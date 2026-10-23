import type {ClinicBillingView, ClinicBillingMutation} from '../domain/clinic-billing';
import { ClinicalRequestFailure } from "./clinical-templates";
export interface ClinicBillingAdapter {
  load(patientId: string): Promise<ClinicBillingView>;
  mutate(input: ClinicBillingMutation): Promise<ClinicBillingView>;
}
export function createClinicBillingAdapter(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  productId: string,
): ClinicBillingAdapter {
  const call = async (body: object): Promise<ClinicBillingView> => {
    const r = await request("/clinic-billing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Product-Id": productId,
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data)
      throw new ClinicalRequestFailure(
        r.ok ? 502 : r.status,
        data?.fieldErrors ?? {},
        data?.reference,
      );
    return data;
  };
  return {
    load: (patientId) => call({ action: "load", patientId }),
    mutate: call,
  };
}
