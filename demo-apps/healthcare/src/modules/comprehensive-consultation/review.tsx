"use client";
import React from "react";
import {CardGrid} from '@pepbits/components';
import {Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import {scoreTotal, emComparison} from '../../domain/comprehensive-consultation';
import {CONSULTATION_FIELDS} from '../../domain/clinical-consultation';
import { Panel, Hint, key, type ComprehensiveProps } from "./shared";
export function ConsultationReview(p: ComprehensiveProps) {
  const { t } = useLocalization(),
    em = emComparison(p.values, p.config);
  const show = (label: string, value: string | React.ReactNode) => (
    <div className="space-y-1">
      <p className="text-xs font-semibold">{t(label)}</p>
      <p className="whitespace-pre-wrap break-words text-sm">
        {value || t("template.op.notRecorded")}
      </p>
    </div>
  );
  return (
    <div className="space-y-3">
      <Hint message={key("previewHint")} />
      <CardGrid columns={2}>
        <Panel title={key("context")}>
          {show(
            key("specialty"),
            t(
              p.config.specialties.find((s) => s.value === p.values.specialty)
                ?.label ?? "",
            ),
          )}
          {show(
            key("context"),
            t(
              p.config.contexts.find((s) => s.value === p.values.context)
                ?.label ?? "",
            ),
          )}
          {show(
            key("version"),
            p.record?.configurationVersion ?? p.config.version,
          )}
          {p.record?.updatedAt
            ? show(
                key("lastSaved"),
                p.format?.dateTime(p.record.updatedAt) + " · " + p.record.actor,
              )
            : null}
        </Panel>
        <Panel title={key("specialtyNotes")}>
          {Object.entries(p.values.specialtyNotes)
            .filter(([, v]) => v.trim())
            .map(([id, value]) => (
              <React.Fragment key={id}>
                {show(
                  p.config.specialties
                    .flatMap((s) => s.fields)
                    .find((f) => f.id === id)?.label ?? id,
                  value,
                )}
              </React.Fragment>
            ))}
        </Panel>
      </CardGrid>
      <Panel title="template.op.navigator">
        <CardGrid columns={2}>
          {CONSULTATION_FIELDS.filter((f) => p.values[f].trim()).map((f) => {
            let value = p.values[f];
            if (f === "clinician")
              value = t(
                p.config.clinicians.find((c) => c.value === value)?.label ??
                  value,
              );
            if (f === "visitType")
              value = t(
                p.config.visitTypes.find((c) => c.value === value)?.label ??
                  value,
              );
            if (f === "allergyReview")
              value = t("template.consultation." + value);
            if (f === "measuredAt") value = p.format?.dateTime(value) ?? value;
            const vital = p.config.vitals.find((v) => v.id === f);
            if (vital)
              value =
                (p.format?.number(Number(value)) ?? value) + " " + vital.unit;
            return (
              <React.Fragment key={f}>
                {show(
                  vital?.label ??
                    (f === "measuredAt"
                      ? "template.triage.measuredAt"
                      : "template.consultation." +
                        (f === "history" ? "historyNotes" : f)),
                  value,
                )}
              </React.Fragment>
            );
          })}
        </CardGrid>
      </Panel>
      <Panel title={key("coding")}>
        {p.values.diagnoses.map((d) => (
          <p key={d.id}>
            {d.primary ? <Badge>{t(key("primary"))}</Badge> : null} {d.system} ·{" "}
            {d.code} · {d.description}
          </p>
        ))}
        {!p.values.diagnoses.length ? <Hint message={key("empty")} /> : null}
      </Panel>
      <Panel title={key("orders")}>
        <Hint message={key("ordersHint")} />
        {p.values.orders.map((o) => (
          <div key={o.id} className="border-t border-[var(--border)] pt-2">
            <strong>
              {t(
                p.config.services.find((s) => s.id === o.serviceId)?.label ??
                  o.serviceId,
              )}
            </strong>
            <CardGrid columns={3}>
              {show(
                key("diagnosisLink"),
                p.values.diagnoses.find((d) => d.id === o.diagnosisId)
                  ?.description,
              )}
              {show(key("priority"), t(key(o.priority)))}
              {show(key("code"), o.codeSystem + " · " + o.serviceCode)}
              {(
                [
                  "dose",
                  "route",
                  "frequency",
                  "duration",
                  "timing",
                  "instructions",
                  "specimen",
                  "collection",
                  "laterality",
                  "contrast",
                  "indication",
                  "allergyNote",
                ] as const
              )
                .filter((f) => o[f])
                .map((f) => (
                  <React.Fragment key={f}>{show(key(f), o[f])}</React.Fragment>
                ))}
              {o.kind === "medication"
                ? show(key("allergyChecked"), o.allergyChecked ? "✓" : "—")
                : null}
            </CardGrid>
          </div>
        ))}
      </Panel>
      <CardGrid columns={2}>
        <Panel title={key("scores")}>
          {p.values.scores.map((s) => (
            <div key={s.id}>
              <strong>
                {
                  p.config.scoreInstruments.find((i) => i.id === s.instrument)
                    ?.label
                }{" "}
                ·{" "}
                {scoreTotal(s, p.config) === null
                  ? t("template.op.notRecorded")
                  : p.format?.number(scoreTotal(s, p.config)!)}
              </strong>
              <p>{p.format?.dateTime(s.measuredAt)}</p>
              {Object.entries(s.inputs).map(([field, value]) => (
                <p key={field}>
                  {t(
                    p.config.scoreInstruments
                      .find((i) => i.id === s.instrument)
                      ?.fields.find((f) => f.id === field)?.label ?? field,
                  )}
                  : {value === "NT" ? value : p.format?.number(Number(value))}
                </p>
              ))}
              <p>{s.notes}</p>
            </div>
          ))}
        </Panel>
        <Panel title={key("em")}>
          {show(key("mdmSuggestion"), em.mdm)}
          {show(key("timeSuggestion"), em.time)}
          {show(
            key("minutes"),
            p.values.em.minutes
              ? p.format?.number(Number(p.values.em.minutes))
              : null,
          )}
          {show(key("rationale"), p.values.em.rationale)}
          {show(key("finalCode"), p.values.em.finalCode)}
          <Hint message={key("emHint")} />
        </Panel>
      </CardGrid>
      <Panel title={key("reporting")}>
        {show(
          key("profile"),
          t(
            p.config.profiles.find((pr) => pr.value === p.values.profile)
              ?.label ?? "",
          ),
        )}
        {show(key("reportingNotes"), p.values.reportingNotes)}
        <Hint message={key("profileHint")} />
      </Panel>
    </div>
  );
}
