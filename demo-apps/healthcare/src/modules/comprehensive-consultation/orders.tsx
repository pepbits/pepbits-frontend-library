"use client";
import React, { useState } from "react";
import {Button, Select, Checkbox, Badge} from '@pepbits/ui';
import {CardGrid, Modal} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {ConsultationOrder, OrderKind} from '../../domain/comprehensive-consultation';
import { ClinicLedgerTable } from "../clinic-billing/parts";
import {
  Panel,
  Hint,
  EntryField,
  key,
  type ComprehensiveProps,
} from "./shared";
const kinds: OrderKind[] = ["medication", "lab", "imaging", "procedure"];
function blank(kind: OrderKind): ConsultationOrder {
  return {
    id: crypto.randomUUID(),
    kind,
    serviceId: "",
    serviceCode: "",
    codeSystem: "",
    diagnosisId: "",
    priority: "routine",
    dose: "",
    route: "",
    frequency: "",
    duration: "",
    timing: "",
    instructions: "",
    specimen: "",
    collection: "",
    laterality: "",
    contrast: "",
    indication: "",
    allergyChecked: false,
    allergyNote: "",
  };
}
export function OrdersPanel(p: ComprehensiveProps) {
  const { t } = useLocalization(),
    [draft, setDraft] = useState<ConsultationOrder | null>(null),
    [error, setError] = useState("");
  const start = (o: ConsultationOrder) => {
    setDraft(structuredClone(o));
    setError("");
  };
  const apply = () => {
    if (!draft || p.disabled) return;
    if (
      !draft.serviceId ||
      !draft.serviceCode.trim() ||
      !draft.codeSystem ||
      !draft.diagnosisId ||
      !draft.indication.trim()
    ) {
      setError(key("required"));
      return;
    }
    p.change(
      "orders",
      p.values.orders.some((o) => o.id === draft.id)
        ? p.values.orders.map((o) => (o.id === draft.id ? draft : o))
        : [...p.values.orders, draft],
    );
    setDraft(null);
  };
  const field = (
    name:
      | "dose"
      | "route"
      | "frequency"
      | "duration"
      | "timing"
      | "instructions"
      | "specimen"
      | "collection"
      | "laterality"
      | "contrast"
      | "indication"
      | "allergyNote",
    multiline = false,
  ) =>
    draft ? (
      <EntryField
        key={name}
        label={key(name)}
        value={draft[name]}
        multiline={multiline}
        onChange={(v) => setDraft({ ...draft, [name]: v })}
        disabled={p.disabled}
      />
    ) : null;
  return (
    <Panel
      title={key("orders")}
      action={<Badge>{p.format?.number(p.values.orders.length)}</Badge>}
    >
      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <Button
            key={kind}
            name={kind === "medication" ? "orders" : undefined}
            disabled={p.disabled || p.values.orders.length >= 60}
            onClick={() => start(blank(kind))}
          >
            + {t(key(kind))}
          </Button>
        ))}
      </div>
      <Hint message={key("ordersHint")} />
      {p.errors.orders ? <p role="alert">{t(p.errors.orders)}</p> : null}
      {p.preferences ? (
        <ClinicLedgerTable
          preferences={p.preferences}
          headers={[
            key("service"),
            key("diagnosisLink"),
            key("priority"),
            key("status"),
            key("edit"),
          ]}
          rows={p.values.orders.map((o) => ({
            id: o.id,
            cells: [
              <div>
                <strong>
                  {t(
                    p.config.services.find((s) => s.id === o.serviceId)
                      ?.label ?? o.serviceId,
                  )}
                </strong>
                <p className="text-xs text-[var(--text-muted)]">
                  {[o.dose, o.route, o.frequency, o.duration]
                    .filter(Boolean)
                    .join(" · ") || o.indication}
                </p>
              </div>,
              p.values.diagnoses.find((d) => d.id === o.diagnosisId)
                ?.description,
              t(key(o.priority)),
              <Badge tone="neutral">
                {t(
                  key(
                    p.record?.status === "completed"
                      ? "orderRecorded"
                      : "orderDraft",
                  ),
                )}
              </Badge>,
              <div className="flex gap-1">
                <Button
                  size="xs"
                  disabled={p.disabled}
                  onClick={() => start(o)}
                >
                  {t(key("edit"))}
                </Button>
                <Button
                  size="xs"
                  disabled={p.disabled}
                  onClick={() =>
                    p.change(
                      "orders",
                      p.values.orders.filter((row) => row.id !== o.id),
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
        title={t(key("addOrder")) + " · " + t(key(draft?.kind ?? "medication"))}
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
                label={key("service")}
                value={draft.serviceId}
                options={p.config.services
                  .filter((s) => s.kind === draft.kind)
                  .map((s) => ({
                    value: s.id,
                    label: t(s.label) + " · " + s.code,
                  }))}
                disabled={p.disabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    serviceId: e.target.value,
                    serviceCode:
                      p.config.services.find((s) => s.id === e.target.value)
                        ?.code ?? "",
                    codeSystem:
                      p.config.services.find((s) => s.id === e.target.value)
                        ?.system ?? "",
                  })
                }
              />
              <Select
                label={key("diagnosisLink")}
                value={draft.diagnosisId}
                options={p.values.diagnoses.map((d) => ({
                  value: d.id,
                  label: d.code + " · " + d.description,
                }))}
                disabled={p.disabled}
                onChange={(e) =>
                  setDraft({ ...draft, diagnosisId: e.target.value })
                }
              />
              <Select
                label={key("priority")}
                value={draft.priority}
                options={p.config.priorities}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value })
                }
                disabled={p.disabled}
              />
              {field("indication")}
              <Select
                label={key("system")}
                value={draft.codeSystem}
                options={p.config.serviceCodeSystems}
                disabled={p.disabled}
                onChange={(e) =>
                  setDraft({ ...draft, codeSystem: e.target.value })
                }
              />
              <EntryField
                label={key("code")}
                value={draft.serviceCode}
                disabled={p.disabled}
                onChange={(v) => setDraft({ ...draft, serviceCode: v })}
              />
            </CardGrid>
            <CardGrid columns={draft.kind === "medication" ? 3 : 2}>
              {(draft.kind === "medication"
                ? ([
                    "dose",
                    "route",
                    "frequency",
                    "duration",
                    "timing",
                  ] as const)
                : draft.kind === "lab"
                  ? (["specimen", "collection"] as const)
                  : (["laterality", "contrast"] as const)
              ).map((name) => field(name))}
            </CardGrid>
            {field("instructions", true)}
            {draft.kind === "medication" ? (
              <>
                <p className="text-sm text-[var(--text-muted)]">
                  {p.values.allergyDetails || t(key("allergyRequired"))}
                </p>
                <Checkbox
                  label={key("allergyChecked")}
                  checked={draft.allergyChecked}
                  disabled={p.disabled}
                  onChange={(e) =>
                    setDraft({ ...draft, allergyChecked: e.target.checked })
                  }
                />
                {field("allergyNote")}
              </>
            ) : null}
            {error ? <p role="alert">{t(error)}</p> : null}
          </div>
        ) : null}
      </Modal>
    </Panel>
  );
}
