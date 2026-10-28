/** Pure consultation contracts extracted from the frozen AllyVora source; no transport or React. */
import type {ClinicalPatientLite} from "../types";

/** What a signed note keeps of each programme the visit showed. */
export interface ProgrammeSnapshot {
    id: string;
    version: number;
    name: string;
    status: ProgrammeStatus;
    dueOn: string;
    mode: ProgrammeMode;
}

// Care programmes (preventive care and care gaps): types, labels and paths for /api/care-programmes.
export type ProgrammeStatus = 'overdue' | 'due' | 'check' | 'due-soon' | 'ordered' | 'referred' | 'in-progress' | 'deferred' | 'declined' | 'up-to-date' | 'not-applicable';

export type ProgrammeMode = 'full' | 'reminder' | 'hidden';

export interface AssessmentView {
    assessment: AssessmentHead;
    revision: AssessmentRevision;
    revisions: AssessmentRevisionSummary[];
    inputs: AssessmentInput[];
    evidence: {
        id: string;
        input: string;
        outcome: string;
        explanation: string;
        source: string;
        candidates: number;
    }[];
    actions: string[];
    toolError?: string | null;
    tool?: {
        id: string;
        version: string;
        name: string;
        source: string;
        artifactHash: string;
    } | null;
    tasks?: AssessmentFollowupTask[];
    sourceChanges?: AssessmentSourceChange[];
    sourceTrackingSince?: string | null;
    sourceTracked?: boolean;
}

export interface AssessmentHead {
    id: string;
    number: string;
    patientId: string;
    encounterId?: string | null;
    toolId: string;
    toolVersion: string;
    status: string;
    currentRevision: number;
    rowVersion: number;
    createdAt: string;
    authorName: string;
    toolName: string;
    displayLabel?: string | null;
    helpBanner?: string;
    printTemplate?: string;
    patient: ClinicalPatientLite;
    encounter?: {
        id: string;
        class: string;
        department?: string;
        status: string;
    } | null;
    body: {
        purpose?: string;
        context: AssessmentScope;
        alerts?: {
            raised: boolean;
            severity: string;
            reason?: string;
            taskIds?: string[];
        };
    };
}

export type AssessmentScope = Partial<Record<'department' | 'ward' | 'specialty' | 'careSetting' | 'encounterClass' | 'workflowStage' | 'role' | 'language', string>>;

export interface AssessmentRevision {
    id: string;
    revision: number;
    status: string;
    mode: string;
    effectiveAt: string;
    cutoffAt: string;
    contentHash?: string | null;
    hashValid?: boolean | null;
    inputsStale?: boolean;
    staleSince?: string | null;
    createdAt?: string;
    body: AssessmentRevisionBody;
}

export interface AssessmentRevisionBody {
    mode: string;
    effectiveAt: string;
    cutoffAt: string;
    authorId: string;
    authorName: string;
    toolVersion: string;
    artifactHash: string;
    configHash: string;
    context: AssessmentScope;
    configSnapshot: Record<string, {
        value: unknown;
        source: string;
        valueIds: string[];
    }>;
    responses: Record<string, AssessmentResponse>;
    eligibility?: AssessmentEligibility;
    result?: AssessmentResult | null;
    reviewRequired?: boolean;
    reviewState?: string | null;
    review?: {
        decision: string;
        byName: string;
        at: string;
        note: string;
    };
    signedByName?: string;
    signedAt?: string;
    contentHash?: string;
    amendReason?: string;
    amends?: number;
    staleReasons?: AssessmentStaleReason[];
    staleConfirmation?: {
        byName: string;
        at: string;
        reason: string;
    };
    events: {
        action: string;
        at: string;
        actorName: string;
        reason?: string;
        staleReasons?: AssessmentStaleReason[];
    }[];
}

export interface AssessmentResponse {
    input: string;
    value: unknown;
    unit?: string | null;
    entryMethod: AssessmentEntryMethod;
    source: string;
    evidenceId?: string;
    outcome?: string;
    explanation?: string;
    status?: string;
    clinicalTime?: string;
    availableAt?: string;
    absentReason?: string;
    reason?: string;
    note?: string;
    enteredByName?: string;
    enteredAt?: string;
    original?: {
        value: string;
        unit: string;
        formula?: string;
    };
    retrieved?: AssessmentResponse;
    sourceRef?: Record<string, unknown>;
    retrievalOutcome?: string;
    retrievalExplanation?: string;
}

