import type {CareCommand, CareView} from '../domain/care-pages';
import { ClinicalRequestFailure } from "./clinical-templates";
export interface CareAdapter {
  command(input: CareCommand): Promise<CareView>;
}
export function createCareAdapter(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  product: string,
): CareAdapter {
  return {
    async command(input) {
      const r = await request("/care-pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Product-Id": product,
        },
        body: JSON.stringify(input),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok || body === null)
        throw new ClinicalRequestFailure(
          r.ok ? 502 : r.status,
          body?.fieldErrors ?? {},
          body?.reference,
        );
      return body;
    },
  };
}
