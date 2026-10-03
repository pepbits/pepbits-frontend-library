import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Db, nowIso } from '../db/database.service';
import { CurrentUser, Roles, SessionUser } from '../common/auth';
import { ageText, bad, must, paging } from '../common/util';
import { ResultEntry, ResultsService } from './results.service';

const PRIO_SQL = "CASE i.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END";
const ENTRY_STATUSES = ['RECEIVED', 'OUTSOURCED', 'IN_PROCESS', 'RESULTED', 'AMENDING', 'VALIDATED'];

@Controller('results')
export class ResultsController {
  constructor(private readonly db: Db, private readonly svc: ResultsService) {}

  private itemFilters(q: any, conds: string[], params: any[]) {
    if (q.departmentId) { conds.push('t.department_id = ?'); params.push(q.departmentId); }
    if (q.subDepartmentId) { conds.push('t.sub_department_id = ?'); params.push(q.subDepartmentId); }
    if (q.priority) { conds.push('i.priority = ?'); params.push(q.priority); }
    if (q.facilityId) { conds.push('o.facility_id = ?'); params.push(q.facilityId); }
    if (q.testId) { conds.push('i.test_id = ?'); params.push(q.testId); }
    if (q.q) {
      conds.push(`(s.sample_no LIKE ? OR s.external_sample_no LIKE ? OR o.order_no LIKE ? OR p.mrn LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ?)`);
      params.push(...Array(5).fill(`%${q.q}%`));
    }
    if (q.from) { conds.push('date(COALESCE(i.received_at, o.created_at)) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(COALESCE(i.received_at, o.created_at)) <= date(?)'); params.push(q.to); }
    if (q.overdue === '1') conds.push("i.due_at < datetime('now')");
    if (q.flag === 'critical') conds.push('i.is_critical = 1');
    if (q.flag === 'abnormal') conds.push('i.is_abnormal = 1');
  }

