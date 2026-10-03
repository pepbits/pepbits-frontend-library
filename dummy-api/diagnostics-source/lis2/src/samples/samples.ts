import { Body, Controller, Get, Injectable, Param, Post, Put, Query } from '@nestjs/common';
import { Db, nowIso } from '../db/database.service';
import { CurrentUser, Roles, SessionUser } from '../common/auth';
import { addMinutes, ageText, bad, must, paging, sqlTime } from '../common/util';
import { refreshOrderStatus } from '../orders/orders';
import { OutboundService } from '../integration/outbound.service';

const PRIORITY_RANK: Record<string, number> = { ROUTINE: 0, URGENT: 1, STAT: 2 };
const topPriority = (list: string[]) => list.reduce((a, b) => (PRIORITY_RANK[b] > PRIORITY_RANK[a] ? b : a), 'ROUTINE');

export interface CollectInput { itemIds: number[]; bodySiteId?: number; laterality?: string; attachToSampleId?: number; collectedAt?: string }

@Injectable()
export class SamplesService {
  constructor(private readonly db: Db, private readonly outbound: OutboundService) {}

  event(sampleId: number, event: string, details: any, userId: number | null) {
    this.db.insert('sample_events', { sample_id: sampleId, event, details: typeof details === 'string' ? details : JSON.stringify(details ?? null), user_id: userId });
  }

