"use client";
import React, { createContext, useCallback, useContext, useRef } from "react";
import { Button, Input, Select } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useConsultPort } from "../context/consult-host";
import { useDebounced } from "../hooks/useDebounced";
import { ProblemNotice } from "../layout/panel";
import type {
  NoteContent,
  OrderInfo as OrderInfoAnswers,
} from "../models/consult-note";
import type {
  InfoField,
  InfoResult,
  OrderEvaluation,
  OrderEvaluationContent,
  OrderList,
} from "../models/consult-orders";
import type { ConsultSectionProps } from "../models/consult-workflow";
import { useOrderResource } from "./OrderPriority";
const emptyInfo = (): OrderInfoAnswers => ({
  answers: {},
  absent: {},
  reasons: {},
});
export function useOrderInfo(
  draft: NoteContent,
  encounterId: string,
  readOnly: boolean
) {
  const port = useConsultPort();
  const payload = JSON.stringify({
    labs: draft.labs.map(({ code, priority }) => ({ code, priority })),
    imaging: draft.imaging.map(({ code, priority }) => ({ code, priority })),
    prescriptions: draft.prescriptions.map(({ code, priority, route }) => ({
      code,
      priority,
      route,
    })),
    procedures: (draft.procedures ?? []).map(({ code, priority }) => ({
      code,
      priority,
    })),
    orderInfo: draft.orderInfo ?? emptyInfo(),
  } satisfies OrderEvaluationContent);
  const delayed = useDebounced(payload, 350);
  const empty =
    !draft.labs.length &&
    !draft.imaging.length &&
    !draft.prescriptions.length &&
    !draft.procedures?.length;
  const resource = useOrderResource(
    useCallback(
      (signal: AbortSignal) =>
        readOnly || empty
          ? Promise.resolve({ results: [], problems: [] })
          : port.evaluateOrderForms(
              encounterId,
              JSON.parse(delayed) as OrderEvaluationContent,
              signal
            ),
      [port, encounterId, delayed, readOnly, empty]
    )
  );
  // Preserve mounted controls while evaluating edits. Readiness still tracks the exact current payload.
  const previous = useRef<{
    port: typeof port;
    encounterId: string;
    data: OrderEvaluation;
    input: OrderEvaluationContent;
  } | null>(null);
  if (resource.data)
    previous.current = {
      port,
      encounterId,
      data: resource.data,
      input: JSON.parse(delayed) as OrderEvaluationContent,
    };
  const saved =
    previous.current?.port === port &&
    previous.current.encounterId === encounterId
      ? previous.current
      : undefined;
  const current = readOnly || empty ? undefined : resource.data ?? saved?.data;
  const latestInfo = draft.orderInfo ?? emptyInfo();
  const oldInfo = saved?.input.orderInfo ?? emptyInfo();
  const results = new Map<string, InfoResult>(),
    shared = new Map<string, number>();
  for (const result of current?.results ?? []) {
    if ((draft[result.list] ?? [])[result.index]?.code !== result.code)
      continue;
    const reason = (check: InfoResult["warnings"][number]) => ({
      ...check,
      reason:
        latestInfo.reasons[check.id] ??
        (check.id in oldInfo.reasons ? undefined : check.reason),
    });
    results.set(`${result.list}:${result.index}`, {
      ...result,
      warnings: result.warnings.map(reason),
      sections: result.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.calculated
            ? field
            : {
                ...field,
                value:
                  field.key in latestInfo.answers
                    ? latestInfo.answers[field.key]
                    : field.key in oldInfo.answers
                    ? undefined
                    : field.value,
                absentReason:
                  latestInfo.absent[field.key] ??
                  (field.key in oldInfo.absent
                    ? undefined
                    : field.absentReason),
                checks: field.checks.map(reason),
              }
        ),
      })),
    });
    for (const key of new Set(
      result.sections.flatMap((s) =>
        s.fields.filter((f) => f.visible && !f.calculated).map((f) => f.key)
      )
    ))
      shared.set(key, (shared.get(key) ?? 0) + 1);
  }
  return {
    ...resource,
    results,
    shared,
    problems: [...resource.problems, ...(current?.problems ?? [])],
    pending: !readOnly && !empty && (payload !== delayed || resource.loading),
    open: (lists: OrderList[]) =>
      [...results.values()].filter((r) => lists.includes(r.list) && !r.complete)
        .length,
  };
}
const Context = createContext<Pick<
  ReturnType<typeof useOrderInfo>,
  "results" | "shared"
