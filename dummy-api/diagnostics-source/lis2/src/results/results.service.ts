import { Injectable, Logger } from '@nestjs/common';
import { Db, nowIso } from '../db/database.service';
import { ageIn, bad, must } from '../common/util';
import { refreshOrderStatus } from '../orders/orders';
import { OutboundService } from '../integration/outbound.service';

export interface ResultEntry { parameterId: number; value: string | number | null; comment?: string | null; rawValue?: string | null; unit?: string | null }
type Source = 'MANUAL' | 'INSTRUMENT' | 'OUTSOURCE' | 'CALCULATED';

const EDITABLE = ['RECEIVED', 'OUTSOURCED', 'IN_PROCESS', 'RESULTED', 'VALIDATED', 'AMENDING'];

@Injectable()
export class ResultsService {
  private readonly log = new Logger('Results');
  constructor(private readonly db: Db, private readonly outbound: OutboundService) {}

  /* ────────── reference ranges & flags ────────── */

  /** Picks the most specific reference range for a patient; ties broken by narrower age band. */
  rangeFor(parameterId: number, patient: any, methodId?: number | null, at = new Date()) {
    const ranges = this.db.all('SELECT * FROM m_reference_ranges WHERE parameter_id = ?', parameterId);
    let best: any = null;
    let bestScore = -1;
    for (const r of ranges) {
      const age = ageIn(patient.dob, r.age_unit || 'YEARS', at);
      if (age !== null && (age < (r.age_from ?? 0) || age >= (r.age_to ?? 1e9))) continue;
      if (r.gender && r.gender !== 'ANY' && r.gender !== patient.gender) continue;
      if (r.ethnicity_id && r.ethnicity_id !== patient.ethnicity_id) continue;
      if (r.pregnancy === 'YES' && !patient.pregnant) continue;
      if (r.pregnancy === 'NO' && patient.pregnant) continue;
      if (r.method_id && methodId && r.method_id !== methodId) continue;
      const score = (r.gender && r.gender !== 'ANY' ? 8 : 0) + (r.ethnicity_id ? 16 : 0) + (r.pregnancy && r.pregnancy !== 'ANY' ? 4 : 0) + (r.method_id ? 2 : 0)
        + 1 / (1 + ((r.age_to ?? 150) - (r.age_from ?? 0)));
      if (score > bestScore) { best = r; bestScore = score; }
    }
    return best;
  }

  rangeText(r: any): string {
    if (!r) return '';
    if (r.display_text) return r.display_text;
    if (r.normal_text) return r.normal_text;
    if (r.low != null && r.high != null) return `${r.low} - ${r.high}`;
    if (r.low != null) return `> ${r.low}`;
    if (r.high != null) return `< ${r.high}`;
    return '';
  }

  /** Returns flag: N, L, H, LL, HH, A (abnormal non-numeric); plus critical/absurd markers. */
  evaluate(param: any, value: string | null, range: any) {
    const out = { flag: null as string | null, critical: false, numeric: null as number | null, absurd: false };
    if (value === null || value === undefined || value === '') return out;
    if (param.result_type === 'NUMERIC' || param.result_type === 'CALCULATED') {
      const cleaned = String(value).replace(/^[<>]=?\s*/, '');
      const n = Number(cleaned);
      if (Number.isNaN(n)) return out;
      out.numeric = n;
      if (!range) return out;
      if ((range.absurd_low != null && n < range.absurd_low) || (range.absurd_high != null && n > range.absurd_high)) out.absurd = true;
      if (range.critical_low != null && n < range.critical_low) { out.flag = 'LL'; out.critical = true; }
      else if (range.critical_high != null && n > range.critical_high) { out.flag = 'HH'; out.critical = true; }
      else if (range.low != null && n < range.low) out.flag = 'L';
      else if (range.high != null && n > range.high) out.flag = 'H';
      else out.flag = 'N';
      return out;
    }
    if (param.result_type === 'OPTION') {
      const opt = this.db.get('SELECT is_abnormal FROM m_parameter_options WHERE parameter_id = ? AND (value = ? OR code = ?)', param.id, value, value);
      out.flag = opt ? (opt.is_abnormal ? 'A' : 'N') : range?.normal_text ? (String(value).toLowerCase() === range.normal_text.toLowerCase() ? 'N' : 'A') : null;
      return out;
    }
    if (range?.normal_text) out.flag = String(value).trim().toLowerCase() === range.normal_text.toLowerCase() ? 'N' : 'A';
    return out;
  }