  /** Bench worklist grouped by sample. */
  @Get('worklist')
  worklist(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const statuses = q.status ? String(q.status).split(',') : ENTRY_STATUSES.filter((s) => s !== 'VALIDATED');
    const conds = [`i.status IN (${statuses.map(() => '?').join(',')})`, 'i.sample_id IS NOT NULL'];
    const params: any[] = [...statuses];
    this.itemFilters(q, conds, params);
    const base = `FROM order_items i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id JOIN samples s ON s.id = i.sample_id
      JOIN m_tests t ON t.id = i.test_id WHERE ${conds.join(' AND ')}`;
    const total = this.db.get(`SELECT COUNT(DISTINCT i.sample_id) c ${base}`, ...params).c;
    const rows = this.db.all(`SELECT s.id sample_id, s.sample_no, s.external_sample_no, s.received_at, p.id patient_id, p.mrn, p.first_name, p.last_name, p.dob, p.gender,
      MIN(${PRIO_SQL}) prio, MIN(i.due_at) due_at, MAX(i.is_critical) critical, MAX(i.is_abnormal) abnormal, MAX(i.has_delta) delta
      ${base} GROUP BY s.id ORDER BY prio, (MIN(i.due_at) IS NULL), MIN(i.due_at), s.id LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    const data = rows.map((r) => {
      const items = this.db.all(`SELECT i.id, i.status, i.priority, i.due_at, i.is_critical, i.is_abnormal, i.has_delta, i.sent_back_reason, t.code test_code, t.name test_name, d.code department,
        (SELECT COUNT(*) FROM results WHERE order_item_id = i.id AND value IS NOT NULL) entered, (SELECT COUNT(*) FROM m_test_parameters WHERE test_id = i.test_id) params,
        (SELECT GROUP_CONCAT(a.code) FROM instrument_orders io JOIN m_analyzers a ON a.id = io.analyzer_id WHERE io.order_item_id = i.id AND io.status <> 'CANCELLED') analyzers
        FROM order_items i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id JOIN samples s ON s.id = i.sample_id JOIN m_tests t ON t.id = i.test_id
        LEFT JOIN m_departments d ON d.id = t.department_id WHERE i.sample_id = ? AND ${conds.join(' AND ')} ORDER BY t.sort_order`, r.sample_id, ...params);
      return { ...r, age: ageText(r.dob), priority: ['STAT', 'URGENT', 'ROUTINE'][r.prio], items };
    });
    const counts = this.db.get(`SELECT COUNT(DISTINCT CASE WHEN i.status IN ('RECEIVED','OUTSOURCED') THEN i.id END) pending,
      COUNT(DISTINCT CASE WHEN i.status = 'IN_PROCESS' THEN i.id END) in_process, COUNT(DISTINCT CASE WHEN i.status = 'RESULTED' THEN i.id END) resulted,
      COUNT(DISTINCT CASE WHEN i.status = 'AMENDING' THEN i.id END) amending, COUNT(DISTINCT CASE WHEN i.due_at < datetime('now') THEN i.id END) overdue
      FROM order_items i WHERE i.status IN ('RECEIVED','OUTSOURCED','IN_PROCESS','RESULTED','AMENDING')`);
    return { data, total, page, pageSize, counts };
  }

  /** Everything the result entry screen needs for one sample. */
  @Get('sample/:sampleId')
  sampleEntry(@Param('sampleId') sampleId: string, @Query() q: any) {
    const s = must(this.db.get(`SELECT s.*, st.name sample_type, c.name container, c.cap_color, bs.name body_site, p.id patient_id, p.mrn, p.first_name, p.last_name, p.dob, p.gender,
      p.ethnicity_id, p.pregnant, e.name ethnicity, f.name facility FROM samples s JOIN patients p ON p.id = s.patient_id LEFT JOIN m_sample_types st ON st.id = s.sample_type_id
      LEFT JOIN m_containers c ON c.id = s.container_id LEFT JOIN m_body_sites bs ON bs.id = s.body_site_id LEFT JOIN m_ethnicities e ON e.id = p.ethnicity_id
      LEFT JOIN m_facilities f ON f.id = s.facility_id WHERE s.id = ?`, Number(sampleId)), 'Sample');
    s.age = ageText(s.dob);
    const conds = ['i.sample_id = ?', "i.status <> 'CANCELLED'"];
    const params: any[] = [s.id];
    if (q.departmentId) { conds.push('t.department_id = ?'); params.push(q.departmentId); }
    const items = this.db.all(`SELECT i.*, t.code test_code, t.name test_name, t.test_type, t.method_id, m.name method, d.id department_id, d.name department, sd.name sub_department,
      o.order_no, o.clinical_info, o.diagnosis, o.priority order_priority, doc.name doctor, vu.full_name validated_by_name, su.full_name signed_by_name
      FROM order_items i JOIN m_tests t ON t.id = i.test_id JOIN orders o ON o.id = i.order_id LEFT JOIN m_methodologies m ON m.id = t.method_id
      LEFT JOIN m_departments d ON d.id = t.department_id LEFT JOIN m_sub_departments sd ON sd.id = t.sub_department_id LEFT JOIN m_doctors doc ON doc.id = o.doctor_id
      LEFT JOIN users vu ON vu.id = i.validated_by LEFT JOIN users su ON su.id = i.signed_by WHERE ${conds.join(' AND ')} ORDER BY d.sort_order, t.sort_order, i.id`, ...params);
    const patient = { dob: s.dob, gender: s.gender, ethnicity_id: s.ethnicity_id, pregnant: s.pregnant };
    for (const it of items) {
      it.parameters = this.db.all(`SELECT p.*, tp.sort_order, tp.section_title, tp.mandatory, u.name unit, l.loinc_num, r.id result_id, r.value, r.flag, r.is_critical, r.delta_flag,
        r.prev_value, r.prev_at, r.source, r.comment, r.raw_value, r.entered_at, r.updated_at, a.code analyzer, eu.full_name entered_by_name,
        (SELECT COUNT(*) FROM result_history h WHERE h.result_id = r.id) history_count
        FROM m_test_parameters tp JOIN m_parameters p ON p.id = tp.parameter_id LEFT JOIN m_units u ON u.id = p.unit_id LEFT JOIN m_loinc l ON l.id = p.loinc_id
        LEFT JOIN results r ON r.parameter_id = p.id AND r.order_item_id = ? LEFT JOIN m_analyzers a ON a.id = r.analyzer_id LEFT JOIN users eu ON eu.id = r.entered_by
        WHERE tp.test_id = ? ORDER BY tp.sort_order, p.id`, it.id, it.test_id);
      for (const p of it.parameters) {
        const range = this.svc.rangeFor(p.id, patient, p.method_id ?? it.method_id);
        p.range = range ? { low: range.low, high: range.high, critical_low: range.critical_low, critical_high: range.critical_high, absurd_low: range.absurd_low, absurd_high: range.absurd_high, normal_text: range.normal_text, text: this.svc.rangeText(range) } : null;
        p.options = p.result_type === 'OPTION' ? this.db.all('SELECT code, value, is_abnormal FROM m_parameter_options WHERE parameter_id = ? ORDER BY sort_order, id', p.id) : [];
        if (!p.prev_value) {
          const prev = this.db.get(`SELECT r.value, r.flag, i.signed_at FROM results r JOIN order_items i ON i.id = r.order_item_id JOIN orders o ON o.id = i.order_id
            WHERE o.patient_id = ? AND r.parameter_id = ? AND i.id <> ? AND i.status = 'SIGNED' ORDER BY i.signed_at DESC LIMIT 1`, s.patient_id, p.id, it.id);
          if (prev) { p.prev_value = prev.value; p.prev_flag = prev.flag; p.prev_at = prev.signed_at; }
        }
      }
      it.criticals = this.db.all("SELECT c.*, p.name parameter FROM critical_notifications c LEFT JOIN results r ON r.id = c.result_id LEFT JOIN m_parameters p ON p.id = r.parameter_id WHERE c.order_item_id = ? ORDER BY c.id DESC", it.id);
    }
    const depts = [...new Set(items.map((i) => i.department_id))];
    const comments = this.db.all(`SELECT id, code, text, department_id FROM m_comment_templates WHERE department_id IS NULL ${depts.length ? `OR department_id IN (${depts.map(() => '?').join(',')})` : ''} ORDER BY code`, ...depts);
    return { sample: s, items, comments };
  }

  @Post('item/:itemId')
  @Roles('TECHNOLOGIST', 'PATHOLOGIST')
  save(@Param('itemId') itemId: string, @Body() b: { entries: ResultEntry[]; interpretation?: string | null; reason?: string }, @CurrentUser() u: SessionUser) {
    const it = must(this.db.get('SELECT is_outsourced FROM order_items WHERE id = ?', Number(itemId)), 'Order item');
    return this.svc.save(Number(itemId), b.entries || [], it.is_outsourced ? 'OUTSOURCE' : 'MANUAL', u.id, { interpretation: b.interpretation, reason: b.reason });
  }

  @Post('validate')
  @Roles('TECHNOLOGIST', 'PATHOLOGIST')
  validate(@Body() b: { itemIds: number[] }, @CurrentUser() u: SessionUser) {
    return this.svc.validate((b.itemIds || []).map(Number), u.id);
  }

  @Post('send-back')
  @Roles('PATHOLOGIST')
  sendBack(@Body() b: { itemId: number; reason: string }, @CurrentUser() u: SessionUser) {
    this.svc.sendBack(Number(b.itemId), b.reason, u.id);
    return { ok: true };
  }

  /** Doctor's signing console: validated reports, critical first, then abnormal, delta, STAT and oldest due. */
  @Get('signing-queue')
  signingQueue(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds = ["i.status = 'VALIDATED'"];
    const params: any[] = [];
    this.itemFilters(q, conds, params);
    const base = `FROM order_items i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id LEFT JOIN samples s ON s.id = i.sample_id JOIN m_tests t ON t.id = i.test_id`;
    const counts = this.db.get(`SELECT COUNT(*) total, SUM(i.is_critical) critical, SUM(CASE WHEN i.is_critical = 0 AND i.is_abnormal = 1 THEN 1 ELSE 0 END) abnormal,
      SUM(CASE WHEN i.is_critical = 0 AND i.is_abnormal = 0 THEN 1 ELSE 0 END) normal, SUM(i.has_delta) delta, SUM(CASE WHEN i.report_version > 0 THEN 1 ELSE 0 END) amended
      ${base} WHERE ${conds.join(' AND ')}`, ...params);
    if (q.category === 'critical') conds.push('i.is_critical = 1');
    else if (q.category === 'abnormal') conds.push('i.is_critical = 0 AND i.is_abnormal = 1');
    else if (q.category === 'normal') conds.push('i.is_critical = 0 AND i.is_abnormal = 0');
    else if (q.category === 'delta') conds.push('i.has_delta = 1');
    else if (q.category === 'amended') conds.push('i.report_version > 0');
    const where = `WHERE ${conds.join(' AND ')}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base} ${where}`, ...params).c;
    const data = this.db.all(`SELECT i.id, i.status, i.priority, i.due_at, i.is_critical, i.is_abnormal, i.has_delta, i.interpretation, i.report_version, i.amend_reason, i.validated_at,
      t.code test_code, t.name test_name, d.name department, o.order_no, o.clinical_info, o.diagnosis, p.id patient_id, p.mrn, p.first_name, p.last_name, p.dob, p.gender,
      s.sample_no, s.id sample_id, s.collected_at, vu.full_name validated_by_name, f.code facility,
      (SELECT COUNT(*) FROM critical_notifications c WHERE c.order_item_id = i.id AND c.status = 'PENDING') critical_pending
      ${base} LEFT JOIN m_departments d ON d.id = t.department_id LEFT JOIN users vu ON vu.id = i.validated_by LEFT JOIN m_facilities f ON f.id = o.facility_id
      ${where} ORDER BY i.is_critical DESC, i.is_abnormal DESC, i.has_delta DESC, ${PRIO_SQL}, i.due_at, i.id LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    for (const r of data) {
      r.age = ageText(r.dob);
      r.results = this.db.all(`SELECT r.id, p.code, p.name, p.result_type, r.value, r.unit, r.flag, r.is_critical, r.delta_flag, r.prev_value, r.prev_at, r.ref_text, r.comment, r.source, tp.section_title
        FROM results r JOIN m_parameters p ON p.id = r.parameter_id LEFT JOIN m_test_parameters tp ON tp.parameter_id = p.id AND tp.test_id = (SELECT test_id FROM order_items WHERE id = ?)
        WHERE r.order_item_id = ? ORDER BY tp.sort_order`, r.id, r.id);
    }
    return { data, total, page, pageSize, counts: Object.fromEntries(Object.entries(counts || {}).map(([k, v]) => [k, Number(v) || 0])) };
  }