// ---------- Patient assessments (A3)
export type AssessmentEntryMethod = 'retrieved' | 'unresolved' | 'manual' | 'absent' | 'override';

export interface AssessmentEligibility {
    outcome: 'ELIGIBLE' | 'INELIGIBLE' | 'UNCERTAIN';
    checks: AssessmentEligibilityCheck[];
    ageYears?: number | null;
    confirmation?: {
        byName: string;
        at: string;
        reason: string;
    };
}

export interface AssessmentEligibilityCheck {
    rule: string;
    label: string;
    outcome: 'ELIGIBLE' | 'INELIGIBLE' | 'UNCERTAIN';
    detail: string;
}

export interface AssessmentResult extends AssessmentCalculationResult {
    severityLevel?: string;
    artifactHash?: string;
    toolVersion?: string;
    calculatedAt?: string;
    display?: string;
    components?: {
        key: string;
        label: string;
        points: number | null;
    }[];
}

export interface AssessmentCalculationResult {
    status: string;
    total: number | null;
    band?: string;
    bandCode?: string;
    severity?: string;
    flags: Record<string, boolean | null>;
    missing: string[];
    warnings: string[];
    interpretation?: string;
}

// ---------- Assessment follow-up (A4)
export interface AssessmentStaleReason {
    text: string;
    change: string;
    selected: boolean;
    eventId: number;
    at: string;
}

export interface AssessmentRevisionSummary {
    revision: number;
    status: string;
    mode: string;
    effectiveAt: string;
    contentHash?: string | null;
    authorName?: string;
    signedByName?: string;
    signedAt?: string;
    amendReason?: string;
}

export interface AssessmentInput {
    key: string;
    label: string;
    type: 'number' | 'choice' | 'flag' | 'text' | 'date';
    unit?: string;
    canonicalUnit?: string;
    acceptedUnits?: string[];
    min?: number;
    max?: number;
    integer?: boolean;
    options?: string[];
    help?: string;
    absenceReasons?: string[];
    binding?: {
        source: string;
        code?: string;
        field?: string;
    } | null;
    response?: AssessmentResponse | null;
}

export interface AssessmentFollowupTask {
    id: string;
    kind: string;
    title: string;
    detail: string;
    recordId: string;
    recordVersion: number;
    status: string;
    priority: 'routine' | 'urgent' | 'critical';
    assigneeRole: string;
    createdAt: string;
    dueAt: string;
    followup?: boolean;
    acknowledgedAt?: string;
    acknowledgedByName?: string;
    acknowledgeNote?: string;
    completedAt?: string;
    completedByName?: string;
    outcome?: string;
    note?: string;
    amendRevision?: number;
    escalatedAt?: string;
    changes?: {
        change: string;
        selected: boolean;
        text: string;
        at: string;
    }[];
    changeCount?: number;
    recipientTeams?: string[];
    actions?: string[];
    outcomes?: string[];
}

export interface AssessmentSourceChange {
    eventId: number;
    effect: 'stale' | 'task' | 'noted';
    change: string;
    selected: boolean;
    taskId?: string | null;
    detail: {
        text: string;
        urgent?: boolean;
        tasksOff?: boolean;
    };
    createdAt: string;
    eventKind: string;
}

export interface AssessmentRow {
    id: string;
    number: string;
    patientId: string;
    toolId: string | null;
    toolName: string | null;
    displayLabel?: string | null;
    status: string;
    revisionStatus: string;
    inputsStale?: boolean;
    currentRevision: number;
    createdAt: string;
    effectiveAt: string;
    reviewState?: string | null;
    signedByName?: string | null;
    signedAt?: string | null;
    authorName?: string;
    patient: ClinicalPatientLite;
    result?: {
        status: string;
        total: number | null;
        band: string;
        severity: string;
        display?: string;
    } | null;
}

export interface AvailableTool {
    id: string;
    name: string;
    displayLabel?: string | null;
    category: string;
    source: string;
    version: string;
    favourite: boolean;
    canPerform: boolean;
    bound: boolean;
    helpBanner?: string;
}

export interface ProgrammesView {
    programmes: Programme[];
    visit: {
        encounterClass: string;
        department: string | null;
        specialties: string[];
    } | null;
    evaluatedAt: string;
}

