export type IdentityMethod =
  "card" | "eid" | "passport" | "fingerprint" | "face";
export interface IdentityDevice {
  id: string;
  title: string;
  method: IdentityMethod;
  transport: "demo" | "native";
}
export interface IdentitySubject {
  id: string;
  name: string;
  birthDate: string;
}
export interface IdentityScenario {
  id: string;
  title: string;
}
export interface IdentityPolicy {
  version: number;
  biometricsEnabled: boolean;
  lockedDevice: string;
}
export interface IdentityAttempt {
  id: string;
  subjectId: string;
  deviceId: string;
  stationId: string;
  expiresAt: string;
  status:
    | "pending"
    | "demo-match"
    | "demo-mismatch"
    | "demo-expired-document"
    | "manual-review"
    | "cancelled"
    | "expired";
  authenticated: false;
  document?: {
    reference: string;
    name: string;
    birthDate: string;
    expiry: string;
  };
  createdAt: string;
}
export interface IdentityLibrary {
  devices: IdentityDevice[];
  subjects: IdentitySubject[];
  scenarios: IdentityScenario[];
  policy: IdentityPolicy;
  attempts: IdentityAttempt[];
  canManage: boolean;
  defaultDevice: string;
}
export interface IdentityCommand {
  action:
    | "library"
    | "start"
    | "simulate"
    | "manual"
    | "cancel"
    | "preference"
    | "policy";
  stationId: string;
  operationId?: string;
  subjectId?: string;
  deviceId?: string;
  consent?: boolean;
  attemptId?: string;
  scenarioId?: string;
  policy?: IdentityPolicy;
}
