import { all } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser } from '@/lib/session';
import { loadOrder, loadReport, tatInfo } from '@/lib/context';
import { transition } from '@/lib/workflow';

export const dynamic = 'force-dynamic';

export function GET(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const o = loadOrder(Number(params.id));
    need(o, 'Order not found', 404);
    const report = loadReport(o.id);
    const invoice = all('SELECT * FROM invoices WHERE order_id = ? ORDER BY id DESC', o.id)[0] || null;
    const payments = invoice ? all('SELECT p.*, u.name AS received_by_name FROM payments p LEFT JOIN users u ON u.id = p.received_by WHERE invoice_id = ? ORDER BY received_at', invoice.id) : [];
    const studies = all('SELECT * FROM studies WHERE order_id = ?', o.id);
    const messages = all('SELECT m.id, m.direction, m.protocol, m.message_type, m.status, m.created_at, i.name AS interface_name FROM messages m LEFT JOIN interfaces i ON i.id = m.interface_id WHERE m.order_id = ? ORDER BY m.id DESC', o.id);
    const critical = all('SELECT * FROM critical_results WHERE order_id = ? ORDER BY id DESC', o.id);
    const history = all("SELECT * FROM audit WHERE entity = 'order' AND entity_id = ? ORDER BY id DESC", String(o.id));
    const priors = all(
      `SELECT o.id, o.accession, o.status, o.ordered_at, o.modality_code, pr.name AS procedure_name,
              (SELECT id FROM studies s WHERE s.order_id = o.id LIMIT 1) AS study_id, r.impression
       FROM orders o JOIN procedures pr ON pr.id = o.procedure_id LEFT JOIN reports r ON r.order_id = o.id
       WHERE o.patient_id = ? AND o.id != ? ORDER BY o.ordered_at DESC LIMIT 20`, o.patient_id, o.id);
    return ok({ ...o, tat: tatInfo(o), report, invoice, payments, studies, messages, critical, history, priors });
  });
}

export function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const { action, ...data } = await req.json();
    transition(Number(params.id), action, data, currentUser());
    return ok(loadOrder(Number(params.id)));
  });
}
