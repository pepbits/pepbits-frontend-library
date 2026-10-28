import type {ConsultationDataPort, ConsultDomainPort} from "./consult-contracts";
import type {DetailedNewAllergy} from "../models/consult-records";
import type {AllergyBlock, CatalogItem, CatalogName, EncounterClass, EncounterDetail, QueueRow, ScoreResult} from "../types";
import type {IntakePayload} from "../forms/intake-model";
import type {EsiPreview} from "../triage/model";

export interface SimpleNewAllergy { substance: string; allergenCode?: string; category: string; reaction?: string; criticality?: string }
export type NewAllergy = SimpleNewAllergy | DetailedNewAllergy;
/** Hosts preserve HTTP status (especially 409 conflicts) and normalize server validation to problems. */
export interface ClinicalPortError extends Error { status?: number; problems?: string[] }
export interface CatalogSearchOptions { limit?: number; category?: string }
export interface IntakeResult { news2: ScoreResult; esi: {finalLevel: number} | null }

/**
 * Everything the clinical forms read and write. The host supplies it (an HTTP client, a test double);
 * the components never build URLs. A rejected promise carries an `Error` whose message is shown, and
 * an optional `problems: string[]` property lists validation failures returned by the server.
 */
export interface ClinicalDataPort {
  consult?: ConsultationDataPort;
  domain?: ConsultDomainPort;
  listEncounters(encounterClass: EncounterClass, signal?: AbortSignal): Promise<QueueRow[]>;
  loadEncounter(encounterId: string, signal?: AbortSignal): Promise<EncounterDetail>;
  setEncounterStatus(encounterId: string, status: string): Promise<void>;
  saveIntake(encounterId: string, payload: IntakePayload): Promise<IntakeResult>;
  searchCatalog(catalog: CatalogName, query: string, signal?: AbortSignal, options?: CatalogSearchOptions): Promise<CatalogItem[]>;
  /** Live score preview; the server recalculates authoritatively when the record is saved. */
  calculateScore(method: string, inputs: Record<string, unknown>, signal?: AbortSignal): Promise<ScoreResult>;
  /** Live ESI preview from the decisions, age and vital signs (`esiInputs`); recalculated on save. */
  previewEsi(inputs: Record<string, unknown>, signal?: AbortSignal): Promise<EsiPreview>;
  addAllergy(patientId: string, allergy: NewAllergy): Promise<AllergyBlock>;
}

/** Server validation problems attached to a rejected port call, or the error message alone. */
export function problemsOf(error: unknown): string[] {
  const problems = (error as {problems?: unknown} | null)?.problems;
  if (Array.isArray(problems) && problems.length) return problems.map(String);
  return [error instanceof Error ? error.message : String(error)];
}
