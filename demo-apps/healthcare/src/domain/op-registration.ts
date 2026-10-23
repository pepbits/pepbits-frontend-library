import type { PatientField, PatientRecord } from "./clinical-templates";
export type RegistrationValues = Record<string, string | boolean>;
export interface RegistrationGroup {
  id: string;
  title: string;
  fields: PatientField[];
}
export interface RegistrationConfig {
  draftsEnabled?: boolean;
  today: string;
  currency: string;
  canWrite: boolean;
  groups: RegistrationGroup[];
  providers: Array<{
    id: string;
    name: string;
    specialty: string;
    room: string;
    fee: number;
  }>;
  templates: Array<{
    id: string;
    label: string;
    provider: string;
    purpose: string;
    reason: string;
  }>;
  services: Array<{
    id: string;
    label: string;
    category: string;
    price: number;
  }>;
  defaults: RegistrationValues;
}
export interface RegistrationOrder {
  id: string;
  serviceId: string;
  label: string;
  category: string;
  price: number;
  status: "ordered" | "started" | "completed" | "cancelled";
  note: string;
  tracking: string;
}
export interface RegistrationPayment {
  id: string;
  amount: number;
  method: string;
  at: string;
  reversed: boolean;
  reason: string;
}
export interface RegistrationRecord {
  id: string;
  patientId: string;
  owner: string;
  version: number;
  status: "draft" | "active" | "completed";
  values: RegistrationValues;
  orders: RegistrationOrder[];
  payments: RegistrationPayment[];
  signedAt: string;
  signedBy: string;
  addenda: Array<{ text: string; at: string; actor: string }>;
  events: Array<{ key: string; at: string; actor: string }>;
  updatedAt: string;
}
export interface RegistrationAppointment {
  id: string;
  patientId: string;
  provider: string;
  date: string;
  time: string;
  reason: string;
  status: "booked" | "arrived" | "fulfilled";
  encounterId: string;
}
export interface RegistrationView {
  config: RegistrationConfig;
  record: RegistrationRecord;
  patient: PatientRecord;
  appointments: RegistrationAppointment[];
}
export interface RegistrationCommand {
  action: string;
  patientId?: string;
  id?: string;
  version?: number;
  operationId?: string;
  values?: RegistrationValues;
  payload?: Record<string, string | number | boolean>;
}
export interface RegistrationLedger {
  gross: number;
  patient: number;
  payer: number;
  paid: number;
  balance: number;
}
/** Illustrative allocation only. The API owns the persisted tariff and charge state. */
export function registrationLedger(
  record: RegistrationRecord,
  config: RegistrationConfig,
): RegistrationLedger {
  const fee =
    config.providers.find((p) => p.id === record.values.provider)?.fee ?? 0;
  const gross =
    (record.signedAt ? fee : 0) +
    record.orders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + o.price, 0);
  const insured =
    record.values.responsibility === "insurance" &&
    record.values.eligibility === "eligible";
  const deductible = Math.min(
    gross,
    Math.max(0, Number(record.values.deductible) || 0),
  );
  const net = Math.max(0, gross - (Number(record.values.discount) || 0));
  const actualDeductible = Math.min(net, deductible);
  const patient = insured
    ? Math.round(
        (actualDeductible +
          ((net - actualDeductible) * Number(record.values.copay)) / 100) *
          100,
      ) / 100
    : net;
  const paid =
    Math.round(
      record.payments
        .filter((p) => !p.reversed)
        .reduce((sum, p) => sum + p.amount, 0) * 100,
    ) / 100;
  return {
    gross,
    patient,
    payer: Math.round((net - patient) * 100) / 100,
    paid,
    balance: Math.max(0, Math.round((patient - paid) * 100) / 100),
  };
}
export function registrationErrors(
  values: RegistrationValues,
  config: RegistrationConfig,
  stage: number,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const require = (key: string) => {
    if (
      !values[key] ||
      (typeof values[key] === "string" && !String(values[key]).trim())
    )
      errors[key] = "registration.required";
  };
  require("identityName");
  require("identityDob");
  if (stage >= 2) {
    require("reason");
    require("clinic");
    if (!config.providers.some((p) => p.id === values.provider))
      errors.provider = "registration.required";
    if (values.source === "referral") require("referrer");
  }
  if (stage >= 3) {
    require("consentReviewed");
    if (!["accepted", "deferred"].includes(String(values.treatment)))
      errors.treatment = "registration.consentRequired";
    if (values.treatment === "deferred") require("consentNote");
    require("privacy");
    if (values.responsibility === "insurance") {
      require("payer");
      require("member");
      if (
        values.eligibility !== "eligible" ||
        ["pending", "denied"].includes(String(values.authorization))
      )
        require("financialReason");
    }
    if (values.responsibility === "sponsor") require("sponsor");
    if (values.responsibility === "package") require("package");
    if (
      !Number.isFinite(Number(values.copay)) ||
      Number(values.copay) < 0 ||
      Number(values.copay) > 100
    )
      errors.copay = "registration.range";
    if (
      !Number.isFinite(Number(values.deductible)) ||
      Number(values.deductible) < 0
    )
      errors.deductible = "registration.range";
  }
  return errors;
}
