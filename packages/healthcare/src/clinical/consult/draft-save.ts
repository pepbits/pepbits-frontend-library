import {DraftSaver, type SavedDraft, type SaveState, type SignResult} from "../models/consult-workflow";
import type {NoteContent} from "../models/consult-note";
import type {ConsultNotePort} from "../context/consult-contracts";
import {problemsOf} from "../context/port";

export {DraftSaver} from "../models/consult-workflow";
export interface ConsultDraftState {
  draft: NoteContent; version: number; savedAt: string | null; state: SaveState;
  signing: boolean; signed: boolean; dirty: boolean; problems: string[];
}
/** Workspace lifecycle around the foundation's single serialized writer. Conflict recovery is explicit. */
export class ConsultDraftSession {
  private value: ConsultDraftState;
  private listeners = new Set<() => void>();
  private revision = 0;
  private savedRevision = 0;
  private pending = 0;
  private conflicted = false;
  private active = true;
  resume = () => { this.active = true; };
  suspend = () => { this.active = false; };
  private saver: DraftSaver<NoteContent>;
  constructor(private encounterId: string, private port: ConsultNotePort, draft: NoteContent, version = 0, savedAt: string | null = null, signed = false) {
    this.value = {draft: structuredClone(draft), version, savedAt, state: savedAt ? "saved" : "idle", signing: false, signed, dirty: false, problems: []};
    this.saver = new DraftSaver(version, (content, baseVersion) => {
      if (!this.active) return Promise.reject(new Error("The consultation has closed."));
      if (this.conflicted) return Promise.reject(new Error("Changed elsewhere. Reload to continue."));
      return port.saveConsultNote(encounterId, content, baseVersion);
    });
  }
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<ConsultDraftState>) {
    this.value = {...this.value, ...patch}; this.listeners.forEach(listener => listener());
  }
  update = (edit: (draft: NoteContent) => void) => {
    if (!this.active || this.value.signing || this.value.signed || this.conflicted) return;
    const draft = structuredClone(this.value.draft); edit(draft); this.revision++;
    this.publish({draft, dirty: true, state: this.pending ? "saving" : "dirty", problems: []});
  };
  markSigned = (version?: number) => {
    if (this.value.dirty || (version !== undefined && version !== this.value.version)) {
      this.conflicted = true;
      this.publish({signed: true, state: "conflict", dirty: true, problems: ["The note was signed elsewhere. Your local draft is preserved. Reload to view the signed note."]});
    } else this.publish({signed: true});
  };
  save = (): Promise<SavedDraft> => {
    if (this.value.signing || this.value.signed) return Promise.reject(new Error("The note is locked."));
    return this.persist();
  };
  private async persist(): Promise<SavedDraft> {
    if (!this.active) throw new Error("The consultation has closed.");
    if (this.conflicted) throw new Error("Changed elsewhere. Reload to continue.");
    const revision = this.revision;
    this.pending++; this.publish({state: "saving", problems: []});
    try {
      const saved = await this.saver.save(this.value.draft);
      this.savedRevision = revision;
      this.publish({version: saved.version, savedAt: saved.updatedAt});
      return saved;
    } catch (error) {
      this.conflicted ||= (error as {status?: number})?.status === 409;
      this.publish({state: this.conflicted ? "conflict" : "error", problems: this.conflicted && this.value.problems.length ? this.value.problems : problemsOf(error)});
      throw error;
    } finally {
      this.pending--;
      const failed = this.value.state === "error" || this.value.state === "conflict";
      this.publish({dirty: failed || this.savedRevision !== this.revision,
        ...(!failed ? {state: this.pending ? "saving" : this.savedRevision === this.revision ? "saved" : "dirty"} : {})});
    }
  }
  sign = async (): Promise<SignResult> => {
    if (this.value.signing || this.value.signed || this.conflicted) throw new Error("The note is locked.");
    // Synchronous lock prevents edits between the saved snapshot and the signing request.
    this.publish({signing: true, problems: []});
    try {
      const saved = await this.persist();
      if (!this.active) throw new Error("The consultation has closed.");
      const result = await this.port.signConsultNote(this.encounterId, saved.version);
      this.publish({signed: true, dirty: false});
      return result;
    } catch (error) {
      this.conflicted ||= (error as {status?: number})?.status === 409;
      this.publish({problems: this.conflicted && this.value.problems.length ? this.value.problems : problemsOf(error), ...(this.conflicted ? {state: "conflict", dirty: true} : {})});
      throw error;
    } finally { this.publish({signing: false}); }
  };
}
