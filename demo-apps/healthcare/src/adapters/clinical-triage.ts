import type {TriageValues, TriageConfiguration} from '../domain/clinical-triage';
import {
  createClinicalDocumentAdapter,
  type ClinicalDocumentAdapter,
} from "./clinical-document";
export type ClinicalTriageAdapter = ClinicalDocumentAdapter<
  TriageValues,
  TriageConfiguration
>;
export function createClinicalTriageAdapter(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  productId: string,
): ClinicalTriageAdapter {
  return createClinicalDocumentAdapter(request, productId, "/clinical-triage");
}