> | null>(null);
export const OrderInfoProvider = Context.Provider;
export function OrderInfoPanel({
  list,
  index,
  onChange,
  readOnly,
}: Pick<ConsultSectionProps, "onChange" | "readOnly"> & {
  list: OrderList;
  index: number;
}) {
  const ctx = useContext(Context),
    { t } = useLocalization();
  const result = ctx?.results.get(`${list}:${index}`);
  if (!result) return null;
  const set = (change: (info: OrderInfoAnswers) => void) => {
    if (!readOnly) onChange((n) => change((n.orderInfo ??= emptyInfo())));
  };
  return (
    <div className="grid gap-3">
      <h4>{t("Order information")}</h4>
      <p>{t(result.complete ? "Complete" : "Complete before signing")}</p>
      {result.sections.map((section) => (
        <div key={section.code}>
          <h5>{t(section.title)}</h5>
          {section.description && <p>{t(section.description)}</p>}
          {section.fields
            .filter((f) => f.visible)
            .map((field) => (
              <InfoInput
                key={field.key}
                field={field}
                readOnly={readOnly}
                shared={(ctx?.shared.get(field.key) ?? 0) > 1}
                set={set}
              />
            ))}
        </div>
      ))}
      <ProblemNotice
        problems={[
          ...result.missing.map((x) => x.label),
          ...result.invalid.map((x) => x.message),
          ...result.blocks.map((x) => x.message),
        ]}
      />
      {result.warnings.map((check) => (
        <div key={check.id}>
          <p>{t(check.message)}</p>
          <Input
            label={`${t("Reason to continue")}: ${t(check.message)}`}
            disabled={readOnly}
            maxLength={500}
            value={check.reason ?? ""}
            onChange={(e) =>
              set((info) => {
                if (e.target.value) info.reasons[check.id] = e.target.value;
                else delete info.reasons[check.id];
              })
            }
          />
        </div>
      ))}
      {result.informs.map((check) => (
        <p key={check.id}>{t(check.message)}</p>
      ))}
    </div>
  );
}
function InfoInput({
  field: f,
  readOnly,
  shared,
  set,
}: {
  field: InfoField;
  readOnly: boolean;
  shared: boolean;
  set: (change: (info: OrderInfoAnswers) => void) => void;
}) {
  const { t } = useLocalization(),
    format = useFormatters();
  const answer = (value: unknown) =>
    set((info) => {
      if (value === "" || value === undefined) delete info.answers[f.key];
      else info.answers[f.key] = value;
      delete info.absent[f.key];
    });
  const absent = (value: string) =>
    set((info) => {
      if (value) {
        info.absent[f.key] = value;
        delete info.answers[f.key];
      } else delete info.absent[f.key];
    });
  const display = (value: unknown) =>
    typeof value === "number"
      ? format.number(value)
      : f.dataType === "date" && value
      ? format.date(new Date(String(value) + "T12:00:00"))
      : typeof value === "boolean"
      ? t(value ? "Yes" : "No")
      : String(value ?? "");
  return (
    <div className="grid gap-2">
      {f.calculated ? (
        <p>
          {t(f.label)}:{" "}
          {f.value == null
            ? t("Calculated when the inputs are answered")
            : display(f.value)}{" "}
          {f.unit}
        </p>
      ) : f.absentReason ? (
        <div>
          {t(f.label)}: {t(f.absentReason)}
          <Button disabled={readOnly} onClick={() => absent("")}>
            {t("Answer instead")}
          </Button>
        </div>
      ) : f.dataType === "boolean" || f.dataType === "code" ? (
        <Select
          label={f.label}
          required={f.required}
          disabled={readOnly}
          value={String(f.value ?? "")}
          options={[
            { value: "", label: "Choose" },
            ...(f.dataType === "boolean"
              ? [
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ]
              : (f.options ?? []).map((o) => ({
                  value: o.code,
                  label: o.display,
                }))),
          ]}
          onChange={(e) =>
            answer(
              e.target.value === ""
                ? ""
                : f.dataType === "boolean"
                ? e.target.value === "true"
                : e.target.value
            )
          }
        />
      ) : (
        <Input
          label={f.label}
          required={f.required}
          disabled={readOnly}
          value={String(f.value ?? "")}
          type={
            f.dataType === "date"
              ? "date"
              : ["integer", "decimal"].includes(f.dataType)
              ? "number"
              : "text"
          }
          min={f.min ?? undefined}
          max={f.max ?? undefined}
          step={f.dataType === "integer" ? 1 : "any"}
          maxLength={2000}
          onChange={(e) =>
            answer(
              e.target.value !== "" &&
                ["integer", "decimal"].includes(f.dataType)
                ? Number(e.target.value)
                : e.target.value
            )
          }
        />
      )}
      {shared && <p>{t("Asked once for this visit")}</p>}
      {!f.calculated && f.absence.length > 0 && (
        <Select
          label={`${t(f.label)}: ${t("reason it is not available")}`}
          disabled={readOnly}
          value={f.absentReason ?? ""}
          options={[
            { value: "", label: "Answer" },
            ...f.absence.map((a) => ({
              value: a,
              label: a.replace(/-/g, " "),
            })),
          ]}
          onChange={(e) => absent(e.target.value)}
        />
      )}
      {!readOnly &&
        !f.calculated &&
        f.value === undefined &&
        !f.absentReason &&
        f.suggested != null && (
          <Button onClick={() => answer(f.suggested)}>
            {t("Use recorded")}: {display(f.suggested)}
          </Button>
        )}
      {f.help && <p>{t(f.help)}</p>}
      <ProblemNotice problems={f.problems} />
    </div>
  );
}
