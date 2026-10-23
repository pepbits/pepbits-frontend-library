import type { CurrencyCode } from "@pepbits/preferences";
import type { PatientRecord, PatientCareRow } from "./clinical-templates";
export interface ClinicService {
  id: string;
  label: string;
  category: string;
  price: number;
  taxBps: number;
  coverageBps: number;
}
export interface ClinicOrder {
  id: string;
  sourceId?: string;
  label: string;
  detail: string;
  doctor: string;
  date: string;
  serviceId: string;
  quantity: number;
  status: "prescribed" | "ordered" | "billed";
  invoiceId?: string;
}
export interface ClinicLine {
  orderId: string;
  label: string;
  quantity: number;
  price: number;
  net: number;
  tax: number;
  insurance: number;
  patient: number;
}
export interface ClinicPayment {
  id: string;
  invoiceId: string;
  amount: number;
  method: "cash" | "card" | "transfer";
  reference: string;
  at: string;
  actor: string;
  refundOf?: string;
}
export interface ClinicInvoice {
  id: string;
  at: string;
  actor: string;
  status: "issued" | "void";
  lines: ClinicLine[];
  discountBps: number;
  total: number;
  insurance: number;
  patient: number;
  insuranceId: string;
  authorization: string;
  note: string;
  revisions?: Array<{
    at: string;
    actor: string;
    reason: string;
    invoice: Omit<ClinicInvoice, "revisions">;
  }>;
}
export interface ClinicAudit {
  id: string;
  at: string;
  actor: string;
  messageKey: string;
  reference: string;
}
export interface ClinicBillingState {
  patientId: string;
  version: number;
  orders: ClinicOrder[];
  invoices: ClinicInvoice[];
  payments: ClinicPayment[];
  history: ClinicAudit[];
}
export interface ClinicBillingView {
  patient: PatientRecord;
  context: PatientCareRow[];
  state: ClinicBillingState;
  services: ClinicService[];
  canWrite: boolean;
  currency: CurrencyCode;
}
export type ClinicBillingCommand =
  | {
      action: "editInvoice";
      invoiceId: string;
      quantities: Array<{ orderId: string; quantity: number }>;
      discountBps: number;
      insuranceId: string;
      authorization: string;
      note: string;
      reason: string;
    }
  | { action: "order"; orderIds: string[] }
  | { action: "add"; serviceId: string; quantity: number; doctor: string }
  | {
      action: "invoice";
      orderIds: string[];
      discountBps: number;
      insuranceId: string;
      authorization: string;
      note: string;
    }
  | {
      action: "payment";
      invoiceId: string;
      amount: number;
      method: "cash" | "card" | "transfer";
      reference: string;
    }
  | { action: "refund"; paymentId: string; reference: string }
  | { action: "export"; invoiceId: string; format: "csv" | "xlsx" | "print" }
  | { action: "void"; invoiceId: string; reference: string };
export type ClinicBillingMutation = ClinicBillingCommand & {
  patientId: string;
  expectedVersion: number;
  operationId: string;
};
export function clinicInvoiceLines(
  orders: ClinicOrder[],
  services: ClinicService[],
  discountBps: number,
  insured: boolean,
): ClinicLine[] {
  return orders.map((order) => {
    const service = services.find((s) => s.id === order.serviceId);
    if (!service) throw Error("Unknown service");
    const net = Math.round(
        (service.price * order.quantity * (10000 - discountBps)) / 10000,
      ),
      tax = Math.round((net * service.taxBps) / 10000),
      insurance = insured ? Math.round((net * service.coverageBps) / 10000) : 0;
    return {
      orderId: order.id,
      label: order.label,
      quantity: order.quantity,
      price: service.price,
      net,
      tax,
      insurance,
      patient: net + tax - insurance,
    };
  });
}
export function clinicBalance(
  state: ClinicBillingState,
  invoice: ClinicInvoice,
): number {
  return invoice.status === "void"
    ? 0
    : invoice.patient -
        state.payments
          .filter((p) => p.invoiceId === invoice.id)
          .reduce((sum, p) => sum + p.amount, 0);
}