export interface Programme {
    id: string;
    version: number;
    name: string;
    category: string;
    description?: string;
    guideline?: string;
    intervalMonths: number;
    mode: ProgrammeMode;
    eligible: boolean;
    status: ProgrammeStatus;
    dueOn: string;
    neverDone: boolean;
    lastDone: ProgrammeEvent | null;
    inProgress: ProgrammeEvent | null;
    decision: Decision | null;
    actions: ProgrammeAction[];
    eligibility: {
        type: string;
        label: string;
        result: 'met' | 'not-met' | 'unknown';
        detail?: string | null;
    }[];
}

export interface ProgrammeEvent {
    on: string;
    source: string;
    display: string;
    ref: string;
    status?: string;
}

export interface Decision {
    id: string;
    programmeId: string;
    outcome: CareOutcome;
    reason: string;
    performedOn?: string | null;
    until?: string | null;
    recordedByName?: string;
    recordedAt: string;
    withdrawnAt?: string | null;
    withdrawReason?: string | null;
}

export type CareOutcome = 'declined' | 'not-applicable' | 'deferred' | 'done-elsewhere';

export interface ProgrammeAction {
    type: 'lab' | 'imaging' | 'referral' | 'assessment';
    code: string;
    display: string;
}

// ------------------------------------------------------------------ recall and coverage
export interface RecallContact {
    id: string;
    programmeId?: string;
    method: 'phone' | 'sms' | 'letter' | 'in-person';
    result: string;
    note: string;
    messageId?: string | null;
    contactedAt: string;
    contactedByName?: string;
}

export interface SavedDraft {
    version: number;
    updatedAt: string;
}

export interface CareTeamData {
    encounterId: string;
    class: string;
    responsible: CareTeamMember | null;
    team: CareTeamMember[];
    history: CareTeamMember[];
    pending: CareTeamHandover | null;
    handovers: CareTeamHandover[];
    can: {
        handover: boolean;
        reassign: boolean;
        addMember: boolean;
        respond: boolean;
        cancel: boolean;
    };
    staff: {
        id: string;
        name: string;
        role: string;
    }[];
    roles: {
        code: string;
        label: string;
    }[];
}

/** GET /api/encounters/{id}/care-team (mirrors EncounterCareTeam.view). */
export interface CareTeamMember {
    id: string;
    userId: string;
    name: string;
    role: string;
    roleLabel: string;
    from: string;
    to?: string;
    reason?: string;
    endReason?: string;
    note?: string;
    active: boolean;
}

export interface CareTeamHandover {
    id: string;
    status: string;
    fromUserId?: string;
    toUserId: string;
    fromName: string;
    toName: string;
    requestedByName: string;
    requestedAt: string;
    respondedAt?: string;
    reason: string;
    ipass: {
        illnessSeverity: string;
        summary: string;
        actions: string;
        contingency?: string;
    };
    synthesis?: string;
    declineReason?: string;
}

export interface EndOutcome {
    code: string;
    label: string;
}

export interface Addendum {
    id: string;
    reason: string;
    text: string;
    authorName: string;
    signedAt: string;
}

export interface Proposal {
    id: string;
    field: string;
    section: string;
    label: string;
    value: unknown;
    display: string;
    confidence: "high" | "medium" | "low";
    evidence: string;
}

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

import type {NoteContent} from "./consult-note";
export class DraftSaver<T> {
  private tail: Promise<unknown> = Promise.resolve();
  private version: number;
  private write: (content: T, baseVersion: number) => Promise<SavedDraft>;
  constructor(
    version: number,
    write: (content: T, baseVersion: number) => Promise<SavedDraft>,
  ) { this.version = version; this.write = write; }

  save(content: T): Promise<SavedDraft> {
    const snapshot = structuredClone(content);
    const task = this.tail.then(async () => {
      const result = await this.write(snapshot, this.version);
      this.version = result.version;
      return result;
    });
    // A later explicit retry is allowed; callers still receive the original error.
    this.tail = task.catch(() => {});
    return task;
  }
}
export const STATUS_LABEL: Record<ProgrammeStatus, string> = {
  overdue: 'Overdue', due: 'Due', check: 'Check eligibility', 'due-soon': 'Due soon', ordered: 'Ordered', referred: 'Referred', 'in-progress': 'In progress',
  deferred: 'Deferred', declined: 'Declined', 'up-to-date': 'Up to date', 'not-applicable': 'Not applicable',
};

