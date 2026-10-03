import { Body, Controller, Get, Headers, Injectable, Logger, OnModuleDestroy, OnModuleInit, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as net from 'net';
import { Db, nowIso } from '../db/database.service';
import { Public, Roles } from '../common/auth';
import { bad, must, paging } from '../common/util';
import { InboundProtocol, InboundService } from './inbound.service';
import { OutboundService } from './outbound.service';
import { sendMLLP, startAstmServer, startMllpServer } from './transport';

const keyOf = (req: Request, header?: string) => header || (req.query.apiKey as string) || (req.query.api_key as string) || null;
const remoteOf = (req: Request) => `${req.ip || req.socket.remoteAddress || ''}`;

/** TCP listeners: HL7 over MLLP and ASTM E1381. */
@Injectable()
export class IntegrationServers implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Integration');
  private servers: net.Server[] = [];
  constructor(private readonly inbound: InboundService) {}

  onModuleInit() {
    if (process.env.DIAGNOSTICS_EMBEDDED === "1") return;
    const mllp = Number(process.env.MLLP_PORT || 2575);
    const astm = Number(process.env.ASTM_PORT || 2576);
    if (mllp > 0) this.servers.push(startMllpServer(mllp, async (raw, remote) => this.inbound.handle('HL7V2', raw, { transport: 'TCP_MLLP', remote }).body));
    if (astm > 0) {
      this.servers.push(startAstmServer(astm, async (raw, remote) => {
        const reply = this.inbound.handle('ASTM', raw, { transport: 'TCP_ASTM', remote });
        return reply.ok && reply.body.startsWith('H|') ? reply.body : null;
      }));
    }
  }
  onModuleDestroy() {
    this.servers.forEach((s) => s.close());
    this.log.log('TCP listeners closed');
  }
}

/**
 * Public, API-key protected endpoints for external systems:
 *  - inbound messages (orders / results / queries) over HTTPS
 *  - worklist polling for middleware that cannot receive pushes
 *  - result pull + acknowledgement for client hospitals (PULL delivery)
 */
@Controller('integration')
export class IntegrationPublicController {
  constructor(private readonly db: Db, private readonly inbound: InboundService) {}

  private send(res: Response, protocol: InboundProtocol, req: Request, apiKey: string | null) {
    const raw = typeof req.body === 'string' ? req.body : protocol === 'FHIR_R4' || protocol === 'JSON' ? JSON.stringify(req.body ?? {}) : String(req.body ?? '');
    if (!raw || raw === '{}') return res.status(400).json({ error: 'Empty message body' });
    const r = this.inbound.handle(protocol, raw, { transport: 'HTTPS', remote: remoteOf(req), apiKey });
    res.status(r.httpStatus).setHeader('x-message-id', String(r.messageId));
    return res.type(r.contentType).send(r.body);
  }

  @Public() @Post('inbound/hl7')
  hl7(@Req() req: Request, @Res() res: Response, @Headers('x-api-key') key?: string) { return this.send(res, 'HL7V2', req, keyOf(req, key)); }

  @Public() @Post('inbound/astm')
  astm(@Req() req: Request, @Res() res: Response, @Headers('x-api-key') key?: string) { return this.send(res, 'ASTM', req, keyOf(req, key)); }

  @Public() @Post('inbound/fhir')
  fhir(@Req() req: Request, @Res() res: Response, @Headers('x-api-key') key?: string) { return this.send(res, 'FHIR_R4', req, keyOf(req, key)); }

  @Public() @Post('inbound/json')
  json(@Req() req: Request, @Res() res: Response, @Headers('x-api-key') key?: string) { return this.send(res, 'JSON', req, keyOf(req, key)); }

  private source(req: Request, key?: string) {
    const s = this.inbound.sourceFromKey(keyOf(req, key));
    if (!s) throw new UnauthorizedException('Valid x-api-key required');
    return s;
  }

  /** Middleware polls its queued work orders (for interfaces in PULL mode). */
  @Public() @Get('worklist')
  worklist(@Req() req: Request, @Query('limit') limit?: string, @Headers('x-api-key') key?: string) {
    const s = this.source(req, key);
    if (!s.iface) bad('This key is not bound to an interface');
    const rows = this.db.all(`SELECT id, message_type, control_id, protocol, raw, created_at FROM interface_messages
      WHERE interface_id = ? AND direction = 'OUT' AND status = 'QUEUED' ORDER BY id LIMIT ?`, s.iface.id, Math.min(200, Number(limit) || 50));
    return { interface: s.iface.code, count: rows.length, messages: rows };
  }

