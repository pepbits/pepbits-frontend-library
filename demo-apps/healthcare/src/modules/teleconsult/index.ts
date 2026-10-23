export { ReferenceTeleconsultProviderModule } from "./provider/module";
export { ReferenceTeleconsultPatientModule } from "./patient/module";
export { providerRoutes, providerNavigation, providerPaths, resolveProviderRoute, type ProviderRoute, type ProviderRouteKind } from "./provider/routes";
export { patientRoutes, patientNavigation, patientPaths, resolvePatientRoute, type PatientRoute, type PatientRouteKind } from "./patient/routes";
export {
  TELECONSULT_PROVIDER_NAMESPACE, TELECONSULT_PATIENT_NAMESPACE, TELECONSULT_PROVIDER_VARIANT, TELECONSULT_PATIENT_VARIANT,
  ROLE_HEADER, PATIENT_HEADER, IDEMPOTENCY_HEADER,
  parseProviderSession, parsePatientSession, SessionContractError, normalizeFrames,
  type ProviderSession, type PatientSession, type TranscriptFrame,
} from "./shared/contract";
export { createTeleconsultClient, ApiError, type TeleconsultClient, type TeleconsultClientOptions } from "./shared/client";
export type { Encounter, Patient, Staff, Role, AppointmentView } from "./shared/types";
