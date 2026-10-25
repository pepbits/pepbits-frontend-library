import { audit, db } from './db';
import { RESOURCES, tableName } from './registry';

/** Synthetic data only. No real patient, payer credential or tenant record is used. */

const USERS = [
  { id: 1, name: 'Amira Haddad', title: 'Tenant administrator', email: 'amira.haddad@meridian.example', initials: 'AH', tone: 'spruce' },
  { id: 2, name: 'Daniel Okafor', title: 'Finance controller', email: 'daniel.okafor@meridian.example', initials: 'DO', tone: 'saffron' },
  { id: 3, name: 'Priya Raman', title: 'Commercial manager', email: 'priya.raman@meridian.example', initials: 'PR', tone: 'cobalt' },
  { id: 4, name: 'Omar Siddiqui', title: 'Insurance operations lead', email: 'omar.siddiqui@meridian.example', initials: 'OS', tone: 'madder' },
];

const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (daysAgo: number, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return d.toISOString();
};

type Seed = {
  code: string; name: string; data: Record<string, unknown>;
  status?: 'APPROVED' | 'PENDING_APPROVAL' | 'DRAFT' | 'REJECTED' | 'RETIRED' | 'ACTIVE' | 'INACTIVE';
  ef?: string | null; eu?: string | null; by?: number; approver?: number; age?: number; reason?: string; decision?: string;
};

function put(resource: string, s: Seed): number {
  const status = s.status ?? 'APPROVED';
  const by = s.by ?? 1;
  const approver = s.approver ?? (by === 2 ? 3 : 2);
  const age = s.age ?? 20;
  const created = at(age, 8);
  const submitted = ['APPROVED', 'PENDING_APPROVAL', 'REJECTED', 'RETIRED'].includes(status) ? at(Math.max(age - 1, 0), 11) : null;
  const decided = ['APPROVED', 'REJECTED', 'RETIRED'].includes(status) ? at(Math.max(age - 2, 0), 15) : null;
  const info = db
    .prepare(
      `INSERT INTO ${tableName(resource)}
        (code, name, status, effective_from, effective_until, data, change_reason, decision_reason,
         created_by, created_at, updated_by, updated_at, submitted_by, submitted_at, decided_by, decided_at)
       VALUES (@code, @name, @status, @ef, @eu, @data, @reason, @decision,
         @by, @created, @by, @updated, @sb, @submitted, @db, @decided)`,
    )
    .run({
      code: s.code, name: s.name, status, ef: s.ef ?? null, eu: s.eu ?? null, data: JSON.stringify(s.data),
      reason: s.reason ?? null, decision: s.decision ?? null, by, created,
      updated: decided ?? submitted ?? created, sb: submitted ? by : null, submitted,
      db: decided ? approver : null, decided,
    });
  const id = Number(info.lastInsertRowid);
  audit({ at: created, actorId: by, resource, recordId: id, recordCode: s.code, action: 'CREATED', summary: `Created “${s.name}”${['ACTIVE', 'INACTIVE'].includes(status) ? '' : ' as a draft'}.`, reason: s.reason ?? null });
  if (submitted) audit({ at: submitted, actorId: by, resource, recordId: id, recordCode: s.code, action: 'SUBMITTED', summary: `Submitted revision 1 of “${s.name}” for approval.` });
  if (decided) audit({ at: decided, actorId: approver, resource, recordId: id, recordCode: s.code, action: status === 'REJECTED' ? 'REJECTED' : 'APPROVED', summary: `${status === 'REJECTED' ? 'Rejected' : 'Approved'} revision 1 of “${s.name}”.`, reason: s.decision ?? null });
  return id;
}

