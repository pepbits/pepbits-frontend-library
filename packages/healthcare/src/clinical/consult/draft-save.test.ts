import {describe, expect, it, vi} from "vitest";
import {emptyNote} from "../models/consult-note";
import type {SavedDraft} from "../models/consult-workflow";
import {DraftSaver, ConsultDraftSession} from "./draft-save";
import {consultationPort, deferred} from "./test-fixtures";

const saved = (version: number) => ({version, updatedAt: "2026-10-28T10:00:00Z"});
describe("consultation draft sequencing", () => {
  it("snapshots queued drafts and advances baseVersion only after each successful write", async () => {
    const first = deferred<SavedDraft>();
    const write = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValueOnce(saved(7));
    const saver = new DraftSaver(5, write), note = {text: "first"};
    const a = saver.save(note); note.text = "second"; const b = saver.save(note); note.text = "not queued";
    await Promise.resolve(); expect(write).toHaveBeenCalledExactlyOnceWith({text: "first"}, 5);
    first.resolve(saved(6)); await a; await b;
    expect(write).toHaveBeenNthCalledWith(2, {text: "second"}, 6);
  });
  it("retains edits made during a save and persists them at the advanced version", async () => {
    const first = deferred<SavedDraft>();
    const {consult} = consultationPort({saveConsultNote: vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValueOnce(saved(6))});
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4);
    session.update(note => {note.assessment = "first";}); const save = session.save();
    session.update(note => {note.assessment = "second";}); first.resolve(saved(5)); await save;
    expect(session.getSnapshot()).toMatchObject({state: "dirty", dirty: true, draft: {assessment: "second"}});
    await session.save(); expect(consult.saveConsultNote).toHaveBeenLastCalledWith("E1", expect.objectContaining({assessment: "second"}), 5);
    expect(session.getSnapshot()).toMatchObject({state: "saved", dirty: false, version: 6});
  });
  it("saves the latest edits behind a pending save before signing and locks edits synchronously", async () => {
    const first = deferred<SavedDraft>();
    const {consult} = consultationPort({saveConsultNote: vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValueOnce(saved(6))});
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4);
    session.update(note => {note.assessment = "first";}); const save = session.save();
    session.update(note => {note.assessment = "latest";}); const sign = session.sign();
    session.update(note => {note.assessment = "too late";}); await expect(session.sign()).rejects.toThrow("locked");
    await Promise.resolve(); expect(consult.signConsultNote).not.toHaveBeenCalled(); first.resolve(saved(5)); await save; await sign;
    expect(consult.saveConsultNote).toHaveBeenLastCalledWith("E1", expect.objectContaining({assessment: "latest"}), 5);
    expect(consult.signConsultNote).toHaveBeenCalledExactlyOnceWith("E1", 6);
    expect(session.getSnapshot()).toMatchObject({signed: true, signing: false, dirty: false});
    await expect(session.save()).rejects.toThrow("locked");
  });
  it("blocks queued saves and signing after a conflict, preserving the local draft and version", async () => {
    const first = deferred<SavedDraft>(), conflict = Object.assign(new Error("Changed elsewhere"), {status: 409, problems: ["Version changed"]});
    const {consult} = consultationPort({saveConsultNote: vi.fn(() => first.promise)});
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4);
    session.update(note => {note.assessment = "keep me";}); const save = session.save(), sign = session.sign();
    const rejected = Promise.allSettled([save, sign]); first.reject(conflict); await rejected;
    expect(consult.saveConsultNote).toHaveBeenCalledTimes(1); expect(consult.signConsultNote).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({state: "conflict", dirty: true, version: 4, draft: {assessment: "keep me"}});
    await expect(session.save()).rejects.toThrow("Changed elsewhere");
    session.update(note => {note.assessment = "blocked";}); expect(session.getSnapshot().draft.assessment).toBe("keep me");
  });
  it("retries a transport failure at the unchanged version", async () => {
    const {consult} = consultationPort({saveConsultNote: vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(saved(5))});
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4); session.update(n => {n.assessment = "retained";});
    await expect(session.save()).rejects.toThrow("Offline"); expect(session.getSnapshot()).toMatchObject({state: "error", dirty: true, version: 4});
    await session.save(); expect(consult.saveConsultNote).toHaveBeenLastCalledWith("E1", expect.objectContaining({assessment: "retained"}), 4);
  });
  it("keeps the successful save version when sign validation fails and permits correction", async () => {
    const {consult} = consultationPort({signConsultNote: vi.fn().mockRejectedValue(new Error("Primary diagnosis required"))});
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4);
    await expect(session.sign()).rejects.toThrow("Primary diagnosis required");
    expect(session.getSnapshot()).toMatchObject({version: 5, signing: false, signed: false, problems: ["Primary diagnosis required"]});
    session.update(n => {n.assessment = "corrected";}); expect(session.getSnapshot().state).toBe("dirty");
  });
  it("treats a sign conflict as a conflict even after saving succeeded", async () => {
    const {consult} = consultationPort({signConsultNote: vi.fn().mockRejectedValue(Object.assign(new Error("Changed before sign"), {status: 409}))});
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4);
    await expect(session.sign()).rejects.toThrow("Changed before sign");
    expect(session.getSnapshot()).toMatchObject({version: 5, state: "conflict", dirty: true});
    await expect(session.save()).rejects.toThrow("Reload");
  });
  it("does not sign after the encounter closes while a save is pending", async () => {
    const write = deferred<SavedDraft>(); const {consult} = consultationPort({saveConsultNote: vi.fn(() => write.promise)});
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4); const sign = session.sign();
    await Promise.resolve(); session.suspend(); write.resolve(saved(5));
    await expect(sign).rejects.toThrow("closed"); expect(consult.signConsultNote).not.toHaveBeenCalled();
  });
  it("preserves local edits if a background refresh discovers a remotely signed note", () => {
    const {consult} = consultationPort();
    const session = new ConsultDraftSession("E1", consult, emptyNote(), 4);
    session.update(note => {note.assessment = "Unsubmitted local work";}); session.markSigned(7);
    expect(session.getSnapshot()).toMatchObject({signed: true, state: "conflict", dirty: true, draft: {assessment: "Unsubmitted local work"}});
  });

});
