import type {ConsultationValues, ConsultationConfiguration} from '../domain/clinical-consultation';
import {
  createClinicalDocumentAdapter,
  type ClinicalDocumentAdapter,
} from "./clinical-document";
export type ClinicalConsultationAdapter = ClinicalDocumentAdapter<
  ConsultationValues,
  ConsultationConfiguration
>;
export function createClinicalConsultationAdapter(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  productId: string,
): ClinicalConsultationAdapter {
  return createClinicalDocumentAdapter(
    request,
    productId,
    "/clinical-consultation",
  );
}
