import type {
  PatientRecord,
  PatientMetadata,
  PatientFilters,
  PatientSearchResult,
  PatientOverview,
  PatientSave,
  PatientSavedSearch,
  PatientCareRequest,
  PatientEligibility,
} from "@pepbits/erp-config";
export interface ClinicalTemplateAdapter {
  eligibility(
    patientId: string,
    insuranceId: string,
  ): Promise<PatientEligibility>;
  metadata(): Promise<PatientMetadata>;
  search(filters: PatientFilters, options?: {signal?: AbortSignal}): Promise<PatientSearchResult>;
  load(id: string): Promise<PatientRecord>;
  newRecord(): Promise<PatientRecord>;
  save(input: PatientSave): Promise<PatientRecord>;
  overview(id: string): Promise<PatientOverview>;
  savedSearches(): Promise<PatientSavedSearch[]>;
  saveSearch(
    name: string,
    filters: PatientFilters,
  ): Promise<PatientSavedSearch[]>;
  deleteSearch(id: string): Promise<PatientSavedSearch[]>;
  exportRows(
    filters: PatientFilters,
  ): Promise<{ rows: PatientSummaryExport[] }>;
  schedule(input: PatientCareRequest): Promise<PatientOverview>;
}
export interface PatientSummaryExport {
  mrn: string;
  name: string;
  birthDate: string;
  gender: string;
  mobile: string;
  email: string;
  status: string;
}
export class ClinicalRequestFailure extends Error {
  constructor(
    public status: number,
    public fieldErrors: Record<string, string> = {},
    public reference?: string,
  ) {
    super("Clinical template request failed");
  }
}
/** Applications can replace this adapter; components do not know URLs, tokens or fetch. */
export function createClinicalTemplateAdapter(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  productId: string,
): ClinicalTemplateAdapter {
  async function call<T>(action: string, payload: object = {}): Promise<T> {
    const response = await request("/clinical-templates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Product-Id": productId,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok)
      throw new ClinicalRequestFailure(
        response.status,
        body?.fieldErrors ?? {},
        body?.reference,
      );
    if (body === null) throw new ClinicalRequestFailure(502);
    return body as T;
  }
  return {
    eligibility: (patientId, insuranceId) =>
      call("eligibility", { patientId, insuranceId }),
    metadata: () => call("metadata"),
    search: (filters) => call("search", { filters }),
    load: (id) => call("load", { id }),
    newRecord: () => call("new"),
    save: (input) => call("save", input),
    overview: (id) => call("overview", { id }),
    savedSearches: () => call("saved-searches"),
    saveSearch: (name, filters) => call("save-search", { name, filters }),
    deleteSearch: (id) => call("delete-search", { id }),
    exportRows: (filters) => call("export", { filters }),
    schedule: (input) => call("schedule", input),
  };
}
