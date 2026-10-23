import type {RegistrationCommand, RegistrationConfig, RegistrationView, RegistrationRecord, RegistrationAppointment} from '../domain/op-registration';
import { ClinicalRequestFailure } from "./clinical-templates";
export interface RegistrationAdapter {
  config(): Promise<RegistrationConfig>;
  load(patientId: string, id?: string): Promise<RegistrationView>;
  command(input: RegistrationCommand): Promise<RegistrationView>;
  worklist(): Promise<{
    records: RegistrationRecord[];
    appointments: RegistrationAppointment[];
  }>;
}
export function createRegistrationAdapter(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  product: string,
): RegistrationAdapter {
  async function call<T>(input: RegistrationCommand): Promise<T> {
    const response = await request("/op-registration", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Product-Id": product },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body === null)
      throw new ClinicalRequestFailure(
        response.ok ? 502 : response.status,
        body?.fieldErrors ?? {},
        body?.reference,
      );
    return body;
  }
  return {
    config: () => call({ action: "config" }),
    load: (patientId, id) =>
      call({ action: "load", patientId, ...(id ? { id } : {}) }),
    command: (input) => call(input),
    worklist: () => call({ action: "worklist" }),
  };
}
