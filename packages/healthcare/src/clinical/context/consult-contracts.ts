/**
 * UI mapping (frozen for WP1–WP4): @pepbits/ui cn/Button/Input/Textarea/Select/Skeleton;
 * Button icon -> leftIcon, quiet -> ghost, ai -> primary with an AI label/icon.
 * Select children -> options; SourceSelect for native children/optgroups. Field -> FieldShell,
 * or clinical ChoiceField for compound labels/aside. Segmented: disable each option, add an
 * explicit Clear action for nullable values; option tones become adjacent semantic status.
 * Badge ok/warn/crit/lapis/ai -> success/warning/danger/brand/violet; omit decorative dot.
 * @pepbits/components Drawer uses supported width and a string title (rich content in body).
 * Panel/SubCard -> Card/CardHeader/CardContent or ClinicalPanel/ConsultSection.
 * EmptyState body -> description; use supported icon/action props or compose alongside it.
 * ErrorNote -> ProblemNotice with problemsOf; use RecoveryNotice/ErrorState for load recovery.
 * Toast -> useScreenHost().notify (supported tone/object shape). Sparkline -> components.
 * useDebounced -> clinical/hooks; TriValue/TRI_OPTIONS -> models/consult-note (translate labels).
 * No generic primitive fork; shared controls consume effective preferences/localization.
 */
import type * as T from "../types";
import type * as N from "../models/consult-note";
import type * as R from "../models/consult-records";
import type * as O from "../models/consult-orders";
import type * as W from "../models/consult-workflow";
import type * as F from "../models/consult-reference";
import type {ClinicalDataPort, NewAllergy} from "./port";