  /** Patients with billed tests waiting for collection, paginated by patient; items carry a grouping key for tube planning. */
  pendingCollection(q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds = ["i.status = 'BILLED'"];
    const params: any[] = [];
    if (q.q) { conds.push(`(p.mrn LIKE ? OR o.order_no LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ? OR o.external_order_no LIKE ?)`); params.push(...Array(4).fill(`%${q.q}%`)); }
    if (q.priority) { conds.push('i.priority = ?'); params.push(q.priority); }
    if (q.facilityId) { conds.push('o.facility_id = ?'); params.push(q.facilityId); }
    if (q.locationId) { conds.push('e.location_id = ?'); params.push(q.locationId); }
    if (q.from) { conds.push('date(o.created_at) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(o.created_at) <= date(?)'); params.push(q.to); }
    const base = `FROM order_items i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id LEFT JOIN encounters e ON e.id = o.encounter_id WHERE ${conds.join(' AND ')}`;
    const total = this.db.get(`SELECT COUNT(DISTINCT p.id) c ${base}`, ...params).c;
    const pats = this.db.all(`SELECT p.id, p.mrn, p.first_name, p.last_name, p.dob, p.gender, MIN(o.created_at) oldest,
      MAX(CASE i.priority WHEN 'STAT' THEN 2 WHEN 'URGENT' THEN 1 ELSE 0 END) prio ${base}
      GROUP BY p.id ORDER BY prio DESC, oldest LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    const data = pats.map((p) => {
      const items = this.db.all(`SELECT i.id, i.order_id, i.priority, i.body_site_id, o.order_no, o.external_order_no, o.created_at ordered_at, t.code test_code, t.name test_name,
        t.sample_type_id, st.name sample_type, COALESCE(t.container_id, st.container_id) container_id, c.name container, c.cap_color, bs.name body_site,
        t.body_site_required, t.patient_preparation, i.is_outsourced, e.encounter_no, l.name location
        FROM order_items i JOIN orders o ON o.id = i.order_id JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_sample_types st ON st.id = t.sample_type_id
        LEFT JOIN m_containers c ON c.id = COALESCE(t.container_id, st.container_id) LEFT JOIN m_body_sites bs ON bs.id = i.body_site_id
        LEFT JOIN encounters e ON e.id = o.encounter_id LEFT JOIN m_locations l ON l.id = e.location_id
        WHERE o.patient_id = ? AND i.status = 'BILLED' ORDER BY i.id`, p.id);
      items.forEach((it) => (it.group_key = `${it.sample_type_id}-${it.container_id}-${it.body_site_id || 0}`));
      const openSamples = this.db.all(`SELECT s.id, s.sample_no, s.status, s.sample_type_id, st.name sample_type, s.collected_at FROM samples s
        LEFT JOIN m_sample_types st ON st.id = s.sample_type_id WHERE s.patient_id = ? AND s.status IN ('COLLECTED','RECEIVED') AND s.collected_at >= datetime('now','-2 days') ORDER BY s.id DESC`, p.id);
      return { ...p, age: ageText(p.dob), priority: ['ROUTINE', 'URGENT', 'STAT'][p.prio], items, openSamples };
    });
    return { data, total, page, pageSize };
  }

  /**
   * Collects items into samples. Items sharing sample type, container and body site go into ONE tube,
   * even when they belong to different orders of the same patient.
   */
  collect(input: CollectInput, userId: number | null) {
    const ids = [...new Set((input.itemIds || []).map(Number))];
    if (!ids.length) bad('Select the tests to collect');
    const items = this.db.all(`SELECT i.*, o.patient_id, o.facility_id, t.name test_name, t.sample_type_id, COALESCE(t.container_id, st.container_id) container_id, t.body_site_required
      FROM order_items i JOIN orders o ON o.id = i.order_id JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_sample_types st ON st.id = t.sample_type_id
      WHERE i.id IN (${ids.map(() => '?').join(',')})`, ...ids);
    if (items.length !== ids.length) bad('Some tests were not found');
    const patients = new Set(items.map((i) => i.patient_id));
    if (patients.size > 1) bad('All tests in one collection must belong to the same patient');
    for (const it of items) {
      if (it.status !== 'BILLED') bad(`${it.test_name} is ${it.status} – only billed tests can be collected`);
      if (input.bodySiteId && !it.body_site_id) it.body_site_id = Number(input.bodySiteId);
      if (it.body_site_required && !it.body_site_id) bad(`${it.test_name} needs a body site before collection`);
    }
    const at = input.collectedAt ? sqlTime(new Date(input.collectedAt)) : nowIso();

    return this.db.tx(() => {
      const touched = new Set<number>();
      const created: number[] = [];
      if (input.attachToSampleId) {
        const s = must(this.db.get('SELECT * FROM samples WHERE id = ?', Number(input.attachToSampleId)), 'Sample');
        if (s.patient_id !== items[0].patient_id) bad('That sample belongs to another patient');
        if (!['COLLECTED', 'RECEIVED'].includes(s.status)) bad(`Sample ${s.sample_no} is ${s.status}`);
        for (const it of items) {
          if (it.sample_type_id !== s.sample_type_id) bad(`${it.test_name} needs a different sample type than ${s.sample_no}`);
          this.linkItem(it, s, userId);
          touched.add(it.order_id);
        }
        this.event(s.id, 'ITEMS_ATTACHED', { items: items.map((i) => i.id) }, userId);
        if (s.status === 'RECEIVED') this.outbound.dispatchSample(s.id);
        touched.forEach((o) => refreshOrderStatus(this.db, o));
        return { samples: [this.get(s.id)] };
      }
      const groups = new Map<string, any[]>();
      for (const it of items) {
        const key = `${it.sample_type_id}-${it.container_id}-${it.body_site_id || 0}`;
        groups.set(key, [...(groups.get(key) || []), it]);
      }
      for (const group of groups.values()) {
        const first = group[0];
        const sid = this.db.insert('samples', {
          sample_no: this.db.nextNo('S', 7), patient_id: first.patient_id, sample_type_id: first.sample_type_id, container_id: first.container_id,
          body_site_id: first.body_site_id, laterality: input.laterality, facility_id: first.facility_id, status: 'COLLECTED',
          priority: topPriority(group.map((g) => g.priority)), collected_at: at, collected_by: userId,
        });
        const s = this.db.get('SELECT * FROM samples WHERE id = ?', sid);
        for (const it of group) { this.linkItem(it, s, userId); touched.add(it.order_id); }
        this.event(sid, 'COLLECTED', { items: group.map((g) => g.id), orders: [...new Set(group.map((g) => g.order_id))] }, userId);
        created.push(sid);
      }
      touched.forEach((o) => refreshOrderStatus(this.db, o));
      this.db.audit(userId, 'COLLECT', 'samples', null, { samples: created });
      return { samples: created.map((id) => this.get(id)) };
    });
  }

  private linkItem(it: any, s: any, userId: number | null) {
    const received = s.status === 'RECEIVED';
    const status = received ? (it.is_outsourced ? 'OUTSOURCE_PENDING' : 'RECEIVED') : 'COLLECTED';
    this.db.run('UPDATE order_items SET sample_id = ?, status = ?, body_site_id = COALESCE(body_site_id, ?), received_at = ?, due_at = ? WHERE id = ?',
      s.id, status, it.body_site_id ?? null, received ? nowIso() : null, received ? this.dueAt(it, new Date()) : null, it.id);
    void userId;
  }

  private dueAt(item: any, from: Date) {
    const t = this.db.get('SELECT tat_routine_min, tat_urgent_min, tat_stat_min FROM m_tests WHERE id = ?', item.test_id);
    const mins = item.priority === 'STAT' ? t.tat_stat_min : item.priority === 'URGENT' ? t.tat_urgent_min : t.tat_routine_min;
    return sqlTime(addMinutes(from, Number(mins) || 240));
  }

  /** Accession: scan our sample number or the client's specimen barcode. */
  receive(barcode: string, userId: number, storage?: string) {
    const code = String(barcode || '').trim();
    if (!code) bad('Scan or type a sample number');
    const matches = this.db.all("SELECT * FROM samples WHERE sample_no = ? OR external_sample_no = ? ORDER BY CASE status WHEN 'COLLECTED' THEN 0 ELSE 1 END, id DESC", code, code);
    const s = matches[0];
    if (!s) bad(`No sample found for ${code}`);
    if (s.status === 'RECEIVED') return { alreadyReceived: true, sample: this.get(s.id) };
    if (s.status === 'REJECTED') bad(`Sample ${s.sample_no} was rejected – recollect`);
    const now = new Date();
    this.db.tx(() => {
      this.db.update('samples', s.id, { status: 'RECEIVED', received_at: sqlTime(now), received_by: userId, storage_location: storage || s.storage_location });
      const items = this.db.all("SELECT * FROM order_items WHERE sample_id = ? AND status = 'COLLECTED'", s.id);
      for (const it of items) {
        this.db.update('order_items', it.id, { status: it.is_outsourced ? 'OUTSOURCE_PENDING' : 'RECEIVED', received_at: sqlTime(now), due_at: this.dueAt(it, now) });
      }
      new Set(items.map((i) => i.order_id)).forEach((o) => refreshOrderStatus(this.db, o));
      this.event(s.id, 'RECEIVED', { storage }, userId);
      const n = this.outbound.dispatchSample(s.id);
      if (n) this.event(s.id, 'SENT_TO_ANALYZER', { analyzers: n }, null);
    });
    return { alreadyReceived: false, sample: this.get(s.id) };
  }

  reject(sampleId: number, reasonId: number, note: string, userId: number) {
    const s = must(this.db.get('SELECT * FROM samples WHERE id = ?', sampleId), 'Sample');
    if (!reasonId) bad('Choose a rejection reason');
    if (s.status === 'REJECTED') bad('Sample is already rejected');
    const resulted = this.db.get("SELECT COUNT(*) c FROM order_items WHERE sample_id = ? AND status IN ('RESULTED','VALIDATED','SIGNED','AMENDING')", sampleId).c;
    if (resulted) bad('Results already exist on this sample – reject is not allowed; cancel individual tests instead');
    this.db.tx(() => {
      this.outbound.cancelSample(sampleId);
      this.db.update('samples', sampleId, { status: 'REJECTED', rejection_reason_id: reasonId, rejection_note: note });
      const orders = this.db.all("SELECT DISTINCT order_id FROM order_items WHERE sample_id = ? AND status <> 'CANCELLED'", sampleId).map((r) => r.order_id);
      const itemsSql = 'SELECT id FROM order_items WHERE sample_id = ?';
      this.db.run(`DELETE FROM result_history WHERE result_id IN (SELECT id FROM results WHERE order_item_id IN (${itemsSql}))`, sampleId);
      this.db.run(`DELETE FROM critical_notifications WHERE order_item_id IN (${itemsSql})`, sampleId);
      this.db.run(`DELETE FROM results WHERE order_item_id IN (${itemsSql})`, sampleId);
      this.db.run("UPDATE order_items SET status = 'BILLED', sample_id = NULL, received_at = NULL, due_at = NULL WHERE sample_id = ? AND status <> 'CANCELLED'", sampleId);
      orders.forEach((o) => refreshOrderStatus(this.db, o));
      const reason = this.db.get('SELECT name FROM m_rejection_reasons WHERE id = ?', reasonId)?.name;
      this.event(sampleId, 'REJECTED', { reason, note }, userId);
      this.db.audit(userId, 'REJECT', 'samples', sampleId, { reason, note });
    });
    return this.get(sampleId);
  }

  list(q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.status) { conds.push('s.status = ?'); params.push(q.status); }
    if (q.priority) { conds.push('s.priority = ?'); params.push(q.priority); }
    if (q.sampleTypeId) { conds.push('s.sample_type_id = ?'); params.push(q.sampleTypeId); }
    if (q.facilityId) { conds.push('s.facility_id = ?'); params.push(q.facilityId); }
    if (q.patientId) { conds.push('s.patient_id = ?'); params.push(q.patientId); }
    if (q.q) { conds.push(`(s.sample_no LIKE ? OR s.external_sample_no LIKE ? OR p.mrn LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ?)`); params.push(...Array(4).fill(`%${q.q}%`)); }
    if (q.from) { conds.push('date(COALESCE(s.collected_at, s.created_at)) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(COALESCE(s.collected_at, s.created_at)) <= date(?)'); params.push(q.to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const base = `FROM samples s JOIN patients p ON p.id = s.patient_id ${where}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base}`, ...params).c;
    const data = this.db.all(`SELECT s.*, p.mrn, p.first_name, p.last_name, p.gender, p.dob, st.name sample_type, c.name container, c.cap_color, f.code facility, rr.name rejection_reason,
      (SELECT GROUP_CONCAT(t.code, ', ') FROM order_items i JOIN m_tests t ON t.id = i.test_id WHERE i.sample_id = s.id AND i.status <> 'CANCELLED') tests,
      (SELECT GROUP_CONCAT(DISTINCT o.order_no) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.sample_id = s.id) orders
      FROM samples s JOIN patients p ON p.id = s.patient_id LEFT JOIN m_sample_types st ON st.id = s.sample_type_id LEFT JOIN m_containers c ON c.id = s.container_id
      LEFT JOIN m_facilities f ON f.id = s.facility_id LEFT JOIN m_rejection_reasons rr ON rr.id = s.rejection_reason_id ${where}
      ORDER BY s.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  get(id: number) {
    const s = must(this.db.get(`SELECT s.*, p.mrn, p.first_name, p.last_name, p.dob, p.gender, st.name sample_type, st.storage_temp, c.name container, c.cap_color,
      bs.name body_site, f.name facility, rr.name rejection_reason, cu.full_name collected_by_name, ru.full_name received_by_name
      FROM samples s JOIN patients p ON p.id = s.patient_id LEFT JOIN m_sample_types st ON st.id = s.sample_type_id LEFT JOIN m_containers c ON c.id = s.container_id
      LEFT JOIN m_body_sites bs ON bs.id = s.body_site_id LEFT JOIN m_facilities f ON f.id = s.facility_id LEFT JOIN m_rejection_reasons rr ON rr.id = s.rejection_reason_id
      LEFT JOIN users cu ON cu.id = s.collected_by LEFT JOIN users ru ON ru.id = s.received_by WHERE s.id = ?`, id), 'Sample');
    s.age = ageText(s.dob);
    s.items = this.db.all(`SELECT i.id, i.status, i.priority, i.due_at, i.is_outsourced, i.is_critical, i.is_abnormal, o.order_no, o.id order_id, t.code test_code, t.name test_name, d.name department
      FROM order_items i JOIN orders o ON o.id = i.order_id JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_departments d ON d.id = t.department_id WHERE i.sample_id = ? ORDER BY i.id`, id);
    s.events = this.db.all('SELECT e.*, u.full_name user FROM sample_events e LEFT JOIN users u ON u.id = e.user_id WHERE sample_id = ? ORDER BY e.id', id);
    s.instrumentOrders = this.db.all(`SELECT io.*, a.code analyzer, a.name analyzer_name, t.code test_code FROM instrument_orders io JOIN m_analyzers a ON a.id = io.analyzer_id
      JOIN order_items i ON i.id = io.order_item_id JOIN m_tests t ON t.id = i.test_id WHERE io.sample_id = ? ORDER BY io.id`, id);
    return s;
  }

  label(id: number) {
    const s = this.get(id);
    return {
      sample_no: s.sample_no, external_sample_no: s.external_sample_no, patient: `${s.last_name ? s.last_name.toUpperCase() + ', ' : ''}${s.first_name}`,
      mrn: s.mrn, age: s.age, gender: s.gender, dob: s.dob, sample_type: s.sample_type, container: s.container, cap_color: s.cap_color, priority: s.priority,
      collected_at: s.collected_at, tests: s.items.filter((i: any) => i.status !== 'CANCELLED').map((i: any) => i.test_code), lab: this.db.setting('lab.name'),
    };
  }

  setStorage(id: number, location: string, userId: number) {
    must(this.db.get('SELECT id FROM samples WHERE id = ?', id), 'Sample');
    this.db.update('samples', id, { storage_location: location });
    this.event(id, 'STORED', { location }, userId);
    return this.get(id);
  }

  /* ─────────── Outsourcing ─────────── */

  outsourcePending(q: any) {
    const conds = ["i.status = 'OUTSOURCE_PENDING'"];
    const params: any[] = [];
    if (q.labId) { conds.push('i.outsource_lab_id = ?'); params.push(q.labId); }
    if (q.q) { conds.push(`(s.sample_no LIKE ? OR p.mrn LIKE ? OR o.order_no LIKE ?)`); params.push(...Array(3).fill(`%${q.q}%`)); }
    return this.db.all(`SELECT i.id, i.priority, i.due_at, i.outsource_lab_id, ol.name outsource_lab, t.code test_code, t.name test_name, s.sample_no, s.id sample_id, s.received_at,
      st.name sample_type, st.storage_temp, o.order_no, p.mrn, p.first_name, p.last_name
      FROM order_items i JOIN m_tests t ON t.id = i.test_id JOIN samples s ON s.id = i.sample_id LEFT JOIN m_sample_types st ON st.id = s.sample_type_id
      JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id LEFT JOIN m_outsource_labs ol ON ol.id = i.outsource_lab_id
      WHERE ${conds.join(' AND ')} ORDER BY i.outsource_lab_id, CASE i.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END, i.id`, ...params);
  }

  createShipment(b: { labId: number; itemIds: number[]; courier?: string; trackingNo?: string; notes?: string }, userId: number) {
    const lab = must(this.db.get('SELECT * FROM m_outsource_labs WHERE id = ? AND active = 1', Number(b.labId)), 'Reference lab');
    const ids = (b.itemIds || []).map(Number);
    if (!ids.length) bad('Select tests to ship');
    const items = this.db.all(`SELECT * FROM order_items WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
    for (const it of items) if (it.status !== 'OUTSOURCE_PENDING') bad(`Item ${it.id} is not waiting for outsourcing`);
    const id = this.db.tx(() => {
      const sid = this.db.insert('outsource_shipments', { manifest_no: this.db.nextNo('MAN', 6), outsource_lab_id: lab.id, status: 'DISPATCHED', courier: b.courier, tracking_no: b.trackingNo, notes: b.notes, dispatched_at: nowIso(), created_by: userId });
      for (const it of items) {
        this.db.update('order_items', it.id, { status: 'OUTSOURCED', shipment_id: sid, outsource_lab_id: lab.id });
        this.event(it.sample_id, 'OUTSOURCED', { lab: lab.name, item: it.id }, userId);
        refreshOrderStatus(this.db, it.order_id);
      }
      this.outbound.queueReferral(sid);
      this.db.audit(userId, 'SHIP', 'outsource_shipments', sid, { items: ids });
      return sid;
    });
    return this.shipment(id);
  }

  shipments(q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.status) { conds.push('s.status = ?'); params.push(q.status); }
    if (q.labId) { conds.push('s.outsource_lab_id = ?'); params.push(q.labId); }
    if (q.q) { conds.push('(s.manifest_no LIKE ? OR s.tracking_no LIKE ?)'); params.push(`%${q.q}%`, `%${q.q}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = this.db.get(`SELECT COUNT(*) c FROM outsource_shipments s ${where}`, ...params).c;
    const data = this.db.all(`SELECT s.*, l.name lab, u.full_name created_by_name,
      (SELECT COUNT(*) FROM order_items WHERE shipment_id = s.id) items,
      (SELECT COUNT(*) FROM order_items WHERE shipment_id = s.id AND status IN ('RESULTED','VALIDATED','SIGNED')) resulted
      FROM outsource_shipments s JOIN m_outsource_labs l ON l.id = s.outsource_lab_id LEFT JOIN users u ON u.id = s.created_by ${where} ORDER BY s.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  shipment(id: number) {
    const s = must(this.db.get('SELECT s.*, l.name lab, l.address lab_address, l.phone lab_phone FROM outsource_shipments s JOIN m_outsource_labs l ON l.id = s.outsource_lab_id WHERE s.id = ?', id), 'Shipment');
    s.items = this.db.all(`SELECT i.id, i.status, i.priority, t.code test_code, t.name test_name, sm.sample_no, st.name sample_type, o.order_no, p.mrn, p.first_name, p.last_name, p.dob, p.gender
      FROM order_items i JOIN m_tests t ON t.id = i.test_id JOIN samples sm ON sm.id = i.sample_id LEFT JOIN m_sample_types st ON st.id = sm.sample_type_id
      JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id WHERE i.shipment_id = ? ORDER BY i.id`, id);
    s.messages = this.db.all("SELECT id, status, message_type, created_at, error FROM interface_messages WHERE ref_type = 'SHIPMENT' AND ref_id = ? ORDER BY id", id);
    return s;
  }

  updateShipment(id: number, b: { status: string; trackingNo?: string; notes?: string }, userId: number) {
    const allowed = ['DISPATCHED', 'IN_TRANSIT', 'RECEIVED_BY_LAB', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(b.status)) bad(`Status must be one of ${allowed.join(', ')}`);
    must(this.db.get('SELECT id FROM outsource_shipments WHERE id = ?', id), 'Shipment');
    this.db.update('outsource_shipments', id, { status: b.status, tracking_no: b.trackingNo, notes: b.notes });
    this.db.audit(userId, 'SHIPMENT_STATUS', 'outsource_shipments', id, b);
    return this.shipment(id);
  }
}

@Controller('samples')
export class SamplesController {
  constructor(private readonly svc: SamplesService) {}

  @Get('pending-collection')
  pending(@Query() q: any) { return this.svc.pendingCollection(q); }

  @Post('collect')
  @Roles('PHLEBOTOMIST', 'FRONT_DESK', 'TECHNOLOGIST')
  collect(@Body() b: CollectInput, @CurrentUser() u: SessionUser) { return this.svc.collect(b, u.id); }

  @Post('receive')
  @Roles('TECHNOLOGIST', 'PHLEBOTOMIST', 'PATHOLOGIST')
  receive(@Body() b: { barcode: string; storage?: string }, @CurrentUser() u: SessionUser) { return this.svc.receive(b.barcode, u.id, b.storage); }

  @Get()
  list(@Query() q: any) { return this.svc.list(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.get(Number(id)); }

  @Get(':id/label')
  label(@Param('id') id: string) { return this.svc.label(Number(id)); }

  @Post(':id/reject')
  @Roles('TECHNOLOGIST', 'PATHOLOGIST')
  reject(@Param('id') id: string, @Body() b: { reasonId: number; note?: string }, @CurrentUser() u: SessionUser) {
    return this.svc.reject(Number(id), Number(b.reasonId), b.note || '', u.id);
  }

  @Put(':id/storage')
  storage(@Param('id') id: string, @Body() b: { location: string }, @CurrentUser() u: SessionUser) { return this.svc.setStorage(Number(id), b.location, u.id); }
}

@Controller('outsource')
export class OutsourceController {
  constructor(private readonly svc: SamplesService) {}

  @Get('pending')
  pending(@Query() q: any) { return this.svc.outsourcePending(q); }

  @Get('shipments')
  shipments(@Query() q: any) { return this.svc.shipments(q); }

  @Get('shipments/:id')
  shipment(@Param('id') id: string) { return this.svc.shipment(Number(id)); }

  @Post('shipments')
  @Roles('TECHNOLOGIST', 'PATHOLOGIST')
  create(@Body() b: any, @CurrentUser() u: SessionUser) { return this.svc.createShipment(b, u.id); }

  @Put('shipments/:id')
  @Roles('TECHNOLOGIST', 'PATHOLOGIST')
  update(@Param('id') id: string, @Body() b: any, @CurrentUser() u: SessionUser) { return this.svc.updateShipment(Number(id), b, u.id); }
}
