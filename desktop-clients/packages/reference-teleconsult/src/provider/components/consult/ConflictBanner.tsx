"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { AlertTriangle } from "lucide-react";
import type { EncounterConflict } from "../../lib/encounter-sync";
import type { Encounter } from "../../../shared/types";
import { Button } from "../ui";
import { NoteView } from "../NoteView";

/**
 * Shown when the server refused a save or sign because its revision differs. The edited note is never
 * thrown away: version conflicts offer both choices explicitly, and a draft that lost to an already-signed
 * note stays readable here (the signed evidence itself is not modified).
 */
export function ConflictBanner({ conflict, preserved, onResolve, onDismiss }: {
  conflict: EncounterConflict | null;
  preserved: Encounter | null;
  onResolve: (choice: "keep-mine" | "use-server") => void;
  onDismiss: () => void;
}) {
  const { t } = useLocalization();
  if (!conflict && !preserved) return null;
  const signed = conflict?.kind === "signed" || (!conflict && !!preserved);
  const draft = preserved ?? conflict?.mine;
  return (
    <div role="alert" className="border-b border-alarm-100 bg-alarm-50 px-4 py-3 text-sm text-alarm-600" data-conflict={signed ? "signed" : "version"}>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 font-medium">
          {signed
            ? t("This visit note was already signed, so it is locked. Your unsaved edits were not applied; they are kept below.")
            : t("This note was saved elsewhere since you opened it. Your edits are kept on screen and are not saved yet.")}
        </p>
        {conflict && !signed && (
          <>
            <Button size="sm" variant="primary" onClick={() => onResolve("keep-mine")}><LocalizedText message={"Keep my edits and save over the latest"} /></Button>
            <Button size="sm" disabled={!conflict.server} onClick={() => onResolve("use-server")}><LocalizedText message={"Load the latest version"} /></Button>
          </>
        )}
        {signed && <Button size="sm" onClick={onDismiss}><LocalizedText message={"Dismiss"} /></Button>}
      </div>
      {draft && (
        <details className="mt-2 text-ink">
          <summary className="cursor-pointer text-xs font-medium text-alarm-600">{t(signed ? "Show my unsaved draft" : "Show my edited note")}</summary>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-md border border-line bg-white p-3"><NoteView enc={draft} /></div>
        </details>
      )}
    </div>
  );
}
