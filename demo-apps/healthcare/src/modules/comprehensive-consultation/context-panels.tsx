"use client";
import React from "react";
import {Select, Input, Badge, Checkbox} from '@pepbits/ui';
import {CardGrid} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {emComparison} from '../../domain/comprehensive-consultation';
import {
  Panel,
  EntryField,
  Hint,
  key,
  type ComprehensiveProps,
} from "./shared";
export function SpecialtyPanel(p: ComprehensiveProps) {
  const specialty = p.config.specialties.find(
    (s) => s.value === p.values.specialty,
  );
  return (
    <Panel title={key("context")}>
      <CardGrid columns={2}>
        <Select
          label={key("specialty")}
          name="specialty"
          value={p.values.specialty}
          options={p.config.specialties}
          disabled={p.disabled}
          error={p.errors.specialty}
          onChange={(e) => p.change("specialty", e.target.value)}
        />
        <Select
          label={key("context")}
          name="context"
          value={p.values.context}
          options={p.config.contexts}
          disabled={p.disabled}
          error={p.errors.context}
          onChange={(e) => p.change("context", e.target.value)}
        />
      </CardGrid>
      <Hint message={key("specialtyHint")} />
      {specialty?.fields.map((f) => (
        <EntryField
          key={f.id}
          name="specialtyNotes"
          label={f.label}
          value={p.values.specialtyNotes[f.id] ?? ""}
          error={p.errors.specialtyNotes}
          multiline
          disabled={p.disabled}
          onChange={(v) =>
            p.change("specialtyNotes", {
              ...p.values.specialtyNotes,
              [f.id]: v,
            })
          }
        />
      ))}
    </Panel>
  );
}
export function EMPanel(p: ComprehensiveProps) {
  const { t } = useLocalization(),
    comparison = emComparison(p.values, p.config);
  return (
    <Panel title={key("em")}>
      <Hint message={key("emHint")} />
      <CardGrid columns={3}>
        {(["problems", "data", "risk"] as const).map((f) => (
          <Select
            key={f}
            name={f === "problems" ? "em" : undefined}
            label={key(f)}
            value={p.values.em[f]}
            disabled={p.disabled}
            options={[0, 1, 2, 3].map((i) => ({
              value: String(i),
              label: key("level" + i),
            }))}
            onChange={(e) =>
              p.change("em", { ...p.values.em, [f]: e.target.value })
            }
          />
        ))}
      </CardGrid>
      <CardGrid columns={2}>
        <Input
          label={key("minutes")}
          type="number"
          min={0}
          max={1440}
          step={1}
          value={p.values.em.minutes}
          disabled={p.disabled}
          onChange={(e) =>
            p.change("em", { ...p.values.em, minutes: e.target.value })
          }
        />
        <EntryField
          label={key("finalCode")}
          value={p.values.em.finalCode}
          disabled={p.disabled}
          onChange={(v) => p.change("em", { ...p.values.em, finalCode: v })}
        />
      </CardGrid>
      <CardGrid columns={2}>
        <Badge>
          {t(key("mdmSuggestion"))}:{" "}
          {comparison.mdm || t("template.op.notRecorded")}
        </Badge>
        <Badge>
          {t(key("timeSuggestion"))}:{" "}
          {comparison.time || t("template.op.notRecorded")}
        </Badge>
      </CardGrid>
      <EntryField
        label={key("rationale")}
        value={p.values.em.rationale}
        disabled={p.disabled}
        multiline
        error={p.errors.em}
        onChange={(v) => p.change("em", { ...p.values.em, rationale: v })}
      />
      <p className="text-xs text-[var(--text-muted)]">
        {p.config.emRules.version}
      </p>
    </Panel>
  );
}
export function ReportingPanel(p: ComprehensiveProps) {
  const { t } = useLocalization(),
    profile = p.config.profiles.find((pr) => pr.value === p.values.profile);
  return (
    <Panel title={key("reporting")}>
      <Select
        name="profile"
        label={key("profile")}
        value={p.values.profile}
        options={p.config.profiles}
        disabled={p.disabled}
        error={p.errors.profile}
        onChange={(e) => p.change("profile", e.target.value)}
      />
      <Hint message={key("profileHint")} />
      <div className="space-y-2">
        {profile?.integrations.map((integration) => (
          <div
            key={integration}
            className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-2"
          >
            <span>{integration}</span>
            <Badge tone="neutral">{t(key("notConnected"))}</Badge>
          </div>
        ))}
      </div>
      <EntryField
        label={key("reportingNotes")}
        value={p.values.reportingNotes}
        disabled={p.disabled}
        multiline
        onChange={(v) => p.change("reportingNotes", v)}
      />
      <Checkbox
        name="attested"
        label={key("attested")}
        checked={p.values.attested}
        disabled={p.disabled}
        onChange={(e) => p.change("attested", e.target.checked)}
      />
      {p.errors.attested ? <p role="alert">{t(p.errors.attested)}</p> : null}
      <p className="text-xs text-[var(--text-muted)]">
        {t(key("version"))}: {p.config.version} ·{" "}
        {p.format?.date(p.config.effectiveFrom)}
      </p>
    </Panel>
  );
}