  @Post('sign')
  @Roles('PATHOLOGIST')
  sign(@Body() b: { itemIds: number[] }, @CurrentUser() u: SessionUser) {
    const ids = (b.itemIds || []).map(Number);
    if (!ids.length) bad('Nothing selected to sign');
    return this.svc.sign(ids, u.id);
  }

  @Post('item/:itemId/amend')
  @Roles('PATHOLOGIST')
  amend(@Param('itemId') itemId: string, @Body() b: { reason: string }, @CurrentUser() u: SessionUser) {
    return this.svc.amend(Number(itemId), b.reason, u.id);
  }

  @Post('item/:itemId/addendum')
  @Roles('PATHOLOGIST')
  addendum(@Param('itemId') itemId: string, @Body() b: { text: string }, @CurrentUser() u: SessionUser) {
    return this.svc.addendum(Number(itemId), b.text, u.id);
  }

  @Get('item/:itemId')
  item(@Param('itemId') itemId: string) {
    const id = Number(itemId);
    const it = must(this.db.get(`SELECT i.*, t.code test_code, t.name test_name, o.order_no, o.id order_id, p.id patient_id, p.mrn, p.first_name, p.last_name, p.dob, p.gender,
      s.sample_no, su.full_name signed_by_name, vu.full_name validated_by_name FROM order_items i JOIN m_tests t ON t.id = i.test_id JOIN orders o ON o.id = i.order_id
      JOIN patients p ON p.id = o.patient_id LEFT JOIN samples s ON s.id = i.sample_id LEFT JOIN users su ON su.id = i.signed_by LEFT JOIN users vu ON vu.id = i.validated_by WHERE i.id = ?`, id), 'Order item');
    it.age = ageText(it.dob);
    it.results = this.db.all(`SELECT r.*, p.code, p.name, a.code analyzer FROM results r JOIN m_parameters p ON p.id = r.parameter_id LEFT JOIN m_analyzers a ON a.id = r.analyzer_id
      LEFT JOIN m_test_parameters tp ON tp.parameter_id = p.id AND tp.test_id = ? WHERE r.order_item_id = ? ORDER BY tp.sort_order`, it.test_id, id);
    it.history = this.db.all(`SELECT h.*, p.name parameter, u.full_name changed_by_name FROM result_history h JOIN results r ON r.id = h.result_id JOIN m_parameters p ON p.id = r.parameter_id
      LEFT JOIN users u ON u.id = h.changed_by WHERE r.order_item_id = ? ORDER BY h.id DESC`, id);
    it.versions = this.db.all('SELECT v.*, u.full_name signed_by_name FROM report_versions v LEFT JOIN users u ON u.id = v.signed_by WHERE order_item_id = ? ORDER BY version DESC', id);
    it.publications = this.db.all(`SELECT pb.id, pb.event, pb.report_version, pb.format, pb.mode, pb.status, pb.attempts, pb.created_at, pb.delivered_at, pb.acked_at, pb.last_error,
      f.code facility, itf.code interface FROM result_publications pb LEFT JOIN m_facilities f ON f.id = pb.facility_id LEFT JOIN m_interfaces itf ON itf.id = pb.interface_id WHERE order_item_id = ? ORDER BY pb.id DESC`, id);
    it.audit = this.db.all("SELECT a.*, u.full_name user FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE entity = 'order_items' AND entity_id = ? ORDER BY a.id DESC", id);
    return it;
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private readonly db: Db) {}

