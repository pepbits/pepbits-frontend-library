export type DeviceCapability =
  "receipt" | "label" | "report" | "scan" | "drawer" | "scale";
export interface IntegrationDevice {
  id: string;
  title: string;
  transport: "browser" | "demo" | "native";
  capabilities: DeviceCapability[];
}
export interface IntegrationRecord {
  id: string;
  code: string;
  title: string;
  context: string;
}
export interface IntegrationRule {
  id: string;
  event: string;
  capability: DeviceCapability;
  deviceId: string;
  enabled: boolean;
}
export interface IntegrationPolicy {
  version: number;
  lockedDevice: string;
  automatic: boolean;
  maxCopies: number;
}
export interface IntegrationJob {
  id: string;
  owner: string;
  stationId: string;
  deviceId: string;
  capability: DeviceCapability;
  recordId: string;
  eventId: string;
  status:
    | "queued"
    | "simulated"
    | "print-requested"
    | "cancelled"
    | "accepted"
    | "failed"
    | "unknown";
  copies: number;
  createdAt: string;
  title: string;
  lines: string[];
  attempts: number;
}
export interface IntegrationLibrary {
  devices: IntegrationDevice[];
  records: IntegrationRecord[];
  rules: IntegrationRule[];
  jobs: IntegrationJob[];
  stationId: string;
  defaultDevice: string;
  policy: IntegrationPolicy;
  canManage: boolean;
}
export interface IntegrationCommand {
  action:
    | "library"
    | "lookup"
    | "enqueue"
    | "event"
    | "dispatch"
    | "cancel"
    | "preference"
    | "policy"
    | "rule";
  operationId?: string;
  stationId: string;
  deviceId?: string;
  recordId?: string;
  capability?: DeviceCapability;
  copies?: number;
  code?: string;
  context?: string;
  eventId?: string;
  event?: string;
  jobId?: string;
  policy?: IntegrationPolicy;
  rule?: IntegrationRule;
  version?: number;
}