  private formatNumber(n: number, decimals: number | null) {
    return decimals === null || decimals === undefined ? String(n) : n.toFixed(decimals);
  }

  private patientOfItem(itemId: number) {
    return must(this.db.get(`SELECT i.*, o.patient_id, o.order_no, o.facility_id, t.name test_name, t.method_id test_method, t.autoverify test_autoverify,
      p.dob, p.gender, p.ethnicity_id, p.pregnant FROM order_items i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id
      JOIN m_tests t ON t.id = i.test_id WHERE i.id = ?`, itemId), 'Order item');
  }

  /* ────────── saving results ────────── */

  save(itemId: number, entries: ResultEntry[], source: Source, userId: number | null, opts: { analyzerId?: number | null; interpretation?: string | null; reason?: string } = {}) {
    const item = this.patientOfItem(itemId);
    if (item.status === 'SIGNED') bad(`${item.test_name} is signed – open an amendment before changing results`);
    if (!EDITABLE.includes(item.status)) bad(`${item.test_name} cannot take results in status ${item.status}`);
    const patient = { dob: item.dob, gender: item.gender, ethnicity_id: item.ethnicity_id, pregnant: item.pregnant };
    const allowed = new Set(this.db.all('SELECT parameter_id FROM m_test_parameters WHERE test_id = ?', item.test_id).map((r) => r.parameter_id));

    this.db.tx(() => {
      let changed = false;
      for (const e of entries) {
        if (!allowed.has(Number(e.parameterId))) bad(`Parameter ${e.parameterId} is not part of ${item.test_name}`);
        changed = this.upsert(item, patient, Number(e.parameterId), e, source, userId, opts.analyzerId ?? null, opts.reason) || changed;
      }
      if (changed) changed = this.computeCalculated(item, patient, userId) || changed;
      if (opts.interpretation !== undefined && opts.interpretation !== item.interpretation) {
        this.db.run('UPDATE order_items SET interpretation = ? WHERE id = ?', opts.interpretation, itemId);
        if (item.status === 'VALIDATED') changed = true;
      }
      if (changed || !['RESULTED', 'VALIDATED'].includes(item.status)) this.refreshItem(itemId, source, userId);
    });
    return this.db.get('SELECT * FROM order_items WHERE id = ?', itemId);
  }