export const OPEN: ProgrammeStatus[] = ['overdue', 'due', 'check'];

export const OUTCOME_LABEL: Record<CareOutcome, string> = { declined: 'Declined', 'not-applicable': 'Not applicable', deferred: 'Deferred', 'done-elsewhere': 'Done elsewhere' };

export const CATEGORY_LABEL: Record<string, string> = {
  'cancer-screening': 'Cancer screening', 'chronic-disease-review': 'Chronic disease review', cardiometabolic: 'Heart and metabolic', 'mental-health': 'Mental health',
};
export function addressedInNote(p: Programme, note: NoteContent) {
  return p.actions.some((a) => a.type === "lab" ? note.labs.some((x) => x.code === a.code) : a.type === "imaging" ? note.imaging.some((x) => x.code === a.code)
    : a.type === "referral" ? note.referral?.specialty === a.code : false);
}

export const stillDue = (programmes: Programme[], note: NoteContent) => programmes.filter((p) => p.mode === "full" && OPEN.includes(p.status) && !addressedInNote(p, note));
export const show = (value: unknown): string => value == null ? '—' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : Array.isArray(value) ? value.map(show).join(', ') || 'None' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export const scopeLabel = (s: AssessmentScope) => Object.entries(s).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(' · ') || 'Every context';

export const valueText = (r?: AssessmentResponse | null) => !r ? '—' : r.entryMethod === 'absent' ? `Not available (${r.absentReason})` : r.value == null ? '—' : `${show(r.value)}${r.unit && r.unit !== 'a' ? ` ${r.unit}` : ''}`;

export const programmeStatusTone = (s: ProgrammeStatus) => s === 'overdue' ? 'danger' : s === 'due' || s === 'check' ? 'warning' : s === 'up-to-date' ? 'success' : s === 'due-soon' ? 'brand' : 'neutral';
export const assessmentSeverityTone = (s?: string) => s === 'HIGH' ? 'danger' : s === 'MEDIUM' || s === 'LOW_MEDIUM' ? 'warning' : s === 'LOW' ? 'success' : 'neutral';
export const assessmentStatusTone = (s: string) => s === 'final' ? 'success' : s === 'entered-in-error' || s === 'cancelled' ? 'danger' : s === 'amended' ? 'neutral' : 'warning';

export interface SignResult {
  orders: {display: string; status: string; priorAuth?: string}[];
  followUpTask: string | null; priorAuthRequests: number;
  certificate?: {id: string; number: string; portal: string} | null;
  admission?: {planned: boolean; id?: string; urgency?: string} | null;
}
export interface ExtractionResult { proposals: Proposal[]; sentText: string; redactions: number; provider: string }
export interface ChartSummary { summary: string; provider: string }
export interface EndEncounterInput {
  outcome: string; version: number; reason: string; contactAttempted?: boolean; lastSeenAt?: string;
  risksExplained?: boolean; capacity?: boolean; formSigned?: boolean; followUpAdvice?: string; diedAt?: string;
}
export interface ClinicalDischargeInput { at: string; reason: string; expectedVersion: number }
export type AssessmentQuery = {encounterId: string; patientId?: never; latest?: never} | {patientId: string; latest: true; encounterId?: never};
export interface AssessmentCreateInput {
  requestId: string; patientId: string; encounterId?: string | null; toolId: string; mode: string;
  workflowStage: string | null; purpose: string; effectiveAt: string | null;
}
export interface CareDecisionInput { programmeId: string; outcome: CareOutcome; reason: string; encounterId?: string; performedOn?: string; until?: string }
export interface HandoverInput { toUserId: string; reason: string; ipass: CareTeamHandover["ipass"] }
export interface CareTeamMemberInput { role: string; userId: string; note: string }
/** The workspace owns cloning and serializing edits; section callbacks mutate only that fresh draft. */
export type ConsultDraftChange = (update: (draft: NoteContent) => void) => void;
export interface ConsultSectionProps {
  detail: import("../types").ConsultationDetail; draft: NoteContent; onChange: ConsultDraftChange; readOnly: boolean;
  /** Reload after a successful server write, without discarding unsaved note edits. */
  onRecordsChanged?: () => void | Promise<void>;
  /** Instance-scoped anchor supplied by the workspace. */
  id?: string;
}
