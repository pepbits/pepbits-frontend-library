"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { referenceScopeKey, useReferenceHost } from "@pepbits/reference-host";
import type { Encounter, TranscriptLine } from "../../shared/types";
import { ApiError } from "../../shared/client";
import { encounterVersion } from "../../shared/contract";
import { useTeleconsultClient } from "./api";

export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";

/**
 * The note could not be saved because the server holds a different revision. `mine` is the local copy and
 * is never discarded by the hook: `signed` means the server already signed this encounter, `version` that
 * another session saved first.
 */
export interface EncounterConflict {
  kind: "version" | "signed";
  mine: Encounter;
  server?: Encounter;
}

export interface SignOptions { signerId: string; overrideReason?: string; recordingSeconds: number }

const AUTOSAVE_MS = 700;
const RETRY_MS = 5000;

/**
 * Loads one appointment's encounter and keeps the draft in sync with the server.
 *
 * - Every save and sign carries `version` (the revision last read from the server); responses replace it.
 * - Saves and the sign request run one at a time, so a save can never race its own sign for a version.
 * - A 409 never overwrites or discards the local edit: it is held in `conflict.mine`, and a signed
 *   server encounter replaces the editable copy only because the signed evidence must stay unchanged.
 * - The transcript is owned by the server; merging it never marks the note as edited.
 */
