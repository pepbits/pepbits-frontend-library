"use client";
import React from "react";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import type {Allergy, RecordChange} from "../types";

export function RecordHistory({changes = []}: {changes?: RecordChange[]}) {
  const {t} = useLocalization(), format = useFormatters();
  if (!changes.length) return <p>{t("No changes recorded.")}</p>;
  return <ol className="grid gap-2">{changes.map((c, i) => <li key={`${c.at}:${i}`}>
    <p>{format.dateTime(c.at)} · {c.actorName} · {t(c.action ?? "Changed")}</p>
    <ul>{Object.keys(c.after).filter(k => JSON.stringify(c.before[k]) !== JSON.stringify(c.after[k])).map(k => <li key={k}>{t(k)}: {show(c.before[k])} → {show(c.after[k])}</li>)}</ul>
    {c.reason ? <p>{t("Reason")}: {c.reason}</p> : null}
  </li>)}</ol>;
  function show(value: unknown): string {return value == null || value === "" ? t("Not recorded") : typeof value === "number" ? format.number(value) : Array.isArray(value) ? value.map(show).join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value);}
}
export function AllergyHistory({allergy, bare = false}: {allergy: Allergy; bare?: boolean}) {
  const {t} = useLocalization();
  return bare ? <RecordHistory changes={allergy.history}/> : <details><summary>{t("Allergy history")}</summary><RecordHistory changes={allergy.history}/></details>;
}