export interface ConsultNotePort {
  loadConsultation(encounterId: string, signal?: AbortSignal): Promise<T.ConsultationDetail>;
  saveConsultNote(encounterId: string, content: N.NoteContent, baseVersion: number): Promise<W.SavedDraft>;
  signConsultNote(encounterId: string, expectedVersion: number): Promise<W.SignResult>;
  acknowledgeReviews(ids: string[]): Promise<void>;
  addNoteAddendum(encounterId: string, input: {reason: string; text: string}): Promise<void>;
  listNursingEntries(encounterId: string, signal?: AbortSignal): Promise<R.NursingEntry[]>;
  requestClarification(encounterId: string, input: R.ClarificationInput): Promise<void>;
}
export interface AllergyLifecyclePort {
  loadAllergyMasters(signal?: AbortSignal): Promise<R.AllergyMasterData>;
  addAllergy(patientId: string, input: NewAllergy): Promise<T.AllergyBlock>;
  addAllergies(patientId: string, input: R.AllergyBatchInput): Promise<T.AllergyBlock>;
  updateAllergy(patientId: string, allergyId: string, input: R.AllergyPatch): Promise<T.AllergyBlock>;
  verifyAllergy(patientId: string, allergyId: string, input: R.AllergyVerification): Promise<T.AllergyBlock>;
  reviewAllergies(patientId: string, outcome: R.AllergyReviewOutcome): Promise<T.AllergyBlock>;
}
export interface VitalsPort {
  recordVitals(encounterId: string, vitals: R.ConsultVitalsPayload): Promise<{news2: T.ScoreResult}>;
  loadVitalParameters(signal?: AbortSignal): Promise<R.VitalParameterCatalogue>;
  correctObservation(observationId: string, input: R.ObservationCorrection): Promise<void>;
  withdrawObservation(observationId: string, input: R.VersionReason): Promise<void>;
}
export interface PainPort {
  loadCodesets(signal?: AbortSignal): Promise<R.Codesets>;
  loadPainMaps(context: R.PatientEncounterContext, signal?: AbortSignal): Promise<R.PainMaps>;
  listPainScales(signal?: AbortSignal): Promise<R.PainScale[]>;
  loadPainHistory(patientId: string, encounterId?: string, signal?: AbortSignal): Promise<R.PainHistory>;
  recordPain(encounterId: string, input: R.PainAssessmentInput): Promise<R.PainSaveResult>;
}
export interface ScreeningPort {
  reviewScreening(encounterId: string, input: R.ScreeningReviewInput): Promise<void>;
  updateReproductiveStatus(patientId: string, input: R.ReproductiveStatusUpdate): Promise<void>;
}
export interface HistoryPort {
  loadMedicationHistory(patientId: string, query: {scope: R.MedHistoryScope; encounterId: string}, signal?: AbortSignal): Promise<R.MedHistoryResponse>;
  addReportedMedication(patientId: string, input: R.ReportedMedicationInput): Promise<T.MedStatement[]>;
  updateReportedMedication(patientId: string, medicationId: string, input: R.MedicationPatch): Promise<void>;
  addMedicationHistory(patientId: string, input: R.MedicationHistoryInput): Promise<void>;
  withdrawMedicationHistory(patientId: string, historyId: string, reason: string): Promise<void>;
  loadInvestigationHistory(patientId: string, query: R.InvestigationHistoryQuery, signal?: AbortSignal): Promise<R.InvestigationHistoryResponse>;
  addExternalResult(patientId: string, input: R.ExternalResultInput): Promise<void>;
  withdrawExternalResult(patientId: string, resultId: string, reason: string): Promise<void>;
  listProcedureHistory(patientId: string, signal?: AbortSignal): Promise<T.ProcedureHistory[]>;
  addProcedureHistory(patientId: string, input: R.ProcedureHistoryInput): Promise<void>;
  updateProcedureHistory(patientId: string, historyId: string, input: R.ProcedureHistoryPatch): Promise<void>;
}
export interface ProblemPort {
  loadProblemTimeline(patientId: string, signal?: AbortSignal): Promise<R.ProblemTimeline[]>;
  listConditions(patientId: string, signal?: AbortSignal): Promise<R.ConditionRow[]>;
  addCondition(patientId: string, input: R.NewCondition): Promise<void>;
  updateCondition(patientId: string, conditionId: string, input: R.ConditionPatch): Promise<void>;
  promoteCondition(patientId: string, conditionId: string): Promise<void>;
  /** Host maps null to the source API's empty string when unlinking. */
  linkCondition(patientId: string, conditionId: string, version: number, problemId: string | null): Promise<void>;
}
export interface ScoresPort {
  calculateScore(method: string, inputs: Record<string, unknown>, signal?: AbortSignal): Promise<T.ScoreResult>;
  listScoreDefinitions(signal?: AbortSignal): Promise<T.ScoreDef[]>;
  /** Include encounter diagnoses; absence of a diagnosis never implies a negative answer. */
  loadScoreAutofill(patientId: string, encounterId?: string, signal?: AbortSignal): Promise<R.ScoreAutofill>;
  saveScore(method: string, input: R.ScoreSaveInput): Promise<R.SavedScore>;
}
export interface AssessmentsPort {
  listAssessments(query: W.AssessmentQuery, signal?: AbortSignal): Promise<W.AssessmentRow[]>;
  listAvailableAssessments(patientId: string, encounterId?: string, signal?: AbortSignal): Promise<W.AvailableTool[]>;
  createAssessment(input: W.AssessmentCreateInput): Promise<W.AssessmentView>;
}
export interface CareProgrammesPort {
  loadCareProgrammes(patientId: string, encounterId?: string, signal?: AbortSignal): Promise<W.ProgrammesView>;
  listCareDecisions(patientId: string, signal?: AbortSignal): Promise<W.Decision[]>;
  listRecallContacts(patientId: string, signal?: AbortSignal): Promise<W.RecallContact[]>;
  recordCareDecision(patientId: string, input: W.CareDecisionInput): Promise<void>;
  withdrawCareDecision(decisionId: string, input: {reason: string; encounterId?: string}): Promise<void>;
}
export interface OrdersPort {
  evaluateOrderForms(encounterId: string, content: O.OrderEvaluationContent, signal?: AbortSignal): Promise<O.OrderEvaluation>;
  listOrderPriorities(signal?: AbortSignal): Promise<O.OrderPriority[]>;
  checkMedications(patientId: string, input: O.MedicationCheckInput, signal?: AbortSignal): Promise<O.MedicationCheckResult>;
  listCertificates(encounterId: string, signal?: AbortSignal): Promise<F.CertificateList>;
  resendCertificate(certificateId: string): Promise<void>;
  completeProcedure(encounterId: string, orderId: string, input: O.ProcedureCompletion): Promise<void>;
}
export interface ReferencePort {
  searchCatalog: ClinicalDataPort["searchCatalog"];
  listFacilities(signal?: AbortSignal): Promise<F.FacilityChoice[]>;
  listSpecialties(signal?: AbortSignal): Promise<string[]>;
  listClinicians(signal?: AbortSignal): Promise<F.Clinician[]>;
  loadServices(signal?: AbortSignal): Promise<F.Services>;
  listEducationTemplates(signal?: AbortSignal): Promise<F.EducationTemplate[]>;
  listReferralPharmacies(signal?: AbortSignal): Promise<F.ReferralPharmacy[]>;
}
export interface CareTeamPort {
  loadCareTeam(encounterId: string, signal?: AbortSignal): Promise<W.CareTeamData>;
  requestHandover(encounterId: string, input: W.HandoverInput): Promise<W.CareTeamData>;
  acceptHandover(encounterId: string, handoverId: string, synthesis: string): Promise<W.CareTeamData>;
  declineHandover(encounterId: string, handoverId: string, reason: string): Promise<W.CareTeamData>;
  cancelHandover(encounterId: string, handoverId: string): Promise<W.CareTeamData>;
  reassignAttending(encounterId: string, input: {userId: string; reason: string}): Promise<W.CareTeamData>;
  addCareTeamMember(encounterId: string, input: W.CareTeamMemberInput): Promise<W.CareTeamData>;
  endCareTeamMember(encounterId: string, memberId: string): Promise<W.CareTeamData>;
}
export interface EncounterEndPort {
  listEndOutcomes(encounterId: string, signal?: AbortSignal): Promise<W.EndOutcome[]>;
  endEncounter(encounterId: string, input: W.EndEncounterInput): Promise<void>;
  recordClinicalDischarge(encounterId: string, input: W.ClinicalDischargeInput): Promise<T.ConsultationEncounter>;
}
export interface AiPort {
  extractSuggestions(encounterId: string, text: string, signal?: AbortSignal): Promise<W.ExtractionResult>;
  summarizeChart(patientId: string, signal?: AbortSignal): Promise<W.ChartSummary>;
}
/** Required only for consultation. Reads/previews are abortable; writes retain source concurrency fields. */
export interface ConsultationDataPort extends ConsultNotePort, AllergyLifecyclePort, VitalsPort, PainPort,
  ScreeningPort, HistoryPort, ProblemPort, ScoresPort, AssessmentsPort, CareProgrammesPort, OrdersPort,
  ReferencePort, CareTeamPort, EncounterEndPort, AiPort,
  Pick<ClinicalDataPort, "setEncounterStatus" | "previewEsi" | "saveIntake"> {}

