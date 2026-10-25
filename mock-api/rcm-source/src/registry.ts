/**
 * Workspace registry. Every operational page is declared here: its fields,
 * its status machine, the actions legal from each status, which actions need an
 * independent second person, and the KPIs shown above the page.
 * The frontend renders entirely from GET /api/meta.
 */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'decimal' | 'money' | 'percent' | 'date'
  | 'boolean' | 'select' | 'multiselect' | 'tags' | 'ref' | 'lines';

export type Option = { value: string; label: string; group?: string };
export type Tone = 'info' | 'progress' | 'attention' | 'success' | 'danger' | 'muted';

export interface FieldDef {
  key: string; label: string; type: FieldType;
  required?: boolean; options?: Option[]; source?: string; help?: string;
  list?: boolean; readonly?: boolean; min?: number; max?: number; span?: 1 | 2;
  upper?: boolean; columns?: FieldDef[]; placeholder?: string; maxItems?: number;
}

export interface ActionDef {
  key: string; label: string; from: string[]; to: string; // '*' = decided by the action's effect
  tone: 'primary' | 'approve' | 'danger' | 'attention' | 'quiet';
  independent?: boolean; reason?: 'required' | 'optional'; inputs?: FieldDef[]; hint?: string;
  /** Independent but not a pending request (e.g. reversing a posted journal): kept out of the approvals inbox. */
  optional?: boolean;
}

export interface KpiDef { label: string; metric: 'count' | 'amount' | 'balance'; statuses?: string[]; overdue?: boolean; today?: boolean; tone?: Tone }
export interface StatusDef { key: string; label: string; tone: Tone }

export interface ResourceDef {
  key: string; label: string; singular: string; category: string; icon: string; summary: string;
  layout: 'queue' | 'board' | 'ledger' | 'monitor';
  prefix: string; create: boolean; editable: string[]; initial: string;
  statuses: StatusDef[]; path: string[]; board?: string[];
  fields: FieldDef[]; actions: ActionDef[]; kpis: KpiDef[];
  titleField?: string; document?: boolean; amountLabel?: string; balanceLabel?: string; dueLabel?: string;
}

export interface PageDef { key: string; label: string; icon: string; href: string; kind: 'dashboard' | 'resource'; summary: string }
export interface CategoryDef { key: string; label: string; short: string; icon: string; summary: string; pages: PageDef[] }

/* ------------------------------------------------------------------ */

export function humanize(code: string): string {
  const keep = new Set(['DRG', 'CDI', 'GL', 'EFT', 'ERP', 'SAP', 'IDOC', 'JSON', 'CSV', 'TPA', 'EM', 'E&M', 'P4P', 'AI', 'SMS']);
  return code.split('_').map((w, i) => (keep.has(w) ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase())).join(' ');
}
const o = (...v: string[]): Option[] => v.map((x) => ({ value: x, label: humanize(x) }));
const s = (key: string, tone: Tone, label = humanize(key)): StatusDef => ({ key, label, tone });

type FO = Omit<Partial<FieldDef>, 'key' | 'label' | 'type'>;
const F = (type: FieldType) => (key: string, label: string, opts: FO = {}): FieldDef => ({ key, label, type, ...opts });
const text = F('text'); const area = F('textarea'); const num = F('number'); const dec = F('decimal');
const money = F('money'); const pct = F('percent'); const date = F('date'); const sel = F('select');
const tags = F('tags'); const ref = F('ref'); const lines = F('lines'); const multi = F('multiselect');

export const TENANT = { name: 'Meridian Care Network', environment: 'DEV', timezone: 'Asia/Riyadh', sourceBaseline: 'f75dc3e0d2855578abbd65a3515878b9e159b3fc' };

export const BRANCHES = [
  { value: 'RUH-CENTRAL', label: 'Riyadh Central Hospital', short: 'Riyadh Central', currency: 'SAR' },
  { value: 'JED-DAYSURG', label: 'Jeddah Day Surgery Centre', short: 'Jeddah Day Surgery', currency: 'SAR' },
  { value: 'DXB-DHCC', label: 'Dubai Healthcare City Clinic', short: 'Dubai DHCC', currency: 'AED' },
];

/** Branch codes covered by a scope ('RUH-CENTRAL' or 'ALL:SAR'); defaults to every SAR branch. */
export function scopeBranches(scope?: string): string[] {
  if (scope && BRANCHES.some((b) => b.value === scope)) return [scope];
  const cur = scope?.startsWith('ALL:') ? scope.slice(4) : 'SAR';
  return BRANCHES.filter((b) => b.currency === cur).map((b) => b.value);
}
export const isScope = (s?: string) => !!s && (BRANCHES.some((b) => b.value === s) || BRANCHES.some((b) => `ALL:${b.currency}` === s));
/** Network-level records (no branch, e.g. payer reconciliations, GL, exports) sit in the scope of their currency. */
export const scopeSql = (scope?: string, alias = '') => {
  const list = scopeBranches(scope);
  const cur = BRANCHES.find((b) => b.value === list[0])?.currency ?? 'SAR';
  const network = scope && !scope.startsWith('ALL:') ? '' : ` OR (${alias}branch IS NULL AND ${alias}currency = '${cur}')`;
  return `(${alias}branch IN (${list.map((b) => `'${b}'`).join(',')})${network})`;
};

const branch = () => sel('branch', 'Branch', { options: BRANCHES.map((b) => ({ value: b.value, label: b.short })), required: true });
const patient = (o2: FO = {}) => ref('patient', 'Patient', { source: 'patients', required: true, list: true, ...o2 });
const encounter = (o2: FO = {}) => ref('encounter', 'Encounter', { source: 'res:encounters', ...o2 });
const payer = (o2: FO = {}) => ref('payer', 'Payer', { source: 'payers', ...o2 });
const invoice = (o2: FO = {}) => ref('invoice', 'Invoice', { source: 'res:invoices', required: true, list: true, ...o2 });
const amount = (label: string, o2: FO = {}) => money('amount', label, { required: true, ...o2 });
const reasonTags = { CREDIT: o('PRICE_ERROR', 'SERVICE_NOT_RENDERED', 'GOODWILL', 'DUPLICATE_CHARGE') };

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

