"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button, Textarea } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useClinicalPort } from "../context/clinical-context";
import { problemsOf } from "../context/port";
import { ProblemNotice } from "../layout/panel";
import type {
  MedicationOrder,
  SubstitutionDecisionInput,
} from "../models/consult-orders";
export function SubstitutionDecision({
  encounterId,
  order,
  disabled,
  onRecordsChanged,
  onBusyChange,
}: {
  encounterId: string;
  order: MedicationOrder;
  disabled: boolean;
  onRecordsChanged?: () => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { domain } = useClinicalPort(),
    { t } = useLocalization();
  const [note, setNote] = useState(""),
    [pending, setPending] = useState<SubstitutionDecisionInput | null>(null),
    [busy, setBusy] = useState(false),
    [problems, setProblems] = useState<string[]>([]);
  const writing = useRef(false);
  useEffect(() => {
    onBusyChange?.(busy || !!pending || !!note.trim());
    return () => onBusyChange?.(false);
  }, [busy, pending, note, onBusyChange]);
  const send = async (input: SubstitutionDecisionInput) => {
    if (
      disabled ||
      !domain ||
      writing.current ||
      order.substitution?.status !== "pending-prescriber"
    )
      return;
    writing.current = true;
    setBusy(true);
    setProblems([]);
    try {
      await domain.decideSubstitution(encounterId, order.id, input);
      setPending(null);
      setNote("");
      await onRecordsChanged?.();
    } catch (error) {
      setProblems(problemsOf(error));
      const status = (error as { status?: number }).status;
      setPending(status && status < 500 ? null : input);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  if (order.substitution?.status !== "pending-prescriber") return null;
  if (!domain)
    return (
      <p role="status">
        {t("Prescriber substitution decisions are unavailable.")}
      </p>
    );
  return (
    <div>
      <p>
        {order.substitution.reasonLabel}: {order.substitution.note}
      </p>
      {order.substitution.allergyConflicts.map((c) => (
        <p role="alert" key={c.allergyId}>
          {t(c.message)}
        </p>
      ))}
      {order.substitution.alerts.map((a, i) => (
        <p role={a.severity === "high" ? "alert" : "status"} key={i}>
          {t(a.message)}
        </p>
      ))}
      {order.substitution.overrideReason && (
        <p>
          {t("Safety override reason")}: {order.substitution.overrideReason}
        </p>
      )}
      {order.substitution.approvalReasons.map((reason) => (
        <p key={reason}>
          {t("Needs prescriber approval")}: {t(reason)}
        </p>
      ))}
      <p>
        {order.substitution.from.display} → {order.substitution.to.display}:{" "}
        {order.substitution.to.dose} {order.substitution.to.route}
      </p>
      <p>
        {t(
          "Approval signs the proposed medicine, dose and route with the documented safety override. Safety checks run again when you decide."
        )}
      </p>
      <Textarea
        label="Prescriber decision note"
        disabled={disabled || busy || !!pending}
        value={note}
        minLength={10}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
      />
      <ProblemNotice problems={problems} />
      {pending ? (
        <Button disabled={disabled || busy} onClick={() => void send(pending)}>
          {t("Retry previous substitution action")}
        </Button>
      ) : (
        (["approve", "reject"] as const).map((decision) => (
          <Button
            key={decision}
            disabled={
              disabled ||
              busy ||
              note.trim().length < 10 ||
              order.version == null
            }
            onClick={() => {
              if (note.trim().length >= 10 && order.version != null)
                void send({
                  version: order.version,
                  decision,
                  note,
                  requestId: crypto.randomUUID(),
                });
            }}
          >
            {t(
              decision === "approve"
                ? "Approve substitution"
                : "Reject substitution"
            )}
          </Button>
        ))
      )}
    </div>
  );
}
