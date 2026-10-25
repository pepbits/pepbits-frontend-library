/**
 * Resource registry — the single source of truth for every Tenant Admin page.
 * The frontend renders forms, tables and navigation from GET /api/meta, so a
 * field added here appears in the UI, the validator and the API at once.
 */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'decimal' | 'money' | 'percent' | 'date'
  | 'boolean' | 'select' | 'multiselect' | 'tags' | 'ref' | 'refs' | 'lines';

export type Option = { value: string; label: string; group?: string };

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Option[];
  ref?: string;
  help?: string;
  section?: string;
  list?: boolean;
  min?: number;
  max?: number;
  maxItems?: number;
  placeholder?: string;
  span?: 1 | 2;
  upper?: boolean;
  columns?: FieldDef[];
  tenantOnly?: boolean;
  alwaysRequired?: boolean;
}

export interface ResourceDef {
  key: string;
  label: string;
  singular: string;
  category: string;
  icon: string;
  summary: string;
  governance: 'versioned' | 'simple';
  effectiveDated: boolean;
  codePrefix: string;
  sections?: string[];
  fields: FieldDef[];
  check?: (data: Record<string, any>) => Record<string, string | undefined>;
  /** When true, only fields marked alwaysRequired are enforced (e.g. branch overrides). */
  relaxRequired?: (data: Record<string, any>) => boolean;
}

export interface CategoryDef { key: string; label: string; short: string; icon: string; summary: string }

/* ------------------------------------------------------------------ */
/* Reference vocabularies                                              */
/* ------------------------------------------------------------------ */

const o = (...values: string[]): Option[] =>
  values.map((v) => ({ value: v, label: humanize(v) }));

