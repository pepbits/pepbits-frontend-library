import type { PatientField } from "./clinical-templates";
export const CARE_PAGES = [
  "emergency-registration",
  "inpatient-admission",
  "consultation-entry-design",
  "consultation-entry-v2",
] as const;
export type CarePageId = (typeof CARE_PAGES)[number];
export type CareValues = Record<string, string | boolean>;
export interface CareGroup {
  navigationLabel?: string;
  id: string;
  title: string;
  step: number;
  tab: string;
  fields: Array<PatientField & { readOnly?: boolean }>;
}
export interface CareDefinition {
  id: CarePageId;
  kind: "emergency" | "inpatient" | "consultation";
  title: string;
  steps: string[];
  groups: CareGroup[];
  defaults: CareValues;
  ordersEnabled?: boolean;
  tools: {
    choices: Array<{
      multiple?:boolean;
      group: string;
      field: string;
      label: string;
      options: Array<{ value: string; label: string }>;
    }>;
    tabs: Array<{ id: string; label: string }>;
    dispositions: Array<{ value: string; label: string }>;
    orderTypes: Array<{ id: string; label: string }>;
    patient: CareGroup;
    order: CareGroup;
    configuration: CareGroup;
  };
}
export interface CarePatient {
  id: string;
  name: string;
  dob: string;
  sex: string;
  mobile: string;
  temporary?: boolean;
}
export interface CareBed {
  id: string;
  ward: string;
  room: string;
  care: string;
  status: string;
  isolation: boolean;
  telemetry: boolean;
}
export interface CareOrder {
  id: string;
  kind: string;
  values: CareValues;
  status: string;
}
export interface CareRecord {
  id: string;
  version: number;
  patient: CarePatient;
  values: CareValues;
  status: "draft" | "active" | "admitted" | "signed" | "completed";
  bedId: string;
  orders: CareOrder[];
  events: Array<{ at: string; action: string }>;
  updatedAt: string;
  step: number;
  notes: Array<{ at: string; text: string }>;
}
export interface CareView {
  definition: CareDefinition;
  patients: CarePatient[];
  beds: CareBed[];
  records: CareRecord[];
  record: CareRecord | null;
}
export interface CareCommand {
  pageId: string;
  action: string;
  operationId?: string;
  id?: string;
  version?: number;
  patientId?: string;
  patient?: Omit<CarePatient, "id">;
  values?: CareValues;
  step?: number;
  bedId?: string;
  order?: { kind: string; values: CareValues };
  orderId?: string;
  text?: string;
}