export function useEncounterSync(appointmentId: string) {
  const client = useTeleconsultClient();
  const clientRef = useRef(client);
  clientRef.current = client;
  const scope = referenceScopeKey(useReferenceHost().scope);

  const [enc, setEnc] = useState<Encounter>();
  const [error, setError] = useState<string>();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState<EncounterConflict | null>(null);
  const [preserved, setPreserved] = useState<Encounter | null>(null);

  const encRef = useRef<Encounter | undefined>(undefined);
  encRef.current = enc;
  const versionRef = useRef(0);
  const rev = useRef(0);
  const dirty = useRef(false);
  const blocked = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const locked = enc?.status === "signed";

  // Load. Keyed by appointment and scope, not by role: switching mode must not refetch over unsaved edits.
  useEffect(() => {
    const controller = new AbortController();
    setEnc(undefined);
    setError(undefined);
    setConflict(null);
    setPreserved(null);
    setSaveState("idle");
    dirty.current = false;
    blocked.current = false;
    rev.current = 0;
    clientRef.current.get<Encounter>(`/api/appointments/${encodeURIComponent(appointmentId)}/encounter`, { signal: controller.signal })
      .then((loaded) => { versionRef.current = encounterVersion(loaded); setEnc(loaded); })
      .catch((e) => { if ((e as Error).name !== "AbortError") setError((e as Error).message); });
    return () => controller.abort();
  }, [appointmentId, scope]);

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const adoptServerVersion = useCallback((saved: Encounter) => {
    if (saved.version !== undefined) versionRef.current = saved.version;
    setEnc((e) => (e ? { ...e, version: saved.version ?? e.version, updatedAt: saved.updatedAt ?? e.updatedAt } : e));
  }, []);

  const handleConflict = useCallback(async () => {
    const mine = encRef.current;
    if (!mine) return;
    setSaveState("conflict");
    let server: Encounter | undefined;
    try { server = await clientRef.current.get<Encounter>(`/api/appointments/${encodeURIComponent(appointmentId)}/encounter`); } catch { /* keep the local draft; the user can retry */ }
    if (server?.status === "signed") {
      // Signed evidence is immutable: show it, and keep the unsent draft available instead of discarding it.
      dirty.current = false;
      versionRef.current = encounterVersion(server);
      setPreserved(mine);
      setEnc(server);
      setConflict({ kind: "signed", mine, server });
    } else {
      setConflict({ kind: "version", mine, server });
    }
  }, [appointmentId]);

  const persist = useCallback(() => enqueue(async () => {
    const snapshot = encRef.current;
    if (!snapshot || snapshot.status === "signed" || blocked.current || !dirty.current) return;
    const startRev = rev.current;
    setSaveState("saving");
    try {
      const saved = await clientRef.current.put<Encounter>(`/api/encounters/${encodeURIComponent(snapshot.id)}`, { ...snapshot, version: versionRef.current });
      adoptServerVersion(saved);
      if (rev.current === startRev) { dirty.current = false; setSaveState("saved"); }
    } catch (e) {
      if (e instanceof ApiError && e.isConflict) await handleConflict();
      else setSaveState("error");
    }
  }), [adoptServerVersion, enqueue, handleConflict]);

  const update = useCallback((fn: (e: Encounter) => Encounter) => {
    setEnc((e) => (e && e.status !== "signed" ? fn(e) : e));
    rev.current++;
    dirty.current = true;
  }, []);

  // Autosave after a pause in editing.
  useEffect(() => {
    if (!enc || !dirty.current || locked || conflict) return;
    setSaveState("saving");
    const timer = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [enc, locked, conflict, persist]);

  // A failed save is retried while the edit is still unsaved.
  useEffect(() => {
    if (saveState !== "error") return;
    const timer = setTimeout(() => void persist(), RETRY_MS);
    return () => clearTimeout(timer);
  }, [saveState, persist]);

  /** Saves now (hand-off); rejects with the ApiError so the caller can report it. */
  const save = useCallback((next: Encounter) => enqueue(async () => {
    try {
      const saved = await clientRef.current.put<Encounter>(`/api/encounters/${encodeURIComponent(next.id)}`, { ...next, version: versionRef.current });
      adoptServerVersion(saved);
      dirty.current = false;
      setSaveState("saved");
      return saved;
    } catch (e) {
      if (e instanceof ApiError && e.isConflict) await handleConflict();
      throw e;
    }
  }), [adoptServerVersion, enqueue, handleConflict]);

  /**
   * Signs the current draft. The request body carries the expected version, so an identical retry after an
   * unknown outcome replays under the same Idempotency-Key. 422 `problems` and 409 conflicts reject.
   */
  const sign = useCallback(async ({ signerId, overrideReason, recordingSeconds }: SignOptions) => {
    blocked.current = true;
    try {
      return await enqueue(async () => {
        const snapshot = encRef.current;
        if (!snapshot) throw new ApiError("The note is not loaded", 0);
        const encounter = { ...snapshot, recording: { ...snapshot.recording, active: false, seconds: recordingSeconds }, version: versionRef.current };
        try {
          const signed = await clientRef.current.post<Encounter>(`/api/encounters/${encodeURIComponent(snapshot.id)}/sign`, { encounter, signerId, overrideReason });
          versionRef.current = encounterVersion(signed);
          dirty.current = false;
          setEnc(signed);
          setSaveState("saved");
          return signed;
        } catch (e) {
          if (e instanceof ApiError && e.isConflict) await handleConflict();
          throw e;
        }
      });
    } finally {
      blocked.current = false;
    }
  }, [enqueue, handleConflict]);

  /** Conflict choices: keep my edits on top of the server revision, or load the server revision (my copy stays in `preserved`). */
  const resolveConflict = useCallback((choice: "keep-mine" | "use-server") => {
    const current = conflict;
    if (!current || current.kind === "signed") return;
    const server = current.server;
    if (choice === "keep-mine") {
      if (server) { versionRef.current = encounterVersion(server); setEnc((e) => (e ? { ...e, version: server.version } : e)); }
      setConflict(null);
      setSaveState("saving");
      dirty.current = true;
      rev.current++;
    } else if (server) {
      setPreserved(current.mine);
      versionRef.current = encounterVersion(server);
      dirty.current = false;
      setEnc(server);
      setConflict(null);
      setSaveState("saved");
    }
  }, [conflict]);

  const dismissConflict = useCallback(() => { setConflict(null); setPreserved(null); }, []);

  /** Adds server-owned transcript lines. This is not an edit and never schedules a save. */
  const mergeTranscript = useCallback((lines: TranscriptLine[]) => {
    setEnc((e) => {
      if (!e || e.status === "signed") return e;
      const fresh = lines.filter((line) => !e.transcript.some((x) => x.id === line.id));
      return fresh.length ? { ...e, transcript: [...e.transcript, ...fresh] } : e;
    });
  }, []);

  return { enc, error, saveState, conflict, preserved, locked, update, save, sign, resolveConflict, dismissConflict, mergeTranscript, setEnc };
}