  @Public() @Post('worklist/ack')
  worklistAck(@Req() req: Request, @Body() b: { ids: number[] }, @Headers('x-api-key') key?: string) {
    const s = this.source(req, key);
    const ids = (b?.ids || []).map(Number).filter(Boolean);
    if (!ids.length) bad('ids[] required');
    const inList = ids.map(() => '?').join(',');
    const n = this.db.run(`UPDATE interface_messages SET status = 'SENT', processed_at = ? WHERE interface_id = ? AND direction = 'OUT' AND status = 'QUEUED' AND id IN (${inList})`, nowIso(), s.iface?.id, ...ids).changes;
    this.db.run(`UPDATE instrument_orders SET status = 'SENT', sent_at = ? WHERE status = 'QUEUED' AND message_id IN (${inList})`, nowIso(), ...ids);
    return { acknowledged: n };
  }

  /** Host query over HTTPS: returns the work order for a specimen in the interface protocol. */
  @Public() @Get('query')
  query(@Req() req: Request, @Res() res: Response, @Query('specimen') specimen: string, @Headers('x-api-key') key?: string) {
    const s = this.source(req, key);
    const protocol = s.iface?.protocol === 'ASTM' ? 'ASTM' : 'HL7V2';
    const found = this.inbound.workOrderFor(String(specimen || ''), s, protocol);
    if (!found) return res.status(404).json({ error: `No pending tests for specimen ${specimen}` });
    return res.type('text/plain').send(found.raw);
  }

  /** PULL delivery: client fetches results published for it (FINAL, CORRECTED, ADDENDUM), then acknowledges them. */
  @Public() @Get('results')
  results(@Req() req: Request, @Query() q: any, @Headers('x-api-key') key?: string) {
    const s = this.source(req, key);
    const conds = ["p.mode = 'PULL'"];
    const params: any[] = [];
    if (s.facility) { conds.push('p.facility_id = ?'); params.push(s.facility.id); }
    else { conds.push('p.facility_id IS NULL AND p.interface_id = ?'); params.push(s.iface.id); }
    if (q.includeAcked === '1') conds.push("p.status IN ('AVAILABLE','ACKED')"); else conds.push("p.status = 'AVAILABLE'");
    if (q.since) { conds.push('p.created_at >= ?'); params.push(String(q.since).replace('T', ' ').slice(0, 19)); }
    if (q.orderNo) { conds.push('(o.external_order_no = ? OR o.order_no = ?)'); params.push(q.orderNo, q.orderNo); }
    const rows = this.db.all(`SELECT p.id, p.event, p.report_version, p.format, p.payload, p.status, p.created_at, o.order_no, o.external_order_no, i.external_line_no
      FROM result_publications p JOIN orders o ON o.id = p.order_id JOIN order_items i ON i.id = p.order_item_id WHERE ${conds.join(' AND ')} ORDER BY p.id LIMIT ?`,
      ...params, Math.min(200, Number(q.limit) || 50));
    const ids = rows.map((r) => r.id);
    if (ids.length) this.db.run(`UPDATE result_publications SET attempts = attempts + 1, delivered_at = COALESCE(delivered_at, ?) WHERE id IN (${ids.map(() => '?').join(',')})`, nowIso(), ...ids);
    return {
      count: rows.length,
      results: rows.map((r) => ({
        publicationId: r.id, event: r.event, reportVersion: r.report_version, format: r.format, orderNo: r.order_no, externalOrderNo: r.external_order_no,
        externalLineNo: r.external_line_no, createdAt: r.created_at, status: r.status,
        payload: r.format === 'HL7V2' ? r.payload : JSON.parse(r.payload),
      })),
    };
  }

  @Public() @Post('results/ack')
  resultsAck(@Req() req: Request, @Body() b: { ids: number[] }, @Headers('x-api-key') key?: string) {
    const s = this.source(req, key);
    const ids = (b?.ids || []).map(Number).filter(Boolean);
    if (!ids.length) bad('ids[] required');
    const scope = s.facility ? 'facility_id = ?' : 'facility_id IS NULL AND interface_id = ?';
    const n = this.db.run(`UPDATE result_publications SET status = 'ACKED', acked_at = ? WHERE mode = 'PULL' AND status = 'AVAILABLE' AND ${scope} AND id IN (${ids.map(() => '?').join(',')})`,
      nowIso(), s.facility ? s.facility.id : s.iface.id, ...ids).changes;
    return { acknowledged: n };
  }
}