export function humanize(code: string): string {
  const keep = new Set(['FFS', 'DRG', 'MPR', 'PMPM', 'P4P', 'TPA', 'GL', 'AR', 'OOP', 'REST', 'JSON', 'XML', 'SOAP', 'X12', 'FHIR', 'NPHIES', 'MTLS', 'HMAC', 'OAUTH2', 'E&M', 'EM', 'SMS', 'ISO', 'USD', 'SAR', 'AED', 'AI']);
  return code
    .split('_')
    .map((w, i) => (keep.has(w) ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ');
}

export const TENANT = {
  name: 'Meridian Care Network',
  environment: 'DEV',
  sourceBaseline: 'f75dc3e0d2855578abbd65a3515878b9e159b3fc',
  timezone: 'Asia/Riyadh',
};

export const LEGAL_ENTITIES: Option[] = [
  { value: 'MCN-KSA', label: 'Meridian Care KSA LLC' },
  { value: 'MCN-UAE', label: 'Meridian Care UAE FZ-LLC' },
];

export const BRANCHES: (Option & { legalEntity: string; city: string })[] = [
  { value: 'RUH-CENTRAL', label: 'Riyadh Central Hospital', legalEntity: 'MCN-KSA', city: 'Riyadh' },
  { value: 'JED-DAYSURG', label: 'Jeddah Day Surgery Centre', legalEntity: 'MCN-KSA', city: 'Jeddah' },
  { value: 'DXB-DHCC', label: 'Dubai Healthcare City Clinic', legalEntity: 'MCN-UAE', city: 'Dubai' },
  { value: 'AUH-SPECIALTY', label: 'Abu Dhabi Specialty Centre', legalEntity: 'MCN-UAE', city: 'Abu Dhabi' },
];

export const CURRENCIES = o('SAR', 'AED', 'USD', 'EUR', 'GBP', 'QAR', 'KWD', 'BHD', 'OMR');

const PERMISSION_CODES = [
  'READ', 'CAPTURE', 'MANUAL_CHARGE', 'REPRICE', 'REVERSE', 'DRAFT', 'ISSUE', 'RECEIPT',
  'ALLOCATE', 'VOID_RECEIPT', 'DEPOSIT_TRANSFER', 'DEPOSIT_TRANSFER_APPROVE', 'ESTIMATE', 'CLEARANCE_OVERRIDE',
  'CLEARANCE_OVERRIDE_APPROVE', 'CREDIT', 'CREDIT_ISSUE', 'ADJUST', 'ADJUST_APPROVE', 'REFUND', 'REFUND_APPROVE',
  'PACKAGE_SELL', 'PACKAGE_CANCEL', 'CLAIM', 'REMIT', 'PACKAGE_RESERVE', 'PACKAGE_REFUND_APPROVE', 'REMIT_APPROVE',
  'TRANSFER', 'TRANSFER_APPROVE', 'REFUND_DISPATCH', 'CAPTURE_BIND', 'ELIGIBILITY', 'EXCHANGE_DISPATCH',
  'AUTHORIZATION', 'AUTHORIZATION_APPROVE', 'CASH_SESSION', 'CASH_REVIEW', 'DEBIT_NOTE', 'DEBIT_NOTE_ISSUE',
  'PAYMENT_PLAN', 'PAYMENT_PLAN_APPROVE', 'STATEMENT', 'DUNNING', 'COLLECTIONS_APPROVE', 'PAYER_TRANSFER',
  'PAYER_TRANSFER_APPROVE', 'APPEAL', 'APPEAL_APPROVE', 'EM_TABLE', 'EM_TABLE_APPROVE', 'EM_TENANT_TABLE',
  'EM_TENANT_TABLE_APPROVE', 'EM_CODE', 'EM_CODE_APPROVE', 'STAY_CONFIG', 'STAY_CONFIG_APPROVE', 'PROCEDURE_GROUP',
  'ADV_PROPOSE', 'ADV_APPROVE', 'ADV_SETTLE', 'DRG_GROUP', 'DRG_CONFIG', 'DRG_CONFIG_APPROVE', 'DRG_TENANT_CONFIG',
  'DRG_TENANT_CONFIG_APPROVE', 'WORKFLOW_DEFINITION_AUTHOR', 'WORKFLOW_DEFINITION_APPROVE', 'RULE_DEFINITION_AUTHOR',
  'RULE_DEFINITION_APPROVE', 'WIRE_PROFILE', 'WIRE_PROFILE_APPROVE', 'CATEGORY_CONFIG', 'CATEGORY_CONFIG_APPROVE',
  'CATEGORY_TENANT_CONFIG', 'CATEGORY_TENANT_CONFIG_APPROVE', 'CATEGORY_CLASSIFY', 'COLLECTION_PROFILE_AUTHOR',
  'COLLECTION_PROFILE_APPROVE', 'COLLECTION_TENANT_PROFILE_AUTHOR', 'COLLECTION_TENANT_PROFILE_APPROVE',
  'COLLECTION_CREATE', 'COLLECTION_DISPATCH', 'COLLECTION_RECONCILE', 'AI_ASSIST', 'AI_CONFIG', 'AI_CONFIG_APPROVE',
  'AI_TENANT_CONFIG', 'AI_TENANT_CONFIG_APPROVE', 'AI_PROFILE_PUBLISH', 'MARKETPLACE_PUBLISH', 'MARKETPLACE_REVIEW',
  'MARKETPLACE_INSTALL', 'WORKFLOW_RUNTIME_START', 'WORKFLOW_RUNTIME_ADVANCE', 'WORKFLOW_RUNTIME_ADVANCE_ANY',
  'WORKFLOW_RUNTIME_WORKLIST', 'WORKFLOW_RUNTIME_TIMER_WORKER', 'WORKFLOW_RUNTIME_CHILDREN_WORKER',
  'WORKFLOW_RUNTIME_TASK_WORKER', 'FORM_WRITE', 'EVENT_CONSUME', 'EVENT_REPAIR',
];

function permissionGroup(code: string): string {
  if (/^(READ|CAPTURE|MANUAL_CHARGE|REPRICE|REVERSE|DRAFT|ISSUE|DEBIT_NOTE|CREDIT|ADJUST)/.test(code)) return 'Charges and documents';
  if (/^(RECEIPT|ALLOCATE|VOID_RECEIPT|DEPOSIT|ESTIMATE|CLEARANCE|REFUND|CASH|PACKAGE)/.test(code)) return 'Money and deposits';
  if (/^(CLAIM|REMIT|TRANSFER|ELIGIBILITY|EXCHANGE|AUTHORIZATION|APPEAL|PAYER_TRANSFER)/.test(code)) return 'Insurance and claims';
  if (/^(PAYMENT_PLAN|STATEMENT|DUNNING|COLLECTIONS_APPROVE)/.test(code)) return 'Receivables';
  if (/^(EM_|STAY|PROCEDURE|ADV_|DRG|CATEGORY)/.test(code)) return 'Reimbursement models';
  if (/^(COLLECTION_|WIRE)/.test(code)) return 'Providers and wire profiles';
  return 'Platform and automation';
}

export const PERMISSIONS: Option[] = PERMISSION_CODES.map((c) => ({ value: c, label: humanize(c), group: permissionGroup(c) }));

const SERVICE_MODELS = o('FFS_CATALOG', 'FFS_MODIFIERS', 'PER_DIEM', 'CASE_RATE', 'DRG', 'DAYCASE_DRG', 'COST_PLUS', 'CAPITATION', 'CATEGORY_RATE');
const CARE_SETTINGS = o('OUTPATIENT', 'INPATIENT', 'DAYCASE', 'EMERGENCY', 'HOME_CARE');
const ROUNDING = o('HALF_UP', 'HALF_EVEN', 'DOWN', 'UP');
const GL_ROLES = o('PATIENT_AR', 'PAYER_AR', 'SERVICE_REVENUE', 'TAX_PAYABLE', 'UNAPPLIED_CASH', 'TENDER_CLEARING', 'CONTRACT_ALLOWANCE', 'WRITE_OFF', 'REFUND_CLEARING', 'CASH_ROUNDING', 'OVER_SHORT', 'MODEL_AR', 'CONTRACT_REVENUE', 'TRANSFER_CLEARING');

/* ------------------------------------------------------------------ */
/* Field helpers                                                       */
/* ------------------------------------------------------------------ */

type FieldOpts = Omit<Partial<FieldDef>, 'key' | 'label' | 'type'>;
const F = (type: FieldType) => (key: string, label: string, opts: FieldOpts = {}): FieldDef => ({ key, label, type, ...opts });
const text = F('text'); const area = F('textarea'); const num = F('number'); const dec = F('decimal');
const money = F('money'); const pct = F('percent'); const date = F('date'); const bool = F('boolean');
const sel = F('select'); const multi = F('multiselect'); const tags = F('tags'); const ref = F('ref');
const refs = F('refs'); const lines = F('lines');
const codes = (key: string, label: string, opts: FieldOpts = {}) => tags(key, label, { upper: true, maxItems: 30, ...opts });

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const CATEGORIES: CategoryDef[] = [
  { key: 'access', label: 'Access and numbering', short: 'Access', icon: 'ShieldCheck', summary: 'Who may do what, in which branch, and how documents are numbered.' },
  { key: 'catalogue', label: 'Catalogue and pricing', short: 'Catalogue', icon: 'PackageSearch', summary: 'Billable items, tariffs, tax, discounts and published commercial releases.' },
  { key: 'payers', label: 'Payers and coverage', short: 'Payers', icon: 'Landmark', summary: 'Insurers, TPAs, plans, contracts and what each branch accepts.' },
  { key: 'policy', label: 'Billing policy and models', short: 'Policy', icon: 'Scale', summary: 'The tenant billing policy and every reimbursement model it can select.' },
  { key: 'exchange', label: 'Exchange and providers', short: 'Exchange', icon: 'Waypoints', summary: 'Payer exchange profiles and payment provider bindings.' },
  { key: 'ledger', label: 'Accounting', short: 'Ledger', icon: 'BookOpenCheck', summary: 'Chart of accounts, posting mappings and fiscal periods.' },
  { key: 'platform', label: 'Platform', short: 'Platform', icon: 'Workflow', summary: 'Workflow definitions, assistance and marketplace packages.' },
];

/* ------------------------------------------------------------------ */
/* Resources (30)                                                      */
/* ------------------------------------------------------------------ */

const branchSel = (opts: FieldOpts = {}) => sel('branch', 'Branch', { options: BRANCHES, ...opts });
const leSel = (opts: FieldOpts = {}) => sel('legalEntity', 'Legal entity', { options: LEGAL_ENTITIES, required: true, list: true, ...opts });

const RES: ResourceDef[] = [
  /* ---------------- Access ---------------- */
  {
    key: 'billing-grants', label: 'Billing access grants', singular: 'billing grant', category: 'access', icon: 'KeyRound',
    summary: 'Per-identity, per-branch billing permissions. The latest grant for a person and branch is the one that counts.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'GRT',
    fields: [
      text('identitySubject', 'Identity subject', { required: true, help: 'Verified identity UUID from the identity provider.', placeholder: '3f8a2c1e-5b7d-4e0a-9c11-2d4e6f8a0b1c' }),
      text('staffEmail', 'Staff email', { required: true, list: true }),
      branchSel({ required: true, list: true }),
      bool('enabled', 'Grant enabled', { list: true, help: 'A later disabled grant revokes access; an older enabled grant never revives it.' }),
      multi('permissions', 'Permissions', { options: PERMISSIONS, required: true, span: 2, help: 'READ is required with every operational permission.' }),
      area('notes', 'Purpose', { span: 2 }),
    ],
    check: (d) => {
      const e: Record<string, string> = {};
      if (Array.isArray(d.permissions) && d.permissions.length && !d.permissions.includes('READ')) e.permissions = 'Include READ alongside any operational permission.';
      return e;
    },
  },
  {
    key: 'commercial-grants', label: 'Commercial authority', singular: 'commercial authority grant', category: 'access', icon: 'BadgeCheck',
    summary: 'Explicit rights to read, author or publish commercial catalogue tables. Module access alone is not enough.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'CAG',
    fields: [
      text('grantee', 'Grantee email', { required: true, list: true }),
      sel('scope', 'Scope', { options: o('TENANT', 'PRICE_BOOK', 'PARTY'), required: true, list: true }),
      text('scopeTarget', 'Scope target', { help: 'Price book or party code when the scope is narrower than the tenant.' }),
      multi('actions', 'Actions', { options: o('READ', 'AUTHOR', 'PUBLISH', 'APPROVE'), required: true, list: true }),
      multi('tables', 'Commercial tables', { span: 2, required: true, options: o('CATALOG_PRICE_BOOK', 'CATALOG_PRICE', 'CATALOG_PRICE_RULE', 'CATALOG_DISCOUNT_RULE', 'CATALOG_TAX_RULE', 'CATALOG_CONTRACT', 'CATALOG_INSURANCE_PLAN', 'CATALOG_NETWORK', 'CATALOG_COMMERCIAL_PARTY') }),
    ],
  },
  {
    key: 'numbering', label: 'Document numbering', singular: 'numbering rule', category: 'access', icon: 'Hash',
    summary: 'Number sequences consumed when invoices, receipts, credit notes and claims are issued.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'NUM',
    fields: [
      sel('documentType', 'Document type', { options: o('INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE', 'RECEIPT', 'REFUND', 'STATEMENT', 'CLAIM', 'ESTIMATE'), required: true, list: true }),
      leSel(),
      text('pattern', 'Pattern', { required: true, list: true, placeholder: 'INV-{BR}-{YYYY}-{SEQ:6}', help: 'Tokens: {BR} branch, {YYYY} year, {MM} month, {SEQ:n} zero-padded sequence.' }),
      num('nextNumber', 'Next number', { required: true, min: 1 }),
      sel('resetCycle', 'Reset cycle', { options: o('NEVER', 'YEARLY', 'MONTHLY'), required: true }),
      bool('branchScoped', 'Separate sequence per branch'),
    ],
  },

  /* ---------------- Catalogue ---------------- */
  {
    key: 'items', label: 'Items and services', singular: 'item', category: 'catalogue', icon: 'Stethoscope',
    summary: 'The billable service catalogue: kind, unit, category and tax classification.',
    governance: 'simple', effectiveDated: false, codePrefix: 'ITM',
    fields: [
      sel('kind', 'Kind', { options: o('SERVICE', 'PROCEDURE', 'LABORATORY', 'IMAGING', 'MEDICINE', 'CONSUMABLE', 'ACCOMMODATION', 'PACKAGE'), required: true, list: true }),
      ref('category', 'Category', { ref: 'categories', list: true }),
      sel('unit', 'Billing unit', { options: o('EACH', 'VISIT', 'DAY', 'HOUR', 'TABLET', 'ML', 'SESSION', 'CASE'), required: true }),
      sel('taxCategory', 'Tax category', { options: o('STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE'), required: true, list: true }),
      text('terminologyCode', 'Terminology code', { placeholder: 'e.g. CPT 99213' }),
      bool('billable', 'Billable', { list: true }),
      bool('manualFee', 'Allowed as manual fee'),
      area('description', 'Description', { span: 2 }),
    ],
  },
  {
    key: 'categories', label: 'Categories and terminology', singular: 'category', category: 'catalogue', icon: 'FolderTree',
    summary: 'Category tree, service groups and the terminology releases items are coded against.',
    governance: 'simple', effectiveDated: false, codePrefix: 'CAT',
    fields: [
      sel('type', 'Type', { options: o('CATEGORY', 'GROUP', 'TERMINOLOGY_RELEASE'), required: true, list: true }),
      ref('parent', 'Parent category', { ref: 'categories', list: true }),
      text('system', 'Terminology system', { placeholder: 'ICD-10-AM, CPT, SNOMED CT' }),
      text('release', 'Release', { placeholder: '2026-07' }),
      area('description', 'Description', { span: 2 }),
    ],
  },
  {
    key: 'tax-rules', label: 'Tax rules', singular: 'tax rule', category: 'catalogue', icon: 'Percent',
    summary: 'Jurisdiction tax treatment per tax category. Missing treatment sends charges to review — never to zero tax.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'TAX',
    fields: [
      text('jurisdiction', 'Jurisdiction', { required: true, upper: true, list: true, placeholder: 'SA' }),
      sel('taxCategory', 'Tax category', { options: o('STANDARD', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE'), required: true, list: true }),
      sel('treatment', 'Treatment', { options: o('TAXABLE', 'ZERO_RATED', 'EXEMPT', 'OUT_OF_SCOPE'), required: true, list: true }),
      pct('ratePercent', 'Rate', { required: true }),
      sel('appliesTo', 'Applies to', { options: o('ALL_PATIENTS', 'CITIZENS', 'NON_CITIZENS'), required: true }),
    ],
    check: (d) => (d.treatment && d.treatment !== 'TAXABLE' && Number(d.ratePercent) > 0 ? { ratePercent: 'Only taxable treatment can carry a rate above zero.' } : {}),
  },
  {
    key: 'price-books', label: 'Price books and prices', singular: 'price book', category: 'catalogue', icon: 'BookText',
    summary: 'Tariff books with currency, precision and rounding, and the item rates inside each book.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'PB',
    sections: ['Book', 'Rates'],
    fields: [
      sel('bookType', 'Book type', { options: o('SELF_PAY', 'INSURED'), required: true, list: true, section: 'Book' }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true, list: true, section: 'Book' }),
      num('precision', 'Decimal places', { required: true, min: 0, max: 3, section: 'Book' }),
      sel('rounding', 'Rounding', { options: ROUNDING, required: true, section: 'Book' }),
      sel('scope', 'Scope', { options: o('TENANT', 'BRANCH'), required: true, section: 'Book' }),
      branchSel({ section: 'Book', help: 'Only for branch-scoped books.' }),
      lines('rates', 'Item rates', {
        section: 'Rates', span: 2, columns: [
          ref('item', 'Item', { ref: 'items', required: true }),
          money('price', 'Unit price', { required: true }),
          num('minQuantity', 'Min qty', { min: 1 }),
          date('validUntil', 'Valid until'),
        ],
      }),
    ],
    check: (d) => {
      const e: Record<string, string> = {};
      if (d.scope === 'BRANCH' && !d.branch) e.branch = 'Choose the branch for a branch-scoped book.';
      if (d.scope === 'TENANT' && d.branch) e.branch = 'Tenant-wide books cannot name a branch.';
      return e;
    },
  },
  {
    key: 'discounts', label: 'Discounts', singular: 'discount', category: 'catalogue', icon: 'TicketPercent',
    summary: 'Governed discounts with scope, eligibility, combination and before- or after-tax timing.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'DSC',
    fields: [
      sel('scope', 'Scope', { options: o('ITEM', 'CATEGORY', 'PRICE_BOOK'), required: true, list: true }),
      text('target', 'Target code', { required: true, list: true }),
      sel('discountType', 'Type', { options: o('PERCENT', 'FIXED_AMOUNT'), required: true }),
      dec('value', 'Value', { required: true, list: true }),
      sel('combination', 'Combination', { options: o('MOST_SPECIFIC', 'STACK', 'BEST_PRICE'), required: true }),
      sel('timing', 'Timing', { options: o('BEFORE_TAX', 'AFTER_TAX'), required: true }),
      text('eligibility', 'Eligibility rule', { placeholder: 'e.g. Staff and dependants', span: 2 }),
      money('maxPerVisit', 'Maximum per visit'),
    ],
    check: (d) => (d.discountType === 'PERCENT' && Number(d.value) > 100 ? { value: 'A percentage discount cannot exceed 100.' } : {}),
  },
  {
    key: 'modifiers', label: 'Modifiers and MPR', singular: 'modifier', category: 'catalogue', icon: 'SlidersHorizontal',
    summary: 'Procedure modifiers and multiple-procedure reduction ranks used by FFS_MODIFIERS pricing.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'MOD',
    fields: [
      text('modifierCode', 'Modifier code', { required: true, upper: true, list: true, placeholder: '50' }),
      sel('adjustment', 'Adjustment', { options: o('PERCENT_OF_BASE', 'FIXED_ADDITION', 'MULTIPLIER'), required: true, list: true }),
      dec('value', 'Value', { required: true, list: true }),
      tags('compatibleWith', 'Compatible modifiers', { upper: true, span: 2 }),
      lines('mprRanks', 'Multiple-procedure reduction', {
        span: 2, columns: [num('rank', 'Rank', { required: true, min: 1 }), pct('payPercent', 'Pays', { required: true })],
      }),
    ],
  },
  {
    key: 'commercial-releases', label: 'Commercial releases', singular: 'commercial release', category: 'catalogue', icon: 'Rocket',
    summary: 'Immutable publication of commercial versions. Imported catalogues are not live until a release is approved.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'REL',
    fields: [
      refs('priceBooks', 'Price books', { ref: 'price-books', span: 2, list: true }),
      refs('discounts', 'Discounts', { ref: 'discounts', span: 2 }),
      refs('taxRules', 'Tax rules', { ref: 'tax-rules', span: 2 }),
      sel('publishMode', 'Publish mode', { options: o('IMMEDIATE', 'SCHEDULED'), required: true, list: true }),
      area('releaseNotes', 'Release notes', { span: 2 }),
    ],
  },

  /* ---------------- Payers ---------------- */
  {
    key: 'commercial-parties', label: 'Payers, TPAs and sponsors', singular: 'commercial party', category: 'payers', icon: 'Building2',
    summary: 'Tenant financial identities for insurers, payers, TPAs and corporate sponsors.',
    governance: 'simple', effectiveDated: false, codePrefix: 'PTY',
    fields: [
      multi('roles', 'Roles', { options: o('INSURER', 'PAYER', 'TPA', 'SPONSOR', 'CORPORATE'), required: true, list: true }),
      text('country', 'Country', { required: true, upper: true, list: true, placeholder: 'SA' }),
      text('licenseNumber', 'Regulator licence'),
      text('payerExchangeId', 'Payer exchange ID', { help: 'Identifier used by exchange routes. Not a credential.' }),
      sel('currency', 'Settlement currency', { options: CURRENCIES, required: true }),
      text('contactEmail', 'Claims contact'),
    ],
  },
  {
    key: 'networks', label: 'Networks', singular: 'network', category: 'payers', icon: 'Share2',
    summary: 'Commercial networks referenced by plans, contracts and branch arrangements.',
    governance: 'simple', effectiveDated: false, codePrefix: 'NET',
    fields: [
      ref('owner', 'Network owner', { ref: 'commercial-parties', required: true, list: true }),
      sel('tier', 'Tier', { options: o('PREMIUM', 'GOLD', 'STANDARD', 'BASIC'), required: true, list: true }),
      area('description', 'Description', { span: 2 }),
    ],
  },
  {
    key: 'insurance-plans', label: 'Plans and benefit rules', singular: 'insurance plan', category: 'payers', icon: 'ClipboardList',
    summary: 'Risk bearer, administrator and network for each plan, with the benefit rules that split liability.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'PLN',
    sections: ['Plan', 'Benefit rules'],
    fields: [
      ref('riskBearer', 'Risk bearer', { ref: 'commercial-parties', required: true, list: true, section: 'Plan' }),
      ref('administrator', 'Administrator (TPA)', { ref: 'commercial-parties', list: true, section: 'Plan' }),
      ref('network', 'Network', { ref: 'networks', section: 'Plan' }),
      sel('planClass', 'Plan class', { options: o('VIP', 'A', 'B', 'C', 'BASIC'), required: true, section: 'Plan' }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true, section: 'Plan' }),
      lines('benefitRules', 'Benefit rules', {
        section: 'Benefit rules', span: 2, columns: [
          ref('target', 'Category', { ref: 'categories', required: true }),
          pct('coverage', 'Coverage', { required: true }),
          pct('coinsurance', 'Coinsurance'),
          money('copay', 'Copay'),
          money('deductible', 'Deductible'),
          money('maxBenefit', 'Max benefit'),
        ],
      }),
    ],
  },
  {
    key: 'contracts', label: 'Contracts', singular: 'contract', category: 'payers', icon: 'FileSignature',
    summary: 'Effective commercial terms binding a party, plan and network to a price book.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'CTR',
    fields: [
      ref('party', 'Contract party', { ref: 'commercial-parties', required: true, list: true }),
      ref('plan', 'Plan', { ref: 'insurance-plans', list: true }),
      ref('network', 'Network', { ref: 'networks' }),
      ref('priceBook', 'Price book', { ref: 'price-books', required: true, list: true }),
      num('paymentTermsDays', 'Payment terms (days)', { min: 0, max: 365 }),
      num('claimFilingDays', 'Claim filing window (days)', { min: 1, max: 730 }),
      area('terms', 'Contract terms', { span: 2 }),
    ],
  },
  {
    key: 'branch-arrangements', label: 'Branch arrangements', singular: 'branch arrangement', category: 'payers', icon: 'Handshake',
    summary: 'The exact insurer, TPA, plan, network and contract combinations each branch accepts.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'ARR',
    fields: [
      branchSel({ required: true, list: true }),
      ref('insurer', 'Insurer', { ref: 'commercial-parties', required: true, list: true }),
      ref('administrator', 'Administrator', { ref: 'commercial-parties' }),
      ref('plan', 'Plan', { ref: 'insurance-plans', required: true, list: true }),
      ref('network', 'Network', { ref: 'networks' }),
      ref('contract', 'Contract', { ref: 'contracts', required: true }),
      area('notes', 'Acceptance notes', { span: 2, help: 'Accepting one insurer never accepts its other plans or networks.' }),
    ],
  },
  {
    key: 'benefit-pools', label: 'Benefit pools', singular: 'benefit pool', category: 'payers', icon: 'Users',
    summary: 'Explicit family or aggregate deductible, out-of-pocket and maximum-benefit pools.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'POOL',
    fields: [
      sel('poolType', 'Pool type', { options: o('FAMILY', 'AGGREGATE'), required: true, list: true }),
      ref('plan', 'Plan', { ref: 'insurance-plans', required: true, list: true }),
      sel('period', 'Accumulator period', { options: o('COVERAGE_TERM', 'CALENDAR_YEAR'), required: true }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true }),
      money('familyDeductible', 'Family deductible'),
      money('memberOutOfPocket', 'Member out-of-pocket limit'),
      money('familyOutOfPocket', 'Family out-of-pocket limit'),
      money('familyMaxBenefit', 'Family maximum benefit'),
      money('carryover', 'Carryover cap'),
    ],
  },

  /* ---------------- Policy and models ---------------- */
  {
    key: 'billing-policies', label: 'Billing policy', singular: 'billing policy', category: 'policy', icon: 'ScrollText',
    summary: 'The tenant default and permitted branch overrides. Billing stays closed without an approved, enabled tenant default.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'POL',
    relaxRequired: (d) => d.scope === 'BRANCH',
    sections: ['Core', 'Documents', 'Coverage', 'Claims', 'Deposits and cash', 'Receivables', 'Packages', 'Model pins', 'Governance'],
    fields: [
      sel('scope', 'Scope', { options: o('TENANT', 'BRANCH'), required: true, alwaysRequired: true, list: true, section: 'Core' }),
      branchSel({ section: 'Core', list: true, help: 'Branch overrides only.' }),
      bool('enabled', 'Billing enabled', { required: true, list: true, section: 'Core' }),
      text('jurisdiction', 'Tax jurisdiction', { required: true, upper: true, section: 'Core', placeholder: 'SA' }),
      sel('pricingModel', 'Default pricing model', { options: SERVICE_MODELS, required: true, list: true, section: 'Core' }),
      ref('selfPayBook', 'Self-pay price book', { ref: 'price-books', required: true, section: 'Core' }),
      sel('insuredBookSource', 'Insured book source', { options: o('COVERAGE_CONTRACT'), required: true, section: 'Core' }),
      sel('liabilityMethod', 'Liability method', { options: o('PLAN_BENEFIT_RULE', 'PAYER_FULL'), required: true, section: 'Core' }),
      sel('taxAllocation', 'Tax allocation', { options: o('PROPORTIONAL', 'PATIENT'), required: true, section: 'Core' }),
      sel('captureTrigger', 'Capture trigger', { options: o('OCCURRENCE_COMPLETED'), required: true, section: 'Core' }),
      bool('independentIssue', 'Independent document issue', { required: true, section: 'Core' }),

      refs('manualChargeItems', 'Manual fee items', { ref: 'items', section: 'Documents', span: 2, maxItems: 200 }),
      codes('settlementMethods', 'Receipt methods', { section: 'Documents', placeholder: 'CASH, CARD_TERMINAL' }),
      codes('refundMethods', 'Refund methods', { section: 'Documents' }),
      codes('creditReasonCodes', 'Credit note reasons', { section: 'Documents' }),
      codes('debitNoteReasonCodes', 'Debit note reasons', { section: 'Documents' }),
      codes('adjustmentReasonCodes', 'Adjustment reasons', { section: 'Documents' }),
      bool('independentReceiptVoid', 'Independent receipt void', { section: 'Documents' }),
      bool('independentCreditIssue', 'Independent credit issue', { section: 'Documents' }),

      sel('accumulatorPeriod', 'Accumulator period', { options: o('COVERAGE_TERM', 'CALENDAR_YEAR'), section: 'Coverage' }),
      num('maxPayerLevels', 'Maximum payer levels', { min: 1, max: 3, section: 'Coverage' }),
      sel('copayBasis', 'Copay basis', { options: o('LINE', 'VISIT', 'DAY'), section: 'Coverage' }),
      bool('benefitPools', 'Benefit pools enabled', { section: 'Coverage' }),

      codes('claimSubmissionChannels', 'Claim submission channels', { section: 'Claims' }),
      codes('denialReasonCodes', 'Denial reasons', { section: 'Claims' }),
      codes('remittanceCorrectionReasonCodes', 'Remittance correction reasons', { section: 'Claims' }),
      codes('appealReasonCodes', 'Appeal reasons', { section: 'Claims' }),
      num('appealFilingDays', 'Appeal filing window (days)', { min: 1, max: 730, section: 'Claims' }),
      num('maxAppealLevels', 'Maximum appeal levels', { min: 1, max: 3, section: 'Claims' }),
      bool('insuranceExchange', 'Electronic insurance exchange', { section: 'Claims' }),
      num('exchangeMaxAttempts', 'Exchange retry attempts', { min: 1, max: 10, section: 'Claims' }),

      bool('encounterDeposits', 'Encounter deposits', { section: 'Deposits and cash' }),
      codes('depositTransferReasonCodes', 'Deposit transfer reasons', { section: 'Deposits and cash' }),
      bool('admissionDepositClearance', 'Admission deposit clearance', { section: 'Deposits and cash' }),
      pct('admissionDepositEstimatePercent', 'Deposit % of estimate', { section: 'Deposits and cash' }),
      num('estimateValidityDays', 'Estimate validity (days)', { min: 1, max: 365, section: 'Deposits and cash' }),
      num('clearanceOverrideValidityHours', 'Override validity (hours)', { min: 1, max: 720, section: 'Deposits and cash' }),
      codes('cashSessionMethods', 'Drawer tender methods', { section: 'Deposits and cash', maxItems: 10 }),
      num('cashSessionMaxOpenHours', 'Drawer max open hours', { min: 1, max: 72, section: 'Deposits and cash' }),
      bool('cashSessionBlindCount', 'Blind count at close', { section: 'Deposits and cash' }),

      multi('receivableCurrencies', 'Receivable currencies', { options: CURRENCIES, section: 'Receivables' }),
      multi('paymentPlanCadences', 'Payment plan cadences', { options: o('WEEKLY', 'BIWEEKLY', 'MONTHLY'), section: 'Receivables' }),
      num('paymentPlanMaxInstallments', 'Max installments', { min: 2, max: 60, section: 'Receivables' }),
      num('paymentPlanGraceDays', 'Grace days', { min: 0, max: 90, section: 'Receivables' }),
      num('statementCadenceDays', 'Statement cadence (days)', { min: 1, max: 366, section: 'Receivables' }),
      multi('statementChannels', 'Statement channels', { options: o('PRINT', 'POSTAL_MAIL', 'EMAIL', 'SMS', 'PATIENT_PORTAL'), section: 'Receivables' }),
      tags('agingBucketDays', 'Aging buckets (days)', { section: 'Receivables', placeholder: '30, 60, 90', maxItems: 5 }),

      refs('packageItems', 'Package items', { ref: 'items', section: 'Packages', span: 2, maxItems: 200 }),
      num('packageValidityDays', 'Package validity (days)', { min: 1, max: 3650, section: 'Packages' }),
      bool('packageReservations', 'Package reservations', { section: 'Packages' }),
      sel('packagePartialCancellation', 'Partial cancellation formula', { options: o('UNUSED_QUANTITY_SHARE_V1', 'UNUSED_CATALOG_VALUE_SHARE_V1'), section: 'Packages' }),
      pct('packageCancellationFeePercent', 'Cancellation fee', { section: 'Packages' }),

      ref('stayConfiguration', 'Stay and case model', { ref: 'stay-models', section: 'Model pins' }),
      ref('advancedConfiguration', 'Advanced model', { ref: 'advanced-models', section: 'Model pins' }),
      ref('emConfiguration', 'E&M level table', { ref: 'em-tables', section: 'Model pins' }),
      ref('categoryConfiguration', 'Category rate set', { ref: 'category-rates', section: 'Model pins' }),
      ref('drgConfiguration', 'DRG configuration', { ref: 'drg-config', section: 'Model pins' }),

      multi('overridableKeys', 'Branch-overridable keys', { section: 'Governance', span: 2, tenantOnly: true, options: [] }),
      multi('lockedKeys', 'Locked keys', { section: 'Governance', span: 2, tenantOnly: true, options: [] }),
      bool('operationalAssistanceEnabled', 'Operational assistance', { section: 'Governance' }),
      multi('operationalAssistanceSources', 'Assistance sources', { section: 'Governance', options: o('CLAIM_COORDINATION_BLOCKER', 'CLAIM_STATE_ATTENTION') }),
    ],
    check: (d) => {
      const e: Record<string, string> = {};
      if (d.scope === 'BRANCH' && !d.branch) e.branch = 'Branch overrides must name a branch.';
      if (d.scope === 'TENANT' && d.branch) e.branch = 'The tenant default cannot name a branch.';
      if (d.scope === 'BRANCH' && ((d.overridableKeys?.length ?? 0) || (d.lockedKeys?.length ?? 0))) e.overridableKeys = 'Only the tenant default can set override and lock controls.';
      if (d.packagePartialCancellation && (d.packageCancellationFeePercent === undefined || d.packageCancellationFeePercent === '' || d.packageCancellationFeePercent === null)) e.packageCancellationFeePercent = 'A partial cancellation formula needs an explicit fee (0 is allowed).';
      if (Array.isArray(d.lockedKeys) && Array.isArray(d.overridableKeys)) {
        const both = d.lockedKeys.filter((k: string) => d.overridableKeys.includes(k));
        if (both.length) e.lockedKeys = `A key cannot be both overridable and locked: ${both.join(', ')}.`;
      }
      if (Array.isArray(d.agingBucketDays) && d.agingBucketDays.length) {
        const n = d.agingBucketDays.map(Number);
        if (n.some((x: number) => !Number.isInteger(x) || x < 1 || x > 3650) || n.some((x: number, i: number) => i > 0 && x <= n[i - 1])) e.agingBucketDays = 'Use one to five strictly increasing whole days between 1 and 3650.';
      }
      return e;
    },
  },
  {
    key: 'reimbursement-routes', label: 'Reimbursement routes', singular: 'reimbursement route', category: 'policy', icon: 'Route',
    summary: 'Mixed-model selection by item, category, contract and care setting. Priority wins first, then specificity.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'RTE',
    fields: [
      sel('model', 'Model', { options: SERVICE_MODELS, required: true, list: true }),
      num('priority', 'Priority', { required: true, min: 0, max: 1000, list: true }),
      sel('scope', 'Scope', { options: o('ITEM', 'CATEGORY', 'ALL'), required: true, list: true }),
      refs('items', 'Items', { ref: 'items', span: 2, help: 'Required when the scope is Item.' }),
      ref('category', 'Category', { ref: 'categories', help: 'Required when the scope is Category.' }),
      ref('contract', 'Contract', { ref: 'contracts' }),
      multi('careSettings', 'Care settings', { options: CARE_SETTINGS, span: 2 }),
      text('configurationRef', 'Model configuration pin', { placeholder: 'STAY-0002@v1', help: 'FFS routes must not pin a configuration; all other models must.' }),
    ],
    check: (d) => {
      const e: Record<string, string> = {};
      if (d.scope === 'ITEM' && !(d.items?.length)) e.items = 'Choose at least one item for an item-scoped route.';
      if (d.scope === 'CATEGORY' && !d.category) e.category = 'Choose a category for a category-scoped route.';
      const ffs = typeof d.model === 'string' && d.model.startsWith('FFS');
      if (ffs && d.configurationRef) e.configurationRef = 'FFS routes cannot pin a model configuration.';
      if (d.model && !ffs && !d.configurationRef) e.configurationRef = 'This model needs an approved configuration pin.';
      return e;
    },
  },
  {
    key: 'stay-models', label: 'Stay and case models', singular: 'stay model', category: 'policy', icon: 'BedDouble',
    summary: 'Per-diem day bands and case-rate packages priced from the actual accommodation ledger.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'STAY',
    fields: [
      sel('modelType', 'Model', { options: o('PER_DIEM', 'CASE_RATE'), required: true, list: true }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true, list: true }),
      sel('dayCountRule', 'Day count rule', { options: o('CALENDAR_DAYS', 'MIDNIGHT_CENSUS', 'MINIMUM_ONE_DAY'), required: true }),
      bool('authorizationRequired', 'Payer authorization required'),
      money('caseAmount', 'Case amount', { help: 'Case-rate models only.' }),
      sel('carveOutMode', 'Carve-out mode', { options: o('FIXED', 'SCHEDULE', 'NETNET') }),
      lines('dayBands', 'Day bands', {
        span: 2, columns: [num('fromDay', 'From day', { required: true, min: 1 }), num('toDay', 'To day', { min: 1 }), money('dailyRate', 'Daily rate', { required: true })],
      }),
    ],
    check: (d) => (d.modelType === 'CASE_RATE' && !d.caseAmount ? { caseAmount: 'A case-rate model needs a case amount.' } : {}),
  },
  {
    key: 'drg-config', label: 'DRG configuration', singular: 'DRG configuration', category: 'policy', icon: 'Layers',
    summary: 'Licensed grouper binding, weight table and the local contract overlay. Not a national certified algorithm.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'DRG',
    sections: ['Grouper', 'Local overlay', 'Weights'],
    fields: [
      text('vendor', 'Grouper vendor', { required: true, list: true, section: 'Grouper' }),
      text('grouperVersion', 'Grouper version', { required: true, list: true, section: 'Grouper' }),
      text('licenseRef', 'Licence reference', { required: true, section: 'Grouper', help: 'Deployment trust and runtime binding are configured separately.' }),
      sel('variant', 'Variant', { options: o('DRG', 'DAYCASE_DRG'), required: true, section: 'Grouper' }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true, section: 'Local overlay' }),
      money('baseRate', 'Base rate', { required: true, list: true, section: 'Local overlay' }),
      sel('dayRule', 'Day rule', { options: o('CALENDAR_DAYS', 'MINIMUM_ONE_DAY'), required: true, section: 'Local overlay' }),
      num('shortStayThreshold', 'Short stay below (days)', { min: 0, section: 'Local overlay' }),
      num('longStayThreshold', 'Long outlier above (days)', { min: 1, section: 'Local overlay' }),
      money('outlierDailyRate', 'Outlier daily payment', { section: 'Local overlay' }),
      money('outlierCap', 'Outlier cap', { section: 'Local overlay' }),
      lines('weights', 'Weight table', {
        section: 'Weights', span: 2, columns: [text('drgCode', 'DRG', { required: true, upper: true }), text('description', 'Description'), dec('weight', 'Weight', { required: true }), dec('alos', 'ALOS')],
      }),
    ],
  },
  {
    key: 'category-rates', label: 'Category rates', singular: 'category rate set', category: 'policy', icon: 'Grid3x3',
    summary: 'Diagnosis-based classification rules and rates. Lower rule priority numbers win here.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'CRS',
    sections: ['Classification', 'Rules', 'Rates'],
    fields: [
      text('diagnosisSystem', 'Diagnosis system', { required: true, list: true, section: 'Classification', placeholder: 'ICD-10-AM' }),
      text('release', 'Release', { required: true, section: 'Classification' }),
      sel('careSetting', 'Care setting', { options: CARE_SETTINGS, required: true, list: true, section: 'Classification' }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true, section: 'Classification' }),
      lines('rules', 'Classification rules', {
        section: 'Rules', span: 2, maxItems: 100, columns: [num('priority', 'Priority', { required: true, min: 0 }), text('code', 'Diagnosis code', { required: true, upper: true }), sel('position', 'Position', { options: o('PRINCIPAL', 'SECONDARY'), required: true }), text('category', 'Category', { required: true, upper: true })],
      }),
      lines('rates', 'Category rates', {
        section: 'Rates', span: 2, maxItems: 500, columns: [text('category', 'Category', { required: true, upper: true }), money('rate', 'Rate', { required: true })],
      }),
    ],
  },
  {
    key: 'em-tables', label: 'E&M level tables', singular: 'E&M level table', category: 'policy', icon: 'Activity',
    summary: 'Professional and facility level tables used by the dedicated E&M determination workflow.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'EMT',
    fields: [
      sel('tableKind', 'Table kind', { options: o('PROFESSIONAL', 'FACILITY'), required: true, list: true }),
      sel('careSetting', 'Care setting', { options: CARE_SETTINGS, required: true, list: true }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true }),
      lines('levels', 'Levels', {
        span: 2, columns: [text('levelCode', 'Level', { required: true, upper: true }), text('description', 'Description'), ref('item', 'Charge item', { ref: 'items' }), money('amount', 'Amount', { required: true })],
      }),
    ],
  },
  {
    key: 'advanced-models', label: 'Advanced models', singular: 'advanced model', category: 'policy', icon: 'Sigma',
    summary: 'Capitation, bundle, global budget, pay-for-performance and cost-plus contract settlements.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'ADV',
    sections: ['Terms', 'Measures'],
    fields: [
      sel('model', 'Model', { options: o('CAPITATION', 'BUNDLE', 'GLOBAL_BUDGET', 'P4P', 'COST_PLUS'), required: true, list: true, section: 'Terms' }),
      ref('contract', 'Contract', { ref: 'contracts', required: true, list: true, section: 'Terms' }),
      sel('currency', 'Currency', { options: CURRENCIES, required: true, section: 'Terms' }),
      sel('settlementPeriod', 'Settlement period', { options: o('MONTHLY', 'QUARTERLY', 'ANNUAL', 'EPISODE'), required: true, section: 'Terms' }),
      money('pmpmRate', 'PMPM rate', { section: 'Terms' }),
      sel('enrollmentRule', 'Member-month rule', { options: o('FIRST_DAY', 'LAST_DAY', 'ANY_DAY'), section: 'Terms' }),
      sel('clawback', 'Clawback', { options: o('FULL', 'NONE'), section: 'Terms' }),
      money('targetAmount', 'Target / budget amount', { section: 'Terms' }),
      pct('sharePercent', 'Share', { section: 'Terms' }),
      sel('trueUp', 'Budget true-up', { options: o('NONE', 'OVERRUN_ONLY', 'UNDERRUN_ONLY', 'BOTH'), section: 'Terms' }),
      pct('markupPercent', 'Cost-plus markup', { section: 'Terms' }),
      lines('measures', 'Performance measures', {
        section: 'Measures', span: 2, columns: [text('measureCode', 'Measure', { required: true, upper: true }), sel('direction', 'Better when', { options: o('HIGHER', 'LOWER'), required: true }), dec('target', 'Target', { required: true }), pct('weight', 'Weight', { required: true })],
      }),
    ],
    check: (d) => {
      const e: Record<string, string> = {};
      if (d.model === 'CAPITATION' && !d.pmpmRate) e.pmpmRate = 'Capitation needs a PMPM rate.';
      if ((d.model === 'BUNDLE' || d.model === 'GLOBAL_BUDGET') && !d.targetAmount) e.targetAmount = 'Bundles and budgets need a target amount.';
      if (d.model === 'COST_PLUS' && (d.markupPercent === undefined || d.markupPercent === '')) e.markupPercent = 'Cost-plus needs an explicit markup.';
      if (d.model === 'P4P' && !(d.measures?.length)) e.measures = 'Pay-for-performance needs at least one agreed measure.';
      return e;
    },
  },

  /* ---------------- Exchange ---------------- */
  {
    key: 'exchange-profiles', label: 'Exchange profiles and routes', singular: 'exchange profile', category: 'exchange', icon: 'ArrowLeftRight',
    summary: 'Approved message profiles and payer routes. Endpoints and credentials stay deployment-owned.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'XPR',
    fields: [
      sel('operation', 'Operation', { options: o('CLAIM', 'ELIGIBILITY', 'CLAIM_STATUS', 'REMITTANCE'), required: true, list: true }),
      sel('format', 'Format', { options: o('REST_JSON', 'REST_XML', 'SOAP_11', 'SOAP_12', 'X12_837P', 'X12_837I', 'X12_835', 'NPHIES_FHIR_SIMULATED'), required: true, list: true }),
      ref('payer', 'Payer', { ref: 'commercial-parties', required: true, list: true }),
      ref('tpa', 'TPA', { ref: 'commercial-parties' }),
      sel('scopeKind', 'Route scope', { options: o('TENANT', 'BRANCH'), required: true }),
      branchSel(),
      text('endpointAlias', 'Endpoint alias', { required: true, upper: true, help: 'Alias resolved by the deployment. Never a URL or secret.' }),
      sel('security', 'Security profile', { options: o('OAUTH2', 'MTLS', 'HMAC', 'OAUTH2_MTLS'), required: true }),
      bool('locked', 'Lock route for branches'),
    ],
    check: (d) => {
      const e: Record<string, string> = {};
      if (typeof d.endpointAlias === 'string' && /:\/\//.test(d.endpointAlias)) e.endpointAlias = 'Use a deployment alias, not a URL.';
      if (d.scopeKind === 'BRANCH' && !d.branch) e.branch = 'Branch-scoped routes must name a branch.';
      return e;
    },
  },
  {
    key: 'provider-profiles', label: 'Payment and refund providers', singular: 'provider profile', category: 'exchange', icon: 'CreditCard',
    summary: 'Collection and refund payout bindings. A simulator never moves real money.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'PAY',
    fields: [
      sel('purpose', 'Purpose', { options: o('COLLECTION', 'REFUND_PAYOUT'), required: true, list: true }),
      text('providerType', 'Provider type', { required: true, upper: true, list: true }),
      text('merchantAlias', 'Merchant alias', { required: true, upper: true }),
      multi('currencies', 'Currencies', { options: CURRENCIES, required: true }),
      num('maxAttempts', 'Max dispatch attempts', { min: 1, max: 10 }),
      sel('mode', 'Mode', { options: o('SIMULATOR', 'LIVE'), required: true, list: true, help: 'Live mode still requires deployment trust and partner certification.' }),
    ],
  },

  /* ---------------- Ledger ---------------- */
  {
    key: 'gl-accounts', label: 'Chart of accounts', singular: 'GL account', category: 'ledger', icon: 'ListTree',
    summary: 'Legal-entity accounts. Nothing is seeded automatically in production.',
    governance: 'simple', effectiveDated: false, codePrefix: 'GL',
    fields: [
      leSel(),
      text('accountNumber', 'Account number', { required: true, list: true }),
      sel('accountType', 'Type', { options: o('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'), required: true, list: true }),
      sel('normalBalance', 'Normal balance', { options: o('DEBIT', 'CREDIT'), required: true }),
      ref('parentAccount', 'Parent account', { ref: 'gl-accounts' }),
      bool('postingAllowed', 'Posting allowed', { list: true }),
    ],
  },
  {
    key: 'gl-mappings', label: 'GL mappings', singular: 'mapping version', category: 'ledger', icon: 'GitCompareArrows',
    summary: 'Versioned role-to-account mappings. A missing mapping fails posting closed and is shown as an exception.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'MAP',
    fields: [
      leSel(),
      lines('entries', 'Role mappings', {
        span: 2, columns: [sel('role', 'Posting role', { options: GL_ROLES, required: true }), ref('account', 'Account', { ref: 'gl-accounts', required: true }), sel('currency', 'Currency', { options: CURRENCIES })],
      }),
    ],
    check: (d) => {
      const roles = (d.entries ?? []).map((x: any) => `${x.role}:${x.currency ?? ''}`);
      return new Set(roles).size !== roles.length ? { entries: 'Each posting role and currency can be mapped once.' } : {};
    },
  },
  {
    key: 'fiscal-periods', label: 'Fiscal periods', singular: 'fiscal period', category: 'ledger', icon: 'CalendarRange',
    summary: 'Open, soft-closed and closed accounting periods per legal entity.',
    governance: 'versioned', effectiveDated: false, codePrefix: 'FP',
    fields: [
      leSel(),
      date('periodStart', 'Period start', { required: true, list: true }),
      date('periodEnd', 'Period end', { required: true, list: true }),
      sel('periodState', 'Period state', { options: o('OPEN', 'SOFT_CLOSED', 'CLOSED'), required: true, list: true }),
    ],
    check: (d) => (d.periodStart && d.periodEnd && d.periodEnd <= d.periodStart ? { periodEnd: 'The period must end after it starts.' } : {}),
  },

  /* ---------------- Platform ---------------- */
  {
    key: 'workflow-definitions', label: 'Workflows and rules', singular: 'workflow definition', category: 'platform', icon: 'GitBranch',
    summary: 'Versioned checkpoint graphs for claims, appeals and collections. They add guards; they never remove financial checks.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'WF',
    fields: [
      sel('workflowType', 'Workflow', { options: o('CLAIM', 'APPEAL', 'COLLECTION'), required: true, list: true }),
      branchSel({ help: 'Leave empty for tenant-wide definitions.' }),
      lines('checkpoints', 'Checkpoints', {
        span: 2, columns: [num('step', 'Step', { required: true, min: 1 }), text('name', 'Checkpoint', { required: true }), text('guard', 'Guard rule'), num('slaHours', 'SLA (h)', { min: 1 })],
      }),
    ],
  },
  {
    key: 'platform-settings', label: 'Assistance and marketplace', singular: 'platform setting', category: 'platform', icon: 'Sparkles',
    summary: 'AI assistance profiles and marketplace packages. Installation never grants authority.',
    governance: 'versioned', effectiveDated: true, codePrefix: 'PLT',
    fields: [
      sel('settingType', 'Setting', { options: o('AI_ASSISTANCE', 'MARKETPLACE_PACKAGE'), required: true, list: true }),
      text('publisher', 'Provider or publisher', { required: true, list: true }),
      text('packageVersion', 'Version', { required: true }),
      bool('humanReviewRequired', 'Human review required', { help: 'Always on. Assistance never writes clinical or financial records.' }),
      multi('allowedSources', 'Allowed sources', { options: o('CLAIM_COORDINATION_BLOCKER', 'CLAIM_STATE_ATTENTION', 'CODING_WORKLIST', 'CDI_CLARIFICATION'), span: 2 }),
    ],
    check: (d) => (d.humanReviewRequired === false ? { humanReviewRequired: 'Human review cannot be turned off.' } : {}),
  },
];

// Billing policy governance keys pick from the policy's own value fields.
const policy = RES.find((r) => r.key === 'billing-policies')!;
const policyKeys: Option[] = policy.fields
  .filter((f) => !f.tenantOnly && !['scope', 'branch'].includes(f.key))
  .map((f) => ({ value: f.key, label: f.label, group: f.section }));
for (const f of policy.fields) if (f.tenantOnly) f.options = policyKeys;

export const RESOURCES = RES;
export const RESOURCE_MAP = new Map(RES.map((r) => [r.key, r]));

export function tableName(resourceKey: string) {
  return 'cfg_' + resourceKey.replace(/-/g, '_');
}
