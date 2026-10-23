import type { PatientRecord, PatientCareRow } from "./clinical-templates";
export interface ClinicalDocument<V> {
  id: string;
  patientId: string;
  encounterId: string;
  version: number;
  status: "draft" | "completed";
  values: V;
  updatedAt: string;
  actor: string;
  configurationVersion?: string;
  history: Array<{ at: string; actor: string; messageKey: string }>;
}
export interface ClinicalDocumentView<V, C> {
  patient: PatientRecord;
  encounters: PatientCareRow[];
  assessments: ClinicalDocument<V>[];
  blank: ClinicalDocument<V>;
  config: C;
  canWrite: boolean;
}
export interface ClinicalDocumentSave<V> {
  patientId: string;
  assessment: ClinicalDocument<V>;
  expectedVersion: number;
  operationId: string;
  complete: boolean;
}