/** Authenticated monitoring & operations for the integration engine. */
@Controller('integration')
export class IntegrationAdminController {
  constructor(private readonly db: Db, private readonly inbound: InboundService, private readonly outbound: OutboundService) {}

  @Get('messages')
  messages(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    for (const [k, col] of [['direction', 'm.direction'], ['status', 'm.status'], ['protocol', 'm.protocol'], ['interfaceId', 'm.interface_id'], ['facilityId', 'm.facility_id'], ['refType', 'm.ref_type'], ['refId', 'm.ref_id']]) {
      if (q[k]) { conds.push(`${col} = ?`); params.push(q[k]); }
    }
    if (q.q) { conds.push('(m.raw LIKE ? OR m.control_id LIKE ? OR m.error LIKE ? OR m.message_type LIKE ?)'); params.push(...Array(4).fill(`%${q.q}%`)); }
    if (q.from) { conds.push('date(m.created_at) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(m.created_at) <= date(?)'); params.push(q.to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = this.db.get(`SELECT COUNT(*) c FROM interface_messages m ${where}`, ...params).c;
    const data = this.db.all(`SELECT m.id, m.direction, m.protocol, m.message_type, m.control_id, m.transport, m.remote, m.status, m.error, m.ref_type, m.ref_id, m.created_at, m.processed_at,
      substr(m.raw, 1, 160) preview, i.code interface, f.code facility FROM interface_messages m LEFT JOIN m_interfaces i ON i.id = m.interface_id LEFT JOIN m_facilities f ON f.id = m.facility_id
      ${where} ORDER BY m.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    const stats = this.db.all("SELECT direction, status, COUNT(*) c FROM interface_messages WHERE created_at >= datetime('now','-1 day') GROUP BY direction, status");
    return { data, total, page, pageSize, stats };
  }

  @Get('messages/:id')
  message(@Param('id') id: string) {
    return must(this.db.get(`SELECT m.*, i.code interface, i.name interface_name, f.code facility FROM interface_messages m LEFT JOIN m_interfaces i ON i.id = m.interface_id
      LEFT JOIN m_facilities f ON f.id = m.facility_id WHERE m.id = ?`, Number(id)), 'Message');
  }

  @Post('messages/:id/reprocess')
  @Roles('ADMIN', 'TECHNOLOGIST', 'INTEGRATION')
  reprocess(@Param('id') id: string) {
    const m = must(this.db.get('SELECT * FROM interface_messages WHERE id = ?', Number(id)), 'Message');
    if (m.direction === 'OUT') {
      this.db.update('interface_messages', m.id, { status: 'QUEUED', error: null });
      return this.message(id);
    }
    const r = this.inbound.reprocess(m.id);
    return { ...this.message(id), reply: r.body };
  }

  @Get('publications')
  publications(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    for (const [k, col] of [['status', 'p.status'], ['mode', 'p.mode'], ['event', 'p.event'], ['facilityId', 'p.facility_id'], ['interfaceId', 'p.interface_id'], ['format', 'p.format']]) {
      if (q[k]) { conds.push(`${col} = ?`); params.push(q[k]); }
    }
    if (q.q) { conds.push('(o.order_no LIKE ? OR o.external_order_no LIKE ? OR pt.mrn LIKE ?)'); params.push(...Array(3).fill(`%${q.q}%`)); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const base = `FROM result_publications p JOIN orders o ON o.id = p.order_id JOIN patients pt ON pt.id = o.patient_id JOIN order_items i ON i.id = p.order_item_id
      JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_facilities f ON f.id = p.facility_id LEFT JOIN m_interfaces itf ON itf.id = p.interface_id ${where}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base}`, ...params).c;
    const data = this.db.all(`SELECT p.id, p.order_item_id, p.event, p.report_version, p.format, p.mode, p.status, p.attempts, p.next_attempt_at, p.last_error, p.created_at, p.delivered_at, p.acked_at,
      o.order_no, o.external_order_no, pt.mrn, pt.first_name, pt.last_name, t.code test_code, f.code facility, itf.code interface ${base} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    const stats = this.db.all('SELECT mode, status, COUNT(*) c FROM result_publications GROUP BY mode, status');
    return { data, total, page, pageSize, stats };
  }

  @Get('publications/:id')
  publication(@Param('id') id: string) {
    return must(this.db.get('SELECT p.*, f.code facility, i.code interface FROM result_publications p LEFT JOIN m_facilities f ON f.id = p.facility_id LEFT JOIN m_interfaces i ON i.id = p.interface_id WHERE p.id = ?', Number(id)), 'Publication');
  }

  @Post('publications/:id/retry')
  @Roles('ADMIN', 'TECHNOLOGIST', 'INTEGRATION')
  async retry(@Param('id') id: string) {
    const p = must(this.db.get('SELECT * FROM result_publications WHERE id = ?', Number(id)), 'Publication');
    if (p.mode !== 'PUSH') bad('Only PUSH publications can be retried – PULL items wait for the client');
    this.outbound.retryPublication(p.id);
    await this.outbound.tick();
    return this.publication(id);
  }

  @Get('instrument-orders')
  instrumentOrders(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.status) { conds.push('io.status = ?'); params.push(q.status); }
    if (q.analyzerId) { conds.push('io.analyzer_id = ?'); params.push(q.analyzerId); }
    if (q.q) { conds.push('(s.sample_no LIKE ? OR p.mrn LIKE ?)'); params.push(`%${q.q}%`, `%${q.q}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const base = `FROM instrument_orders io JOIN samples s ON s.id = io.sample_id JOIN patients p ON p.id = s.patient_id JOIN m_analyzers a ON a.id = io.analyzer_id
      JOIN order_items i ON i.id = io.order_item_id JOIN m_tests t ON t.id = i.test_id ${where}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base}`, ...params).c;
    const data = this.db.all(`SELECT io.*, s.sample_no, p.mrn, p.first_name, p.last_name, a.code analyzer, a.name analyzer_name, t.code test_code, i.status item_status,
      (SELECT m.code FROM m_middleware m WHERE m.id = a.middleware_id) middleware ${base} ORDER BY io.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    const stats = this.db.all('SELECT status, COUNT(*) c FROM instrument_orders GROUP BY status');
    return { data, total, page, pageSize, stats };
  }

  @Post('samples/:sampleId/resend')
  @Roles('ADMIN', 'TECHNOLOGIST', 'INTEGRATION')
  resend(@Param('sampleId') sampleId: string) {
    const n = this.outbound.dispatchSample(Number(sampleId), true);
    return { analyzers: n };
  }

  /** Connection details shown in the integration console. */
  @Get('endpoints')
  @Roles('ADMIN', 'INTEGRATION', 'TECHNOLOGIST', 'PATHOLOGIST')
  endpoints() {
    return {
      mllpPort: Number(process.env.MLLP_PORT || 2575), astmPort: Number(process.env.ASTM_PORT || 2576), dispatchIntervalMs: Number(process.env.DISPATCH_INTERVAL_MS || 10000),
      http: {
        hl7: 'POST /api/integration/inbound/hl7', astm: 'POST /api/integration/inbound/astm', fhir: 'POST /api/integration/inbound/fhir', json: 'POST /api/integration/inbound/json',
        worklist: 'GET /api/integration/worklist', worklistAck: 'POST /api/integration/worklist/ack', query: 'GET /api/integration/query?specimen=',
        results: 'GET /api/integration/results', resultsAck: 'POST /api/integration/results/ack',
      },
      facilities: this.db.all('SELECT f.id, f.code, f.name, f.api_key, f.result_delivery, f.result_format, i.code interface, i.protocol FROM m_facilities f LEFT JOIN m_interfaces i ON i.id = f.interface_id WHERE f.active = 1'),
      interfaces: this.db.all('SELECT id, code, name, category, protocol, transport, direction, delivery_mode, sending_app, sending_facility, auth_secret, host, port, endpoint_url, active FROM m_interfaces ORDER BY category, code'),
      analyzers: this.db.all(`SELECT a.id, a.code, a.name, a.instrument_id, a.protocol, a.query_mode, m.code middleware, COALESCE(i.code, mi.code) interface FROM m_analyzers a
        LEFT JOIN m_middleware m ON m.id = a.middleware_id LEFT JOIN m_interfaces i ON i.id = a.interface_id LEFT JOIN m_interfaces mi ON mi.id = m.interface_id WHERE a.active = 1`),
    };
  }

  /** Sends a real HL7 message over TCP/MLLP (e.g. to this LIS's own listener or a remote system) and returns the ACK. */
  @Post('console/mllp')
  @Roles('ADMIN', 'INTEGRATION')
  async mllp(@Body() b: { host?: string; port?: number; message: string }) {
    if (!b.message?.trim()) bad('Message is required');
    const msg = b.message.replace(/\r?\n/g, '\r');
    const ack = await sendMLLP(b.host || '127.0.0.1', Number(b.port) || Number(process.env.MLLP_PORT || 2575), msg).catch((e) => bad(`MLLP send failed: ${e.message}`));
    return { ack };
  }
}