  @Get()
  search(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const statuses = q.status ? String(q.status).split(',') : ['SIGNED', 'AMENDING'];
    const conds = [`i.status IN (${statuses.map(() => '?').join(',')})`];
    const params: any[] = [...statuses];
    if (q.q) { conds.push(`(o.order_no LIKE ? OR o.external_order_no LIKE ? OR s.sample_no LIKE ? OR p.mrn LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ?)`); params.push(...Array(5).fill(`%${q.q}%`)); }
    if (q.departmentId) { conds.push('t.department_id = ?'); params.push(q.departmentId); }
    if (q.facilityId) { conds.push('o.facility_id = ?'); params.push(q.facilityId); }
    if (q.patientId) { conds.push('o.patient_id = ?'); params.push(q.patientId); }
    if (q.from) { conds.push('date(i.signed_at) >= date(?)'); params.push(q.from); }
    if (q.to) { conds.push('date(i.signed_at) <= date(?)'); params.push(q.to); }
    if (q.versioned === '1') conds.push('i.report_version > 1');
    if (q.flag === 'critical') conds.push('i.is_critical = 1');
    if (q.flag === 'abnormal') conds.push('i.is_abnormal = 1');
    const base = `FROM order_items i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id LEFT JOIN samples s ON s.id = i.sample_id JOIN m_tests t ON t.id = i.test_id WHERE ${conds.join(' AND ')}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base}`, ...params).c;
    const data = this.db.all(`SELECT i.id, i.status, i.signed_at, i.report_version, i.is_critical, i.is_abnormal, i.amend_reason, t.code test_code, t.name test_name, o.id order_id, o.order_no, o.external_order_no,
      p.id patient_id, p.mrn, p.first_name, p.last_name, p.gender, p.dob, s.sample_no, u.full_name signed_by_name, f.code facility,
      (SELECT GROUP_CONCAT(kind || ' v' || version, ', ') FROM report_versions v WHERE v.order_item_id = i.id) versions
      ${base.replace('WHERE', 'LEFT JOIN users u ON u.id = i.signed_by LEFT JOIN m_facilities f ON f.id = o.facility_id WHERE')} ORDER BY i.signed_at DESC, i.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    return { data, total, page, pageSize };
  }

  @Get('version/:id')
  version(@Param('id') id: string) {
    const v = must(this.db.get('SELECT v.*, u.full_name signed_by_name FROM report_versions v LEFT JOIN users u ON u.id = v.signed_by WHERE v.id = ?', Number(id)), 'Report version');
    v.snapshot = v.snapshot ? JSON.parse(v.snapshot) : null;
    return v;
  }

  /** Everything needed to render the printable report for an order (signed items by default). */
  @Get('order/:orderId/print')
  print(@Param('orderId') orderId: string, @Query() q: any) {
    const order = must(this.db.get(`SELECT o.*, p.mrn, p.first_name, p.last_name, p.dob, p.gender, p.phone, p.address, e.encounter_no, e.type encounter_type, e.external_encounter_no, e.bed,
      l.name location, d.name doctor, f.name facility FROM orders o JOIN patients p ON p.id = o.patient_id LEFT JOIN encounters e ON e.id = o.encounter_id
      LEFT JOIN m_locations l ON l.id = e.location_id LEFT JOIN m_doctors d ON d.id = o.doctor_id LEFT JOIN m_facilities f ON f.id = o.facility_id WHERE o.id = ?`, Number(orderId)), 'Order');
    order.age = ageText(order.dob);
    const conds = ['i.order_id = ?'];
    const params: any[] = [order.id];
    if (q.itemIds) { const ids = String(q.itemIds).split(',').map(Number); conds.push(`i.id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    else if (q.preview !== '1') conds.push("i.status = 'SIGNED'");
    else conds.push("i.status <> 'CANCELLED'");
    const items = this.db.all(`SELECT i.*, t.code test_code, t.name test_name, t.report_template_id, t.test_type, m.name method, dep.id department_id, dep.name department, dep.sort_order dept_sort,
      sd.name sub_department, s.sample_no, s.external_sample_no, s.collected_at, s.received_at, st.name sample_type, bs.name body_site, su.full_name signed_by_name, su.qualification signed_by_qualification,
      su.signature_text, vu.full_name validated_by_name, lt.loinc_num test_loinc, ol.name outsource_lab
      FROM order_items i JOIN m_tests t ON t.id = i.test_id LEFT JOIN m_methodologies m ON m.id = t.method_id LEFT JOIN m_departments dep ON dep.id = t.department_id
      LEFT JOIN m_sub_departments sd ON sd.id = t.sub_department_id LEFT JOIN samples s ON s.id = i.sample_id LEFT JOIN m_sample_types st ON st.id = s.sample_type_id
      LEFT JOIN m_body_sites bs ON bs.id = COALESCE(i.body_site_id, s.body_site_id) LEFT JOIN users su ON su.id = i.signed_by LEFT JOIN users vu ON vu.id = i.validated_by
      LEFT JOIN m_loinc lt ON lt.id = t.loinc_id LEFT JOIN m_outsource_labs ol ON ol.id = i.outsource_lab_id
      WHERE ${conds.join(' AND ')} ORDER BY dep.sort_order, t.sort_order, i.id`, ...params);
    for (const it of items) {
      it.results = this.db.all(`SELECT r.*, p.code, p.name, p.result_type, tp.section_title, l.loinc_num, pm.name method FROM results r JOIN m_parameters p ON p.id = r.parameter_id
        JOIN m_test_parameters tp ON tp.parameter_id = p.id AND tp.test_id = ? LEFT JOIN m_loinc l ON l.id = p.loinc_id LEFT JOIN m_methodologies pm ON pm.id = p.method_id
        WHERE r.order_item_id = ? AND tp.printable = 1 ORDER BY tp.sort_order`, it.test_id, it.id);
      it.versions = this.db.all('SELECT v.id, v.version, v.kind, v.reason, v.addendum_text, v.signed_at, u.full_name signed_by_name FROM report_versions v LEFT JOIN users u ON u.id = v.signed_by WHERE order_item_id = ? ORDER BY version', it.id);
    }
    const templateId = Number(q.templateId) || items.find((i) => i.report_template_id)?.report_template_id;
    const template = (templateId && this.db.get('SELECT * FROM m_report_templates WHERE id = ?', templateId)) || this.db.get('SELECT * FROM m_report_templates WHERE is_default = 1 AND active = 1')
      || this.db.get('SELECT * FROM m_report_templates ORDER BY id LIMIT 1');
    const settings = Object.fromEntries(this.db.all('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
    return { order, items, template, settings, printedAt: nowIso() };
  }
}

@Controller('critical')
export class CriticalController {
  constructor(private readonly db: Db) {}

  @Get()
  list(@Query() q: any) {
    const { page, pageSize, offset } = paging(q);
    const conds: string[] = [];
    const params: any[] = [];
    if (q.status) { conds.push('c.status = ?'); params.push(q.status); }
    if (q.q) { conds.push(`(p.mrn LIKE ? OR o.order_no LIKE ? OR p.first_name || ' ' || IFNULL(p.last_name,'') LIKE ?)`); params.push(...Array(3).fill(`%${q.q}%`)); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const base = `FROM critical_notifications c JOIN order_items i ON i.id = c.order_item_id JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id
      JOIN m_tests t ON t.id = i.test_id LEFT JOIN results r ON r.id = c.result_id LEFT JOIN m_parameters pa ON pa.id = r.parameter_id ${where}`;
    const total = this.db.get(`SELECT COUNT(*) c ${base}`, ...params).c;
    const data = this.db.all(`SELECT c.*, i.status item_status, t.code test_code, t.name test_name, pa.name parameter, r.value, r.unit, r.flag, r.ref_text, o.order_no, p.mrn, p.first_name, p.last_name, p.phone,
      (SELECT d.name FROM m_doctors d WHERE d.id = o.doctor_id) doctor, (SELECT d.phone FROM m_doctors d WHERE d.id = o.doctor_id) doctor_phone,
      (SELECT l.name FROM encounters e JOIN m_locations l ON l.id = e.location_id WHERE e.id = o.encounter_id) location,
      (SELECT full_name FROM users WHERE id = c.notified_by) notified_by_name, ROUND((julianday(COALESCE(c.notified_at, datetime('now'))) - julianday(c.created_at)) * 1440) minutes_open
      ${base} ORDER BY CASE c.status WHEN 'PENDING' THEN 0 ELSE 1 END, c.id DESC LIMIT ? OFFSET ?`, ...params, pageSize, offset);
    const pending = this.db.get("SELECT COUNT(*) c FROM critical_notifications WHERE status = 'PENDING'").c;
    return { data, total, page, pageSize, pending };
  }

  @Post(':id/notify')
  @Roles('TECHNOLOGIST', 'PATHOLOGIST')
  notify(@Param('id') id: string, @Body() b: { notifiedTo: string; method: string; readBack: boolean; notes?: string }, @CurrentUser() u: SessionUser) {
    const c = must(this.db.get('SELECT * FROM critical_notifications WHERE id = ?', Number(id)), 'Critical notification');
    if (!b.notifiedTo?.trim()) bad('Record who was informed');
    if (!b.readBack) bad('Read-back confirmation is required for critical values');
    this.db.update('critical_notifications', c.id, { status: 'NOTIFIED', notified_to: b.notifiedTo.trim(), method: b.method || 'PHONE', read_back: 1, notes: b.notes, notified_by: u.id, notified_at: nowIso() });
    this.db.audit(u.id, 'CRITICAL_NOTIFIED', 'order_items', c.order_item_id, b);
    return this.db.get('SELECT * FROM critical_notifications WHERE id = ?', c.id);
  }
}
