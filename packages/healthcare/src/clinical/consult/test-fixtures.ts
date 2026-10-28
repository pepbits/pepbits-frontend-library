import {masters} from "../consult-records/test-fixtures";
import {vi} from "vitest";
import type {ConsultationDataPort} from "../context/consult-contracts";
import type {ConsultationDetail} from "../types";
import {emptyNote} from "../models/consult-note";
import {FALLBACK_PARAMETERS} from "../models/consult-records";
import {encounterDetail, fakePort} from "../test/fixtures";

/** Synthetic consultation. No real patient, transport, or host service. */
export function consultationDetail(): ConsultationDetail {
  const intake = encounterDetail();
  return {...intake, patient: {...intake.patient, givenName: "Test", familyName: "Patient", nationality: "", preferredLanguage: "en", identifiers: [], version: 1},
    observations: {latest: {}, history: []}, allergies: {assessment: {state: "nka"}, entries: []},
    problems: [], medications: [], orders: [], reviews: [], scores: [],
    note: {id: "N1", version: 4, status: "draft", content: {...emptyNote(), vitalsNotTaken: "Patient declined measurement", disposition: "home", dischargeAt: "2026-10-27T09:00:00Z", diagnoses: [{code: "DX1", display: "Synthetic diagnosis", primary: true, verification: "provisional"}]}, updatedAt: "2026-10-28T10:00:00Z"}};
}
export function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
export function consultationPort(overrides: Partial<ConsultationDataPort> = {}) {
  let detail = consultationDetail();
  const methods = {
    acceptHandover: vi.fn(async () => {throw new Error("Unarranged consultation operation: acceptHandover");}),
    addAllergies: vi.fn(async () => {throw new Error("Unarranged consultation operation: addAllergies");}),
    addAllergy: vi.fn(async () => {throw new Error("Unarranged consultation operation: addAllergy");}),
    addCareTeamMember: vi.fn(async () => {throw new Error("Unarranged consultation operation: addCareTeamMember");}),
    addCondition: vi.fn(async () => {throw new Error("Unarranged consultation operation: addCondition");}),
    addExternalResult: vi.fn(async () => {throw new Error("Unarranged consultation operation: addExternalResult");}),
    addMedicationHistory: vi.fn(async () => {throw new Error("Unarranged consultation operation: addMedicationHistory");}),
    addProcedureHistory: vi.fn(async () => {throw new Error("Unarranged consultation operation: addProcedureHistory");}),
    addReportedMedication: vi.fn(async () => {throw new Error("Unarranged consultation operation: addReportedMedication");}),
    calculateScore: vi.fn(async () => {throw new Error("Unarranged consultation operation: calculateScore");}),
    cancelHandover: vi.fn(async () => {throw new Error("Unarranged consultation operation: cancelHandover");}),
    completeProcedure: vi.fn(async () => {throw new Error("Unarranged consultation operation: completeProcedure");}),
    correctObservation: vi.fn(async () => {throw new Error("Unarranged consultation operation: correctObservation");}),
    createAssessment: vi.fn(async () => {throw new Error("Unarranged consultation operation: createAssessment");}),
    declineHandover: vi.fn(async () => {throw new Error("Unarranged consultation operation: declineHandover");}),
    endCareTeamMember: vi.fn(async () => {throw new Error("Unarranged consultation operation: endCareTeamMember");}),
    endEncounter: vi.fn(async () => {throw new Error("Unarranged consultation operation: endEncounter");}),
    extractSuggestions: vi.fn(async () => {throw new Error("Unarranged consultation operation: extractSuggestions");}),
    linkCondition: vi.fn(async () => {throw new Error("Unarranged consultation operation: linkCondition");}),
    listAvailableAssessments: vi.fn(async () => {throw new Error("Unarranged consultation operation: listAvailableAssessments");}),
    listCareDecisions: vi.fn(async () => {throw new Error("Unarranged consultation operation: listCareDecisions");}),
    listFacilities: vi.fn(async () => {throw new Error("Unarranged consultation operation: listFacilities");}),
    listPainScales: vi.fn(async () => {throw new Error("Unarranged consultation operation: listPainScales");}),
    listRecallContacts: vi.fn(async () => {throw new Error("Unarranged consultation operation: listRecallContacts");}),
    loadInvestigationHistory: vi.fn(async () => {throw new Error("Unarranged consultation operation: loadInvestigationHistory");}),
    loadMedicationHistory: vi.fn(async () => {throw new Error("Unarranged consultation operation: loadMedicationHistory");}),
    loadPainMaps: vi.fn(async () => {throw new Error("Unarranged consultation operation: loadPainMaps");}),
    loadProblemTimeline: vi.fn(async () => {throw new Error("Unarranged consultation operation: loadProblemTimeline");}),
    loadScoreAutofill: vi.fn(async () => {throw new Error("Unarranged consultation operation: loadScoreAutofill");}),
    previewEsi: vi.fn(async () => {throw new Error("Unarranged consultation operation: previewEsi");}),
    promoteCondition: vi.fn(async () => {throw new Error("Unarranged consultation operation: promoteCondition");}),
    reassignAttending: vi.fn(async () => {throw new Error("Unarranged consultation operation: reassignAttending");}),
    recordCareDecision: vi.fn(async () => {throw new Error("Unarranged consultation operation: recordCareDecision");}),
    recordClinicalDischarge: vi.fn(async () => {throw new Error("Unarranged consultation operation: recordClinicalDischarge");}),
    recordPain: vi.fn(async () => {throw new Error("Unarranged consultation operation: recordPain");}),
    recordVitals: vi.fn(async () => {throw new Error("Unarranged consultation operation: recordVitals");}),
    requestClarification: vi.fn(async () => {throw new Error("Unarranged consultation operation: requestClarification");}),
    requestHandover: vi.fn(async () => {throw new Error("Unarranged consultation operation: requestHandover");}),
    resendCertificate: vi.fn(async () => {throw new Error("Unarranged consultation operation: resendCertificate");}),
    reviewAllergies: vi.fn(async () => {throw new Error("Unarranged consultation operation: reviewAllergies");}),
    reviewScreening: vi.fn(async () => {throw new Error("Unarranged consultation operation: reviewScreening");}),
    saveIntake: vi.fn(async () => {throw new Error("Unarranged consultation operation: saveIntake");}),
    saveScore: vi.fn(async () => {throw new Error("Unarranged consultation operation: saveScore");}),
    setEncounterStatus: vi.fn(async () => {throw new Error("Unarranged consultation operation: setEncounterStatus");}),
    summarizeChart: vi.fn(async () => {throw new Error("Unarranged consultation operation: summarizeChart");}),
    updateAllergy: vi.fn(async () => {throw new Error("Unarranged consultation operation: updateAllergy");}),
    updateCondition: vi.fn(async () => {throw new Error("Unarranged consultation operation: updateCondition");}),
    updateProcedureHistory: vi.fn(async () => {throw new Error("Unarranged consultation operation: updateProcedureHistory");}),
    updateReportedMedication: vi.fn(async () => {throw new Error("Unarranged consultation operation: updateReportedMedication");}),
    updateReproductiveStatus: vi.fn(async () => {throw new Error("Unarranged consultation operation: updateReproductiveStatus");}),
    withdrawCareDecision: vi.fn(async () => {throw new Error("Unarranged consultation operation: withdrawCareDecision");}),
    withdrawExternalResult: vi.fn(async () => {throw new Error("Unarranged consultation operation: withdrawExternalResult");}),
    withdrawMedicationHistory: vi.fn(async () => {throw new Error("Unarranged consultation operation: withdrawMedicationHistory");}),
    withdrawObservation: vi.fn(async () => {throw new Error("Unarranged consultation operation: withdrawObservation");}),

    loadConsultation: vi.fn(async () => structuredClone(detail)),
    saveConsultNote: vi.fn(async (_id, content, baseVersion) => {
      detail.note = {...detail.note!, version: baseVersion + 1, content: structuredClone(content), updatedAt: "2026-10-28T10:01:00Z"};
      return {version: baseVersion + 1, updatedAt: detail.note.updatedAt};
    }),
    signConsultNote: vi.fn(async () => {detail.note!.status = "final"; return {orders: [], followUpTask: null, priorAuthRequests: 0};}),
    searchCatalog: vi.fn(async (_catalog, query) => query ? [{system: "snomed", code: "DX1", display: "Synthetic diagnosis"}] : []),
    listNursingEntries: vi.fn(async () => []), loadAllergyMasters: vi.fn(async () => masters),
    loadCodesets: vi.fn(async () => ({})),
    loadPainHistory: vi.fn(async () => ({assessments: [], analgesia: [], reassessments: [], suggested: {scale: "nrs", reason: "Self report"}})),
    listProcedureHistory: vi.fn(async () => []), listConditions: vi.fn(async () => []), listScoreDefinitions: vi.fn(async () => []),
    listOrderPriorities: vi.fn(async () => [{code: "routine", label: "Routine", rank: 3, verifyMinutes: null, dispenseMinutes: null, firstDoseMinutes: null, resultMinutes: null, firstDoseBeforeVerification: false, reasonRequired: false, active: true, default: true}]),
    listReferralPharmacies: vi.fn(async () => []), listSpecialties: vi.fn(async () => []), listClinicians: vi.fn(async () => []),
    loadServices: vi.fn(async () => ({specialties: [], departments: [], clinics: [], wards: []})), listEducationTemplates: vi.fn(async () => []),
    listCertificates: vi.fn(async () => ({portalConfigured: false, certificates: []})),
    evaluateOrderForms: vi.fn(async () => ({results: [], problems: []})),
    checkMedications: vi.fn(async (_id, input) => ({lines: input.lines.map((rx: {code: string}) => ({code: rx.code, allergy: [], alerts: [], needsReason: false})), unmapped: [], context: {}})),
    loadVitalParameters: vi.fn(async () => ({items: FALLBACK_PARAMETERS, correctionGraceSeconds: 60, maxBackdateHours: 24})),
    addNoteAddendum: vi.fn(async (_id, input) => {detail.note!.addenda = [...(detail.note!.addenda ?? []), {id: "A1", ...input, authorName: "Test Doctor", signedAt: "2026-10-28T10:10:00Z"}];}),
    acknowledgeReviews: vi.fn(async () => {}), verifyAllergy: vi.fn(async () => detail.allergies),
    loadCareTeam: vi.fn(async () => ({encounterId: "E1", class: "OP", responsible: null, team: [], history: [], pending: null, handovers: [], can: {handover: false, reassign: false, addMember: false, respond: false, cancel: false}, staff: [], roles: []})),
    listEndOutcomes: vi.fn(async () => [{code: "cancelled", label: "Cancelled"}]),
    listAssessments: vi.fn(async () => []),
    loadCareProgrammes: vi.fn(async () => ({programmes: [], visit: null, evaluatedAt: "2026-10-28T10:00:00Z"})),
    ...overrides,
  } satisfies ConsultationDataPort;
  const consult: ConsultationDataPort = methods;
  return {consult, port: fakePort({consult, searchCatalog: consult.searchCatalog}), getDetail: () => detail};
}
