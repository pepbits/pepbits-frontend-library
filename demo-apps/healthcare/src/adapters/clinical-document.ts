import type {ClinicalDocumentView, ClinicalDocumentSave, ClinicalDocument} from '../domain/clinical-document';
import { ClinicalRequestFailure } from "./clinical-templates";
export interface ClinicalDocumentAdapter<V, C> {
  load(patientId: string): Promise<ClinicalDocumentView<V, C>>;
  save(input: ClinicalDocumentSave<V>): Promise<ClinicalDocument<V>>;
}
export function createClinicalDocumentAdapter<V, C>(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  productId: string,
  endpoint: string,
): ClinicalDocumentAdapter<V, C> {
  async function call<T>(body: object): Promise<T> {
    const response = await request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Product-Id": productId,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data)
      throw new ClinicalRequestFailure(
        response.ok ? 502 : response.status,
        data?.fieldErrors ?? {},
        data?.reference,
      );
    return data;
  }
  return {
    load: (patientId) => call({ action: "load", patientId }),
    save: (input) => call({ action: "save", ...input }),
  };
}
