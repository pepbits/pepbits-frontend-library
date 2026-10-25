import { all, get, update } from '@/lib/db';
import { handle, ok, need } from '@/lib/http';
import { currentUser, can } from '@/lib/session';
import { recordPayment } from '@/lib/workflow';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export function GET(_: Request, { params }: { params: { id: string } }) {
  return handle(() => {
    const inv = get(
      `SELECT i.*, o.accession, pr.name AS procedure_name, pr.cpt, p.first_name, p.last_name, p.mrn, p.address, p.insurance
       FROM invoices i JOIN orders o ON o.id = i.order_id JOIN patients p ON p.id = o.patient_id JOIN procedures pr ON pr.id = o.procedure_id WHERE i.id = ?`, Number(params.id));
    need(inv, 'Invoice not found', 404);
    return ok({ ...inv, payments: all('SELECT p.*, u.name AS received_by_name FROM payments p LEFT JOIN users u ON u.id = p.received_by WHERE invoice_id = ?', inv.id) });
  });
}

/** Body: { action: 'pay', amount, mode, reference } | { action: 'discount', discount, payer } */
export function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const b = await req.json();
    const user = currentUser();
    need(can(user, 'bill'), 'Only billing or front-desk staff can change invoices', 403);
    const id = Number(params.id);
    if (b.action === 'pay') recordPayment(id, Number(b.amount), b.mode || 'CASH', b.reference || null, user);
    else if (b.action === 'adjust') {
      const inv = get('SELECT * FROM invoices WHERE id = ?', id);
      need(inv && inv.status !== 'CANCELLED', 'Invoice cannot be adjusted');
      const discount = Math.max(0, Number(b.discount ?? inv.discount));
      need(discount <= inv.amount, 'Discount cannot exceed the charge');
      const net = inv.amount - discount + inv.tax;
      update('invoices', id, { discount, net, payer: b.payer || inv.payer, status: inv.paid >= net ? 'PAID' : inv.paid > 0 ? 'PARTIAL' : 'UNPAID' });
      audit(user, 'INVOICE_ADJUSTED', 'invoice', id, { discount, payer: b.payer });
    } else need(false, 'Unknown billing action');
    return ok({ ok: true });
  });
}