  private upsert(item: any, patient: any, parameterId: number, e: ResultEntry, source: Source, userId: number | null, analyzerId: number | null, reason?: string): boolean {
    const param = must(this.db.get('SELECT p.*, u.name unit_name FROM m_parameters p LEFT JOIN m_units u ON u.id = p.unit_id WHERE p.id = ?', parameterId), 'Parameter');
    let value = e.value === null || e.value === undefined ? null : String(e.value).trim();
    if (value === '') value = null;
    const range = this.rangeFor(parameterId, patient, param.method_id ?? item.test_method);
    const ev = this.evaluate(param, value, range);
    if (ev.numeric !== null && (param.result_type === 'NUMERIC') && !/^[<>]/.test(value || '')) value = this.formatNumber(ev.numeric, param.decimals);
    if (ev.absurd && source === 'MANUAL') bad(`${param.name}: ${value} is outside the physiologically possible range – check the entry`);

    // Delta check vs previous signed result for the same patient/parameter
    const prev = this.db.get(`SELECT r.value, r.numeric_value, i.signed_at FROM results r JOIN order_items i ON i.id = r.order_item_id JOIN orders o ON o.id = i.order_id
      WHERE o.patient_id = ? AND r.parameter_id = ? AND i.id <> ? AND i.status = 'SIGNED' ORDER BY i.signed_at DESC LIMIT 1`, item.patient_id, parameterId, item.id);
    let delta = 0;
    if (prev && ev.numeric !== null && prev.numeric_value && param.delta_percent) {
      const hours = (Date.now() - new Date(prev.signed_at.replace(' ', 'T') + 'Z').getTime()) / 3600000;
      if (hours <= (param.delta_hours || 720) && Math.abs((ev.numeric - prev.numeric_value) / prev.numeric_value) * 100 > param.delta_percent) delta = 1;
    }

    const existing = this.db.get('SELECT * FROM results WHERE order_item_id = ? AND parameter_id = ?', item.id, parameterId);
    const row = {
      value, numeric_value: ev.numeric, unit: e.unit || param.unit_name || null, flag: ev.flag, is_critical: ev.critical ? 1 : 0,
      ref_low: range?.low ?? null, ref_high: range?.high ?? null, ref_text: this.rangeText(range), prev_value: prev?.value ?? null, prev_at: prev?.signed_at ?? null,
      delta_flag: delta, source, analyzer_id: analyzerId, raw_value: e.rawValue ?? null, comment: e.comment ?? existing?.comment ?? null,
    };
    let resultId: number;
    if (existing) {
      if (existing.value === value && existing.comment === row.comment && existing.flag === row.flag) return false;
      this.db.update('results', existing.id, { ...row, entered_by: userId ?? existing.entered_by, updated_at: nowIso() });
      resultId = existing.id;
      if (existing.value !== value) this.db.insert('result_history', { result_id: existing.id, old_value: existing.value, new_value: value, source, reason: reason ?? null, changed_by: userId });
    } else {
      resultId = this.db.insert('results', { order_item_id: item.id, parameter_id: parameterId, ...row, entered_by: userId });
      this.db.insert('result_history', { result_id: resultId, old_value: null, new_value: value, source, changed_by: userId });
    }
    if (ev.critical) {
      const open = this.db.get("SELECT id FROM critical_notifications WHERE result_id = ? AND status = 'PENDING'", resultId);
      if (!open) this.db.insert('critical_notifications', { order_item_id: item.id, result_id: resultId, status: 'PENDING' });
    } else {
      this.db.run("UPDATE critical_notifications SET status = 'CLEARED' WHERE result_id = ? AND status = 'PENDING'", resultId);
    }
    return true;
  }

  /** Evaluates CALCULATED parameters using codes of sibling results, e.g. "CHOL - HDL - TG/5". */
  private computeCalculated(item: any, patient: any, userId: number | null): boolean {
    let changed = false;
    const calcs = this.db.all(`SELECT p.* FROM m_test_parameters tp JOIN m_parameters p ON p.id = tp.parameter_id
      WHERE tp.test_id = ? AND p.result_type = 'CALCULATED' AND p.formula IS NOT NULL`, item.test_id);
    if (!calcs.length) return false;
    const values = new Map<string, number>(this.db.all(`SELECT p.code, r.numeric_value FROM results r JOIN m_parameters p ON p.id = r.parameter_id
      WHERE r.order_item_id = ? AND r.numeric_value IS NOT NULL`, item.id).map((r) => [r.code, r.numeric_value]));
    for (const c of calcs) {
      let missing = false;
      const expr = String(c.formula).replace(/[A-Za-z_][A-Za-z0-9_]*/g, (tok) => {
        if (!values.has(tok)) { missing = true; return '0'; }
        return `(${values.get(tok)})`;
      });
      if (missing || !/^[0-9+\-*/().\s eE]+$/.test(expr)) continue;
      let n: number;
      try { n = Function(`"use strict"; return (${expr});`)(); } catch { continue; }
      if (!Number.isFinite(n)) continue;
      changed = this.upsert(item, patient, c.id, { parameterId: c.id, value: this.formatNumber(n, c.decimals) }, 'CALCULATED', userId, null) || changed;
    }
    return changed;
  }

