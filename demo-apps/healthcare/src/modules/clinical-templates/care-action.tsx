"use client";
import React, { useRef, useState } from "react";
import {Modal, CardGrid, RecoveryNotice, failureFromError} from '@pepbits/components';
import {Button, DateInput, TimeInput, Select, Textarea} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {PatientCareRequest} from '../../domain/clinical-templates';
import type { ClinicalPageProps } from "./shared";
export function PatientCareAction({
  kind,
  patientId,
  adapter,
  metadata,
  onClose,
  onDone,
}: {
  kind: "appointment" | "encounter";
  patientId: string;
  adapter: ClinicalPageProps["adapter"];
  metadata: ClinicalPageProps["metadata"];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useLocalization(),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [time, setTime] = useState("09:00"),
    [provider, setProvider] = useState(metadata.providers[0]?.value ?? ""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    pending = useRef<PatientCareRequest | null>(null),
    lock = useRef(false);
  const edit = (fn: () => void) => {
    pending.current = null;
    setError(null);
    fn();
  };
  const save = async () => {
    if (lock.current || !metadata.canWrite) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    pending.current ??= {
      patientId,
      kind,
      date,
      time,
      provider,
      notes,
      operationId: crypto.randomUUID(),
    };
    try {
      await adapter.schedule(pending.current);
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t(`template.clinical.${kind}`)}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button
            variant="primary"
            disabled={!metadata.canWrite || !date || !time || !provider}
            loading={busy}
            onClick={() => void save()}
          >
            {t("template.clinical.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-muted)]">
          {t("template.clinical.careDemo")}
        </p>
        {error ? (
          <RecoveryNotice
            failure={failureFromError(error)}
            onRetry={() => void save()}
            preservesValues
          />
        ) : null}
        <CardGrid columns={2}>
          <DateInput
            label="template.clinical.date"
            value={date}
            disabled={busy}
            onChange={(e) => edit(() => setDate(e.target.value))}
          />
          <TimeInput
            label="template.clinical.time"
            value={time}
            disabled={busy}
            onChange={(e) => edit(() => setTime(e.target.value))}
          />
        </CardGrid>
        <Select
          label="template.clinical.provider"
          options={metadata.providers}
          value={provider}
          disabled={busy}
          onChange={(e) => edit(() => setProvider(e.target.value))}
        />
        <Textarea
          label="template.clinical.notes"
          value={notes}
          disabled={busy}
          onChange={(e) => edit(() => setNotes(e.target.value))}
        />
      </div>
    </Modal>
  );
}