export function seed() {
  const insertUser = db.prepare('INSERT INTO app_user (id, name, title, email, initials, tone) VALUES (@id, @name, @title, @email, @initials, @tone)');
  for (const u of USERS) insertUser.run(u);

  /* Access */
  put('billing-grants', { code: 'GRT-0001', name: 'Riyadh central cashiers', ef: day(-90), data: { identitySubject: '3f8a2c1e-5b7d-4e0a-9c11-2d4e6f8a0b1c', staffEmail: 'cashier.team@meridian.example', branch: 'RUH-CENTRAL', enabled: true, permissions: ['READ', 'RECEIPT', 'ALLOCATE', 'CASH_SESSION', 'ESTIMATE'], notes: 'Front-desk cashier group for the main hospital.' } });
  put('billing-grants', { code: 'GRT-0002', name: 'Riyadh billing supervisors', ef: day(-90), data: { identitySubject: '9b1d4f7a-2c3e-4a5b-8d6f-7e8091a2b3c4', staffEmail: 'billing.supervisors@meridian.example', branch: 'RUH-CENTRAL', enabled: true, permissions: ['READ', 'CAPTURE', 'DRAFT', 'ISSUE', 'CREDIT', 'CREDIT_ISSUE', 'ADJUST', 'ADJUST_APPROVE', 'CASH_REVIEW'] } });
  put('billing-grants', { code: 'GRT-0003', name: 'Dubai claims team', ef: day(-40), by: 4, data: { identitySubject: 'c2e4a6b8-0d1f-4a3c-9e5b-7d9f1b3d5e7f', staffEmail: 'claims.dxb@meridian.example', branch: 'DXB-DHCC', enabled: true, permissions: ['READ', 'CLAIM', 'REMIT', 'ELIGIBILITY', 'APPEAL', 'TRANSFER'] } });
  put('billing-grants', { code: 'GRT-0004', reason: 'New charge clerks for the day surgery opening', name: 'Jeddah day surgery charge clerks', status: 'PENDING_APPROVAL', ef: day(7), age: 2, data: { identitySubject: 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b', staffEmail: 'charges.jed@meridian.example', branch: 'JED-DAYSURG', enabled: true, permissions: ['READ', 'CAPTURE', 'MANUAL_CHARGE', 'PROCEDURE_GROUP'] } });

  put('commercial-grants', { code: 'CAG-0001', name: 'Commercial team — tenant authoring', ef: day(-120), data: { grantee: 'priya.raman@meridian.example', scope: 'TENANT', actions: ['READ', 'AUTHOR', 'PUBLISH'], tables: ['CATALOG_PRICE_BOOK', 'CATALOG_PRICE', 'CATALOG_DISCOUNT_RULE', 'CATALOG_TAX_RULE', 'CATALOG_CONTRACT'] } });
  put('commercial-grants', { code: 'CAG-0002', name: 'Finance read access to price books', ef: day(-60), by: 2, approver: 1, data: { grantee: 'daniel.okafor@meridian.example', scope: 'TENANT', actions: ['READ'], tables: ['CATALOG_PRICE_BOOK', 'CATALOG_PRICE'] } });

  put('numbering', { code: 'NUM-0001', name: 'KSA tax invoices', ef: day(-120), by: 2, approver: 1, data: { documentType: 'INVOICE', legalEntity: 'MCN-KSA', pattern: 'INV-{BR}-{YYYY}-{SEQ:6}', nextNumber: 18452, resetCycle: 'YEARLY', branchScoped: true } });
  put('numbering', { code: 'NUM-0002', name: 'KSA receipts', ef: day(-120), by: 2, approver: 1, data: { documentType: 'RECEIPT', legalEntity: 'MCN-KSA', pattern: 'RCT-{BR}-{YYYY}-{SEQ:6}', nextNumber: 30117, resetCycle: 'YEARLY', branchScoped: true } });
  put('numbering', { code: 'NUM-0003', name: 'KSA credit notes', ef: day(-120), by: 2, approver: 1, data: { documentType: 'CREDIT_NOTE', legalEntity: 'MCN-KSA', pattern: 'CRN-{YYYY}-{SEQ:5}', nextNumber: 412, resetCycle: 'YEARLY', branchScoped: false } });
  put('numbering', { code: 'NUM-0005', name: 'KSA debit notes', ef: day(9), by: 2, approver: 1, age: 3, reason: 'Debit notes go live with the late-charge policy', data: { documentType: 'DEBIT_NOTE', legalEntity: 'MCN-KSA', pattern: 'DBN-{YYYY}-{SEQ:5}', nextNumber: 1, resetCycle: 'YEARLY', branchScoped: false } });
  put('numbering', { code: 'NUM-0004', name: 'UAE invoices', status: 'DRAFT', age: 1, by: 2, data: { documentType: 'INVOICE', legalEntity: 'MCN-UAE', pattern: 'AE-INV-{YYYY}{MM}-{SEQ:6}', nextNumber: 1, resetCycle: 'MONTHLY', branchScoped: true } });

  /* Catalogue */
  const catOut = put('categories', { code: 'CAT-0001', name: 'Outpatient consultations', status: 'ACTIVE', by: 3, data: { type: 'CATEGORY', description: 'Clinic visits and specialist reviews.' } });
  const catLab = put('categories', { code: 'CAT-0002', name: 'Laboratory', status: 'ACTIVE', by: 3, data: { type: 'CATEGORY' } });
  const catImg = put('categories', { code: 'CAT-0003', name: 'Diagnostic imaging', status: 'ACTIVE', by: 3, data: { type: 'CATEGORY' } });
  const catSurg = put('categories', { code: 'CAT-0004', name: 'Day surgery', status: 'ACTIVE', by: 3, data: { type: 'CATEGORY' } });
  const catAcc = put('categories', { code: 'CAT-0005', name: 'Inpatient accommodation', status: 'ACTIVE', by: 3, data: { type: 'CATEGORY' } });
  const catPharm = put('categories', { code: 'CAT-0006', name: 'Pharmacy', status: 'ACTIVE', by: 3, data: { type: 'CATEGORY' } });
  put('categories', { code: 'CAT-0007', name: 'Cardiology clinic group', status: 'ACTIVE', by: 3, data: { type: 'GROUP', parent: catOut } });
  put('categories', { code: 'CAT-0008', name: 'ICD-10-AM 12th edition', status: 'ACTIVE', by: 3, data: { type: 'TERMINOLOGY_RELEASE', system: 'ICD-10-AM', release: '12' } });

  const iConsult = put('items', { code: 'ITM-0001', name: 'Specialist consultation', status: 'ACTIVE', by: 3, data: { kind: 'SERVICE', category: catOut, unit: 'VISIT', taxCategory: 'STANDARD', terminologyCode: 'CPT 99214', billable: true, manualFee: false } });
  const iFollow = put('items', { code: 'ITM-0002', name: 'Follow-up consultation', status: 'ACTIVE', by: 3, data: { kind: 'SERVICE', category: catOut, unit: 'VISIT', taxCategory: 'STANDARD', terminologyCode: 'CPT 99213', billable: true } });
  const iCbc = put('items', { code: 'ITM-0003', name: 'Complete blood count', status: 'ACTIVE', by: 3, data: { kind: 'LABORATORY', category: catLab, unit: 'EACH', taxCategory: 'STANDARD', terminologyCode: 'CPT 85025', billable: true } });
  const iMri = put('items', { code: 'ITM-0004', name: 'MRI knee without contrast', status: 'ACTIVE', by: 3, data: { kind: 'IMAGING', category: catImg, unit: 'EACH', taxCategory: 'STANDARD', terminologyCode: 'CPT 73721', billable: true } });
  const iChole = put('items', { code: 'ITM-0005', name: 'Laparoscopic cholecystectomy', status: 'ACTIVE', by: 3, data: { kind: 'PROCEDURE', category: catSurg, unit: 'CASE', taxCategory: 'STANDARD', terminologyCode: 'CPT 47562', billable: true } });
  const iWard = put('items', { code: 'ITM-0006', name: 'Ward bed day', status: 'ACTIVE', by: 3, data: { kind: 'ACCOMMODATION', category: catAcc, unit: 'DAY', taxCategory: 'STANDARD', billable: true } });
  put('items', { code: 'ITM-0007', name: 'Paracetamol 500 mg tablet', status: 'ACTIVE', by: 3, data: { kind: 'MEDICINE', category: catPharm, unit: 'TABLET', taxCategory: 'ZERO_RATED', billable: true } });
  const iReport = put('items', { code: 'ITM-0008', name: 'Medical report fee', status: 'ACTIVE', by: 3, data: { kind: 'SERVICE', category: catOut, unit: 'EACH', taxCategory: 'STANDARD', billable: true, manualFee: true } });
  const iPkg = put('items', { code: 'ITM-0009', name: 'Executive health check package', status: 'ACTIVE', by: 3, data: { kind: 'PACKAGE', category: catOut, unit: 'EACH', taxCategory: 'STANDARD', billable: true } });
  put('items', { code: 'ITM-0010', name: 'Legacy X-ray film charge', status: 'INACTIVE', by: 3, data: { kind: 'CONSUMABLE', category: catImg, unit: 'EACH', taxCategory: 'STANDARD', billable: false } });

  const tax1 = put('tax-rules', { code: 'TAX-0001', name: 'KSA VAT — standard healthcare', by: 2, approver: 1, ef: day(-200), data: { jurisdiction: 'SA', taxCategory: 'STANDARD', treatment: 'TAXABLE', ratePercent: '15', appliesTo: 'NON_CITIZENS' } });
  const tax2 = put('tax-rules', { code: 'TAX-0002', name: 'KSA VAT — citizen healthcare', by: 2, approver: 1, ef: day(-200), data: { jurisdiction: 'SA', taxCategory: 'STANDARD', treatment: 'ZERO_RATED', ratePercent: '0', appliesTo: 'CITIZENS' } });
  put('tax-rules', { code: 'TAX-0003', name: 'UAE VAT — healthcare zero-rated', by: 2, approver: 1, ef: day(-150), data: { jurisdiction: 'AE', taxCategory: 'STANDARD', treatment: 'ZERO_RATED', ratePercent: '0', appliesTo: 'ALL_PATIENTS' } });
  put('tax-rules', { code: 'TAX-0004', reason: 'Align medicines with the zero-rated supply list', name: 'KSA medicines zero-rated', status: 'PENDING_APPROVAL', ef: day(10), by: 2, age: 3, data: { jurisdiction: 'SA', taxCategory: 'ZERO_RATED', treatment: 'ZERO_RATED', ratePercent: '0', appliesTo: 'ALL_PATIENTS' } });

  const bookSelf = put('price-books', { code: 'PB-0001', name: 'Self-pay tariff 2026 (SAR)', by: 3, ef: day(-150), data: { bookType: 'SELF_PAY', currency: 'SAR', precision: 2, rounding: 'HALF_UP', scope: 'TENANT', rates: [
    { item: iConsult, price: '450.00', minQuantity: 1 }, { item: iFollow, price: '300.00' }, { item: iCbc, price: '85.00' }, { item: iMri, price: '1850.00' },
    { item: iChole, price: '14500.00' }, { item: iWard, price: '1200.00' }, { item: iReport, price: '150.00' }, { item: iPkg, price: '2400.00' },
  ] } });
  const bookIns = put('price-books', { code: 'PB-0002', name: 'Insured tariff — Gulf Shield (SAR)', by: 3, ef: day(-120), data: { bookType: 'INSURED', currency: 'SAR', precision: 2, rounding: 'HALF_UP', scope: 'TENANT', rates: [
    { item: iConsult, price: '400.00' }, { item: iFollow, price: '260.00' }, { item: iCbc, price: '70.00' }, { item: iMri, price: '1600.00' }, { item: iChole, price: '12800.00' }, { item: iWard, price: '1050.00' },
  ] } });
  const bookUae = put('price-books', { code: 'PB-0003', name: 'UAE self-pay tariff (AED)', by: 3, ef: day(-90), data: { bookType: 'SELF_PAY', currency: 'AED', precision: 2, rounding: 'HALF_EVEN', scope: 'BRANCH', branch: 'DXB-DHCC', rates: [{ item: iConsult, price: '500.00' }, { item: iCbc, price: '95.00' }] } });
  put('price-books', { code: 'PB-0004', name: 'Self-pay tariff 2027 (SAR)', status: 'DRAFT', by: 3, age: 1, ef: day(90), data: { bookType: 'SELF_PAY', currency: 'SAR', precision: 2, rounding: 'HALF_UP', scope: 'TENANT', rates: [{ item: iConsult, price: '475.00' }] } });

  const disc1 = put('discounts', { code: 'DSC-0001', name: 'Staff and dependants', by: 3, ef: day(-100), data: { scope: 'PRICE_BOOK', target: 'PB-0001', discountType: 'PERCENT', value: '20', combination: 'BEST_PRICE', timing: 'BEFORE_TAX', eligibility: 'Verified staff ID and registered dependants' } });
  put('discounts', { code: 'DSC-0002', name: 'Laboratory bundle saving', by: 3, ef: day(-30), data: { scope: 'CATEGORY', target: 'CAT-0002', discountType: 'PERCENT', value: '10', combination: 'MOST_SPECIFIC', timing: 'BEFORE_TAX', maxPerVisit: '200.00' } });
  put('discounts', { code: 'DSC-0004', name: 'Senior citizens', by: 3, ef: day(30), age: 4, reason: 'Board-approved senior care discount', data: { scope: 'PRICE_BOOK', target: 'PB-0001', discountType: 'PERCENT', value: '15', combination: 'BEST_PRICE', timing: 'BEFORE_TAX', eligibility: 'Patients aged 65 and over with national ID' } });
  put('discounts', { code: 'DSC-0003', reason: 'Seasonal wellness campaign', name: 'Ramadan wellness offer', status: 'REJECTED', by: 3, age: 5, ef: day(20), decision: 'Eligibility wording needs legal review before publication.', data: { scope: 'ITEM', target: 'ITM-0009', discountType: 'FIXED_AMOUNT', value: '400', combination: 'STACK', timing: 'AFTER_TAX' } });

  put('modifiers', { code: 'MOD-0001', name: 'Bilateral procedure', by: 3, ef: day(-80), data: { modifierCode: '50', adjustment: 'PERCENT_OF_BASE', value: '150', compatibleWith: ['LT', 'RT'], mprRanks: [{ rank: 1, payPercent: '100' }, { rank: 2, payPercent: '50' }, { rank: 3, payPercent: '25' }] } });
  put('modifiers', { code: 'MOD-0002', name: 'Assistant surgeon', by: 3, ef: day(-80), data: { modifierCode: '80', adjustment: 'PERCENT_OF_BASE', value: '16', compatibleWith: [] } });

  put('commercial-releases', { code: 'REL-0001', name: 'Q2 2026 tariff release', by: 3, ef: day(-120), data: { priceBooks: [bookSelf, bookIns], discounts: [disc1], taxRules: [tax1, tax2], publishMode: 'IMMEDIATE', releaseNotes: 'First published tariff for KSA branches.' } });
  put('commercial-releases', { code: 'REL-0002', reason: 'Publish the Dubai opening tariff', name: 'UAE launch tariff', status: 'PENDING_APPROVAL', by: 3, age: 1, ef: day(5), data: { priceBooks: [bookUae], publishMode: 'SCHEDULED', releaseNotes: 'Dubai clinic opening tariff.' } });

  /* Payers */
  const pGulf = put('commercial-parties', { code: 'PTY-0001', name: 'Gulf Shield Insurance', status: 'ACTIVE', by: 4, data: { roles: ['INSURER', 'PAYER'], country: 'SA', licenseNumber: 'IA-2231', payerExchangeId: 'GSI', currency: 'SAR', contactEmail: 'claims@gulfshield.example' } });
  const pNajm = put('commercial-parties', { code: 'PTY-0002', name: 'Najm Health Administrators', status: 'ACTIVE', by: 4, data: { roles: ['TPA'], country: 'SA', licenseNumber: 'TPA-0418', payerExchangeId: 'NHA', currency: 'SAR' } });
  const pOasis = put('commercial-parties', { code: 'PTY-0003', name: 'Oasis Mutual Takaful', status: 'ACTIVE', by: 4, data: { roles: ['INSURER', 'PAYER'], country: 'SA', licenseNumber: 'IA-1987', payerExchangeId: 'OMT', currency: 'SAR' } });
  const pEmir = put('commercial-parties', { code: 'PTY-0004', name: 'Emirates Care Assurance', status: 'ACTIVE', by: 4, data: { roles: ['INSURER', 'PAYER'], country: 'AE', payerExchangeId: 'ECA', currency: 'AED' } });
  put('commercial-parties', { code: 'PTY-0005', name: 'Red Sea Petrochemicals', status: 'ACTIVE', by: 4, data: { roles: ['SPONSOR', 'CORPORATE'], country: 'SA', currency: 'SAR' } });

  const netGold = put('networks', { code: 'NET-0001', name: 'Gulf Shield Gold', status: 'ACTIVE', by: 4, data: { owner: pGulf, tier: 'GOLD' } });
  const netStd = put('networks', { code: 'NET-0002', name: 'Oasis Standard', status: 'ACTIVE', by: 4, data: { owner: pOasis, tier: 'STANDARD' } });

  const planGold = put('insurance-plans', { code: 'PLN-0001', name: 'Gulf Shield Gold — Class A', by: 4, ef: day(-110), data: { riskBearer: pGulf, administrator: pNajm, network: netGold, planClass: 'A', currency: 'SAR', benefitRules: [
    { target: catOut, coverage: '80', copay: '50.00', maxBenefit: '10000.00' }, { target: catLab, coverage: '90' }, { target: catImg, coverage: '80', deductible: '200.00' }, { target: catSurg, coverage: '100' },
  ] } });
  const planOasis = put('insurance-plans', { code: 'PLN-0002', name: 'Oasis Standard — Class B', by: 4, ef: day(-110), data: { riskBearer: pOasis, network: netStd, planClass: 'B', currency: 'SAR', benefitRules: [{ target: catOut, coverage: '70', coinsurance: '20', copay: '75.00' }, { target: catLab, coverage: '80' }] } });
  put('insurance-plans', { code: 'PLN-0003', name: 'Emirates Care Essential', status: 'DRAFT', by: 4, age: 2, data: { riskBearer: pEmir, planClass: 'BASIC', currency: 'AED', benefitRules: [] } });

  const ctrGold = put('contracts', { code: 'CTR-0001', name: 'Gulf Shield provider agreement 2026', by: 4, approver: 2, ef: day(-110), data: { party: pGulf, plan: planGold, network: netGold, priceBook: bookIns, paymentTermsDays: 45, claimFilingDays: 90, terms: 'Clean claims paid within 45 days of receipt.' } });
  const ctrOasis = put('contracts', { code: 'CTR-0002', name: 'Oasis Takaful agreement 2026', by: 4, approver: 2, ef: day(-100), data: { party: pOasis, plan: planOasis, network: netStd, priceBook: bookIns, paymentTermsDays: 60, claimFilingDays: 120 } });

  put('branch-arrangements', { code: 'ARR-0001', name: 'Riyadh — Gulf Shield Gold via Najm', by: 4, ef: day(-100), data: { branch: 'RUH-CENTRAL', insurer: pGulf, administrator: pNajm, plan: planGold, network: netGold, contract: ctrGold } });
  put('branch-arrangements', { code: 'ARR-0002', name: 'Riyadh — Oasis Standard', by: 4, ef: day(-95), data: { branch: 'RUH-CENTRAL', insurer: pOasis, plan: planOasis, network: netStd, contract: ctrOasis } });
  put('branch-arrangements', { code: 'ARR-0003', reason: 'Gulf Shield agreed to cover Jeddah day surgery', name: 'Jeddah — Gulf Shield Gold', status: 'PENDING_APPROVAL', by: 4, age: 1, ef: day(3), data: { branch: 'JED-DAYSURG', insurer: pGulf, administrator: pNajm, plan: planGold, network: netGold, contract: ctrGold } });

  put('benefit-pools', { code: 'POOL-0001', name: 'Gulf Shield family pool', by: 4, ef: day(-100), data: { poolType: 'FAMILY', plan: planGold, period: 'CALENDAR_YEAR', currency: 'SAR', familyDeductible: '1500.00', memberOutOfPocket: '3000.00', familyOutOfPocket: '9000.00', familyMaxBenefit: '250000.00', carryover: '0' } });

  /* Policy and models */
  const stay = put('stay-models', { code: 'STAY-0001', name: 'Ward per-diem bands', by: 2, approver: 1, ef: day(-90), data: { modelType: 'PER_DIEM', currency: 'SAR', dayCountRule: 'MIDNIGHT_CENSUS', authorizationRequired: true, dayBands: [{ fromDay: 1, toDay: 3, dailyRate: '1200.00' }, { fromDay: 4, toDay: 10, dailyRate: '1000.00' }, { fromDay: 11, dailyRate: '850.00' }] } });
  put('stay-models', { code: 'STAY-0002', name: 'Cholecystectomy case rate', by: 2, approver: 1, ef: day(-90), data: { modelType: 'CASE_RATE', currency: 'SAR', dayCountRule: 'CALENDAR_DAYS', caseAmount: '16500.00', carveOutMode: 'FIXED', authorizationRequired: true } });

  const drg = put('drg-config', { code: 'DRG-0001', reason: 'Grouper licence renewed for 2026', name: 'AR-DRG local overlay', status: 'PENDING_APPROVAL', by: 2, age: 2, ef: day(14), data: { vendor: 'Licensed grouper vendor', grouperVersion: '11.0', licenseRef: 'LIC-2026-0042', variant: 'DRG', currency: 'SAR', baseRate: '9800.00', dayRule: 'CALENDAR_DAYS', shortStayThreshold: 2, longStayThreshold: 14, outlierDailyRate: '900.00', outlierCap: '30000.00', weights: [{ drgCode: 'G07B', description: 'Appendicectomy, minor complexity', weight: '0.92', alos: '2.4' }, { drgCode: 'H08B', description: 'Laparoscopic cholecystectomy', weight: '1.18', alos: '2.1' }] } });

  put('category-rates', { code: 'CRS-0001', name: 'Outpatient category rates', by: 2, approver: 1, ef: day(-30), data: { diagnosisSystem: 'ICD-10-AM', release: '12', careSetting: 'OUTPATIENT', currency: 'SAR', rules: [{ priority: 10, code: 'J06.9', position: 'PRINCIPAL', category: 'RESP_MINOR' }, { priority: 20, code: 'E11.9', position: 'PRINCIPAL', category: 'CHRONIC_REVIEW' }], rates: [{ category: 'RESP_MINOR', rate: '320.00' }, { category: 'CHRONIC_REVIEW', rate: '540.00' }] } });

  const em = put('em-tables', { code: 'EMT-0001', name: 'Outpatient professional levels', by: 2, approver: 1, ef: day(-60), data: { tableKind: 'PROFESSIONAL', careSetting: 'OUTPATIENT', currency: 'SAR', levels: [{ levelCode: 'L2', description: 'Straightforward', item: iFollow, amount: '260.00' }, { levelCode: 'L3', description: 'Low complexity', item: iFollow, amount: '300.00' }, { levelCode: 'L4', description: 'Moderate complexity', item: iConsult, amount: '450.00' }, { levelCode: 'L5', description: 'High complexity', item: iConsult, amount: '620.00' }] } });

  const adv = put('advanced-models', { code: 'ADV-0001', name: 'Red Sea capitation', by: 2, approver: 3, ef: day(-45), data: { model: 'CAPITATION', contract: ctrOasis, currency: 'SAR', settlementPeriod: 'MONTHLY', pmpmRate: '185.00', enrollmentRule: 'FIRST_DAY', clawback: 'FULL' } });
  put('advanced-models', { code: 'ADV-0002', name: 'Diabetes quality incentive', status: 'DRAFT', by: 2, age: 1, data: { model: 'P4P', contract: ctrGold, currency: 'SAR', settlementPeriod: 'QUARTERLY', measures: [{ measureCode: 'HBA1C_CONTROL', direction: 'HIGHER', target: '70', weight: '60' }, { measureCode: 'READMIT_30D', direction: 'LOWER', target: '8', weight: '40' }] } });

  put('billing-policies', { code: 'POL-0001', name: 'Tenant billing default', by: 1, approver: 2, ef: day(-90), data: {
    scope: 'TENANT', enabled: true, jurisdiction: 'SA', pricingModel: 'FFS_CATALOG', selfPayBook: bookSelf, insuredBookSource: 'COVERAGE_CONTRACT',
    liabilityMethod: 'PLAN_BENEFIT_RULE', taxAllocation: 'PROPORTIONAL', captureTrigger: 'OCCURRENCE_COMPLETED', independentIssue: true,
    manualChargeItems: [iReport], settlementMethods: ['CASH', 'CARD_TERMINAL', 'BANK_TRANSFER'], refundMethods: ['CASH', 'BANK_TRANSFER'],
    creditReasonCodes: ['PRICE_ERROR', 'SERVICE_NOT_RENDERED', 'GOODWILL'], debitNoteReasonCodes: ['LATE_CHARGE'], adjustmentReasonCodes: ['CONTRACTUAL', 'SMALL_BALANCE'],
    independentReceiptVoid: true, independentCreditIssue: true, accumulatorPeriod: 'CALENDAR_YEAR', maxPayerLevels: 2, copayBasis: 'VISIT', benefitPools: true,
    claimSubmissionChannels: ['PAYER_PORTAL', 'PAPER'], denialReasonCodes: ['NOT_COVERED', 'NO_AUTHORIZATION', 'DUPLICATE'], remittanceCorrectionReasonCodes: ['KEYING_ERROR'],
    appealReasonCodes: ['MEDICAL_NECESSITY', 'CODING_DISPUTE'], appealFilingDays: 60, maxAppealLevels: 2, insuranceExchange: false, exchangeMaxAttempts: 3,
    encounterDeposits: true, depositTransferReasonCodes: ['VISIT_CORRECTION'], admissionDepositClearance: true, admissionDepositEstimatePercent: '30', estimateValidityDays: 30, clearanceOverrideValidityHours: 24,
    cashSessionMethods: ['CASH'], cashSessionMaxOpenHours: 12, cashSessionBlindCount: true,
    receivableCurrencies: ['SAR'], paymentPlanCadences: ['MONTHLY'], paymentPlanMaxInstallments: 12, paymentPlanGraceDays: 7, statementCadenceDays: 30, statementChannels: ['EMAIL', 'SMS', 'PATIENT_PORTAL'], agingBucketDays: ['30', '60', '90'],
    packageItems: [iPkg], packageValidityDays: 180, packageReservations: true, packagePartialCancellation: 'UNUSED_QUANTITY_SHARE_V1', packageCancellationFeePercent: '10',
    stayConfiguration: stay, emConfiguration: em, advancedConfiguration: adv,
    overridableKeys: ['settlementMethods', 'cashSessionMethods', 'statementChannels', 'admissionDepositEstimatePercent'], lockedKeys: ['jurisdiction', 'independentIssue', 'taxAllocation'],
    operationalAssistanceEnabled: true, operationalAssistanceSources: ['CLAIM_COORDINATION_BLOCKER'],
  } });
  put('billing-policies', { code: 'POL-0002', name: 'Riyadh Central override', by: 1, approver: 2, ef: day(-60), data: { scope: 'BRANCH', branch: 'RUH-CENTRAL', settlementMethods: ['CASH', 'CARD_TERMINAL', 'BANK_TRANSFER', 'MADA'], admissionDepositEstimatePercent: '40' } });
  put('billing-policies', { code: 'POL-0003', reason: 'Dubai clinic sends statements by email only', name: 'Dubai clinic override', status: 'PENDING_APPROVAL', by: 1, age: 1, ef: day(6), data: { scope: 'BRANCH', branch: 'DXB-DHCC', statementChannels: ['EMAIL'], cashSessionMethods: ['CASH', 'CARD_TERMINAL'] } });

  put('reimbursement-routes', { code: 'RTE-0001', name: 'Ward days priced per diem', by: 2, approver: 1, ef: day(-80), data: { model: 'PER_DIEM', priority: 500, scope: 'ITEM', items: [iWard], careSettings: ['INPATIENT'], configurationRef: 'STAY-0001@v1' } });
  put('reimbursement-routes', { code: 'RTE-0002', name: 'Cholecystectomy case rate (Gulf Shield)', by: 2, approver: 1, ef: day(-80), data: { model: 'CASE_RATE', priority: 600, scope: 'ITEM', items: [iChole], contract: ctrGold, careSettings: ['DAYCASE', 'INPATIENT'], configurationRef: 'STAY-0002@v1' } });
  put('reimbursement-routes', { code: 'RTE-0003', name: 'Outpatient category rate', by: 2, approver: 1, ef: day(-25), data: { model: 'CATEGORY_RATE', priority: 300, scope: 'CATEGORY', category: catOut, careSettings: ['OUTPATIENT'], configurationRef: 'CRS-0001@v1' } });
  put('reimbursement-routes', { code: 'RTE-0004', name: 'Modifier pricing for imaging', by: 2, approver: 1, ef: day(-25), data: { model: 'FFS_MODIFIERS', priority: 200, scope: 'CATEGORY', category: catImg } });
  put('reimbursement-routes', { code: 'RTE-0005', name: 'DRG for inpatient surgery', status: 'DRAFT', by: 2, age: 1, data: { model: 'DRG', priority: 700, scope: 'CATEGORY', category: catSurg, careSettings: ['INPATIENT'], configurationRef: `DRG-0001@v1` } });
  void drg;

  /* Exchange */
  put('exchange-profiles', { code: 'XPR-0001', name: 'Gulf Shield claims (REST JSON)', by: 4, approver: 1, ef: day(-30), data: { operation: 'CLAIM', format: 'REST_JSON', payer: pGulf, tpa: pNajm, scopeKind: 'TENANT', endpointAlias: 'GSI_CLAIMS_V2', security: 'OAUTH2_MTLS', locked: true } });
  put('exchange-profiles', { code: 'XPR-0002', name: 'Gulf Shield eligibility', by: 4, approver: 1, ef: day(-30), data: { operation: 'ELIGIBILITY', format: 'REST_JSON', payer: pGulf, tpa: pNajm, scopeKind: 'TENANT', endpointAlias: 'GSI_ELIG_V2', security: 'OAUTH2_MTLS' } });
  put('exchange-profiles', { code: 'XPR-0004', name: 'Gulf Shield remittance (X12 835)', by: 4, approver: 2, ef: day(18), age: 2, reason: 'Electronic remittance from next billing cycle', data: { operation: 'REMITTANCE', format: 'X12_835', payer: pGulf, tpa: pNajm, scopeKind: 'TENANT', endpointAlias: 'GSI_REMIT_835', security: 'MTLS' } });
  put('exchange-profiles', { code: 'XPR-0003', name: 'NPHIES structural preview', status: 'DRAFT', by: 4, age: 3, data: { operation: 'CLAIM', format: 'NPHIES_FHIR_SIMULATED', payer: pOasis, scopeKind: 'TENANT', endpointAlias: 'NPHIES_SIM', security: 'MTLS' } });

  put('provider-profiles', { code: 'PAY-0001', name: 'Card collection simulator', status: 'DRAFT', by: 2, age: 2, data: { purpose: 'COLLECTION', providerType: 'CARD_GATEWAY', merchantAlias: 'MCN_RUH_MAIN', currencies: ['SAR'], maxAttempts: 3, mode: 'SIMULATOR' } });
  put('provider-profiles', { code: 'PAY-0002', reason: 'Simulated payouts before bank certification', name: 'Refund payout simulator', status: 'PENDING_APPROVAL', by: 2, age: 1, ef: day(4), data: { purpose: 'REFUND_PAYOUT', providerType: 'BANK_PAYOUT', merchantAlias: 'MCN_KSA_REFUNDS', currencies: ['SAR'], maxAttempts: 3, mode: 'SIMULATOR' } });

  /* Ledger */
  const acc = (code: string, name: string, accountNumber: string, accountType: string, normalBalance: string, parent?: number) =>
    put('gl-accounts', { code, name, status: 'ACTIVE', by: 2, data: { legalEntity: 'MCN-KSA', accountNumber, accountType, normalBalance, postingAllowed: !!parent, ...(parent ? { parentAccount: parent } : {}) } });
  const aAssets = acc('GL-0001', 'Current assets', '1000', 'ASSET', 'DEBIT');
  const aPatAr = acc('GL-0002', 'Patient receivables', '1210', 'ASSET', 'DEBIT', aAssets);
  const aPayAr = acc('GL-0003', 'Payer receivables', '1220', 'ASSET', 'DEBIT', aAssets);
  const aTender = acc('GL-0004', 'Tender clearing', '1150', 'ASSET', 'DEBIT', aAssets);
  const aLiab = acc('GL-0005', 'Current liabilities', '2000', 'LIABILITY', 'CREDIT');
  const aVat = acc('GL-0006', 'VAT payable', '2310', 'LIABILITY', 'CREDIT', aLiab);
  const aUnapplied = acc('GL-0007', 'Unapplied receipts', '2410', 'LIABILITY', 'CREDIT', aLiab);
  const aRev = acc('GL-0008', 'Revenue', '4000', 'REVENUE', 'CREDIT');
  const aSvc = acc('GL-0009', 'Patient service revenue', '4100', 'REVENUE', 'CREDIT', aRev);
  const aAllow = acc('GL-0010', 'Contractual allowances', '4900', 'REVENUE', 'DEBIT', aRev);

  put('gl-mappings', { code: 'MAP-0001', name: 'KSA posting map v1', by: 2, approver: 1, ef: day(-90), data: { legalEntity: 'MCN-KSA', entries: [
    { role: 'PATIENT_AR', account: aPatAr }, { role: 'PAYER_AR', account: aPayAr }, { role: 'SERVICE_REVENUE', account: aSvc }, { role: 'TAX_PAYABLE', account: aVat },
    { role: 'UNAPPLIED_CASH', account: aUnapplied }, { role: 'TENDER_CLEARING', account: aTender }, { role: 'CONTRACT_ALLOWANCE', account: aAllow },
  ] } });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const label = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  put('fiscal-periods', { code: 'FP-0001', name: `${label(prevStart)}, KSA`, by: 2, approver: 1, data: { legalEntity: 'MCN-KSA', periodStart: prevStart, periodEnd: prevEnd, periodState: 'SOFT_CLOSED' } });
  put('fiscal-periods', { code: 'FP-0002', name: `${label(monthStart)}, KSA`, by: 2, approver: 1, data: { legalEntity: 'MCN-KSA', periodStart: monthStart, periodEnd: monthEnd, periodState: 'OPEN' } });

  /* Platform */
  put('workflow-definitions', { code: 'WF-0001', name: 'Standard claim follow-up', by: 4, approver: 1, ef: day(-40), data: { workflowType: 'CLAIM', checkpoints: [
    { step: 1, name: 'Readiness check', guard: 'payer_invoice_issued', slaHours: 24 }, { step: 2, name: 'Submit to payer', guard: 'channel_evidence_recorded', slaHours: 48 },
    { step: 3, name: 'Await adjudication', slaHours: 720 }, { step: 4, name: 'Post remittance', guard: 'payer_receipt_recorded', slaHours: 72 },
  ] } });
  put('workflow-definitions', { code: 'WF-0002', name: 'Appeal escalation', status: 'DRAFT', by: 4, age: 2, data: { workflowType: 'APPEAL', checkpoints: [{ step: 1, name: 'Evidence pack', slaHours: 72 }, { step: 2, name: 'Independent decision', guard: 'approver_differs', slaHours: 48 }] } });

  put('platform-settings', { code: 'PLT-0001', name: 'Claim coordination assistant', by: 1, approver: 2, ef: day(-15), data: { settingType: 'AI_ASSISTANCE', publisher: 'Internal operations', packageVersion: '1.2.0', humanReviewRequired: true, allowedSources: ['CLAIM_COORDINATION_BLOCKER', 'CLAIM_STATE_ATTENTION'] } });
}

export function seedIfEmpty() {
  const n = (db.prepare('SELECT COUNT(*) n FROM app_user').get() as { n: number }).n;
  if (n > 0) return false;
  db.transaction(seed)();
  console.log('Seeded synthetic tenant configuration.');
  return true;
}

export function resetAndSeed() {
  db.transaction(() => {
    for (const r of RESOURCES) db.exec(`DELETE FROM ${tableName(r.key)}; DELETE FROM sqlite_sequence WHERE name='${tableName(r.key)}';`);
    db.exec(`DELETE FROM audit_event; DELETE FROM app_user;`);
    seed();
  })();
}
