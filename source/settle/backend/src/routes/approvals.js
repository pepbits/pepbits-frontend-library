import { Router } from 'express';
import { db, tx } from '../db.js';
import { can, requireRight } from '../lib/auth.js';
import { lifecycle, mustGetBill, recalcBill } from '../lib/billing.js';
import { asyncRoute, audit, bad, conflict, notFound, nowIso, parseJson } from '../lib/util.js';
import { cancelBillNow, closeBill } from './bills.js';

const router = Router();
const RIGHT = { discount: 'approve_discount', writeoff: 'approve_writeoff', cancellation: 'approve_cancellation' };

router.get('/approvals', asyncRoute((req, res) => {
  const { status = 'pending', kind = '' } = req.query;
  const rows = db.prepare(`SELECT a.*, b.mr_no, b.bill_type, b.is_tpa, b.status AS bill_status, b.patient_amount, b.patient_due, b.total_amount,
      b.total_discount, p.name AS patient_name, v.department, v.doctor
    FROM approvals a JOIN bills b ON b.bill_no = a.bill_no JOIN patients p ON p.mr_no = b.mr_no JOIN visits v ON v.visit_id = b.visit_id
    WHERE (@status = 'all' OR a.status = @status) AND (@kind = '' OR a.kind = @kind)
    ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.requested_at DESC LIMIT 300`).all({ status, kind })
    .map((a) => ({ ...a, payload: parseJson(a.payload, {}), canDecide: can(req.user, RIGHT[a.kind]) }));
  const counts = db.prepare("SELECT kind, COUNT(*) AS n, SUM(amount) AS amount FROM approvals WHERE status = 'pending' GROUP BY kind").all();
  res.json({ rows, counts });
}));

router.post('/approvals/:id/decide', asyncRoute((req, res) => {
  const a = db.prepare('SELECT * FROM approvals WHERE id = ?').get(req.params.id);
  if (!a) throw notFound('Approval not found');
  if (a.status !== 'pending') throw conflict(`Already ${a.status}.`);
  requireRight(req.user, RIGHT[a.kind]);
  const { decision, note } = req.body;
  if (!['approved', 'rejected'].includes(decision)) throw bad('Choose approve or reject.');
  if (decision === 'rejected' && !note) throw bad('Add a note so the requester knows why.');
  if (a.requested_by === req.user.username && !req.user.isAdmin) throw conflict('You cannot decide on your own request.');
  const bill = mustGetBill(a.bill_no);
  const payload = parseJson(a.payload, {});
  const result = tx(() => {
    db.prepare('UPDATE approvals SET status=?, decided_by=?, decided_at=?, decision_note=? WHERE id=?')
      .run(decision, req.user.username, nowIso(), note || null, a.id);
    let extra = null;
    if (a.kind === 'discount') {
      for (const c of payload.changes || []) {
        if (decision === 'approved') db.prepare("UPDATE charges SET discount_status='approved' WHERE charge_id=?").run(c.chargeId);
        else db.prepare("UPDATE charges SET discount=?, discount_status=CASE WHEN ? > 0 THEN 'approved' ELSE 'none' END, discount_by=CASE WHEN ? > 0 THEN discount_by ELSE NULL END WHERE charge_id=?")
          .run(c.from, c.from, c.from, c.chargeId);
      }
    } else if (a.kind === 'writeoff') {
      db.prepare('UPDATE bills SET patient_writeoff=? WHERE bill_no=?').run(decision === 'approved' ? 'A' : 'N', bill.bill_no);
      if (decision === 'approved') {
        const b = recalcBill(bill.bill_no);
        if (lifecycle(req.user, b).close.allowed) { closeBill(req.user, bill.bill_no); extra = 'Bill closed automatically'; }
      }
    } else if (a.kind === 'cancellation') {
      if (decision === 'approved') cancelBillNow(req.user, bill.bill_no, a.reason);
      else db.prepare("UPDATE bills SET cancellation_status='N' WHERE bill_no=?").run(bill.bill_no);
    }
    audit(req.user, { entity: 'bill', id: bill.bill_no, billNo: bill.bill_no, mrNo: bill.mr_no, action: `${a.kind}_${decision}`,
      summary: `${decision === 'approved' ? 'Approved' : 'Rejected'} ${a.kind === 'writeoff' ? 'write-off' : a.kind}${note ? ` — ${note}` : ''}` });
    recalcBill(bill.bill_no);
    return extra;
  })();
  res.json({ ok: true, note: result });
}));

export default router;
