"use client";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Badge, Button, Input, Select } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useClinicalActor } from "../context/clinical-context";
import { useConsultHost, useConsultPort } from "../context/consult-host";
import { problemsOf } from "../context/port";
import { ConsultSection } from "../layout/ConsultSection";
import { ProblemNotice } from "../layout/panel";
import { CodedSearch } from "../complaint/CodedSearch";
import { useDebounced } from "../hooks/useDebounced";
import type { CatalogItem, MedStatement } from "../types";
import type { NoteContent, RxLine } from "../models/consult-note";
import type { ConsultSectionProps } from "../models/consult-workflow";
import {
  conflictSummary,
  FREQUENCIES,
  sortedAlerts,
  type MedicationCheckInput,
  type MedicationCheckResult,
} from "../models/consult-orders";
import {
  OrderLoadProblems,
  localOrderTime,
  PriorityPicker,
  useOrderPriorities,
  useOrderResource,
} from "../orders/OrderPriority";
import {
  OrderInfoPanel,
  OrderInfoProvider,
  useOrderInfo,
} from "../orders/OrderInfo";
import { SubstitutionDecision } from "../orders/SubstitutionDecision";

/** Workspace must include this state in sign readiness; the server rechecks at signing. */
export interface MedicationSafetyState {
  pending: boolean;
  ready: boolean;
  problems: string[];
}
export interface MedicinesSectionProps extends ConsultSectionProps {
  canDecideSubstitution?: boolean;
  onSafetyChange?: (state: MedicationSafetyState) => void;
  onBusyChange?: (busy: boolean) => void;
  orderInfo?: ReturnType<typeof useOrderInfo>;
}
/** Required reasons use the source's nonblank rule; never infer safety from an absent result. */
export function medicationSafetyProblems(
  draft: NoteContent,
  checked?: MedicationCheckResult
): string[] {
  return draft.prescriptions.flatMap((rx) => {
    const line = checked?.lines.find((x) => x.code === rx.code);
    const needs = checked
      ? !!line &&
        (line.needsReason ||
          !!line.allergy.length ||
          line.alerts.some((a) => a.severity === "high"))
      : rx.flags.needsReason ||
        !!rx.flags.allergy ||
        rx.flags.safety?.some((a) => a.severity === "high");
    return checked && !line
      ? [`${rx.display}: medication check is incomplete.`]
      : needs && !rx.overrideReason?.trim()
      ? [
          `${rx.display}: document a reason to proceed despite these alerts before signing.`,
        ]
      : [];
  });
}
export function MedicinesSection(props: MedicinesSectionProps) {
  const {
    detail,
    draft,
    onChange,
    readOnly,
    onRecordsChanged,
    onSafetyChange,
    onBusyChange,
  } = props;
  const port = useConsultPort(),
    host = useConsultHost(),
    { can } = useClinicalActor(),
    { t } = useLocalization(),
    format = useFormatters(),
    uid = useId();
  const canPrescribe = !readOnly && can("rx.write");
  const priorities = useOrderPriorities(),
    localInfo = useOrderInfo(draft, detail.encounter.id, readOnly || !!props.orderInfo);
  const info = props.orderInfo ?? localInfo;
  const pharmacies = useOrderResource(
    useCallback(
      (signal: AbortSignal) => port.listReferralPharmacies(signal),
      [port]
    )
  );
  const [history, setHistory] = useState(false),
    [administration, setAdministration] = useState(false),
    [substitution, setSubstitution] = useState<string | null>(null),
    [problems, setProblems] = useState<string[]>([]);
  const [renewing, setRenewing] = useState(false);
  const latest = useRef({ draft, onChange, readOnly, canPrescribe });
  latest.current = { draft, onChange, readOnly, canPrescribe };
  const renewal = useRef<AbortController | null>(null);
  useEffect(() => {
    renewal.current?.abort();
    setRenewing(false);
    return () => renewal.current?.abort();
  }, [port, detail.patient.id, detail.encounter.id]);
  const input: MedicationCheckInput = {
    lines: draft.prescriptions.map(({ code, dose, frequency }) => ({
      code,
      dose,
      frequency,
    })),
    stopping: Object.entries(draft.history.meds)
      .filter(([, v]) => v === "stop")
      .map(([id]) => id)
      .sort(),
  };
  const payload = JSON.stringify(input),
    delayed = useDebounced(payload, 400);
  const clinicalKey = JSON.stringify([
    detail.allergies,
    detail.medications,
    detail.observations.latest,
    detail.reproductiveStatus,
  ]);
  const safety = useOrderResource(
    useCallback(
      (signal: AbortSignal) =>
        JSON.parse(delayed).lines.length
          ? port.checkMedications(
              detail.patient.id,
              JSON.parse(delayed) as MedicationCheckInput,
              signal
            )
          : Promise.resolve({
              lines: [],
              unmapped: [],
              context: {},
            } as MedicationCheckResult),
      [port, detail.patient.id, clinicalKey, delayed]
    )
  );
  const checked = payload === delayed ? safety.data : undefined;
  const pending =
    draft.prescriptions.length > 0 && (payload !== delayed || safety.loading);
  const safetyProblems = [
    ...safety.problems,
    ...medicationSafetyProblems(draft, checked),
  ];
  const ready =
    !draft.prescriptions.length ||
    (!pending && !!checked && !safetyProblems.length);
  const stateKey = JSON.stringify({ pending, ready, problems: safetyProblems });
  useEffect(() => {
    onSafetyChange?.(JSON.parse(stateKey) as MedicationSafetyState);
  }, [stateKey, onSafetyChange]);
  useEffect(() => {
    if (!checked || latest.current.readOnly) return;
    const updates = checked.lines.map((line) => ({
      code: line.code,
      allergy: conflictSummary(line.allergy),
      safety: sortedAlerts(line.alerts),
      needsReason:
        line.needsReason || line.alerts.some((a) => a.severity === "high"),
    }));
    if (
      latest.current.draft.prescriptions.some((rx) => {
        const f = updates.find((f) => f.code === rx.code);
        return (
          f &&
          JSON.stringify([
            rx.flags.allergy,
            rx.flags.safety ?? [],
            !!rx.flags.needsReason,
          ]) !== JSON.stringify([f.allergy, f.safety, f.needsReason])
        );
      })
    )
      latest.current.onChange((n) => {
        for (const rx of n.prescriptions) {
          const f = updates.find((f) => f.code === rx.code);
          if (f)
            Object.assign(rx.flags, {
              allergy: f.allergy,
              safety: f.safety,
              needsReason: f.needsReason,
            });
        }
      });
  }, [checked]);
  useEffect(() => {
    if (!readOnly && !draft.prescriptions.length && draft.ePrescription)
      onChange((n) => {
        n.ePrescription = null;
      });
  }, [readOnly, draft.prescriptions.length, draft.ePrescription, onChange]);
  const update: typeof onChange = (fn) => {
    if (!readOnly) onChange(fn);
  };
  const edit = (i: number, patch: Partial<RxLine>) => {
    if (canPrescribe)
      update((n) => {
        Object.assign(n.prescriptions[i]!, patch);
      });
  };
  const decide = (
    n: NoteContent,
    med: MedStatement,
    decision: "continue" | "change" | "stop" | null
  ) => {
    n.history.meds[med.id] = decision;
    (n.history.medVersions ??= {})[med.id] = med.version ?? 1;
  };
  const prescribe = (item: CatalogItem, renewalMed?: MedStatement) => {
    if (!latest.current.canPrescribe) return;
    const meta = item.meta ?? {},
      home =
        renewalMed ??
        detail.medications.find(
          (m) => m.status !== "stopped" && m.drugCode === item.code
        );
    latest.current.onChange((n) => {
      if (n.prescriptions.some((x) => x.code === item.code)) return;
      n.prescriptions.push({
        code: item.code,
        display: item.display,
        administration: "take-home",
        dose: String(meta.defaultDose ?? ""),
        route: Array.isArray(meta.routes)
          ? String(meta.routes[0] ?? "oral")
          : "oral",
        frequency: String(meta.defaultFrequency ?? ""),
        days: typeof meta.defaultDays === "number" ? meta.defaultDays : 7,
        instructions: "",
        drugClass: String(meta.drugClass ?? ""),
        renews: home?.id,
        flags: {
          highAlert: !!meta.highAlert,
          controlled: !!meta.controlled,
          priorAuth: !!meta.priorAuth,
        },
      });
      if (home && !n.history.meds[home.id]) decide(n, home, "continue");
    });
  };
  const represcribe = async (med: MedStatement) => {
    if (!canPrescribe || renewing) return;
    const ctrl = new AbortController();
    renewal.current?.abort();
    renewal.current = ctrl;
    setRenewing(true);
    setProblems([]);
    try {
      const items = await port.searchCatalog(
        "drugs",
        med.display,
        ctrl.signal,
        { limit: 20 }
      );
      if (ctrl.signal.aborted) return;
      const item = items.find((x) => x.code === med.drugCode);
      if (item) prescribe(item, med);
      else
        setProblems([
          `${med.display} was not found in the formulary. Search for it under New this visit.`,
        ]);
    } catch (error) {
      if (!ctrl.signal.aborted) setProblems(problemsOf(error));
    } finally {
      if (!ctrl.signal.aborted) setRenewing(false);
    }
  };
  const replace = (i: number, id: string) => {
    if (canPrescribe)
      update((n) => {
        const rx = n.prescriptions[i]!;
        if (rx.replaces && n.history.meds[rx.replaces] === "stop")
          n.history.meds[rx.replaces] = null;
        rx.replaces = id || undefined;
        const med = detail.medications.find((m) => m.id === id);
        if (med) decide(n, med, "stop");
      });
  };
  const slotProps = {
    detail,
    readOnly,
    onRecordsChanged: onRecordsChanged ?? (() => {}),
    onBusyChange: onBusyChange ?? (() => {}),
  };
  return (
    <ConsultSection
      id={props.id ?? uid}
      stickyOffset={host.stickyOffset}
      title="Medicines"
      subtitle="Reconcile what the patient takes and prescribe what is new. Take-home prescriptions join the medicine list when you sign."
      actions={
        <Button onClick={() => setHistory(!history)}>
          {t("Medication history")}
        </Button>
      }
    >
      <ProblemNotice problems={problems} />
      <OrderLoadProblems {...priorities} />
      <OrderLoadProblems {...safety} />
      <OrderLoadProblems {...info} />
      <h3>{t("Current medicines")}</h3>
      <ul>
        {detail.medications.map((med) => {
          const replaced = draft.prescriptions.some(
              (rx) => rx.replaces === med.id
            ),
            renewed = draft.prescriptions.some((rx) => rx.renews === med.id);
          return (
            <li key={med.id}>
              <p>
                {med.display} · {med.dose} · {t(med.status)}
              </p>
              {med.status !== "stopped" && (
                <Select
                  label={`${t("Decision for")} ${med.display}`}
                  disabled={readOnly || replaced}
                  value={draft.history.meds[med.id] ?? ""}
                  options={[
                    { value: "", label: "Not reviewed" },
                    { value: "continue", label: "Continue" },
                    { value: "change", label: "Change" },
                    { value: "stop", label: "Stop" },
                  ]}
                  onChange={(e) => {
                    if (!replaced)
                      update((n) =>
                        decide(n, med, (e.target.value as "continue") || null)
                      );
                  }}
                />
              )}
              {draft.history.meds[med.id] === "change" && (
                <Input
                  label={`New dose for ${med.display}`}
                  required
                  disabled={readOnly}
                  value={draft.history.medChanges?.[med.id]?.dose ?? ""}
                  onChange={(e) =>
                    update((n) => {
                      (n.history.medChanges ??= {})[med.id] = {
                        dose: e.target.value,
                      };
                    })
                  }
                />
              )}
              {med.drugCode &&
                !renewed &&
                !replaced &&
                draft.history.meds[med.id] !== "stop" && (
                  <Button
                    disabled={!canPrescribe || renewing}
                    onClick={() => void represcribe(med)}
                  >
                    {t("Represcribe")} {med.display}
                  </Button>
                )}
            </li>
          );
        })}
      </ul>
      <h3>{t("New this visit")}</h3>
      <CodedSearch
        catalog="drugs"
        label="Add medicine"
        disabled={!canPrescribe}
        disabledCodes={draft.prescriptions.map((x) => x.code)}
        onPick={(item) => prescribe(item)}
      />
      {pending && (
        <p role="status">{t("Checking allergies, doses and interactions…")}</p>
      )}
      {checked && draft.prescriptions.length > 0 && (
        <p>
          {t("Checked for")}:{" "}
          {checked.context.ageYears == null
            ? t("age not recorded")
            : `${t("age")} ${format.number(
                checked.context.ageYears < 1
                  ? Math.round(checked.context.ageYears * 12)
                  : Math.floor(checked.context.ageYears)
              )} ${t(checked.context.ageYears < 1 ? "months" : "years")}`}{" "}
          ·{" "}
          {checked.context.weightKg == null
            ? t("weight not recorded")
            : `${t("weight")} ${format.number(
                checked.context.weightKg
              )} kg`}{" "}
          ·{" "}
          {checked.context.egfr == null
            ? t("eGFR not recorded")
            : `eGFR ${format.number(checked.context.egfr)}`}
          {checked.context.pregnancy &&
            ` · ${t(
              checked.context.pregnancy === "pregnant"
                ? "pregnant"
                : "may be pregnant"
            )}`}
          {checked.context.breastfeeding && ` · ${t("breastfeeding")}`}.{" "}
          {t(
            "Dose limits and interaction rules are a starter set pending pharmacist review."
          )}
        </p>
      )}
      {checked?.unmapped.map((a) => (
        <p key={a.allergyId} role="status">
          {a.substance}:{" "}
          {t(
            "Recorded as free text, so not checked automatically. Review these allergies yourself."
          )}
        </p>
      ))}
      <ProblemNotice problems={safetyProblems} />
      <OrderInfoProvider value={info}>
        <ul className="grid gap-4">
          {draft.prescriptions.map((rx, i) => {
            const review = checked?.lines.find((x) => x.code === rx.code);
            const allergy = review
              ? conflictSummary(review.allergy)
              : rx.flags.allergy;
            const alerts = review
              ? sortedAlerts(review.alerts)
              : rx.flags.safety ?? [];
            const needsReason =
              !!allergy ||
              (review?.needsReason ?? rx.flags.needsReason) ||
              alerts.some((a) => a.severity === "high");
            const stopped = detail.medications.find(
              (m) =>
                m.drugCode === rx.code &&
                draft.history.meds[m.id] === "stop" &&
                rx.replaces !== m.id
            );
            return (
              <li key={rx.code}>
                <h4>{rx.display}</h4>
                {rx.flags.highAlert && (
                  <Badge tone="danger">{t("High-alert")}</Badge>
                )}
                {rx.flags.controlled && (
                  <Badge tone="warning">{t("Controlled")}</Badge>
                )}
                {rx.flags.priorAuth && (
                  <Badge tone="warning">{t("Insurer approval")}</Badge>
                )}
                <Button
                  disabled={!canPrescribe}
                  aria-label={`${t("Remove")} ${rx.display}`}
                  onClick={() => {
                    if (canPrescribe)
                      update((n) => {
                        const old = n.prescriptions[i]!;
                        if (
                          old.replaces &&
                          n.history.meds[old.replaces] === "stop"
                        )
                          n.history.meds[old.replaces] = null;
                        n.prescriptions.splice(i, 1);
                      });
                  }}
                >
                  {t("Remove")}
                </Button>
                {rx.renews && (
                  <Button
                    disabled={!canPrescribe}
                    onClick={() => edit(i, { renews: undefined })}
                  >
                    {t("Not a renewal")}
                  </Button>
                )}
                {stopped && (
                  <ProblemNotice
                    problems={[
                      `${stopped.display} is marked Stop above. Choose Continue or Change, or remove this prescription.`,
                    ]}
                  />
                )}
                {allergy && <ProblemNotice problems={[allergy]} />}{" "}
                {alerts.map((a, k) => (
                  <p key={k} role={a.severity === "high" ? "alert" : "status"}>
                    {t(a.message)}
                  </p>
                ))}
                {needsReason && (
                  <Input
                    label={`Reason to proceed with ${rx.display}`}
                    required
                    disabled={!canPrescribe}
                    value={rx.overrideReason ?? ""}
                    onChange={(e) =>
                      edit(i, { overrideReason: e.target.value })
                    }
                  />
                )}
                <Select
                  label="Where will this medicine be used?"
                  disabled={!canPrescribe}
                  value={rx.administration ?? "take-home"}
                  options={[
                    { value: "take-home", label: "Take-home supply" },
                    { value: "in-clinic", label: "Administer in clinic" },
                  ]}
                  onChange={(e) =>
                    edit(i, {
                      administration: e.target
                        .value as RxLine["administration"],
                      ...(e.target.value === "take-home"
                        ? { administrationMode: "dose" }
                        : !FREQUENCIES[rx.frequency] && rx.frequency !== "stat"
                        ? { frequency: "" }
                        : {}),
                    })
                  }
                />
                {rx.administration !== "in-clinic" && (
                  <Select
                    label="Replaces a home medicine"
                    disabled={!canPrescribe}
                    value={rx.replaces ?? ""}
                    options={[
                      { value: "", label: "No, an addition" },
                      ...detail.medications
                        .filter(
                          (m) => m.status !== "stopped" && m.id !== rx.renews
                        )
                        .map((m) => ({ value: m.id, label: m.display })),
                    ]}
                    onChange={(e) => replace(i, e.target.value)}
                  />
                )}
                <PriorityPicker
                  value={rx}
                  priorities={priorities.priorities}
                  disabled={!canPrescribe}
                  onChange={(value) => edit(i, value)}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["dose", "route", "instructions"] as const).map((key) => (
                    <Input
                      key={key}
                      label={
                        {
                          dose: "Dose",
                          route: "Route",
                          instructions: "Instructions",
                        }[key]
                      }
                      disabled={!canPrescribe}
                      value={rx[key]}
                      onChange={(e) => edit(i, { [key]: e.target.value })}
                    />
                  ))}
                  {rx.administration === "in-clinic" ? (
                    <Select
                      label="Frequency"
                      disabled={!canPrescribe}
                      value={rx.frequency}
                      options={[
                        { value: "", label: "Choose frequency" },
                        ...Object.entries({
                          ...FREQUENCIES,
                          stat: "Single immediate dose (STAT)",
                        }).map(([value, label]) => ({ value, label })),
                      ]}
                      onChange={(e) => edit(i, { frequency: e.target.value })}
                    />
                  ) : (
                    <Input
                      label="Frequency"
                      disabled={!canPrescribe}
                      value={rx.frequency}
                      onChange={(e) => edit(i, { frequency: e.target.value })}
                    />
                  )}
                  <Input
                    label="Days"
                    type="number"
                    min={1}
                    max={365}
                    disabled={!canPrescribe}
                    value={rx.days}
                    onChange={(e) => edit(i, { days: Number(e.target.value) })}
                  />
                  {rx.administration === "in-clinic" && (
                    <>
                      <Input
                        label="Indication"
                        maxLength={500}
                        disabled={!canPrescribe}
                        value={rx.indication ?? ""}
                        onChange={(e) =>
                          edit(i, { indication: e.target.value })
                        }
                      />
                      <Input
                        label="Start time (device timezone, blank for signing time)"
                        type="datetime-local"
                        disabled={!canPrescribe}
                        value={localOrderTime(rx.startAt)}
                        onChange={(e) =>
                          edit(i, {
                            startAt: e.target.value
                              ? new Date(e.target.value).toISOString()
                              : undefined,
                          })
                        }
                      />
                      <Select
                        label="Administration mode"
                        disabled={!canPrescribe}
                        value={rx.administrationMode ?? "dose"}
                        options={[
                          { value: "dose", label: "Dose" },
                          { value: "infusion", label: "Infusion" },
                        ]}
                        onChange={(e) =>
                          edit(i, {
                            administrationMode: e.target.value as
                              | "dose"
                              | "infusion",
                          })
                        }
                      />
                    </>
                  )}
                  {rx.frequency === "prn" && (
                    <>
                      {(
                        ["minimumIntervalHours", "maximumDoses24h"] as const
                      ).map((key) => (
                        <Input
                          key={key}
                          label={
                            key === "minimumIntervalHours"
                              ? "Minimum interval (hours)"
                              : "Maximum doses in 24 hours"
                          }
                          type="number"
                          min={1}
                          max={key === "minimumIntervalHours" ? 168 : 24}
                          disabled={!canPrescribe}
                          value={rx[key] ?? ""}
                          onChange={(e) =>
                            edit(i, {
                              [key]:
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                            })
                          }
                        />
                      ))}
                    </>
                  )}
                  {rx.administration === "in-clinic" &&
                    rx.administrationMode === "infusion" && (
                      <>
                        {(
                          [
                            ["infusionVolumeMl", "Prescribed volume (mL)"],
                            ["infusionRateMlHour", "Starting rate (mL/hour)"],
                            ["minimumRateMlHour", "Minimum rate (mL/hour)"],
                            ["maximumRateMlHour", "Maximum rate (mL/hour)"],
                          ] as const
                        ).map(([key, label]) => (
                          <Input
                            key={key}
                            label={label}
                            type="number"
                            min={0.001}
                            max={100000}
                            step="any"
                            disabled={!canPrescribe}
                            value={rx[key] ?? ""}
                            onChange={(e) =>
                              edit(i, {
                                [key]:
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                              })
                            }
                          />
                        ))}
                        <Input
                          label="Infusion preparation and instructions"
                          minLength={10}
                          maxLength={1000}
                          disabled={!canPrescribe}
                          value={rx.infusionPreparation ?? ""}
                          onChange={(e) =>
                            edit(i, { infusionPreparation: e.target.value })
                          }
                        />
                      </>
                    )}
                </div>
                <p>
                  {rx.dose} {rx.route}, {rx.frequency}, {format.number(rx.days)}{" "}
                  {t("days")}
                </p>
                <OrderInfoPanel
                  list="prescriptions"
                  index={i}
                  onChange={update}
                  readOnly={!canPrescribe}
                />
              </li>
            );
          })}
        </ul>
      </OrderInfoProvider>
      {draft.prescriptions.some((rx) => rx.administration !== "in-clinic") && (
        <>
          <OrderLoadProblems {...pharmacies} />
          <Select
            label="Dispense at"
            disabled={!canPrescribe}
            value={draft.ePrescription?.pharmacy ?? ""}
            options={[
              {
                value: "",
                label: "This organisation's pharmacy or a printed prescription",
              },
              ...(pharmacies.data ?? [])
                .filter(
                  (p) =>
                    !draft.prescriptions.some((rx) => rx.flags.controlled) ||
                    p.name === draft.ePrescription?.pharmacy
                )
                .map((p) => ({ value: p.name, label: p.name })),
            ]}
            onChange={(e) => {
              if (
                canPrescribe &&
                (!e.target.value ||
                  !draft.prescriptions.some((rx) => rx.flags.controlled))
              )
                update((n) => {
                  n.ePrescription = e.target.value
                    ? { pharmacy: e.target.value }
                    : null;
                });
            }}
          />
          {draft.ePrescription && (
            <p>
              {t(
                "Sent electronically when you sign. Controlled medicines cannot be sent this way."
              )}
            </p>
          )}
        </>
      )}
      <h3>{t("After this visit")}</h3>
      <ul>
        {detail.medications
          .filter((m) => m.status !== "stopped")
          .map((m) => {
            const rx = draft.prescriptions.find((x) => x.renews === m.id);
            return (
              <li key={m.id}>
                {m.display}:{" "}
                {draft.history.meds[m.id] === "stop"
                  ? t("Stopping")
                  : rx
                  ? `${rx.dose} ${rx.frequency}`
                  : draft.history.meds[m.id] === "change"
                  ? draft.history.medChanges?.[m.id]?.dose ||
                    t("New dose missing")
                  : m.dose}
              </li>
            );
          })}
        {draft.prescriptions
          .filter((rx) => !rx.renews && rx.administration !== "in-clinic")
          .map((rx) => (
            <li key={rx.code}>
              {rx.display}: {rx.dose} {rx.frequency}
            </li>
          ))}
      </ul>
      {history &&
        (host.renderMedicationHistory?.(props) ?? (
          <p role="status">{t("Medication history is unavailable.")}</p>
        ))}
      <Button onClick={() => setAdministration(!administration)}>
        {t("Administration, returns and vaccinations")}
      </Button>
      {administration &&
        (host.renderAdministration?.(slotProps) ?? (
          <p role="status">{t("Medication administration is unavailable.")}</p>
        ))}
      {detail.orders
        .filter((o) => o.kind === "medication" || o.kind === "prescription")
        .map((order) => (
          <div key={order.id}>
            <h4>{order.display}</h4>
            <SubstitutionDecision
              key={`${detail.encounter.id}:${order.id}:${order.version}`}
              encounterId={detail.encounter.id}
              order={order}
              disabled={
                !(props.canDecideSubstitution ?? !readOnly) || !can("rx.write")
              }
              onRecordsChanged={onRecordsChanged}
              onBusyChange={onBusyChange}
            />
            <Button
              onClick={() =>
                setSubstitution(substitution === order.id ? null : order.id)
              }
            >
              {t("Substitution")}
            </Button>
            {substitution === order.id &&
              (host.renderSubstitution?.({ ...slotProps, order }) ?? (
                <p role="status">
                  {t("Pharmacy substitution workflow is unavailable.")}
                </p>
              ))}
          </div>
        ))}
    </ConsultSection>
  );
}
