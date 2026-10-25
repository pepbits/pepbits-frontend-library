import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Db } from '../db/database.service';
import { CurrentUser, Roles, SessionUser } from '../common/auth';
import { ageText, bad, must, paging } from '../common/util';

const OPEN = "('RECEIVED','OUTSOURCE_PENDING','OUTSOURCED','IN_PROCESS','RESULTED','VALIDATED','AMENDING')";

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly db: Db) {}

  @Get()
  summary() {
    const one = (sql: string, ...p: any[]) => Number(this.db.get(sql, ...p)?.c || 0);
    const kpi = {
      ordersToday: one("SELECT COUNT(*) c FROM orders WHERE date(created_at) = date('now')"),
      externalOrdersToday: one("SELECT COUNT(*) c FROM orders WHERE date(created_at) = date('now') AND facility_id IS NOT NULL"),
      awaitingCollection: one("SELECT COUNT(*) c FROM order_items WHERE status = 'BILLED'"),
      inTransit: one("SELECT COUNT(*) c FROM samples WHERE status = 'COLLECTED'"),
      receivedToday: one("SELECT COUNT(*) c FROM samples WHERE date(received_at) = date('now')"),
      pendingResults: one("SELECT COUNT(*) c FROM order_items WHERE status IN ('RECEIVED','IN_PROCESS','OUTSOURCED')"),
      awaitingValidation: one("SELECT COUNT(*) c FROM order_items WHERE status IN ('RESULTED','AMENDING')"),
      awaitingSignature: one("SELECT COUNT(*) c FROM order_items WHERE status = 'VALIDATED'"),
      signedToday: one("SELECT COUNT(*) c FROM order_items WHERE date(signed_at) = date('now')"),
      criticalPending: one("SELECT COUNT(*) c FROM critical_notifications WHERE status = 'PENDING'"),
      tatBreached: one(`SELECT COUNT(*) c FROM order_items WHERE status IN ${OPEN} AND due_at < datetime('now')`),
      tatAtRisk: one(`SELECT COUNT(*) c FROM order_items WHERE status IN ${OPEN} AND due_at >= datetime('now') AND due_at < datetime('now','+30 minutes')`),
      outsourcePending: one("SELECT COUNT(*) c FROM order_items WHERE status = 'OUTSOURCE_PENDING'"),
      interfaceErrors24h: one("SELECT COUNT(*) c FROM interface_messages WHERE status IN ('ERROR','REJECTED','FAILED','NACKED') AND created_at >= datetime('now','-1 day')"),
      failedPublications: one("SELECT COUNT(*) c FROM result_publications WHERE status IN ('FAILED','RETRY')"),
      availableForPull: one("SELECT COUNT(*) c FROM result_publications WHERE status = 'AVAILABLE'"),
      lowReagents: one('SELECT COUNT(*) c FROM m_reagents WHERE active = 1 AND stock_qty <= reorder_level'),
      rejectedToday: one("SELECT COUNT(*) c FROM sample_events WHERE event = 'REJECTED' AND date(at) = date('now')"),
    };
    const tat = this.db.get(`SELECT COUNT(*) total, SUM(CASE WHEN signed_at <= due_at THEN 1 ELSE 0 END) ontime,
      AVG((julianday(signed_at) - julianday(received_at)) * 1440) avg_min FROM order_items WHERE date(signed_at) >= date('now','-6 days') AND due_at IS NOT NULL AND received_at IS NOT NULL`);
    const workload = this.db.all(`SELECT d.id, d.code, d.name, COUNT(i.id) open_items,
      SUM(CASE WHEN i.due_at < datetime('now') THEN 1 ELSE 0 END) overdue, SUM(CASE WHEN i.status = 'VALIDATED' THEN 1 ELSE 0 END) to_sign,
      SUM(CASE WHEN i.status IN ('RECEIVED','IN_PROCESS','OUTSOURCED') THEN 1 ELSE 0 END) to_result
      FROM m_departments d LEFT JOIN m_tests t ON t.department_id = d.id LEFT JOIN order_items i ON i.test_id = t.id AND i.status IN ${OPEN}
      WHERE d.active = 1 GROUP BY d.id ORDER BY d.sort_order`);
    const hourly = this.db.all(`SELECT CAST(strftime('%H', received_at) AS INTEGER) hour, COUNT(*) c FROM samples WHERE date(received_at) = date('now') GROUP BY hour ORDER BY hour`);
    const daily = this.db.all(`SELECT date(created_at) day, COUNT(*) c FROM orders WHERE date(created_at) >= date('now','-13 days') GROUP BY day ORDER BY day`);
    const recentErrors = this.db.all(`SELECT m.id, m.direction, m.protocol, m.message_type, m.error, m.created_at, i.code interface FROM interface_messages m
      LEFT JOIN m_interfaces i ON i.id = m.interface_id WHERE m.status IN ('ERROR','REJECTED','FAILED','NACKED') ORDER BY m.id DESC LIMIT 6`);
    const lowStock = this.db.all('SELECT id, code, name, item_code, stock_qty, reorder_level, uom FROM m_reagents WHERE active = 1 AND stock_qty <= reorder_level ORDER BY stock_qty LIMIT 8');
    return {
      kpi, workload, hourly, daily, recentErrors, lowStock,
      tat: { total: Number(tat?.total || 0), onTime: Number(tat?.ontime || 0), avgMinutes: tat?.avg_min ? Math.round(tat.avg_min) : null },
    };
  }

  /** TAT monitor: open tests with time remaining (negative = breached). */
  @Get('tat')
  tat(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds = [`i.status IN ${OPEN}`, 'i.due_at IS NOT NULL'];
    const params: any[] = [];
    if (q.departmentId) { conds.push('t.department_id = ?'); params.push(q.departmentId); }
    if (q.priority) { conds.push('i.priority = ?'); params.push(q.priority); }
    if (q.status) { conds.push('i.status = ?'); params.push(q.status); }
    if (q.state === 'breached') conds.push("i.due_at < datetime('now')");
    if (q.state === 'risk') conds.push("i.due_at >= datetime('now') AND i.due_at < datetime('now','+30 minutes')");
    if (q.state === 'ok') conds.push("i.due_at >= datetime('now','+30 minutes')");
    if (q.q) { conds.push(`(s.sample_no LIKE ? OR o.order_no LIKE ? OR p.mrn LIKE ?)`); params.push(...Array(3).fill(`%${q.q}%`)); }
    const base = `FROM order_items i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id JOIN m_tests t ON t.id = i.test_id
      LEFT JOIN samples s ON s.id = i.sample_id LEFT JOIN m_departments d ON d.id = t.department_id WHERE ${conds.join(' AND ')}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base}`, ...params).c;
    const data = this.db.all(`SELECT i.id, i.status, i.priority, i.received_at, i.due_at, i.is_critical, t.code test_code, t.name test_name, d.name department,
      s.sample_no, s.id sample_id, o.order_no, p.mrn, p.first_name, p.last_name, p.dob, p.gender,
      ROUND((julianday(i.due_at) - julianday('now')) * 1440) minutes_left,
      ROUND((julianday('now') - julianday(i.received_at)) * 1440) minutes_elapsed
      ${base} ORDER BY i.due_at LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    data.forEach((r) => (r.age = ageText(r.dob)));
    return { data, total, page, pageSize };
  }
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly db: Db) {}

  @Get('reagents')
  reagents(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.q) { conds.push('(r.code LIKE ? OR r.name LIKE ? OR r.item_code LIKE ?)'); params.push(...Array(3).fill(`%${q.q}%`)); }
    if (q.analyzerId) { conds.push('r.analyzer_id = ?'); params.push(q.analyzerId); }
    if (q.low === '1') conds.push('r.stock_qty <= r.reorder_level');
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = this.db.get(`SELECT COUNT(*) c FROM m_reagents r ${where}`, ...params).c;
    const data = this.db.all(`SELECT r.*, a.code analyzer, (SELECT COUNT(*) FROM m_reagent_lots l WHERE l.reagent_id = r.id AND l.status = 'IN_USE') lots,
      (SELECT MIN(expiry_date) FROM m_reagent_lots l WHERE l.reagent_id = r.id AND l.status = 'IN_USE') next_expiry,
      (SELECT IFNULL(-SUM(qty),0) FROM reagent_transactions x WHERE x.reagent_id = r.id AND x.type = 'CONSUMPTION' AND x.at >= datetime('now','-30 days')) used_30d,
      (SELECT GROUP_CONCAT(t.code, ', ') FROM m_reagent_test_mappings m JOIN m_tests t ON t.id = m.test_id WHERE m.reagent_id = r.id) tests
      FROM m_reagents r LEFT JOIN m_analyzers a ON a.id = r.analyzer_id ${where} ORDER BY (r.stock_qty <= r.reorder_level) DESC, r.code LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  @Get('transactions')
  transactions(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.reagentId) { conds.push('x.reagent_id = ?'); params.push(q.reagentId); }
    if (q.type) { conds.push('x.type = ?'); params.push(q.type); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = this.db.get(`SELECT COUNT(*) c FROM reagent_transactions x ${where}`, ...params).c;
    const data = this.db.all(`SELECT x.*, r.code, r.name, r.item_code, u.full_name user, o.order_no FROM reagent_transactions x JOIN m_reagents r ON r.id = x.reagent_id
      LEFT JOIN users u ON u.id = x.user_id LEFT JOIN order_items i ON i.id = x.order_item_id LEFT JOIN orders o ON o.id = i.order_id ${where} ORDER BY x.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  /** Stock receipt (optionally registering a lot), adjustment or wastage. */
  @Post('transactions')
  @Roles('TECHNOLOGIST', 'PATHOLOGIST')
  post(@Body() b: { reagentId: number; qty: number; type: string; note?: string; lotNo?: string; expiryDate?: string }, @CurrentUser() u: SessionUser) {
    const r = must(this.db.get('SELECT * FROM m_reagents WHERE id = ?', Number(b.reagentId)), 'Reagent');
    const qty = Number(b.qty);
    if (!['RECEIPT', 'ADJUSTMENT', 'WASTAGE', 'RETURN'].includes(b.type)) bad('Type must be RECEIPT, ADJUSTMENT, WASTAGE or RETURN');
    if (!qty) bad('Quantity is required');
    const signed = b.type === 'RECEIPT' ? Math.abs(qty) : b.type === 'ADJUSTMENT' ? qty : -Math.abs(qty);
    this.db.tx(() => {
      this.db.run('UPDATE m_reagents SET stock_qty = IFNULL(stock_qty,0) + ? WHERE id = ?', signed, r.id);
      this.db.insert('reagent_transactions', { reagent_id: r.id, qty: signed, type: b.type, note: [b.note, b.lotNo ? `Lot ${b.lotNo}` : ''].filter(Boolean).join(' · ') || null, user_id: u.id });
      if (b.type === 'RECEIPT' && b.lotNo) {
        if (!b.expiryDate) bad('Expiry date is required when registering a lot');
        this.db.run(`INSERT INTO m_reagent_lots(reagent_id, lot_no, expiry_date, qty, received_date, status) VALUES (?,?,?,?,date('now'),'IN_USE')
          ON CONFLICT(reagent_id, lot_no) DO UPDATE SET qty = IFNULL(qty,0) + excluded.qty`, r.id, b.lotNo, b.expiryDate, Math.abs(qty));
      }
      this.db.audit(u.id, 'STOCK_' + b.type, 'm_reagents', r.id, { qty: signed });
    });
    return this.db.get('SELECT * FROM m_reagents WHERE id = ?', r.id);
  }
}

@Controller('audit')
export class AuditController {
  constructor(private readonly db: Db) {}

  @Get()
  @Roles('ADMIN', 'PATHOLOGIST')
  list(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.entity) { conds.push('a.entity = ?'); params.push(q.entity); }
    if (q.entityId) { conds.push('a.entity_id = ?'); params.push(q.entityId); }
    if (q.userId) { conds.push('a.user_id = ?'); params.push(q.userId); }
    if (q.action) { conds.push('a.action = ?'); params.push(q.action); }
    if (q.q) { conds.push('(a.details LIKE ? OR a.action LIKE ?)'); params.push(`%${q.q}%`, `%${q.q}%`); }
    if (q.from) { conds.push('date(a.at) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(a.at) <= date(?)'); params.push(q.to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const total = this.db.get(`SELECT COUNT(*) c FROM audit_log a ${where}`, ...params).c;
    const data = this.db.all(`SELECT a.*, u.full_name user FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ${where} ORDER BY a.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }
}
