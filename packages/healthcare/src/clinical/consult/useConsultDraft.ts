"use client";
import {useEffect, useMemo, useSyncExternalStore} from "react";
import {usePreferences} from "@pepbits/preferences/react";
import {useConsultPort} from "../context/consult-host";
import {initialConsultNote} from "../models/consult-note";
import type {ConsultationDetail} from "../types";
import {ConsultDraftSession} from "./draft-save";

export const consultationSigned = (detail: ConsultationDetail) => detail.note?.status === "final" || ["signed", "checked-out"].includes(detail.encounter.status);
/** Mount once per encounter/port. Record refreshes deliberately leave the draft untouched. */
export function useConsultDraft(detail: ConsultationDetail, canWrite: boolean, autosaveMs = 1200) {
  const port = useConsultPort();
  const {preferences} = usePreferences();
  // The enclosing workspace remounts this hook for encounter/port replacement or explicit conflict reload.
  const session = useMemo(() => new ConsultDraftSession(detail.encounter.id, port, initialConsultNote(detail), detail.note?.version,
    detail.note?.updatedAt, consultationSigned(detail)), [port, detail.encounter.id]);
  useEffect(() => {session.resume(); return session.suspend;}, [session]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const readOnly = !canWrite || state.signing || state.signed || state.state === "conflict" || consultationSigned(detail);
  useEffect(() => { if (consultationSigned(detail)) session.markSigned(detail.note?.version); }, [session, detail]);
  useEffect(() => {
    if (state.state !== "dirty" || readOnly) return;
    const timer = setTimeout(() => { void session.save().catch(() => {}); }, autosaveMs);
    return () => clearTimeout(timer);
  }, [state.draft, state.state, readOnly, autosaveMs, session]);
  useEffect(() => {
    if (!preferences.keyboardShortcuts || readOnly) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault(); void session.save().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [preferences.keyboardShortcuts, readOnly, session]);
  return {...state, readOnly, onChange: (edit: (draft: typeof state.draft) => void) => { if (!readOnly) session.update(edit); },
    saveNow: () => readOnly ? Promise.reject(new Error("The note is locked.")) : session.save(),
    sign: () => readOnly ? Promise.reject(new Error("The note is locked.")) : session.sign()};
}
