import {describe, expect, it, vi} from "vitest";
import {
  emptyNote, initialConsultNote, DraftSaver, priorityProblem, sortedAlerts, FALLBACK_PARAMETERS, EMPTY_CONSULT_VITALS,
  consultMeasurementErrors, consultVitalsPayload, consultBmiPreview, vitalLevel, stillDue, addressedInNote,
  type ConsultationDetail, type Programme, type OrderPriority, type NoteContent, type SavedDraft, type VitalParameter,
} from "../model";

import {encounterDetail} from "../test/fixtures";
function fullDetail(): ConsultationDetail {
  const base = encounterDetail();
  return {...base, patient: {...base.patient, givenName: "Test", familyName: "Patient", nationality: "test", preferredLanguage: "en", identifiers: [], version: 1},
    observations: {...base.observations, history: [], enteredInError: []}, problems: [], medications: [], note: null, orders: [], reviews: [], scores: []};
}
const priority: OrderPriority = {code: "routine", label: "Routine", rank: 1, verifyMinutes: null, dispenseMinutes: null,
  firstDoseMinutes: null, resultMinutes: null, firstDoseBeforeVerification: false, reasonRequired: false, active: true, default: true};
const programme: Programme = {id: "screening", version: 2, name: "Synthetic screening", category: "test", intervalMonths: 12,
  mode: "full", eligible: true, status: "due", dueOn: "2026-10-28", neverDone: true, lastDone: null, inProgress: null,
  decision: null, eligibility: [], actions: [{type: "lab", code: "LAB-1", display: "Synthetic laboratory test"}]};

describe("consultation pure models", () => {
  it("creates independent note defaults and retains optional legacy fields", () => {
    const first = emptyNote(), second = emptyNote();
    first.history.meds.medicine = "stop";
    first.hpi.narrative = "Synthetic complaint";
    expect(second.history.meds).toEqual({});
    expect(second.hpi.narrative).toBe("");
    expect(second.procedures).toBeUndefined();
    expect(second.history.living).toBeNull();
  });
  it("loads legacy note fields with defaults without mutating persisted content", () => {
    const detail = fullDetail();
    detail.note = {id: "note-1", version: 3, status: "draft", updatedAt: "2026-10-28T08:00:00Z", content: {hpi: {...emptyNote().hpi, narrative: "Saved complaint"}}};
    const draft = initialConsultNote(detail);
    expect(draft.hpi.narrative).toBe("Saved complaint");
    expect(draft.labs).toEqual([]);
    draft.hpi.narrative = "Unsaved edit";
    expect(detail.note.content.hpi?.narrative).toBe("Saved complaint");
  });
  it("seeds a new note from versioned social history without overriding a saved note", () => {
    const detail = fullDetail();
    detail.socialHistory = {version: 2, smoking: "former", occupation: "Teacher", living: "family"};
    expect(initialConsultNote(detail).history).toMatchObject({smoking: "former", occupation: "Teacher", living: "family"});
    detail.note = {id: "note-2", version: 1, status: "draft", updatedAt: "now", content: emptyNote()};
    expect(initialConsultNote(detail).history.smoking).toBeNull();
  });
  it("snapshots queued drafts, serializes saves and uses the returned version", async () => {
    let release!: (saved: SavedDraft) => void;
    const write = vi.fn<(note: NoteContent, version: number) => Promise<SavedDraft>>()
      .mockImplementationOnce(() => new Promise(resolve => {release = resolve;}))
      .mockResolvedValueOnce({version: 9, updatedAt: "later"});
    const saver = new DraftSaver(7, write), note = emptyNote();
    note.assessment = "first";
    const first = saver.save(note);
    note.assessment = "second";
    const second = saver.save(note);
    note.assessment = "third";
    await Promise.resolve();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0].assessment).toBe("first");
    release({version: 8, updatedAt: "now"});
    await first;
    await second;
    expect(write.mock.calls[1]?.[0].assessment).toBe("second");
    expect(write.mock.calls[1]?.[1]).toBe(8);
  });
  it("does not advance the base version after a rejected save and permits an explicit retry", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("Version conflict")).mockResolvedValue({version: 4, updatedAt: "now"});
    const saver = new DraftSaver<NoteContent>(3, write);
    await expect(saver.save(emptyNote())).rejects.toThrow("Version conflict");
    await saver.save(emptyNote());
    expect(write.mock.calls.map(call => call[1])).toEqual([3, 3]);
  });
  it("preserves source priority validation and does not reorder caller-owned safety alerts", () => {
    expect(priorityProblem({}, [priority])).toBe("");
    expect(priorityProblem({priority: "retired"}, [priority])).toBe("Choose an active priority from the medication policy.");
    expect(priorityProblem({}, [{...priority, reasonRequired: true}])).toContain("at least 10 characters");
    expect(priorityProblem({priorityAt: "2020-01-01"}, [{...priority, requiresTime: true}], Date.UTC(2026, 0, 1))).toContain("current or future");
    const alerts = [{kind: "test", severity: "info" as const, message: "Info"}, {kind: "test", severity: "high" as const, message: "High"}];
    expect(sortedAlerts(alerts).map(a => a.message)).toEqual(["High", "Info"]);
    expect(alerts[0]?.message).toBe("Info");
  });
  it("keeps catalogue ranges isolated and serializes extra measurements and absence reasons", () => {
    const temperature = FALLBACK_PARAMETERS.find(p => p.key === "temp")!;
    const extra: VitalParameter = {...temperature, key: "custom", code: "TEST", display: "Custom", min: 1, max: 10};
    const firstCatalogue = [{...temperature, max: 37}, extra];
    const v = {...EMPTY_CONSULT_VITALS, temp: "38", o2: "air" as const, o2Flow: "4", weight: "70", extra: {custom: "5"}};
    expect(consultMeasurementErrors(v, {}, firstCatalogue).temp).toContain("37");
    expect(consultMeasurementErrors(v, {}, [temperature]).temp).toBeUndefined();
    expect(consultVitalsPayload(v, {weight: "refused"}, firstCatalogue)).toMatchObject({custom: 5, weight: null, o2Flow: null, notMeasured: {weight: "refused"}});
    expect(v.weight).toBe("70");
    expect(consultVitalsPayload({...v, measuredAt: "2026-10-28T08:00:00Z"}, {}, firstCatalogue).measuredAt).toBe("2026-10-28T08:00:00.000Z");
    expect(consultBmiPreview({...v, height: "175"})).toBe(22.9);
  });
  it("uses inclusive high thresholds and excludes already-addressed care gaps", () => {
    const p = {...FALLBACK_PARAMETERS[0]!, alertHigh: 180};
    expect(vitalLevel(p, 180)).toBe("alert");
    expect(vitalLevel(p, NaN)).toBe("");
    const note = emptyNote();
    expect(stillDue([programme], note)).toHaveLength(1);
    note.labs.push({code: "LAB-1", display: "Test", indication: "Screening"});
    expect(addressedInNote(programme, note)).toBe(true);
    expect(stillDue([programme], note)).toEqual([]);
    expect(stillDue([{...programme, mode: "reminder"}], emptyNote())).toEqual([]);
  });
});
