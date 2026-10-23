export type Row = Record<string, any>;
export interface Page<T = Row> { data: T[]; total: number; page: number; pageSize: number }
export interface Option { value: string; label: string; code?: string; meta?: Row }

export interface Policy {
  id?: string; patientId?: string; payerId: string; tpaId: string; planId: string; networkId: string;
  memberId: string; policyNo: string; validFrom: string; validTo: string; relation: string; isPrimary: boolean; status: string;
  payerName?: string; tpaName?: string; planName?: string; networkName?: string;
  copayPct?: number; deductible?: number; maxCopayPerVisit?: number; isExpired?: boolean; isCurrent?: boolean;
}

export interface PatientSummary {
  id: string; mrn: string; firstName: string; lastName: string; fullName: string; gender: string; dob: string; age: number | null;
  phone: string; email: string; nationalId: string; nationality: string; address: string; allergies: string; status: string;
  primaryPolicy: Policy | null; insuranceLabel: string; lastVisit: string;
}

export interface Quote {
  code: string; name: string; kind: 'item' | 'service'; category: string; billingCategory: 'Hospital' | 'Pharmacy';
  qty: number; basePrice: number; unitPrice: number; gross: number; discount: number; net: number;
  covered: boolean; copayPct: number; patientShare: number; payerShare: number;
  priorAuthRequired: boolean; erxRequired: boolean; priceSource: string; stockQty: number | null; uom: string;
}

export interface OrderLine extends Omit<Quote, 'priceSource' | 'stockQty' | 'basePrice'> {
  id: string; orderNo: string; encounterId: string; status: 'Draft' | 'Signed' | 'Billed' | 'Cancelled';
  dosage: string; frequency: string; durationDays: number; route: string; instructions: string;
  priorAuthStatus: string; erxStatus: string; approvalId: string; erxId: string; orderedBy: string; orderedAt: string; invoiceId: string;
}

export interface Approval {
  id: string; approvalNo: string; channel: 'PriorAuth' | 'eRx'; encounterId: string; status: string; diagnosis: string; justification: string;
  requestedAmount: number; approvedAmount: number; authorizationNo: string; remarks: string; submittedAt: string; respondedAt: string;
  patientName: string; mrn: string; encNo: string; payerName: string; itemsLabel: string; lines: { id: string; code: string; name: string; qty: number; net: number }[];
}

export interface Coverage {
  payerName: string; tpaName: string; planName: string; networkName: string; priceListName?: string;
  copayPct: number; deductible: number; maxCopayPerVisit: number; priorAuthLimit?: number; active?: boolean;
}
