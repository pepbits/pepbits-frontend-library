"use client";
import React, { useCallback, useRef, useState } from "react";
import { Button, Badge } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
import { useConsultHost, useConsultPort } from "../context/consult-host";
import { problemsOf } from "../context/port";
import { ProblemNotice } from "../layout/panel";
import { OrderLoadProblems, useOrderResource } from "./OrderPriority";
export function IssuedCertificates({
  encounterId,
  signed,
  canSend = false,
  onRecordsChanged,
}: {
  encounterId: string;
  signed: boolean;
  canSend?: boolean;
  onRecordsChanged?: () => void | Promise<void>;
}) {
  const port = useConsultPort(),
    host = useConsultHost(),
    { t } = useLocalization(),
    format = useFormatters();
  const resource = useOrderResource(
    useCallback(
      (signal: AbortSignal) =>
        signed
          ? port.listCertificates(encounterId, signal)
          : Promise.resolve(null),
      [port, encounterId, signed]
    )
  );
  const [busy, setBusy] = useState(false),
    [problems, setProblems] = useState<string[]>([]),
    writing = useRef(false);
  const send = async (id: string) => {
    if (!canSend || writing.current) return;
    writing.current = true;
    setBusy(true);
    setProblems([]);
    try {
      await port.resendCertificate(id);
      resource.retry();
      await onRecordsChanged?.();
    } catch (error) {
      setProblems(problemsOf(error));
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  if (!signed) return null;
  return (
    <div>
      <OrderLoadProblems {...resource} />
      <ProblemNotice problems={problems} />
      <ul>
        {resource.data?.certificates.map((c) => (
          <li key={c.id}>
            <p>
              {c.number} · {format.number(c.days)} {t("days")} ·{" "}
              {format.date(new Date(c.from + "T12:00:00"))} –{" "}
              {format.date(new Date(c.to + "T12:00:00"))}
            </p>
            <Badge>{t(c.portal.status)}</Badge>
            {c.portal.reference && <p>{c.portal.reference}</p>}
            {c.portal.error && <ProblemNotice problems={[c.portal.error]} />}
            {host.renderLink(
              { kind: "certificate", certificateId: c.id },
              { children: t("Print"), newTab: true }
            )}
            {canSend &&
              resource.data?.portalConfigured &&
              ["rejected", "failed", "queued"].includes(c.portal.status) && (
                <Button disabled={busy} onClick={() => void send(c.id)}>
                  {t("Send again")}
                </Button>
              )}
          </li>
        ))}
      </ul>
    </div>
  );
}
