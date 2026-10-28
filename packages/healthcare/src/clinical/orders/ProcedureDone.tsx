"use client";
import React, { useRef, useState } from "react";
import { Button, Input, Select } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useConsultPort } from "../context/consult-host";
import { problemsOf } from "../context/port";
import { ProblemNotice } from "../layout/panel";
/** Local projection: completion metadata is not exposed on the frozen consultation order DTO. */
export interface ProcedureOrder {
  id: string;
  status: string;
  display: string;
  completedAt?: string;
  performedByName?: string;
  outcome?: string;
  details?: { timing?: string; consentRequired?: boolean; specialty?: string };
}
export function ProcedureDone({
  encounterId,
  order,
  canWrite,
  onDone,
  onBusyChange,
}: {
  encounterId: string;
  order: ProcedureOrder;
  canWrite: boolean;
  onDone: () => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const port = useConsultPort(),
    { t } = useLocalization(),
    format = useFormatters();
  const [open, setOpen] = useState(false),
    [outcome, setOutcome] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [problems, setProblems] = useState<string[]>([]);
  const writing = useRef(false);
  const save = async () => {
    if (
      !canWrite ||
      writing.current ||
      (order.details?.consentRequired && !consent)
    )
      return;
    writing.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setProblems([]);
    try {
      await port.completeProcedure(encounterId, order.id, {
        outcome,
        consentConfirmed: consent,
      });
      setOpen(false);
      await onDone();
    } catch (error) {
      setProblems(problemsOf(error));
    } finally {
      writing.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  if (order.status === "completed")
    return (
      <p>
        {t("Done")}{" "}
        {order.completedAt && format.dateTime(new Date(order.completedAt))}{" "}
        {order.performedByName} {order.outcome}
      </p>
    );
  if (!canWrite || !["active", "on-hold"].includes(order.status)) return null;
  return (
    <div>
      <ProblemNotice problems={problems} />
      {!open ? (
        <Button onClick={() => setOpen(true)}>{t("Mark done")}</Button>
      ) : (
        <>
          <Input
            label="Outcome"
            disabled={busy}
            maxLength={2000}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          />
          {order.details?.consentRequired && (
            <Select
              label="The patient's consent was obtained"
              disabled={busy}
              value={consent ? "yes" : "no"}
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes" },
              ]}
              onChange={(e) => setConsent(e.target.value === "yes")}
            />
          )}
          <Button disabled={busy} onClick={() => setOpen(false)}>
            {t("Cancel")}
          </Button>
          <Button
            disabled={busy || (!!order.details?.consentRequired && !consent)}
            onClick={() => void save()}
          >
            {t("Record as done")}
          </Button>
        </>
      )}
    </div>
  );
}