  /** Re-derives item status and aggregate flags after any result change. */
  refreshItem(itemId: number, source: Source | null, userId: number | null) {
    const item = this.patientOfItem(itemId);
    const params = this.db.all(`SELECT tp.parameter_id, tp.mandatory, p.autoverify, r.value, r.flag, r.is_critical, r.delta_flag
      FROM m_test_parameters tp JOIN m_parameters p ON p.id = tp.parameter_id LEFT JOIN results r ON r.parameter_id = tp.parameter_id AND r.order_item_id = ?
      WHERE tp.test_id = ?`, itemId, item.test_id);
    const complete = params.filter((p) => p.mandatory).every((p) => p.value !== null && p.value !== undefined);
    const any = params.some((p) => p.value !== null && p.value !== undefined);
    const critical = params.some((p) => p.is_critical) ? 1 : 0;
    const abnormal = params.some((p) => p.flag && p.flag !== 'N') ? 1 : 0;
    const delta = params.some((p) => p.delta_flag) ? 1 : 0;
    let status = item.status;
    if (item.status !== 'AMENDING') {
      if (complete) status = 'RESULTED';
      else if (any) status = 'IN_PROCESS';
    }
    this.db.run(`UPDATE order_items SET status = ?, is_critical = ?, is_abnormal = ?, has_delta = ?, resulted_at = CASE WHEN ? THEN COALESCE(resulted_at, ?) ELSE resulted_at END,
      validated_at = CASE WHEN ? = 'RESULTED' THEN NULL ELSE validated_at END WHERE id = ?`, status, critical, abnormal, delta, complete ? 1 : 0, nowIso(), status, itemId);

    // Auto-verification: complete instrument results, all normal, no delta, eligible parameters & test.
    if (status === 'RESULTED' && source === 'INSTRUMENT' && item.test_autoverify && !critical && !abnormal && !delta && params.every((p) => p.autoverify)) {
      this.validate([itemId], null, true);
    }
    refreshOrderStatus(this.db, item.order_id);
  }

  /* ────────── workflow transitions ────────── */

  validate(itemIds: number[], userId: number | null, auto = false) {
    const done: number[] = [];
    this.db.tx(() => {
      for (const id of itemIds) {
        const it = this.db.get('SELECT * FROM order_items WHERE id = ?', id);
        if (!it) continue;
        if (it.status === 'AMENDING') {
          const missing = this.db.get(`SELECT COUNT(*) c FROM m_test_parameters tp LEFT JOIN results r ON r.parameter_id = tp.parameter_id AND r.order_item_id = ?
            WHERE tp.test_id = ? AND tp.mandatory = 1 AND r.value IS NULL`, id, it.test_id).c;
          if (missing) bad('Complete all mandatory results before validating the amendment');
        } else if (it.status !== 'RESULTED') continue;
        this.db.run("UPDATE order_items SET status = 'VALIDATED', validated_at = ?, validated_by = ?, sent_back_reason = NULL WHERE id = ?", nowIso(), userId, id);
        this.consumeReagents(it, userId);
        this.db.audit(userId, auto ? 'AUTOVERIFY' : 'VALIDATE', 'order_items', id);
        refreshOrderStatus(this.db, it.order_id);
        done.push(id);
      }
    });
    return { validated: done };
  }

  private consumeReagents(it: any, userId: number | null) {
    if (it.reagent_consumed) return;
    for (const m of this.db.all('SELECT * FROM m_reagent_test_mappings WHERE test_id = ?', it.test_id)) {
      this.db.run('UPDATE m_reagents SET stock_qty = IFNULL(stock_qty,0) - ? WHERE id = ?', m.qty_per_test, m.reagent_id);
      this.db.insert('reagent_transactions', { reagent_id: m.reagent_id, qty: -m.qty_per_test, type: 'CONSUMPTION', order_item_id: it.id, user_id: userId });
    }
    this.db.run('UPDATE order_items SET reagent_consumed = 1 WHERE id = ?', it.id);
  }