const R: ResourceDef[] = [
  /* ===== Front office ===== */
  {
    key: 'coverages', label: 'Patient and encounter coverage', singular: 'coverage', category: 'front', icon: 'IdCard', layout: 'queue',
    summary: 'Verify each patient’s insurance before services are billed. Unverified coverage cannot be used for claims.',
    prefix: 'COV', create: true, editable: ['PENDING_VERIFICATION', 'REJECTED'], initial: 'PENDING_VERIFICATION', titleField: 'payer',
    statuses: [s('PENDING_VERIFICATION', 'attention', 'Needs verification'), s('VERIFIED', 'success'), s('REJECTED', 'danger'), s('EXPIRED', 'muted')],
    path: ['PENDING_VERIFICATION', 'VERIFIED', 'EXPIRED'],
    fields: [patient(), encounter(), payer({ required: true, list: true }), ref('plan', 'Plan', { source: 'plans', list: true }), text('memberId', 'Member ID', { required: true }),
      sel('level', 'Payer level', { options: o('PRIMARY', 'SECONDARY', 'TERTIARY'), required: true, list: true }), date('validFrom', 'Valid from'), date('dueDate', 'Valid until', { required: true }),
      pct('copayPercent', 'Patient copay'), branch()],
    actions: [
      { key: 'verify', label: 'Mark verified', from: ['PENDING_VERIFICATION'], to: 'VERIFIED', tone: 'approve', hint: 'Card and member ID checked against the payer.' },
      { key: 'reject', label: 'Reject coverage', from: ['PENDING_VERIFICATION'], to: 'REJECTED', tone: 'danger', reason: 'required' },
      { key: 'reopen', label: 'Reopen', from: ['REJECTED'], to: 'PENDING_VERIFICATION', tone: 'quiet' },
      { key: 'expire', label: 'Expire', from: ['VERIFIED'], to: 'EXPIRED', tone: 'quiet', reason: 'optional' },
    ],
    kpis: [{ label: 'Needs verification', metric: 'count', statuses: ['PENDING_VERIFICATION'], tone: 'attention' }, { label: 'Verified', metric: 'count', statuses: ['VERIFIED'], tone: 'success' }, { label: 'Expired or past validity', metric: 'count', statuses: ['VERIFIED'], overdue: true, tone: 'danger' }],
    dueLabel: 'Valid until',
  },
  {
    key: 'authorizations', label: 'Payer authorizations', singular: 'authorization', category: 'front', icon: 'ShieldCheck', layout: 'queue',
    summary: 'Request and track prior authorization. A partial approval records the approved amount for the claim.',
    prefix: 'PA', create: true, editable: ['DRAFT'], initial: 'DRAFT', titleField: 'service',
    statuses: [s('DRAFT', 'info'), s('SUBMITTED', 'progress', 'With payer'), s('APPROVED', 'success'), s('PARTIAL', 'attention', 'Partially approved'), s('DENIED', 'danger'), s('CANCELLED', 'muted')],
    path: ['DRAFT', 'SUBMITTED', 'APPROVED'],
    fields: [patient(), encounter(), payer({ required: true, list: true }), ref('service', 'Service', { source: 'items', required: true, list: true }), amount('Requested amount', { list: true }),
      money('approvedAmount', 'Approved amount', { readonly: true }), text('payerReference', 'Payer reference', { readonly: true }), date('dueDate', 'Respond by'), area('clinicalNote', 'Clinical justification', { span: 2 }), branch()],
    actions: [
      { key: 'submit', label: 'Send to payer', from: ['DRAFT'], to: 'SUBMITTED', tone: 'primary' },
      { key: 'record-decision', label: 'Record approval', from: ['SUBMITTED'], to: '*', tone: 'approve', inputs: [money('approvedAmount', 'Approved amount', { required: true }), text('payerReference', 'Payer reference', { required: true })], hint: 'Less than requested is recorded as a partial approval.' },
      { key: 'deny', label: 'Record denial', from: ['SUBMITTED'], to: 'DENIED', tone: 'danger', reason: 'required' },
      { key: 'cancel', label: 'Cancel request', from: ['DRAFT', 'SUBMITTED'], to: 'CANCELLED', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'Waiting on payer', metric: 'count', statuses: ['SUBMITTED'], tone: 'progress' }, { label: 'Past respond-by date', metric: 'count', statuses: ['SUBMITTED'], overdue: true, tone: 'danger' }, { label: 'Requested value pending', metric: 'amount', statuses: ['DRAFT', 'SUBMITTED'] }],
    amountLabel: 'Requested',
  },
  {
    key: 'eligibility', label: 'Eligibility checks', singular: 'eligibility check', category: 'front', icon: 'BadgeCheck', layout: 'queue',
    summary: 'Real-time eligibility against the payer. Results come from the simulator in this environment.',
    prefix: 'ELG', create: true, editable: ['QUEUED'], initial: 'QUEUED', titleField: 'payer',
    statuses: [s('QUEUED', 'info', 'Ready to run'), s('ELIGIBLE', 'success'), s('NOT_ELIGIBLE', 'danger', 'Not eligible'), s('ERROR', 'attention', 'Payer error')],
    path: ['QUEUED', 'ELIGIBLE'],
    fields: [patient(), ref('coverage', 'Coverage', { source: 'res:coverages' }), payer({ required: true, list: true }), sel('channel', 'Channel', { options: o('EXCHANGE', 'PAYER_PORTAL', 'PHONE'), required: true, list: true }),
      date('serviceDate', 'Service date', { required: true }), text('responseCode', 'Response code', { readonly: true, list: true }), pct('copayPercent', 'Copay returned', { readonly: true }), text('message', 'Payer message', { readonly: true, span: 2 }), branch()],
    actions: [
      { key: 'run', label: 'Run check', from: ['QUEUED', 'ERROR'], to: '*', tone: 'primary', hint: 'Sends the request and records the payer response.' },
      { key: 'rerun', label: 'Check again', from: ['ELIGIBLE', 'NOT_ELIGIBLE'], to: 'QUEUED', tone: 'quiet' },
    ],
    kpis: [{ label: 'Ready to run', metric: 'count', statuses: ['QUEUED'], tone: 'info' }, { label: 'Not eligible', metric: 'count', statuses: ['NOT_ELIGIBLE'], tone: 'danger' }, { label: 'Payer errors', metric: 'count', statuses: ['ERROR'], tone: 'attention' }],
  },
  {
    key: 'estimates', label: 'Estimates and admission clearance', singular: 'estimate', category: 'front', icon: 'Calculator', layout: 'queue',
    summary: 'Give patients a cost estimate and clear admission once the required deposit is held. Overrides need a second person.',
    prefix: 'EST', create: true, editable: ['DRAFT', 'ISSUED'], initial: 'DRAFT', titleField: 'encounter',
    statuses: [s('DRAFT', 'info'), s('ISSUED', 'progress', 'Awaiting clearance'), s('OVERRIDE_REQUESTED', 'attention', 'Override requested'), s('CLEARED', 'success'), s('OVERRIDDEN', 'success', 'Cleared by override'), s('EXPIRED', 'muted')],
    path: ['DRAFT', 'ISSUED', 'CLEARED'],
    fields: [patient(), encounter({ list: true }), payer(), amount('Estimated total', { list: true }), money('patientShare', 'Patient share', { required: true }), money('depositRequired', 'Deposit required', { required: true }),
      money('depositCollected', 'Deposit held'), date('dueDate', 'Valid until'), branch()],
    actions: [
      { key: 'issue', label: 'Issue estimate', from: ['DRAFT'], to: 'ISSUED', tone: 'primary' },
      { key: 'clear', label: 'Clear admission', from: ['ISSUED'], to: 'CLEARED', tone: 'approve', hint: 'Requires the deposit held to meet the deposit required.' },
      { key: 'request-override', label: 'Request override', from: ['ISSUED'], to: 'OVERRIDE_REQUESTED', tone: 'attention', reason: 'required' },
      { key: 'approve-override', label: 'Approve override', from: ['OVERRIDE_REQUESTED'], to: 'OVERRIDDEN', tone: 'approve', independent: true, reason: 'optional' },
      { key: 'decline-override', label: 'Decline override', from: ['OVERRIDE_REQUESTED'], to: 'ISSUED', tone: 'danger', independent: true, reason: 'required' },
      { key: 'expire', label: 'Expire', from: ['DRAFT', 'ISSUED'], to: 'EXPIRED', tone: 'quiet' },
    ],
    kpis: [{ label: 'Awaiting clearance', metric: 'count', statuses: ['ISSUED'], tone: 'progress' }, { label: 'Overrides to decide', metric: 'count', statuses: ['OVERRIDE_REQUESTED'], tone: 'attention' }, { label: 'Estimated value in progress', metric: 'amount', statuses: ['ISSUED', 'OVERRIDE_REQUESTED'] }],
    amountLabel: 'Estimate', dueLabel: 'Valid until',
  },
  {
    key: 'deposits', label: 'Deposits', singular: 'deposit', category: 'front', icon: 'PiggyBank', layout: 'ledger',
    summary: 'Money held against an encounter. Apply it to invoices, or request a transfer or refund for a second person to approve.',
    prefix: 'DEP', create: true, editable: [], initial: 'HELD', titleField: 'encounter',
    statuses: [s('HELD', 'progress'), s('APPLIED', 'success', 'Fully applied'), s('TRANSFER_REQUESTED', 'attention', 'Transfer requested'), s('TRANSFERRED', 'muted'), s('REFUND_REQUESTED', 'attention', 'Refund requested'), s('REFUNDED', 'muted')],
    path: ['HELD', 'APPLIED'],
    fields: [patient(), encounter({ list: true }), amount('Amount collected'), money('balance', 'Unapplied', { readonly: true, list: true }), sel('method', 'Method', { options: o('CASH', 'CARD', 'BANK_TRANSFER'), required: true, list: true }), text('reference', 'Reference'), branch()],
    actions: [
      { key: 'apply', label: 'Apply to invoice', from: ['HELD'], to: '*', tone: 'primary', inputs: [ref('invoice', 'Invoice', { source: 'res:invoices', required: true })] },
      { key: 'request-transfer', label: 'Request transfer', from: ['HELD'], to: 'TRANSFER_REQUESTED', tone: 'quiet', reason: 'required', inputs: [ref('targetEncounter', 'Move to encounter', { source: 'res:encounters', required: true })] },
      { key: 'approve-transfer', label: 'Approve transfer', from: ['TRANSFER_REQUESTED'], to: 'TRANSFERRED', tone: 'approve', independent: true },
      { key: 'request-refund', label: 'Request refund', from: ['HELD'], to: 'REFUND_REQUESTED', tone: 'quiet', reason: 'required' },
      { key: 'approve-refund', label: 'Approve refund', from: ['REFUND_REQUESTED'], to: 'REFUNDED', tone: 'approve', independent: true, hint: 'Creates an approved refund ready for payout.' },
      { key: 'decline', label: 'Decline request', from: ['TRANSFER_REQUESTED', 'REFUND_REQUESTED'], to: 'HELD', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Held and unapplied', metric: 'balance', statuses: ['HELD'], tone: 'progress' }, { label: 'Requests to decide', metric: 'count', statuses: ['TRANSFER_REQUESTED', 'REFUND_REQUESTED'], tone: 'attention' }, { label: 'Collected today', metric: 'amount', today: true }],
    balanceLabel: 'Unapplied',
  },
  {
    key: 'cash-sessions', label: 'Cash drawer', singular: 'drawer session', category: 'front', icon: 'Banknote', layout: 'ledger',
    summary: 'Open and close cashier drawers. Variances beyond the tolerance go to a supervisor for review.',
    prefix: 'CSH', create: true, editable: ['OPEN'], initial: 'OPEN', titleField: 'assignee',
    statuses: [s('OPEN', 'progress'), s('UNDER_REVIEW', 'attention', 'Variance review'), s('CLOSED', 'success'), s('REVIEWED', 'success', 'Closed after review')],
    path: ['OPEN', 'CLOSED'],
    fields: [ref('assignee', 'Cashier', { source: 'users', required: true, list: true }), branch(), money('openingFloat', 'Opening float', { required: true }), money('amount', 'Expected cash takings', { readonly: true, list: true, help: 'Cash tenders recorded in this session.' }),
      money('countedCash', 'Counted at close', { readonly: true }), money('variance', 'Variance', { readonly: true, list: true }),
      lines('tenders', 'Takings by tender', { span: 2, columns: [sel('method', 'Tender', { options: o('CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE'), required: true }), num('count', 'Receipts', { min: 0 }), money('total', 'Total', { required: true })] })],
    actions: [
      { key: 'close', label: 'Count and close', from: ['OPEN'], to: '*', tone: 'primary', inputs: [money('countedCash', 'Cash counted in drawer', { required: true })], hint: 'Blind count: enter what is physically in the drawer.' },
      { key: 'review', label: 'Sign off variance', from: ['UNDER_REVIEW'], to: 'REVIEWED', tone: 'approve', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Open drawers', metric: 'count', statuses: ['OPEN'], tone: 'progress' }, { label: 'Variances to review', metric: 'count', statuses: ['UNDER_REVIEW'], tone: 'attention' }, { label: 'Cash expected in open drawers', metric: 'amount', statuses: ['OPEN'] }],
    amountLabel: 'Expected',
  },

  /* ===== Charges and documents ===== */
  {
    key: 'encounters', label: 'Unbilled worklist', singular: 'encounter', category: 'charges', icon: 'ListTodo', layout: 'queue',
    summary: 'Encounters with charges not yet invoiced. Mark ready, hold with a reason, or create the invoice draft from priced charges.',
    prefix: 'ENC', create: true, editable: ['OPEN', 'ON_HOLD'], initial: 'OPEN', titleField: 'careSetting',
    statuses: [s('OPEN', 'info', 'In progress'), s('READY_TO_BILL', 'attention', 'Ready to bill'), s('ON_HOLD', 'danger', 'On hold'), s('BILLED', 'success')],
    path: ['OPEN', 'READY_TO_BILL', 'BILLED'],
    fields: [patient(), branch(), sel('careSetting', 'Care setting', { options: o('OUTPATIENT', 'INPATIENT', 'DAYCASE', 'EMERGENCY'), required: true, list: true }), payer({ list: true, help: 'Empty for self-pay.' }),
      text('attending', 'Attending clinician'), date('admittedOn', 'Admitted or seen'), date('dischargedOn', 'Discharged'), money('amount', 'Unbilled value', { readonly: true, list: true }), date('dueDate', 'Bill by'), text('holdReason', 'Hold reason', { readonly: true, span: 2 })],
    actions: [
      { key: 'mark-ready', label: 'Mark ready to bill', from: ['OPEN'], to: 'READY_TO_BILL', tone: 'primary', hint: 'All charges are captured and priced.' },
      { key: 'hold', label: 'Put on hold', from: ['OPEN', 'READY_TO_BILL'], to: 'ON_HOLD', tone: 'danger', reason: 'required' },
      { key: 'release', label: 'Release hold', from: ['ON_HOLD'], to: 'READY_TO_BILL', tone: 'quiet' },
      { key: 'create-invoice', label: 'Create invoice draft', from: ['READY_TO_BILL'], to: 'BILLED', tone: 'approve', hint: 'Bills every priced charge on this encounter into one draft invoice.' },
    ],
    kpis: [{ label: 'Ready to bill', metric: 'amount', statuses: ['READY_TO_BILL'], tone: 'attention' }, { label: 'On hold', metric: 'count', statuses: ['ON_HOLD'], tone: 'danger' }, { label: 'Past bill-by date', metric: 'count', statuses: ['OPEN', 'READY_TO_BILL', 'ON_HOLD'], overdue: true, tone: 'danger' }, { label: 'Unbilled value', metric: 'amount', statuses: ['OPEN', 'READY_TO_BILL', 'ON_HOLD'] }],
    amountLabel: 'Unbilled', dueLabel: 'Bill by',
  },
  {
    key: 'charges', label: 'Charge detail', singular: 'charge', category: 'charges', icon: 'Receipt', layout: 'queue',
    summary: 'Every captured charge line. Price from the catalogue, reprice with a reason, send to review or reverse.',
    prefix: 'CHG', create: false, editable: ['CAPTURED', 'REVIEW'], initial: 'CAPTURED', titleField: 'item',
    statuses: [s('CAPTURED', 'info'), s('PRICED', 'progress'), s('REVIEW', 'attention', 'Needs review'), s('BILLED', 'success'), s('REVERSED', 'muted')],
    path: ['CAPTURED', 'PRICED', 'BILLED'],
    fields: [patient(), encounter({ required: true, list: true }), ref('item', 'Item', { source: 'items', required: true, list: true }), num('quantity', 'Quantity', { required: true, min: 1 }),
      money('unitPrice', 'Unit price'), money('amount', 'Line amount', { readonly: true, list: true }), date('serviceDate', 'Service date'), sel('source', 'Source', { options: o('ORDER_COMPLETION', 'MANUAL', 'PACKAGE'), list: true }), text('invoiceRef', 'Billed on', { readonly: true }), branch()],
    actions: [
      { key: 'price', label: 'Price from catalogue', from: ['CAPTURED'], to: 'PRICED', tone: 'primary' },
      { key: 'reprice', label: 'Reprice', from: ['PRICED', 'REVIEW'], to: 'PRICED', tone: 'quiet', reason: 'required', inputs: [money('unitPrice', 'New unit price', { required: true })] },
      { key: 'send-to-review', label: 'Send to review', from: ['CAPTURED', 'PRICED'], to: 'REVIEW', tone: 'attention', reason: 'required' },
      { key: 'reverse', label: 'Reverse charge', from: ['CAPTURED', 'PRICED', 'REVIEW'], to: 'REVERSED', tone: 'danger', reason: 'required' },
    ],
    kpis: [{ label: 'Not yet priced', metric: 'count', statuses: ['CAPTURED'], tone: 'info' }, { label: 'Needs review', metric: 'count', statuses: ['REVIEW'], tone: 'attention' }, { label: 'Priced, unbilled', metric: 'amount', statuses: ['PRICED'], tone: 'progress' }],
  },
  {
    key: 'manual-charges', label: 'Manual charges and procedure groups', singular: 'manual charge', category: 'charges', icon: 'HandCoins', layout: 'queue',
    summary: 'Fees that no clinical order produces. Each needs approval by a second person before it becomes a charge.',
    prefix: 'MCH', create: true, editable: ['DRAFT', 'REJECTED'], initial: 'DRAFT', titleField: 'item',
    statuses: [s('DRAFT', 'info'), s('PENDING_APPROVAL', 'attention', 'Awaiting approval'), s('POSTED', 'success'), s('REJECTED', 'danger', 'Returned')],
    path: ['DRAFT', 'PENDING_APPROVAL', 'POSTED'],
    fields: [patient(), encounter({ required: true, list: true }), ref('item', 'Fee item', { source: 'items', required: true, list: true }), num('quantity', 'Quantity', { required: true, min: 1 }), money('unitPrice', 'Unit price', { required: true }),
      money('amount', 'Amount', { readonly: true, list: true }), text('procedureGroup', 'Procedure group'), area('justification', 'Justification', { required: true, span: 2 }), branch()],
    actions: [
      { key: 'submit', label: 'Submit for approval', from: ['DRAFT', 'REJECTED'], to: 'PENDING_APPROVAL', tone: 'attention' },
      { key: 'approve', label: 'Approve and post', from: ['PENDING_APPROVAL'], to: 'POSTED', tone: 'approve', independent: true, hint: 'Creates a priced charge on the encounter.' },
      { key: 'return', label: 'Return', from: ['PENDING_APPROVAL'], to: 'REJECTED', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Awaiting approval', metric: 'count', statuses: ['PENDING_APPROVAL'], tone: 'attention' }, { label: 'Value awaiting approval', metric: 'amount', statuses: ['PENDING_APPROVAL'] }, { label: 'Posted', metric: 'count', statuses: ['POSTED'], tone: 'success' }],
  },
  {
    key: 'invoices', label: 'Invoices', singular: 'invoice', category: 'charges', icon: 'FileText', layout: 'ledger', document: true,
    summary: 'Draft invoices are issued by someone other than the person who drafted them. Issued invoices never change; corrections use notes.',
    prefix: 'INV', create: false, editable: [], initial: 'DRAFT', titleField: 'billTo',
    statuses: [s('DRAFT', 'info'), s('ISSUED', 'progress', 'Issued, unpaid'), s('PARTIALLY_PAID', 'attention', 'Part paid'), s('PAID', 'success'), s('CREDITED', 'muted', 'Fully credited')],
    path: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID'],
    fields: [patient(), encounter(), sel('billTo', 'Bill to', { options: o('PATIENT', 'PAYER'), required: true, list: true }), payer({ list: true }), money('subtotal', 'Subtotal', { readonly: true }), money('tax', 'VAT', { readonly: true }),
      money('amount', 'Total', { readonly: true }), money('balance', 'Balance due', { readonly: true }), date('issuedOn', 'Issued on', { readonly: true }), date('dueDate', 'Due date'),
      lines('lines', 'Lines', { readonly: true, span: 2, columns: [text('description', 'Description'), num('quantity', 'Qty'), money('unitPrice', 'Unit price'), money('tax', 'VAT'), money('amount', 'Amount')] })],
    actions: [{ key: 'issue', label: 'Issue invoice', from: ['DRAFT'], to: 'ISSUED', tone: 'approve', independent: true, hint: 'Consumes the next invoice number. The invoice becomes immutable.' }],
    kpis: [{ label: 'Drafts to issue', metric: 'count', statuses: ['DRAFT'], tone: 'info' }, { label: 'Outstanding', metric: 'balance', statuses: ['ISSUED', 'PARTIALLY_PAID'], tone: 'progress' }, { label: 'Overdue', metric: 'balance', statuses: ['ISSUED', 'PARTIALLY_PAID'], overdue: true, tone: 'danger' }],
    amountLabel: 'Total', balanceLabel: 'Balance',
  },
  {
    key: 'debit-notes', label: 'Debit notes', singular: 'debit note', category: 'charges', icon: 'FilePlus2', layout: 'ledger', document: true,
    summary: 'Increase what is owed on an issued invoice, for example a late charge. Issued by a second person.',
    prefix: 'DBN', create: true, editable: ['DRAFT'], initial: 'DRAFT', titleField: 'invoice',
    statuses: [s('DRAFT', 'info'), s('ISSUED', 'success')], path: ['DRAFT', 'ISSUED'],
    fields: [invoice(), patient(), amount('Amount', { list: true }), sel('reasonCode', 'Reason', { options: o('LATE_CHARGE', 'MISSED_CHARGE', 'PRICE_CORRECTION'), required: true, list: true }), area('note', 'Note', { span: 2 })],
    actions: [{ key: 'issue', label: 'Issue debit note', from: ['DRAFT'], to: 'ISSUED', tone: 'approve', independent: true, hint: 'Adds the amount to the invoice balance.' }],
    kpis: [{ label: 'Drafts to issue', metric: 'count', statuses: ['DRAFT'], tone: 'info' }, { label: 'Issued value', metric: 'amount', statuses: ['ISSUED'] }],
  },
  {
    key: 'credit-notes', label: 'Credit notes', singular: 'credit note', category: 'charges', icon: 'FileMinus2', layout: 'ledger', document: true,
    summary: 'Reduce what is owed on an issued invoice. Never more than the open balance; approved by a second person.',
    prefix: 'CRN', create: true, editable: ['DRAFT', 'REJECTED'], initial: 'DRAFT', titleField: 'invoice',
    statuses: [s('DRAFT', 'info'), s('PENDING_APPROVAL', 'attention', 'Awaiting approval'), s('ISSUED', 'success'), s('REJECTED', 'danger', 'Returned')], path: ['DRAFT', 'PENDING_APPROVAL', 'ISSUED'],
    fields: [invoice(), patient(), amount('Credit amount', { list: true }), sel('reasonCode', 'Reason', { options: reasonTags.CREDIT, required: true, list: true }), area('note', 'Note', { span: 2 })],
    actions: [
      { key: 'submit', label: 'Submit for approval', from: ['DRAFT', 'REJECTED'], to: 'PENDING_APPROVAL', tone: 'attention' },
      { key: 'issue', label: 'Approve and issue', from: ['PENDING_APPROVAL'], to: 'ISSUED', tone: 'approve', independent: true },
      { key: 'return', label: 'Return', from: ['PENDING_APPROVAL'], to: 'REJECTED', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Awaiting approval', metric: 'count', statuses: ['PENDING_APPROVAL'], tone: 'attention' }, { label: 'Credited this period', metric: 'amount', statuses: ['ISSUED'] }],
  },
  {
    key: 'adjustments', label: 'Adjustments', singular: 'adjustment', category: 'charges', icon: 'Scale', layout: 'queue',
    summary: 'Contractual allowances, small-balance and bad-debt write-offs. Every write-off is decided by a second person.',
    prefix: 'ADJ', create: true, editable: ['REQUESTED'], initial: 'REQUESTED', titleField: 'adjustmentType',
    statuses: [s('REQUESTED', 'attention', 'Awaiting decision'), s('APPROVED', 'success'), s('REJECTED', 'danger')], path: ['REQUESTED', 'APPROVED'],
    fields: [invoice(), patient(), amount('Amount', { list: true }), sel('adjustmentType', 'Type', { options: o('CONTRACTUAL_ALLOWANCE', 'SMALL_BALANCE', 'BAD_DEBT', 'CHARITY_CARE'), required: true, list: true }), area('note', 'Note', { span: 2 })],
    actions: [
      { key: 'approve', label: 'Approve', from: ['REQUESTED'], to: 'APPROVED', tone: 'approve', independent: true, hint: 'Reduces the invoice balance.' },
      { key: 'reject', label: 'Reject', from: ['REQUESTED'], to: 'REJECTED', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Awaiting decision', metric: 'count', statuses: ['REQUESTED'], tone: 'attention' }, { label: 'Value requested', metric: 'amount', statuses: ['REQUESTED'] }, { label: 'Approved write-offs', metric: 'amount', statuses: ['APPROVED'], tone: 'success' }],
  },

  /* ===== Money ===== */
  {
    key: 'receipts', label: 'Receipts and allocation', singular: 'receipt', category: 'money', icon: 'Wallet', layout: 'ledger', document: true,
    summary: 'Record money received and allocate it to open invoices. Voids need a second person and only apply to unallocated receipts.',
    prefix: 'RCT', create: true, editable: [], initial: 'UNALLOCATED', titleField: 'payerType',
    statuses: [s('UNALLOCATED', 'attention'), s('PARTIALLY_ALLOCATED', 'progress', 'Part allocated'), s('ALLOCATED', 'success'), s('VOID_REQUESTED', 'attention', 'Void requested'), s('VOIDED', 'muted')],
    path: ['UNALLOCATED', 'PARTIALLY_ALLOCATED', 'ALLOCATED'],
    fields: [sel('payerType', 'Received from', { options: o('PATIENT', 'PAYER'), required: true, list: true }), patient({ required: false }), payer(), amount('Amount received'), money('balance', 'Unallocated', { readonly: true }),
      sel('method', 'Method', { options: o('CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'PAYER_EFT'), required: true, list: true }), text('reference', 'Reference'), date('receivedOn', 'Received on', { required: true }), branch(),
      lines('allocations', 'Allocations', { readonly: true, span: 2, columns: [text('invoiceRef', 'Invoice'), money('amount', 'Amount'), date('on', 'Allocated on')] })],
    actions: [
      { key: 'allocate', label: 'Allocate to invoice', from: ['UNALLOCATED', 'PARTIALLY_ALLOCATED'], to: '*', tone: 'primary', inputs: [ref('invoice', 'Invoice', { source: 'res:invoices', required: true }), money('allocateAmount', 'Amount', { required: true })] },
      { key: 'request-void', label: 'Request void', from: ['UNALLOCATED'], to: 'VOID_REQUESTED', tone: 'quiet', reason: 'required' },
      { key: 'approve-void', label: 'Approve void', from: ['VOID_REQUESTED'], to: 'VOIDED', tone: 'danger', independent: true },
      { key: 'decline-void', label: 'Decline void', from: ['VOID_REQUESTED'], to: 'UNALLOCATED', tone: 'quiet', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Unallocated cash', metric: 'balance', statuses: ['UNALLOCATED', 'PARTIALLY_ALLOCATED'], tone: 'attention' }, { label: 'Received today', metric: 'amount', today: true, tone: 'success' }, { label: 'Void requests', metric: 'count', statuses: ['VOID_REQUESTED'], tone: 'attention' }],
    balanceLabel: 'Unallocated',
  },
  {
    key: 'refunds', label: 'Refunds and payouts', singular: 'refund', category: 'money', icon: 'Undo2', layout: 'queue',
    summary: 'Approve refunds, dispatch them to the payout provider and confirm the outcome. The simulator never moves real money.',
    prefix: 'RFD', create: true, editable: ['REQUESTED'], initial: 'REQUESTED', titleField: 'method',
    statuses: [s('REQUESTED', 'attention', 'Awaiting approval'), s('APPROVED', 'progress', 'Ready to dispatch'), s('DISPATCHED', 'progress', 'With provider'), s('PAID_OUT', 'success', 'Paid out'), s('FAILED', 'danger'), s('REJECTED', 'muted')],
    path: ['REQUESTED', 'APPROVED', 'DISPATCHED', 'PAID_OUT'],
    fields: [patient(), text('source', 'Refunding', { required: true, list: true, placeholder: 'Receipt or deposit reference' }), amount('Amount', { list: true }), sel('method', 'Method', { options: o('BANK_TRANSFER', 'CARD_REVERSAL', 'CASH'), required: true }),
      text('payeeName', 'Payee name', { required: true }), text('payeeAccount', 'Payee IBAN'), text('providerReference', 'Provider reference', { readonly: true }), branch()],
    actions: [
      { key: 'approve', label: 'Approve refund', from: ['REQUESTED'], to: 'APPROVED', tone: 'approve', independent: true },
      { key: 'reject', label: 'Reject', from: ['REQUESTED'], to: 'REJECTED', tone: 'danger', independent: true, reason: 'required' },
      { key: 'dispatch', label: 'Dispatch payout', from: ['APPROVED'], to: 'DISPATCHED', tone: 'primary' },
      { key: 'confirm', label: 'Confirm paid out', from: ['DISPATCHED'], to: 'PAID_OUT', tone: 'approve', inputs: [text('providerReference', 'Provider reference', { required: true })] },
      { key: 'fail', label: 'Record failure', from: ['DISPATCHED'], to: 'FAILED', tone: 'danger', reason: 'required' },
      { key: 'retry', label: 'Retry dispatch', from: ['FAILED'], to: 'DISPATCHED', tone: 'quiet' },
    ],
    kpis: [{ label: 'Awaiting approval', metric: 'count', statuses: ['REQUESTED'], tone: 'attention' }, { label: 'Ready or with provider', metric: 'amount', statuses: ['APPROVED', 'DISPATCHED'], tone: 'progress' }, { label: 'Failed payouts', metric: 'count', statuses: ['FAILED'], tone: 'danger' }],
  },
  {
    key: 'packages', label: 'Packages', singular: 'package', category: 'money', icon: 'Package', layout: 'queue',
    summary: 'Prepaid service packages. Record sessions as they are used; cancelling refunds the unused share less the fee.',
    prefix: 'PKG', create: true, editable: [], initial: 'ACTIVE', titleField: 'packageItem',
    statuses: [s('ACTIVE', 'progress'), s('CONSUMED', 'success', 'Fully used'), s('CANCELLED', 'muted'), s('EXPIRED', 'muted')], path: ['ACTIVE', 'CONSUMED'],
    fields: [patient(), ref('packageItem', 'Package', { source: 'items', required: true, list: true }), amount('Price paid'), num('sessionsTotal', 'Sessions included', { required: true, min: 1 }), num('sessionsUsed', 'Sessions used', { readonly: true, list: true }),
      money('balance', 'Unused value', { readonly: true }), date('dueDate', 'Valid until', { required: true }), branch()],
    actions: [
      { key: 'use-session', label: 'Record a session', from: ['ACTIVE'], to: '*', tone: 'primary' },
      { key: 'cancel', label: 'Cancel package', from: ['ACTIVE'], to: 'CANCELLED', tone: 'danger', reason: 'required', hint: 'Creates a refund request for the unused share less a 10% fee.' },
      { key: 'expire', label: 'Expire', from: ['ACTIVE'], to: 'EXPIRED', tone: 'quiet' },
    ],
    kpis: [{ label: 'Active packages', metric: 'count', statuses: ['ACTIVE'], tone: 'progress' }, { label: 'Unused value held', metric: 'balance', statuses: ['ACTIVE'] }, { label: 'Expiring or expired', metric: 'count', statuses: ['ACTIVE'], overdue: true, tone: 'danger' }],
    balanceLabel: 'Unused', dueLabel: 'Valid until',
  },

  /* ===== Insurance ===== */
  {
    key: 'claims', label: 'Claims', singular: 'claim', category: 'insurance', icon: 'FileStack', layout: 'board',
    summary: 'Every payer claim from ready to paid. Submission through the exchange creates a tracked message.',
    prefix: 'CLM', create: false, editable: ['READY'], initial: 'READY', titleField: 'payer',
    statuses: [s('READY', 'info', 'Ready to submit'), s('SUBMITTED', 'progress'), s('ACKNOWLEDGED', 'progress', 'Acknowledged'), s('PARTIALLY_PAID', 'attention', 'Part paid'), s('DENIED', 'danger'), s('PAID', 'success'), s('CLOSED', 'muted')],
    path: ['READY', 'SUBMITTED', 'ACKNOWLEDGED', 'PAID'], board: ['READY', 'SUBMITTED', 'ACKNOWLEDGED', 'PARTIALLY_PAID', 'DENIED', 'PAID'],
    fields: [patient(), ref('invoice', 'Invoice', { source: 'res:invoices', list: true }), payer({ required: true, list: true }), amount('Claimed', { readonly: true }), money('balance', 'Outstanding', { readonly: true }),
      sel('channel', 'Channel', { options: o('EXCHANGE', 'PAYER_PORTAL', 'PAPER'), required: true }), date('submittedOn', 'Submitted on', { readonly: true }), date('dueDate', 'Filing deadline'), text('denialReason', 'Denial reason', { readonly: true }), branch()],
    actions: [
      { key: 'submit', label: 'Submit claim', from: ['READY'], to: 'SUBMITTED', tone: 'primary', hint: 'Exchange claims create a message on the exchange monitor.' },
      { key: 'acknowledge', label: 'Record acknowledgement', from: ['SUBMITTED'], to: 'ACKNOWLEDGED', tone: 'quiet' },
      { key: 'record-denial', label: 'Record denial', from: ['SUBMITTED', 'ACKNOWLEDGED'], to: 'DENIED', tone: 'danger', inputs: [sel('denialReason', 'Denial reason', { options: o('NOT_COVERED', 'NO_AUTHORIZATION', 'DUPLICATE', 'CODING_ERROR', 'TIMELY_FILING'), required: true })] },
      { key: 'resubmit', label: 'Correct and resubmit', from: ['DENIED'], to: 'READY', tone: 'quiet', reason: 'required' },
      { key: 'close', label: 'Close claim', from: ['DENIED', 'PARTIALLY_PAID'], to: 'CLOSED', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'Ready to submit', metric: 'amount', statuses: ['READY'], tone: 'info' }, { label: 'With payers', metric: 'balance', statuses: ['SUBMITTED', 'ACKNOWLEDGED'], tone: 'progress' }, { label: 'Denied', metric: 'balance', statuses: ['DENIED'], tone: 'danger' }, { label: 'Filing deadline passed', metric: 'count', statuses: ['READY'], overdue: true, tone: 'danger' }],
    amountLabel: 'Claimed', balanceLabel: 'Outstanding', dueLabel: 'File by',
  },
  {
    key: 'exchange-messages', label: 'Exchange monitor', singular: 'exchange message', category: 'insurance', icon: 'RadioTower', layout: 'monitor',
    summary: 'Live view of messages to and from payers. Retry failures or resolve them manually with a reason.',
    prefix: 'MSG', create: false, editable: [], initial: 'QUEUED', titleField: 'operation',
    statuses: [s('QUEUED', 'info'), s('SENT', 'progress'), s('ACKNOWLEDGED', 'success'), s('FAILED', 'danger'), s('DEAD_LETTER', 'danger', 'Dead letter'), s('RESOLVED', 'muted', 'Resolved manually')],
    path: ['QUEUED', 'SENT', 'ACKNOWLEDGED'],
    fields: [sel('operation', 'Operation', { options: o('CLAIM', 'ELIGIBILITY', 'CLAIM_STATUS', 'REMITTANCE'), required: true, list: true }), payer({ list: true }), ref('claim', 'Claim', { source: 'res:claims' }),
      text('format', 'Format', { list: true }), text('endpointAlias', 'Endpoint alias'), num('attempts', 'Attempts', { readonly: true, list: true }), text('lastError', 'Last error', { readonly: true, span: 2 }), branch()],
    actions: [
      { key: 'retry', label: 'Retry now', from: ['FAILED', 'DEAD_LETTER', 'QUEUED'], to: '*', tone: 'primary' },
      { key: 'resolve', label: 'Resolve manually', from: ['FAILED', 'DEAD_LETTER'], to: 'RESOLVED', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'In flight', metric: 'count', statuses: ['QUEUED', 'SENT'], tone: 'progress' }, { label: 'Failed', metric: 'count', statuses: ['FAILED'], tone: 'danger' }, { label: 'Dead letters', metric: 'count', statuses: ['DEAD_LETTER'], tone: 'danger' }, { label: 'Acknowledged', metric: 'count', statuses: ['ACKNOWLEDGED'], tone: 'success' }],
  },
  {
    key: 'remittances', label: 'Remittances', singular: 'remittance', category: 'insurance', icon: 'Landmark', layout: 'ledger', document: true,
    summary: 'Payer remittance advice. Posting updates every claim and invoice it covers, so it is checked by a second person.',
    prefix: 'ERA', create: false, editable: ['RECEIVED'], initial: 'RECEIVED', titleField: 'payer',
    statuses: [s('RECEIVED', 'info'), s('POSTING_REVIEW', 'attention', 'Posting review'), s('POSTED', 'success')], path: ['RECEIVED', 'POSTING_REVIEW', 'POSTED'],
    fields: [payer({ required: true, list: true }), amount('Total paid', { readonly: true }), text('paymentReference', 'Payment reference', { list: true }), date('receivedOn', 'Received on'),
      lines('lines', 'Claim lines', { readonly: true, span: 2, columns: [text('claimRef', 'Claim'), money('claimed', 'Claimed'), money('paid', 'Paid'), money('denied', 'Denied'), text('reasonCode', 'Reason')] }), branch()],
    actions: [
      { key: 'send-to-review', label: 'Send for posting review', from: ['RECEIVED'], to: 'POSTING_REVIEW', tone: 'attention' },
      { key: 'post', label: 'Post remittance', from: ['POSTING_REVIEW'], to: 'POSTED', tone: 'approve', independent: true, hint: 'Marks claims paid, part paid or denied, and reduces invoice balances.' },
      { key: 'return', label: 'Return', from: ['POSTING_REVIEW'], to: 'RECEIVED', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Not yet posted', metric: 'amount', statuses: ['RECEIVED', 'POSTING_REVIEW'], tone: 'attention' }, { label: 'Posting review', metric: 'count', statuses: ['POSTING_REVIEW'], tone: 'attention' }, { label: 'Posted', metric: 'amount', statuses: ['POSTED'], tone: 'success' }],
  },
  {
    key: 'remittance-corrections', label: 'Remittance corrections', singular: 'correction', category: 'insurance', icon: 'PencilLine', layout: 'queue',
    summary: 'Correct a keying or payer error on a posted remittance line. The difference is applied to the invoice on approval.',
    prefix: 'RMC', create: true, editable: ['REQUESTED'], initial: 'REQUESTED', titleField: 'claim',
    statuses: [s('REQUESTED', 'attention', 'Awaiting approval'), s('APPROVED', 'success'), s('REJECTED', 'danger')], path: ['REQUESTED', 'APPROVED'],
    fields: [ref('remittance', 'Remittance', { source: 'res:remittances', required: true, list: true }), ref('claim', 'Claim', { source: 'res:claims', required: true, list: true }), money('originalPaid', 'Paid as posted', { required: true }),
      amount('Correct paid amount', { list: true }), sel('reasonCode', 'Reason', { options: o('KEYING_ERROR', 'PAYER_REISSUE', 'DUPLICATE_POSTING'), required: true }), area('note', 'Note', { span: 2 })],
    actions: [
      { key: 'approve', label: 'Approve correction', from: ['REQUESTED'], to: 'APPROVED', tone: 'approve', independent: true },
      { key: 'reject', label: 'Reject', from: ['REQUESTED'], to: 'REJECTED', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Awaiting approval', metric: 'count', statuses: ['REQUESTED'], tone: 'attention' }, { label: 'Approved', metric: 'count', statuses: ['APPROVED'], tone: 'success' }],
  },
  {
    key: 'appeals', label: 'Appeals', singular: 'appeal', category: 'insurance', icon: 'Gavel', layout: 'board',
    summary: 'Contest denials before the filing deadline. Filing is approved by a second person; outcomes record what was recovered.',
    prefix: 'APL', create: true, editable: ['DRAFT'], initial: 'DRAFT', titleField: 'reasonCode',
    statuses: [s('DRAFT', 'info'), s('PENDING_APPROVAL', 'attention', 'Awaiting approval'), s('FILED', 'progress'), s('WON', 'success'), s('PARTIAL', 'attention', 'Partly won'), s('LOST', 'danger'), s('WITHDRAWN', 'muted')],
    path: ['DRAFT', 'PENDING_APPROVAL', 'FILED', 'WON'], board: ['DRAFT', 'PENDING_APPROVAL', 'FILED', 'PARTIAL', 'WON', 'LOST'],
    fields: [ref('claim', 'Claim', { source: 'res:claims', required: true, list: true }), patient(), payer(), amount('Disputed amount'), num('level', 'Appeal level', { required: true, min: 1, max: 3 }),
      sel('reasonCode', 'Grounds', { options: o('MEDICAL_NECESSITY', 'CODING_DISPUTE', 'AUTHORIZATION_ON_FILE', 'TIMELY_FILING'), required: true, list: true }), date('dueDate', 'Filing deadline', { required: true }), money('recovered', 'Recovered', { readonly: true }), area('argument', 'Argument', { span: 2 })],
    actions: [
      { key: 'submit', label: 'Submit for approval', from: ['DRAFT'], to: 'PENDING_APPROVAL', tone: 'attention' },
      { key: 'approve-filing', label: 'Approve and file', from: ['PENDING_APPROVAL'], to: 'FILED', tone: 'approve', independent: true },
      { key: 'return', label: 'Return', from: ['PENDING_APPROVAL'], to: 'DRAFT', tone: 'danger', independent: true, reason: 'required' },
      { key: 'record-outcome', label: 'Record outcome', from: ['FILED'], to: '*', tone: 'primary', inputs: [money('recovered', 'Amount recovered', { required: true })], hint: 'Full recovery is won, some is partly won, none is lost.' },
      { key: 'withdraw', label: 'Withdraw', from: ['DRAFT', 'FILED'], to: 'WITHDRAWN', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'Filed, awaiting payer', metric: 'amount', statuses: ['FILED'], tone: 'progress' }, { label: 'Deadline passed', metric: 'count', statuses: ['DRAFT', 'PENDING_APPROVAL'], overdue: true, tone: 'danger' }, { label: 'Awaiting approval', metric: 'count', statuses: ['PENDING_APPROVAL'], tone: 'attention' }],
    amountLabel: 'Disputed', dueLabel: 'File by',
  },
  {
    key: 'payer-reconciliations', label: 'Payer reconciliation', singular: 'reconciliation', category: 'insurance', icon: 'GitCompare', layout: 'queue',
    summary: 'Compare what each payer should have paid with what arrived, period by period. Sign-off is independent.',
    prefix: 'PRC', create: true, editable: ['OPEN'], initial: 'OPEN', titleField: 'payer',
    statuses: [s('OPEN', 'info'), s('IN_REVIEW', 'attention', 'In review'), s('RECONCILED', 'success'), s('DISPUTED', 'danger')], path: ['OPEN', 'IN_REVIEW', 'RECONCILED'],
    fields: [payer({ required: true, list: true }), text('period', 'Period', { required: true, list: true, placeholder: '2026-09' }), amount('Expected from payer'), money('receivedAmount', 'Received', { required: true }), money('variance', 'Variance', { readonly: true, list: true }), area('notes', 'Notes', { span: 2 })],
    actions: [
      { key: 'compare', label: 'Compare and review', from: ['OPEN'], to: 'IN_REVIEW', tone: 'primary' },
      { key: 'reconcile', label: 'Sign off', from: ['IN_REVIEW'], to: 'RECONCILED', tone: 'approve', independent: true, reason: 'optional', hint: 'A non-zero variance needs an explanation.' },
      { key: 'dispute', label: 'Dispute with payer', from: ['IN_REVIEW'], to: 'DISPUTED', tone: 'danger', reason: 'required' },
    ],
    kpis: [{ label: 'In review', metric: 'count', statuses: ['IN_REVIEW'], tone: 'attention' }, { label: 'Disputed', metric: 'count', statuses: ['DISPUTED'], tone: 'danger' }, { label: 'Expected this cycle', metric: 'amount', statuses: ['OPEN', 'IN_REVIEW'] }],
  },
  {
    key: 'responsibility-transfers', label: 'Responsibility transfers', singular: 'transfer', category: 'insurance', icon: 'ArrowRightLeft', layout: 'queue',
    summary: 'Move a balance between payer levels or to the patient. Approval moves the money and bills the new party.',
    prefix: 'RTR', create: true, editable: ['REQUESTED'], initial: 'REQUESTED', titleField: 'toParty',
    statuses: [s('REQUESTED', 'attention', 'Awaiting approval'), s('APPROVED', 'success'), s('REJECTED', 'danger')], path: ['REQUESTED', 'APPROVED'],
    fields: [invoice(), patient(), sel('fromParty', 'From', { options: o('PRIMARY_PAYER', 'SECONDARY_PAYER', 'PATIENT'), required: true, list: true }), sel('toParty', 'To', { options: o('SECONDARY_PAYER', 'PATIENT', 'SPONSOR'), required: true, list: true }),
      amount('Amount'), sel('reasonCode', 'Reason', { options: o('NOT_COVERED', 'COPAY', 'SECONDARY_COVERAGE', 'DENIAL_UPHELD'), required: true })],
    actions: [
      { key: 'approve', label: 'Approve transfer', from: ['REQUESTED'], to: 'APPROVED', tone: 'approve', independent: true, hint: 'Reduces the source invoice and issues a new invoice to the receiving party.' },
      { key: 'reject', label: 'Reject', from: ['REQUESTED'], to: 'REJECTED', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Awaiting approval', metric: 'count', statuses: ['REQUESTED'], tone: 'attention' }, { label: 'Value requested', metric: 'amount', statuses: ['REQUESTED'] }, { label: 'Moved', metric: 'amount', statuses: ['APPROVED'], tone: 'success' }],
  },

  /* ===== Receivables ===== */
  {
    key: 'payment-plans', label: 'Payment plans', singular: 'payment plan', category: 'receivables', icon: 'CalendarClock', layout: 'queue',
    summary: 'Instalment agreements for patient balances. Approval generates the schedule; payments reduce it in order.',
    prefix: 'PPL', create: true, editable: ['PROPOSED'], initial: 'PROPOSED', titleField: 'cadence',
    statuses: [s('PROPOSED', 'attention', 'Awaiting approval'), s('ACTIVE', 'progress'), s('COMPLETED', 'success'), s('DEFAULTED', 'danger'), s('CANCELLED', 'muted')], path: ['PROPOSED', 'ACTIVE', 'COMPLETED'],
    fields: [patient(), amount('Plan total'), money('balance', 'Remaining', { readonly: true }), num('installments', 'Instalments', { required: true, min: 2, max: 60, list: true }), sel('cadence', 'Cadence', { options: o('WEEKLY', 'BIWEEKLY', 'MONTHLY'), required: true, list: true }),
      date('firstDue', 'First due', { required: true }), date('dueDate', 'Next due', { readonly: true }), branch(),
      lines('schedule', 'Schedule', { readonly: true, span: 2, columns: [num('n', '#'), date('due', 'Due'), money('amount', 'Amount'), text('state', 'State')] })],
    actions: [
      { key: 'approve', label: 'Approve plan', from: ['PROPOSED'], to: 'ACTIVE', tone: 'approve', independent: true, hint: 'Generates the instalment schedule.' },
      { key: 'record-payment', label: 'Record instalment paid', from: ['ACTIVE'], to: '*', tone: 'primary' },
      { key: 'default', label: 'Mark defaulted', from: ['ACTIVE'], to: 'DEFAULTED', tone: 'danger', reason: 'required' },
      { key: 'cancel', label: 'Cancel', from: ['PROPOSED', 'ACTIVE'], to: 'CANCELLED', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'Active plans', metric: 'balance', statuses: ['ACTIVE'], tone: 'progress' }, { label: 'Instalment overdue', metric: 'count', statuses: ['ACTIVE'], overdue: true, tone: 'danger' }, { label: 'Awaiting approval', metric: 'count', statuses: ['PROPOSED'], tone: 'attention' }],
    balanceLabel: 'Remaining', dueLabel: 'Next due',
  },
  {
    key: 'statements', label: 'Statements', singular: 'statement', category: 'receivables', icon: 'Mail', layout: 'queue',
    summary: 'Patient statements generated each cycle. Send them, record returned mail, or suppress for a reason.',
    prefix: 'STM', create: true, editable: ['GENERATED'], initial: 'GENERATED', titleField: 'channel',
    statuses: [s('GENERATED', 'info', 'Ready to send'), s('SENT', 'success'), s('RETURNED', 'danger', 'Returned undelivered'), s('SUPPRESSED', 'muted')], path: ['GENERATED', 'SENT'],
    fields: [patient(), amount('Balance due', { list: true }), text('period', 'Period', { required: true, placeholder: '2026-09' }), sel('channel', 'Channel', { options: o('EMAIL', 'SMS', 'PRINT', 'PATIENT_PORTAL'), required: true, list: true }), date('sentOn', 'Sent on', { readonly: true }), branch()],
    actions: [
      { key: 'send', label: 'Send statement', from: ['GENERATED'], to: 'SENT', tone: 'primary' },
      { key: 'mark-returned', label: 'Record returned', from: ['SENT'], to: 'RETURNED', tone: 'danger', reason: 'required' },
      { key: 'regenerate', label: 'Regenerate', from: ['RETURNED'], to: 'GENERATED', tone: 'quiet' },
      { key: 'suppress', label: 'Suppress', from: ['GENERATED'], to: 'SUPPRESSED', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'Ready to send', metric: 'count', statuses: ['GENERATED'], tone: 'info' }, { label: 'Billed on statements', metric: 'amount', statuses: ['SENT'] }, { label: 'Returned', metric: 'count', statuses: ['RETURNED'], tone: 'danger' }],
  },
  {
    key: 'collections', label: 'Dunning and collections', singular: 'collection case', category: 'receivables', icon: 'Megaphone', layout: 'board',
    summary: 'Overdue patient balances move through reminders to a final notice. Agency referral needs a second person.',
    prefix: 'COL', create: true, editable: ['REMINDER_1'], initial: 'REMINDER_1', titleField: 'agency',
    statuses: [s('REMINDER_1', 'info', 'First reminder'), s('REMINDER_2', 'attention', 'Second reminder'), s('FINAL_NOTICE', 'danger', 'Final notice'), s('PROMISE_TO_PAY', 'progress', 'Promise to pay'), s('AGENCY_REQUESTED', 'attention', 'Referral requested'), s('WITH_AGENCY', 'muted', 'With agency'), s('RESOLVED', 'success')],
    path: ['REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE', 'RESOLVED'], board: ['REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE', 'PROMISE_TO_PAY', 'AGENCY_REQUESTED', 'WITH_AGENCY'],
    fields: [patient(), money('amount', 'Overdue balance', { required: true }), date('dueDate', 'Next action', { required: true }), date('promiseDate', 'Promised by', { readonly: true }), text('agency', 'Agency'), area('lastContact', 'Last contact note', { span: 2 }), branch()],
    actions: [
      { key: 'second-reminder', label: 'Send second reminder', from: ['REMINDER_1'], to: 'REMINDER_2', tone: 'primary' },
      { key: 'final-notice', label: 'Send final notice', from: ['REMINDER_2'], to: 'FINAL_NOTICE', tone: 'danger' },
      { key: 'promise', label: 'Record promise to pay', from: ['REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE'], to: 'PROMISE_TO_PAY', tone: 'quiet', inputs: [date('promiseDate', 'Promised by', { required: true })] },
      { key: 'refer', label: 'Request agency referral', from: ['FINAL_NOTICE'], to: 'AGENCY_REQUESTED', tone: 'attention', reason: 'required' },
      { key: 'approve-referral', label: 'Approve referral', from: ['AGENCY_REQUESTED'], to: 'WITH_AGENCY', tone: 'approve', independent: true },
      { key: 'resolve', label: 'Mark resolved', from: ['REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE', 'PROMISE_TO_PAY', 'WITH_AGENCY'], to: 'RESOLVED', tone: 'approve', reason: 'optional' },
    ],
    kpis: [{ label: 'In dunning', metric: 'amount', statuses: ['REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE'], tone: 'attention' }, { label: 'Promised', metric: 'amount', statuses: ['PROMISE_TO_PAY'], tone: 'progress' }, { label: 'Action overdue', metric: 'count', statuses: ['REMINDER_1', 'REMINDER_2', 'FINAL_NOTICE', 'PROMISE_TO_PAY'], overdue: true, tone: 'danger' }],
    amountLabel: 'Overdue', dueLabel: 'Next action',
  },

  /* ===== Coding and models ===== */
  {
    key: 'coding-cases', label: 'Coding worklist', singular: 'coding case', category: 'coding', icon: 'Code2', layout: 'board',
    summary: 'Assign diagnosis and procedure codes. Coding is validated by a second coder before billing uses it.',
    prefix: 'COD', create: false, editable: ['QUEUED', 'IN_PROGRESS'], initial: 'QUEUED', titleField: 'encounter',
    statuses: [s('QUEUED', 'info'), s('IN_PROGRESS', 'progress', 'Coding'), s('QUERY_RAISED', 'attention', 'Query raised'), s('CODED', 'progress', 'Awaiting validation'), s('VALIDATED', 'success')],
    path: ['QUEUED', 'IN_PROGRESS', 'CODED', 'VALIDATED'], board: ['QUEUED', 'IN_PROGRESS', 'QUERY_RAISED', 'CODED', 'VALIDATED'],
    fields: [encounter({ required: true, list: true }), patient(), ref('assignee', 'Coder', { source: 'users', list: true }), text('principalDx', 'Principal diagnosis', { upper: false, placeholder: 'K80.20' }), tags('secondaryDx', 'Secondary diagnoses'), tags('procedures', 'Procedures'), date('dueDate', 'Code by'), branch()],
    actions: [
      { key: 'start', label: 'Start coding', from: ['QUEUED'], to: 'IN_PROGRESS', tone: 'primary' },
      { key: 'raise-query', label: 'Raise CDI query', from: ['IN_PROGRESS'], to: 'QUERY_RAISED', tone: 'attention', inputs: [area('question', 'Question for the clinician', { required: true })], hint: 'Creates a clarification in the CDI queue.' },
      { key: 'resume', label: 'Resume coding', from: ['QUERY_RAISED'], to: 'IN_PROGRESS', tone: 'quiet' },
      { key: 'complete', label: 'Complete coding', from: ['IN_PROGRESS'], to: 'CODED', tone: 'primary' },
      { key: 'validate', label: 'Validate', from: ['CODED'], to: 'VALIDATED', tone: 'approve', independent: true },
      { key: 'return', label: 'Return to coder', from: ['CODED'], to: 'IN_PROGRESS', tone: 'danger', independent: true, reason: 'required' },
    ],
    kpis: [{ label: 'Queued', metric: 'count', statuses: ['QUEUED'], tone: 'info' }, { label: 'Waiting on clinicians', metric: 'count', statuses: ['QUERY_RAISED'], tone: 'attention' }, { label: 'To validate', metric: 'count', statuses: ['CODED'], tone: 'progress' }, { label: 'Past code-by date', metric: 'count', statuses: ['QUEUED', 'IN_PROGRESS'], overdue: true, tone: 'danger' }],
    dueLabel: 'Code by',
  },
  {
    key: 'cdi-queries', label: 'CDI clarifications', singular: 'clarification', category: 'coding', icon: 'MessageSquareText', layout: 'queue',
    summary: 'Clinical documentation questions to clinicians. Answers return to the coder; unanswered queries escalate.',
    prefix: 'CDI', create: true, editable: ['OPEN'], initial: 'OPEN', titleField: 'physician',
    statuses: [s('OPEN', 'attention', 'Awaiting answer'), s('ANSWERED', 'progress'), s('ESCALATED', 'danger'), s('CLOSED', 'success')], path: ['OPEN', 'ANSWERED', 'CLOSED'],
    fields: [encounter({ required: true, list: true }), patient(), text('physician', 'Clinician', { required: true, list: true }), area('question', 'Question', { required: true, span: 2 }), area('response', 'Clinician response', { readonly: true, span: 2 }), date('dueDate', 'Answer by'), branch()],
    actions: [
      { key: 'record-response', label: 'Record response', from: ['OPEN', 'ESCALATED'], to: 'ANSWERED', tone: 'primary', inputs: [area('response', 'Clinician response', { required: true })] },
      { key: 'escalate', label: 'Escalate', from: ['OPEN'], to: 'ESCALATED', tone: 'danger', reason: 'required' },
      { key: 'close', label: 'Close', from: ['ANSWERED'], to: 'CLOSED', tone: 'approve' },
    ],
    kpis: [{ label: 'Awaiting answer', metric: 'count', statuses: ['OPEN'], tone: 'attention' }, { label: 'Overdue', metric: 'count', statuses: ['OPEN', 'ESCALATED'], overdue: true, tone: 'danger' }, { label: 'Answered', metric: 'count', statuses: ['ANSWERED'], tone: 'progress' }],
    dueLabel: 'Answer by',
  },
  {
    key: 'drg-groupings', label: 'DRG grouping', singular: 'DRG grouping', category: 'coding', icon: 'Layers', layout: 'queue',
    summary: 'Run the licensed grouper on coded inpatient stays and validate the result before claims use it.',
    prefix: 'DRG', create: true, editable: ['PENDING', 'ERROR'], initial: 'PENDING', titleField: 'drgCode',
    statuses: [s('PENDING', 'info', 'Ready to group'), s('GROUPED', 'progress', 'Awaiting validation'), s('VALIDATED', 'success'), s('ERROR', 'danger', 'Grouper error')], path: ['PENDING', 'GROUPED', 'VALIDATED'],
    fields: [encounter({ required: true, list: true }), patient(), text('principalDx', 'Principal diagnosis', { required: true }), tags('secondaryDx', 'Secondary diagnoses'), tags('procedures', 'Procedures'), num('lengthOfStay', 'Length of stay (days)', { required: true, min: 0 }),
      text('drgCode', 'DRG', { readonly: true, list: true }), dec('weight', 'Relative weight', { readonly: true }), money('amount', 'Expected payment', { readonly: true, list: true }), text('grouperVersion', 'Grouper', { readonly: true }), branch()],
    actions: [
      { key: 'run-grouper', label: 'Run grouper', from: ['PENDING', 'ERROR'], to: '*', tone: 'primary' },
      { key: 'validate', label: 'Validate result', from: ['GROUPED'], to: 'VALIDATED', tone: 'approve', independent: true },
      { key: 'regroup', label: 'Send back to regroup', from: ['GROUPED'], to: 'PENDING', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'Ready to group', metric: 'count', statuses: ['PENDING'], tone: 'info' }, { label: 'Awaiting validation', metric: 'amount', statuses: ['GROUPED'], tone: 'progress' }, { label: 'Grouper errors', metric: 'count', statuses: ['ERROR'], tone: 'danger' }],
    amountLabel: 'Expected',
  },
  {
    key: 'em-determinations', label: 'E&M determinations', singular: 'E&M determination', category: 'coding', icon: 'Activity', layout: 'queue',
    summary: 'Determine the visit level from medical decision making or time. A second person confirms or overrides it.',
    prefix: 'EMD', create: true, editable: ['DRAFT'], initial: 'DRAFT', titleField: 'level',
    statuses: [s('DRAFT', 'info'), s('PROPOSED', 'attention', 'Awaiting confirmation'), s('CONFIRMED', 'success'), s('OVERRIDDEN', 'progress')], path: ['DRAFT', 'PROPOSED', 'CONFIRMED'],
    fields: [encounter({ required: true, list: true }), patient(), sel('careSetting', 'Setting', { options: o('OUTPATIENT', 'EMERGENCY'), required: true }), sel('mdm', 'Medical decision making', { options: o('STRAIGHTFORWARD', 'LOW', 'MODERATE', 'HIGH'), required: true, list: true }),
      num('totalMinutes', 'Total time (minutes)', { min: 0 }), text('level', 'Level', { readonly: true, list: true }), money('amount', 'Level amount', { readonly: true, list: true }), branch()],
    actions: [
      { key: 'determine', label: 'Determine level', from: ['DRAFT'], to: 'PROPOSED', tone: 'primary', hint: 'Uses whichever of MDM or time gives the higher supported level.' },
      { key: 'confirm', label: 'Confirm level', from: ['PROPOSED'], to: 'CONFIRMED', tone: 'approve', independent: true },
      { key: 'override', label: 'Override level', from: ['PROPOSED'], to: 'OVERRIDDEN', tone: 'danger', independent: true, reason: 'required', inputs: [sel('level', 'Level', { options: o('L2', 'L3', 'L4', 'L5'), required: true })] },
    ],
    kpis: [{ label: 'Awaiting confirmation', metric: 'count', statuses: ['PROPOSED'], tone: 'attention' }, { label: 'Drafts', metric: 'count', statuses: ['DRAFT'], tone: 'info' }, { label: 'Confirmed value', metric: 'amount', statuses: ['CONFIRMED', 'OVERRIDDEN'], tone: 'success' }],
  },
  {
    key: 'model-settlements', label: 'Model settlements', singular: 'settlement', category: 'coding', icon: 'Sigma', layout: 'queue',
    summary: 'Capitation, bundle, budget and performance settlements per contract period, posted to the ledger after approval.',
    prefix: 'STL', create: true, editable: ['DRAFT'], initial: 'DRAFT', titleField: 'model',
    statuses: [s('DRAFT', 'info'), s('CALCULATED', 'attention', 'Awaiting approval'), s('APPROVED', 'progress', 'Ready to post'), s('POSTED', 'success'), s('REJECTED', 'danger')], path: ['DRAFT', 'CALCULATED', 'APPROVED', 'POSTED'],
    fields: [ref('contract', 'Contract', { source: 'contracts', required: true, list: true }), sel('model', 'Model', { options: o('CAPITATION', 'BUNDLE', 'GLOBAL_BUDGET', 'P4P', 'COST_PLUS'), required: true, list: true }), text('period', 'Period', { required: true, list: true }),
      money('expectedAmount', 'Contract amount', { required: true }), money('actualAmount', 'Actual cost or activity', { required: true }), money('amount', 'Settlement due', { readonly: true, list: true }), area('notes', 'Notes', { span: 2 })],
    actions: [
      { key: 'calculate', label: 'Calculate', from: ['DRAFT', 'REJECTED'], to: 'CALCULATED', tone: 'primary' },
      { key: 'approve', label: 'Approve', from: ['CALCULATED'], to: 'APPROVED', tone: 'approve', independent: true },
      { key: 'reject', label: 'Reject', from: ['CALCULATED'], to: 'REJECTED', tone: 'danger', independent: true, reason: 'required' },
      { key: 'post', label: 'Post to ledger', from: ['APPROVED'], to: 'POSTED', tone: 'primary', hint: 'Creates a balanced journal.' },
    ],
    kpis: [{ label: 'Awaiting approval', metric: 'amount', statuses: ['CALCULATED'], tone: 'attention' }, { label: 'Ready to post', metric: 'count', statuses: ['APPROVED'], tone: 'progress' }, { label: 'Posted', metric: 'amount', statuses: ['POSTED'], tone: 'success' }],
  },

  /* ===== Accounting ===== */
  {
    key: 'journals', label: 'Journals and exceptions', singular: 'journal', category: 'accounting', icon: 'BookOpen', layout: 'ledger', document: true,
    summary: 'Balanced journals produced by billing events. Missing GL mappings stop posting and appear here as exceptions.',
    prefix: 'JNL', create: false, editable: [], initial: 'POSTED', titleField: 'sourceDocument',
    statuses: [s('EXCEPTION', 'danger'), s('POSTED', 'success'), s('REVERSED', 'muted')], path: ['EXCEPTION', 'POSTED'],
    fields: [text('sourceDocument', 'Source document', { required: true, list: true }), date('postingDate', 'Posting date', { list: true }), money('amount', 'Total debits', { readonly: true }), text('exception', 'Exception', { readonly: true, span: 2 }),
      lines('lines', 'Lines', { readonly: true, span: 2, columns: [text('account', 'Account'), text('role', 'Role'), money('debit', 'Debit'), money('credit', 'Credit')] }), branch()],
    actions: [
      { key: 'resolve', label: 'Resolve and post', from: ['EXCEPTION'], to: 'POSTED', tone: 'primary', reason: 'required', hint: 'Use after the missing mapping is approved in Tenant Admin.' },
      { key: 'reverse', label: 'Reverse journal', from: ['POSTED'], to: 'REVERSED', tone: 'danger', independent: true, optional: true, reason: 'required' },
    ],
    kpis: [{ label: 'Exceptions', metric: 'count', statuses: ['EXCEPTION'], tone: 'danger' }, { label: 'Value blocked', metric: 'amount', statuses: ['EXCEPTION'], tone: 'danger' }, { label: 'Posted', metric: 'amount', statuses: ['POSTED'], tone: 'success' }],
  },
  {
    key: 'gl-reconciliations', label: 'GL reconciliation', singular: 'reconciliation', category: 'accounting', icon: 'Columns3', layout: 'queue',
    summary: 'Match subledger balances to the general ledger for each control account and period.',
    prefix: 'GLR', create: true, editable: ['OPEN', 'VARIANCE'], initial: 'OPEN', titleField: 'account',
    statuses: [s('OPEN', 'info'), s('MATCHED', 'progress', 'Matched, awaiting sign-off'), s('VARIANCE', 'attention', 'Variance found'), s('RECONCILED', 'success')], path: ['OPEN', 'MATCHED', 'RECONCILED'],
    fields: [ref('account', 'Control account', { source: 'accounts', required: true, list: true }), text('period', 'Period', { required: true, list: true }), amount('Subledger balance'), money('glBalance', 'GL balance', { required: true }), money('variance', 'Variance', { readonly: true, list: true }), area('explanation', 'Explanation', { span: 2 })],
    actions: [
      { key: 'compare', label: 'Compare balances', from: ['OPEN', 'VARIANCE'], to: '*', tone: 'primary' },
      { key: 'sign-off', label: 'Sign off', from: ['MATCHED', 'VARIANCE'], to: 'RECONCILED', tone: 'approve', independent: true, reason: 'optional', hint: 'A variance needs an explanation before sign-off.' },
    ],
    kpis: [{ label: 'Variances', metric: 'count', statuses: ['VARIANCE'], tone: 'attention' }, { label: 'Awaiting sign-off', metric: 'count', statuses: ['MATCHED'], tone: 'progress' }, { label: 'Reconciled', metric: 'count', statuses: ['RECONCILED'], tone: 'success' }],
  },
  {
    key: 'exports', label: 'Exports', singular: 'export batch', category: 'accounting', icon: 'FileOutput', layout: 'queue',
    summary: 'Batches of posted journals for the ERP. Each batch is approved before export and carries a checksum.',
    prefix: 'EXP', create: true, editable: ['PREPARED'], initial: 'PREPARED', titleField: 'target',
    statuses: [s('PREPARED', 'info'), s('APPROVED', 'progress', 'Approved'), s('EXPORTED', 'success'), s('FAILED', 'danger')], path: ['PREPARED', 'APPROVED', 'EXPORTED'],
    fields: [text('period', 'Period', { required: true, list: true }), sel('target', 'Target', { options: o('ERP_CSV', 'SAP_IDOC', 'ORACLE_GL', 'JSON'), required: true, list: true }), num('entries', 'Journals', { required: true, min: 1, list: true }), amount('Total debits'), text('checksum', 'Checksum', { readonly: true, span: 2 })],
    actions: [
      { key: 'approve', label: 'Approve batch', from: ['PREPARED'], to: 'APPROVED', tone: 'approve', independent: true },
      { key: 'export', label: 'Export now', from: ['APPROVED'], to: 'EXPORTED', tone: 'primary' },
      { key: 'fail', label: 'Record failure', from: ['APPROVED'], to: 'FAILED', tone: 'danger', reason: 'required' },
      { key: 'retry', label: 'Retry', from: ['FAILED'], to: 'APPROVED', tone: 'quiet' },
    ],
    kpis: [{ label: 'Awaiting approval', metric: 'count', statuses: ['PREPARED'], tone: 'info' }, { label: 'Ready to export', metric: 'count', statuses: ['APPROVED'], tone: 'progress' }, { label: 'Failed', metric: 'count', statuses: ['FAILED'], tone: 'danger' }],
  },

  /* ===== Cross-cutting ===== */
  {
    key: 'tasks', label: 'Workflow worklist', singular: 'task', category: 'cross', icon: 'KanbanSquare', layout: 'board',
    summary: 'Checkpoint tasks from claim, appeal, coding and collection workflows. Pick one up, block it with a reason, or finish it.',
    prefix: 'TSK', create: true, editable: ['OPEN', 'IN_PROGRESS', 'BLOCKED'], initial: 'OPEN', titleField: 'title',
    statuses: [s('OPEN', 'info', 'To do'), s('IN_PROGRESS', 'progress', 'In progress'), s('BLOCKED', 'danger'), s('DONE', 'success')], path: ['OPEN', 'IN_PROGRESS', 'DONE'], board: ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE'],
    fields: [text('title', 'Task', { required: true, list: true, span: 2 }), sel('workflow', 'Workflow', { options: o('CLAIM', 'APPEAL', 'CODING', 'COLLECTION', 'CASH'), required: true, list: true }), text('linkedRef', 'Linked record'), ref('assignee', 'Assignee', { source: 'users', list: true }),
      sel('priority', 'Priority', { options: o('HIGH', 'MEDIUM', 'LOW'), required: true, list: true }), date('dueDate', 'Due'), text('checkpoint', 'Checkpoint'), branch()],
    actions: [
      { key: 'start', label: 'Start', from: ['OPEN'], to: 'IN_PROGRESS', tone: 'primary' },
      { key: 'block', label: 'Block', from: ['OPEN', 'IN_PROGRESS'], to: 'BLOCKED', tone: 'danger', reason: 'required' },
      { key: 'unblock', label: 'Unblock', from: ['BLOCKED'], to: 'IN_PROGRESS', tone: 'quiet' },
      { key: 'complete', label: 'Complete', from: ['IN_PROGRESS'], to: 'DONE', tone: 'approve', reason: 'optional' },
    ],
    kpis: [{ label: 'To do', metric: 'count', statuses: ['OPEN'], tone: 'info' }, { label: 'In progress', metric: 'count', statuses: ['IN_PROGRESS'], tone: 'progress' }, { label: 'Blocked', metric: 'count', statuses: ['BLOCKED'], tone: 'danger' }, { label: 'Overdue', metric: 'count', statuses: ['OPEN', 'IN_PROGRESS', 'BLOCKED'], overdue: true, tone: 'danger' }],
  },
  {
    key: 'assistance', label: 'Assistance', singular: 'suggestion', category: 'cross', icon: 'Sparkles', layout: 'queue',
    summary: 'Suggestions from operational assistance. They never change records; a person accepts or dismisses each one.',
    prefix: 'AST', create: false, editable: [], initial: 'NEW', titleField: 'source',
    statuses: [s('NEW', 'attention', 'To review'), s('ACCEPTED', 'success'), s('DISMISSED', 'muted')], path: ['NEW', 'ACCEPTED'],
    fields: [sel('source', 'Source', { options: o('CLAIM_COORDINATION_BLOCKER', 'CLAIM_STATE_ATTENTION', 'CODING_WORKLIST', 'CDI_CLARIFICATION'), required: true, list: true }), text('linkedRef', 'About', { list: true }),
      area('suggestion', 'Suggestion', { required: true, span: 2 }), pct('confidence', 'Confidence', { list: true }), area('rationale', 'Why it was suggested', { span: 2 }), branch()],
    actions: [
      { key: 'accept', label: 'Accept', from: ['NEW'], to: 'ACCEPTED', tone: 'approve', reason: 'optional', hint: 'Accepting records your review. Make the change yourself on the linked record.' },
      { key: 'dismiss', label: 'Dismiss', from: ['NEW'], to: 'DISMISSED', tone: 'quiet', reason: 'required' },
    ],
    kpis: [{ label: 'To review', metric: 'count', statuses: ['NEW'], tone: 'attention' }, { label: 'Accepted', metric: 'count', statuses: ['ACCEPTED'], tone: 'success' }, { label: 'Dismissed', metric: 'count', statuses: ['DISMISSED'] }],
  },
];

export const RESOURCES = R;
export const RESOURCE_MAP = new Map(R.map((r) => [r.key, r]));
export const tableName = (k: string) => 'ws_' + k.replace(/-/g, '_');

/* ------------------------------------------------------------------ */
/* Navigation: 8 categories, 40 pages in the order of the brief        */
/* ------------------------------------------------------------------ */

const page = (key: string): PageDef => {
  const r = RESOURCE_MAP.get(key)!;
  return { key, label: r.label, icon: r.icon, href: `/w/${key}`, kind: 'resource', summary: r.summary };
};
const dash = (key: string, label: string, icon: string, href: string, summary: string): PageDef => ({ key, label, icon, href, kind: 'dashboard', summary });

export const CATEGORIES: CategoryDef[] = [
  { key: 'front', label: 'Front office', short: 'Front', icon: 'ConciergeBell', summary: 'Coverage, authorization, estimates, deposits and the cash drawer.',
    pages: [dash('home', 'Billing home', 'Home', '/', 'Today across every queue.'), page('coverages'), page('authorizations'), page('eligibility'), page('estimates'), page('deposits'), page('cash-sessions')] },
  { key: 'charges', label: 'Charges and documents', short: 'Charges', icon: 'Receipt', summary: 'From captured charge to issued invoice and its notes.',
    pages: [page('encounters'), page('charges'), page('manual-charges'), page('invoices'), page('debit-notes'), page('credit-notes'), page('adjustments')] },
  { key: 'money', label: 'Money', short: 'Money', icon: 'Wallet', summary: 'Receipts, allocation, refunds and prepaid packages.', pages: [page('receipts'), page('refunds'), page('packages')] },
  { key: 'insurance', label: 'Insurance', short: 'Insurance', icon: 'ShieldPlus', summary: 'Claims, exchange, remittances, appeals and payer balances.',
    pages: [page('claims'), page('exchange-messages'), page('remittances'), page('remittance-corrections'), page('appeals'), page('payer-reconciliations'), page('responsibility-transfers')] },
  { key: 'receivables', label: 'Receivables', short: 'AR', icon: 'TrendingUp', summary: 'Aging, plans, statements, collections and reporting.',
    pages: [dash('aging', 'Aging', 'BarChart3', '/aging', 'Open balances by age and party.'), page('payment-plans'), page('statements'), page('collections'), dash('reports', 'Reports', 'PieChart', '/reports', 'Revenue cycle performance.')] },
  { key: 'coding', label: 'Coding and models', short: 'Coding', icon: 'Code2', summary: 'Coding, clinical clarification, grouping and model settlements.',
    pages: [page('coding-cases'), page('cdi-queries'), page('drg-groupings'), page('em-determinations'), page('model-settlements')] },
  { key: 'accounting', label: 'Accounting', short: 'Ledger', icon: 'BookOpen', summary: 'Journals, exceptions, reconciliation and ERP exports.', pages: [page('journals'), page('gl-reconciliations'), page('exports')] },
  { key: 'cross', label: 'Cross-cutting', short: 'Team', icon: 'Users', summary: 'Approvals, workflow tasks and assistance suggestions.',
    pages: [dash('approvals', 'Approvals inbox', 'Inbox', '/approvals', 'Everything waiting for a second person.'), page('tasks'), page('assistance')] },
];
