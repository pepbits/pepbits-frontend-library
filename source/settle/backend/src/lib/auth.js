import { db } from '../db.js';
import { forbidden, parseJson } from './util.js';

export const RIGHTS = {
  edit_bill: 'Edit bills',
  addtobill_charges: 'Add charges to a bill',
  cancel_elements_in_bill: 'Cancel charges',
  allow_ratechange: 'Change rates',
  allow_discount: 'Give discounts',
  allow_backdate: 'Backdate finalization',
  allow_refund: 'Issue refunds',
  allow_deposit_setoff: 'Set off deposits',
  bill_reopen: 'Reopen bills',
  cancel_bill: 'Cancel bills',
  patient_writeoff: 'Request write-offs',
  change_billtype: 'Change bill type',
  change_billprimary: 'Change primary bill',
  connect_disconnect_tpa: 'Connect / disconnect insurance',
  edit_receipt: 'Edit and cancel receipts',
  collect_deposit: 'Collect and refund deposits',
  realize_cheques: 'Realize cheques',
  approve_discount: 'Approve discounts',
  approve_writeoff: 'Approve write-offs',
  approve_cancellation: 'Approve cancellations',
  close_counter: 'Close counter',
  view_reports: 'View reports',
  view_audit: 'View audit log',
  settings_admin: 'Manage settings',
};

const getUser = db.prepare(`SELECT u.*, c.name AS counter_name, c.is_system AS counter_is_system
  FROM users u LEFT JOIN counters c ON c.id = u.counter_id WHERE u.id = ?`);

export function loadUser(id) {
  const u = getUser.get(id);
  if (!u) return null;
  return { ...u, rights: parseJson(u.rights, []), isAdmin: u.role === 'admin' };
}

export function authMiddleware(req, _res, next) {
  const id = Number(req.header('x-user-id')) || 1;
  req.user = loadUser(id) || loadUser(1);
  next();
}

export const can = (user, right) => !!user && (user.isAdmin || user.rights.includes(right));

export function requireRight(user, right) {
  if (!can(user, right)) throw forbidden(`You need the “${RIGHTS[right] || right}” right for this.`);
}
