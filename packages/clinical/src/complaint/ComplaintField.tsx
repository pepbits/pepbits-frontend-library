"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {X} from "@pepbits/icons";
import {IconButton, Input} from "@pepbits/ui";
import {ChoiceField} from "../layout/panel";
import type {CatalogItem} from "../types";
import {CodedSearch} from "./CodedSearch";

/** A picked coded item as a removable chip. */
export function CodedChip({item, removeLabel, onRemove}: {item: CatalogItem; removeLabel: string; onRemove: () => void}) {
  return <div className="flex h-9 items-center justify-between rounded-[10px] border border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] ps-3">
    <span className="truncate font-bold text-[var(--text)]">{item.display}</span>
    <IconButton label={removeLabel} onClick={onRemove}><X className="size-4"/></IconButton>
  </div>;
}

/** The coded presenting complaint: search the complaints catalogue, then show the pick. Reception's reason is shown for comparison. */
export function ComplaintField({value, onChange, required = false, receptionReason}: {
  value: CatalogItem | null; onChange: (value: CatalogItem | null) => void; required?: boolean; receptionReason?: string;
}) {
  const {t} = useLocalization();
  return <ChoiceField label="Presenting complaint" required={required} hint={receptionReason ? `${t("Reception noted")}: “${receptionReason}”` : undefined}>
    {value ? <CodedChip item={value} removeLabel="Remove complaint" onRemove={() => onChange(null)}/>
      : <CodedSearch catalog="complaints" label="Presenting complaint" placeholder="Search symptoms, e.g. chest pain" onPick={onChange}/>}
  </ChoiceField>;
}

/** The complaint in the patient's own words. */
export function PatientWordsField({value, onChange}: {value: string; onChange: (value: string) => void}) {
  return <Input label="In the patient’s own words" value={value} onChange={e => onChange(e.target.value)} placeholder="“Tight feeling when I climb stairs”" maxLength={500}/>;
}
