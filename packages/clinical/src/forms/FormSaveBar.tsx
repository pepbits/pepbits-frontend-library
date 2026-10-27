"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {Check} from "@pepbits/icons";
import {Button, cn} from "@pepbits/ui";
import {TEXT} from "../layout/panel";

/** The sticky footer of a clinical form: what saving does, Cancel and the save button. */
export function FormSaveBar({note, saveLabel, saving = false, onSave, onCancel}: {note?: string; saveLabel: string; saving?: boolean; onSave: () => void; onCancel: () => void}) {
  const {t} = useLocalization();
  return <div className="sticky bottom-0 z-10 mt-3 flex flex-wrap items-center justify-end gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-sm)]">
    {note ? <p className={cn("me-auto hidden sm:block", TEXT.muted)}>{t(note)}</p> : null}
    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    <Button variant="primary" size="lg" loading={saving} leftIcon={<Check className="size-4"/>} onClick={onSave}>{saveLabel}</Button>
  </div>;
}