  sendBack(itemId: number, reason: string, userId: number) {
    if (!reason?.trim()) bad('Give a reason so the technologist knows what to recheck');
    const it = must(this.db.get('SELECT * FROM order_items WHERE id = ?', itemId), 'Order item');
    if (it.status !== 'VALIDATED') bad('Only validated results can be sent back');
    this.db.run("UPDATE order_items SET status = ?, sent_back_reason = ?, validated_at = NULL WHERE id = ?", it.report_version > 0 ? 'AMENDING' : 'RESULTED', reason, itemId);
    this.db.audit(userId, 'SEND_BACK', 'order_items', itemId, reason);
  }

  sign(itemIds: number[], userId: number) {
    const signed: number[] = [];
    const skipped: { id: number; reason: string }[] = [];
    for (const id of itemIds) {
      const it = this.db.get('SELECT * FROM order_items WHERE id = ?', id);
      if (!it || it.status !== 'VALIDATED') { skipped.push({ id, reason: `status ${it?.status ?? 'missing'}` }); continue; }
      const pendingCritical = this.db.get("SELECT COUNT(*) c FROM critical_notifications WHERE order_item_id = ? AND status = 'PENDING'", id).c;
      if (pendingCritical) { skipped.push({ id, reason: 'critical value not yet notified' }); continue; }
      const version = (it.report_version || 0) + 1;
      const kind = version === 1 ? 'ORIGINAL' : 'AMENDMENT';
      this.db.tx(() => {
        this.db.insert('report_versions', { order_item_id: id, version, kind, reason: kind === 'AMENDMENT' ? it.amend_reason : null, snapshot: JSON.stringify(this.snapshot(id)), signed_by: userId });
        this.db.run("UPDATE order_items SET status = 'SIGNED', signed_at = ?, signed_by = ?, report_version = ?, amend_reason = CASE WHEN ? = 'ORIGINAL' THEN NULL ELSE amend_reason END WHERE id = ?",
          nowIso(), userId, version, kind, id);
        this.db.audit(userId, kind === 'ORIGINAL' ? 'SIGN' : 'SIGN_AMENDMENT', 'order_items', id, { version });
        refreshOrderStatus(this.db, it.order_id);
        this.outbound.publishReport(id, kind === 'ORIGINAL' ? 'FINAL' : 'CORRECTED', version);
      });
      signed.push(id);
    }
    return { signed, skipped };
  }

  amend(itemId: number, reason: string, userId: number) {
    if (!reason?.trim()) bad('An amendment reason is required');
    const it = must(this.db.get('SELECT * FROM order_items WHERE id = ?', itemId), 'Order item');
    if (it.status !== 'SIGNED') bad('Only signed reports can be amended');
    this.db.run("UPDATE order_items SET status = 'AMENDING', amend_reason = ? WHERE id = ?", reason.trim(), itemId);
    this.db.audit(userId, 'AMEND_OPEN', 'order_items', itemId, reason);
    refreshOrderStatus(this.db, it.order_id);
    return this.db.get('SELECT * FROM order_items WHERE id = ?', itemId);
  }

  addendum(itemId: number, text: string, userId: number) {
    if (!text?.trim()) bad('Addendum text is required');
    const it = must(this.db.get('SELECT * FROM order_items WHERE id = ?', itemId), 'Order item');
    if (it.status !== 'SIGNED') bad('Addenda can only be added to signed reports');
    const version = it.report_version + 1;
    this.db.tx(() => {
      this.db.insert('report_versions', { order_item_id: itemId, version, kind: 'ADDENDUM', addendum_text: text.trim(), snapshot: JSON.stringify(this.snapshot(itemId)), signed_by: userId });
      this.db.run('UPDATE order_items SET report_version = ? WHERE id = ?', version, itemId);
      this.db.audit(userId, 'ADDENDUM', 'order_items', itemId, { version });
      this.outbound.publishReport(itemId, 'ADDENDUM', version);
    });
    return { version };
  }

  snapshot(itemId: number) {
    return {
      interpretation: this.db.get('SELECT interpretation FROM order_items WHERE id = ?', itemId)?.interpretation ?? null,
      results: this.db.all(`SELECT p.code, p.name, r.value, r.unit, r.flag, r.ref_text, r.comment FROM results r JOIN m_parameters p ON p.id = r.parameter_id WHERE r.order_item_id = ?`, itemId),
    };
  }
}
