"use client";
import React from "react";
import {Sparkline} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {ClinicalPanel} from "../layout/panel";
import {FALLBACK_PARAMETERS, type VitalParameter} from "../models/consult-records";
import type {Observation} from "../types";

export function Trends({observations, parameters = FALLBACK_PARAMETERS}: {observations: Observation[]; parameters?: VitalParameter[]}) {
  const {t} = useLocalization(), format = useFormatters();
  return <ClinicalPanel title="Trends" subtitle="Earlier measurements with their dates"><ul className="grid gap-3">{parameters.filter(p => p.status === "active" && p.tile).map(p => {
    const series = observations.filter(o => o.code === p.code && o.status !== "entered-in-error" && typeof o.value === "number" && Number.isFinite(o.value)).sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)).slice(-8);
    const last = series.at(-1);
    return <li key={p.key}><p>{t(p.display)} · {last ? `${format.number(last.value!)} ${p.unitDisplay} · ${format.dateTime(last.effectiveAt)}` : t("No history")}</p><Sparkline values={series.map(o => o.value!)}/><details><summary>{t("Readings")}</summary><ol>{series.map(o => <li key={o.id}>{format.dateTime(o.effectiveAt)} · {format.number(o.value!)}{o.value2 == null ? "" : `/${format.number(o.value2)}`} {p.unitDisplay}</li>)}</ol></details></li>;
  })}</ul></ClinicalPanel>;
}