/** Optional domain capability; hosts may instead implement these workflows entirely in slots. */
export interface ConsultDomainPort {
  decideSubstitution(encounterId: string, orderId: string, input: O.SubstitutionDecisionInput): Promise<void>;
  loadSubstitutionOptions(orderId: string, query?: O.SubstitutionPreview, signal?: AbortSignal): Promise<O.SubstitutionOptions>;
  proposeSubstitution(orderId: string, input: O.SubstitutionProposal): Promise<void>;
  withdrawSubstitution(orderId: string, input: O.SubstitutionWithdrawal): Promise<void>;
  loadMedicationAdministration(encounterId: string, date?: string, signal?: AbortSignal): Promise<O.MarDetail>;
  requestAdministrationCheck(encounterId: string, input: O.AdministrationProposal): Promise<void>;
  recordAdministration(encounterId: string, input: O.AdministrationRecordInput): Promise<void>;
  approveAdministrationCheck(encounterId: string, checkId: string, input: O.CheckApproval): Promise<void>;
  recordPostDoseObservation(encounterId: string, recordId: string, input: O.PostDoseObservationInput): Promise<void>;
  recordAdverseReaction(encounterId: string, recordId: string, input: O.AdverseReactionInput): Promise<void>;
  recordPrnReassessment(encounterId: string, recordId: string, input: O.PrnReassessmentInput): Promise<void>;
  loadReturnableMedicines(encounterId: string, signal?: AbortSignal): Promise<O.ReturnAvailable>;
  requestMedicationReturn(input: O.MedicationReturnInput): Promise<void>;
  loadMedicationCourse(courseId: string, signal?: AbortSignal): Promise<O.CourseDetail>;
  listCourseLots(product: string, orderId: string, signal?: AbortSignal): Promise<O.CourseLots>;
  loadLabQuestions(query: O.LabQuestionQuery, signal?: AbortSignal): Promise<O.LabQuestionCatalogue>;
  loadSpecimenTests(specimenId: string, signal?: AbortSignal): Promise<O.CodedTest[]>;
}
