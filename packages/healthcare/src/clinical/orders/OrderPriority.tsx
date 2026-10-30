"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, FieldShell, Input, SourceSelect } from "@pepbits/ui";
import { ErrorState } from "@pepbits/components";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useConsultPort } from "../context/consult-host";
import { problemsOf } from "../context/port";
import { ProblemNotice } from "../layout/panel";
import {
  priorityCountdown,
  priorityProblem,
  type OrderPriority,
  type PriorityInput,
  type PriorityOrder,
} from "../models/consult-orders";

/** Instance-scoped abortable read with a retry; loader identity fences replacement hosts. */
export function useOrderResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    load: typeof load;
    data?: T;
    problems: string[];
    loading: boolean;
  }>();
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ load, problems: [], loading: true });
    void load(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted)
          setState({ load, data, problems: [], loading: false });
      })
      .catch((error) => {
        if (!ctrl.signal.aborted)
          setState({ load, problems: problemsOf(error), loading: false });
      });
    return () => ctrl.abort();
  }, [load, attempt]);
  return {
    data: state?.load === load ? state.data : undefined,
    problems: state?.load === load ? state.problems : [],
    loading: state?.load !== load || state.loading,
    retry: () => retry((n) => n + 1),
  };
}
export function OrderLoadProblems({
  problems,
  retry,
}: {
  problems: string[];
  retry: () => void;
}) {
  const { t } = useLocalization();
  return problems.length ? (
    <div>
      <ProblemNotice problems={problems} />
      <ErrorState
        title="Could not load order information"
        action={<Button onClick={retry}>{t("Retry")}</Button>}
      />
    </div>
  ) : null;
}
export function useOrderPriorities() {
  const port = useConsultPort();
  const resource = useOrderResource(
    useCallback(
      (signal: AbortSignal) => port.listOrderPriorities(signal),
      [port]
    )
  );
  return { ...resource, priorities: resource.data ?? [] };
}
export function localOrderTime(iso?: string | null) {
  const date = iso ? new Date(iso) : null;
  return date && Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
}
export function PriorityPicker({
  value,
  priorities,
  onChange,
  disabled = false,
  emergencyAllowed = true,
}: {
  value: PriorityInput;
  priorities: OrderPriority[];
  onChange: (value: PriorityInput) => void;
  disabled?: boolean;
  emergencyAllowed?: boolean;
}) {
  const { t } = useLocalization();
  const selected = priorities.find(
    (p) =>
      p.code ===
      (value.priority || priorities.find((p) => p.active && p.default)?.code)
  );
  const set = (next: PriorityInput) => {
    if (!disabled) onChange(next);
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <FieldShell label="Order priority">
        {(describedBy) => (
          <SourceSelect
            aria-label={t("Order priority")}
            aria-describedby={describedBy}
            disabled={disabled || !priorities.length}
            value={value.priority ?? ""}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]"
            onChange={(e) => {
              const p = priorities.find((x) => x.code === e.target.value);
              if (
                p &&
                (!p.active ||
                  (p.firstDoseBeforeVerification && !emergencyAllowed))
              )
                return;
              set({ ...value, priority: e.target.value, priorityAt: null });
            }}
          >
            <option value="">
              {t("Default")} ·{" "}
              {priorities.find((p) => p.active && p.default)?.label ?? ""}
            </option>
            {priorities
              .filter((p) => p.active || p.code === value.priority)
              .map((p) => (
                <option
                  key={p.code}
                  value={p.code}
                  disabled={
                    !p.active ||
                    (p.firstDoseBeforeVerification && !emergencyAllowed)
                  }
                >
                  {t(p.label)}
                  {!p.active ? ` (${t("inactive")})` : ""}
                </option>
              ))}
          </SourceSelect>
        )}
      </FieldShell>
      <Input
        label={
          selected?.reasonRequired
            ? "Priority reason"
            : "Priority reason (optional)"
        }
        required={selected?.reasonRequired}
        minLength={selected?.reasonRequired ? 10 : undefined}
        maxLength={500}
        disabled={disabled}
        value={value.priorityReason ?? ""}
        onChange={(e) => set({ ...value, priorityReason: e.target.value })}
      />
      {selected?.requiresTime && (
        <Input
          label="Required time"
          type="datetime-local"
          required
          disabled={disabled}
          value={localOrderTime(value.priorityAt)}
          onChange={(e) =>
            set({
              ...value,
              priorityAt: e.target.value
                ? new Date(e.target.value).toISOString()
                : null,
            })
          }
        />
      )}
      {priorities.length > 0 && (
        <ProblemNotice
          problems={[priorityProblem(value, priorities)].filter(Boolean)}
        />
      )}
      {selected?.firstDoseBeforeVerification && (
        <p>
          {t(
            emergencyAllowed
              ? "This priority permits the first dose before pharmacy verification when the emergency policy and all bedside checks allow it."
              : "Emergency first doses are disabled. Arrange pharmacy verification before administration."
          )}
        </p>
      )}
    </div>
  );
}
export function usePriorityClock(asOf?: string) {
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const offset = asOf ? Date.parse(asOf) - Date.now() : 0;
    const tick = () =>
      setClock(Date.now() + (Number.isFinite(offset) ? offset : 0));
    tick();
    const timer = setInterval(tick, 10000);
    return () => clearInterval(timer);
  }, [asOf]);
  return clock;
}
export function PriorityBadge({
  order,
  dueAt,
  now = 0,
}: {
  order: PriorityOrder;
  dueAt?: string | null;
  now?: number;
}) {
  const format = useFormatters(),
    { t } = useLocalization();
  return (
    <span>
      <Badge
        tone={
          order.priorityRank === 1
            ? "danger"
            : order.priorityRank === 2
            ? "warning"
            : "neutral"
        }
      >
        {t(order.priorityLabel ?? order.priority ?? "Priority not recorded")}
      </Badge>
      {dueAt && (
        <span title={format.dateTime(new Date(dueAt))}>
          {now
            ? t(priorityCountdown(dueAt, now, format.number))
            : format.dateTime(new Date(dueAt))}
        </span>
      )}
    </span>
  );
}
