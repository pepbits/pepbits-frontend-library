"use client";
import React, { useState } from "react";
import {Button, Select, Input, DateTimeInput, Badge} from '@pepbits/ui';
import {CardGrid, Modal} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {scoreTotal, type ScoreEntry} from '../../domain/comprehensive-consultation';
import { ClinicLedgerTable } from "../clinic-billing/parts";
import {
  Panel,
  Hint,
  EntryField,
  key,
  type ComprehensiveProps,
} from "./shared";
export function ScoresPanel(p: ComprehensiveProps) {
  const { t } = useLocalization(),
    [draft, setDraft] = useState<ScoreEntry | null>(null),
    [error, setError] = useState("");
  const instrument = p.config.scoreInstruments.find(
    (i) => i.id === draft?.instrument,
  );
  const apply = () => {
    if (!draft || !instrument || p.disabled) return;
    if (
      !draft.measuredAt ||
      !Number.isFinite(Date.parse(draft.measuredAt)) ||
      instrument.fields.some((f) => {
        const value = draft.inputs[f.id];
        return (
          !(f.notTestable && value === "NT") &&
          (!/^\d+$/.test(value ?? "") ||
            Number(value) < f.min ||
            Number(value) > f.max)
        );
      }) ||
      (instrument.mode === "recorded" && !draft.notes.trim())
    ) {
      setError(key("required"));
      return;
    }
    p.change("scores", [
      ...p.values.scores.filter((s) => s.id !== draft.id),
      draft,
    ]);
    setDraft(null);
  };
  return (
    <Panel title={key("scores")}>
      <Hint message={key("scoreHint")} />
      <Button
        name="scores"
        disabled={p.disabled || p.values.scores.length >= 30}
        onClick={() => {
          setError("");
          setDraft({
            id: crypto.randomUUID(),
            instrument: "",
            measuredAt: "",
            inputs: {},
            notes: "",
          });
        }}
      >
        {t(key("addScore"))}
      </Button>
      {p.errors.scores ? <p role="alert">{t(p.errors.scores)}</p> : null}
      {p.preferences ? (
        <ClinicLedgerTable
          preferences={p.preferences}
          headers={[
            key("instrument"),
            "template.triage.measuredAt",
            key("total"),
            key("edit"),
          ]}
          rows={p.values.scores.map((s) => ({
            id: s.id,
            cells: [
              p.config.scoreInstruments.find((i) => i.id === s.instrument)
                ?.label,
              p.format?.dateTime(s.measuredAt),
              scoreTotal(s, p.config) === null
                ? t("template.op.notRecorded")
                : p.format?.number(scoreTotal(s, p.config)!),
              <div className="flex gap-1">
                <Button
                  size="xs"
                  disabled={p.disabled}
                  onClick={() => {
                    setError("");
                    setDraft(structuredClone(s));
                  }}
                >
                  {t(key("edit"))}
                </Button>
                <Button
                  size="xs"
                  disabled={p.disabled}
                  onClick={() =>
                    p.change(
                      "scores",
                      p.values.scores.filter((row) => row.id !== s.id),
                    )
                  }
                >
                  {t(key("remove"))}
                </Button>
              </div>,
            ],
          }))}
        />
      ) : null}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={t(key("addScore"))}
        size="lg"
        footer={
          <>
            <Button onClick={() => setDraft(null)}>{t("Cancel")}</Button>
            <Button variant="primary" disabled={p.disabled} onClick={apply}>
              {t(key("apply"))}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-3">
            <CardGrid columns={2}>
              <Select
                label={key("instrument")}
                value={draft.instrument}
                disabled={p.disabled}
                options={p.config.scoreInstruments.map((s) => ({
                  value: s.id,
                  label: s.label,
                }))}
                onChange={(e) =>
                  setDraft({ ...draft, instrument: e.target.value, inputs: {} })
                }
              />
              <DateTimeInput
                label="template.triage.measuredAt"
                value={localTime(draft.measuredAt)}
                disabled={p.disabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    measuredAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : "",
                  })
                }
              />
            </CardGrid>
            {instrument?.mode === "recorded" ? (
              <Hint message={key("recordedHint")} />
            ) : null}
            <CardGrid columns={instrument?.fields.length === 3 ? 3 : 1}>
              {instrument?.fields.map((f) =>
                f.notTestable ? (
                  <Select
                    key={f.id}
                    label={f.label}
                    value={draft.inputs[f.id] ?? ""}
                    disabled={p.disabled}
                    options={[
                      ...Array.from({ length: f.max - f.min + 1 }, (_, i) => ({
                        value: String(i + f.min),
                        label: p.format?.number(i + f.min) ?? String(i + f.min),
                      })),
                      { value: "NT", label: "NT" },
                    ]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        inputs: { ...draft.inputs, [f.id]: e.target.value },
                      })
                    }
                  />
                ) : (
                  <Input
                    key={f.id}
                    label={f.label}
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={1}
                    value={draft.inputs[f.id] ?? ""}
                    disabled={p.disabled}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        inputs: { ...draft.inputs, [f.id]: e.target.value },
                      })
                    }
                  />
                ),
              )}
            </CardGrid>
            <EntryField
              label={key("notes")}
              value={draft.notes}
              onChange={(v) => setDraft({ ...draft, notes: v })}
              disabled={p.disabled}
              multiline
            />
            <Badge>
              {t(key("total"))}:{" "}
              {scoreTotal(draft, p.config) === null
                ? t("template.op.notRecorded")
                : p.format?.number(scoreTotal(draft, p.config)!)}
            </Badge>
            {error ? <p role="alert">{t(error)}</p> : null}
          </div>
        ) : null}
      </Modal>
    </Panel>
  );
}
function localTime(value: string) {
  const d = new Date(value);
  return Number.isFinite(d.valueOf())
    ? new Date(d.valueOf() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
}
