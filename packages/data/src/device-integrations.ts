import type {
  IntegrationCommand,
  IntegrationLibrary,
} from "./contracts/device-integrations";
import { WorkflowRequestFailure } from "./workflow-failure";
export interface IntegrationAdapter {
  library(stationId: string): Promise<IntegrationLibrary>;
  command<T>(input: IntegrationCommand): Promise<T>;
}
export function createIntegrationAdapter(
  request: (path: string, init?: RequestInit) => Promise<Response>,
  product: string,
  path: string,
): IntegrationAdapter {
  async function command<T>(input: IntegrationCommand): Promise<T> {
    const r = await request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Product-Id": product },
      body: JSON.stringify(input),
    });
    const body = await r.json();
    if (!r.ok) throw new WorkflowRequestFailure(r.status, { form: body.error });
    return body;
  }
  return {
    library: (stationId) => command({ action: "library", stationId }),
    command,
  };
}

export * from "./contracts/device-integrations";
