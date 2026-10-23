"use client";
import React, { useState } from "react";
import {Modal, CardGrid} from '@pepbits/components';
import {Button, Input, Select, Textarea, Checkbox, DateInput, TimeInput} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type {RegistrationConfig} from '../../domain/op-registration';
import { rk } from "./components";
export function RegistrationActionDialog({
  action,
  initial,
  config,
  busy,
  onClose,
  onConfirm,
}: {
  action: string;
  initial: Record<string, string | number | boolean>;
  config: RegistrationConfig;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: Record<string, string | number | boolean>) => void;
}) {
  const { t } = useLocalization(),
    [payload, setPayload] = useState<Record<string, string | number | boolean>>(
      { ...initial, confirm: false },
    ),
    change = (key: string, value: string | boolean) =>
      setPayload((p) => ({ ...p, [key]: value }));
  const note = ![
      "sign",
      "complete",
      "book-followup",
      "claim",
      "discard",
    ].includes(action),
    labels: Record<string, string> = {
      "order-add": "addOrder",
      "order-complete": "finish",
      "order-cancel": "cancelOrder",
      "resolve-consent": "resolveConsent",
      "book-followup": "bookFollowup",
      urgent: "urgentHandoff",
    };
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={rk(labels[action] ?? action)}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {t(rk("cancel"))}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => onConfirm(payload)}
          >
            {t(rk("confirm"))}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p>{t(rk(action === "urgent" ? "handoffHint" : "demo"))}</p>
        {action === "order-add" ? (
          <>
            <Select
              label={rk("service")}
              value={String(payload.serviceId ?? "")}
              options={[
                { value: "", label: rk("select") },
                ...config.services.map((s) => ({
                  value: s.id,
                  label: s.label,
                })),
              ]}
              onChange={(e) => change("serviceId", e.target.value)}
            />
            <Input
              label={rk("site")}
              value={String(payload.site ?? "")}
              onChange={(e) => change("site", e.target.value)}
            />
          </>
        ) : null}
        {action === "discount" ? (
          <Input
            label={rk("amount")}
            type="number"
            min="0"
            step="0.01"
            value={String(payload.amount ?? "")}
            onChange={(e) => change("amount", e.target.value)}
          />
        ) : null}
        {action === "payment" ? (
          <CardGrid columns={2}>
            <Input
              label={rk("amount")}
              type="number"
              min="0.01"
              step="0.01"
              value={String(payload.amount ?? "")}
              onChange={(e) => change("amount", e.target.value)}
            />
            <Select
              label={rk("method")}
              value={String(payload.method ?? "")}
              options={[
                { value: "", label: rk("select") },
                ...["cash", "card", "transfer-payment"].map((value) => ({
                  value,
                  label: rk(value),
                })),
              ]}
              onChange={(e) => change("method", e.target.value)}
            />
          </CardGrid>
        ) : null}
        {action === "book" ? (
          <CardGrid columns={2}>
            <DateInput
              label={rk("appointmentDate")}
              min={config.today}
              value={String(payload.date ?? "")}
              onChange={(e) => change("date", e.target.value)}
            />
            <TimeInput
              label={rk("appointmentTime")}
              value={String(payload.time ?? "")}
              onChange={(e) => change("time", e.target.value)}
            />
            <Select
              label={rk("provider")}
              value={String(payload.provider ?? "")}
              options={[
                { value: "", label: rk("select") },
                ...config.providers.map((p) => ({
                  value: p.id,
                  label: p.name,
                })),
              ]}
              onChange={(e) => change("provider", e.target.value)}
            />
          </CardGrid>
        ) : null}
        {action === "order-complete" && initial.category === "medication" ? (
          <CardGrid columns={2}>
            <Input
              label={rk("batch")}
              value={String(payload.batch ?? "")}
              onChange={(e) => change("batch", e.target.value)}
            />
            <DateInput
              label={rk("medExpiry")}
              min={config.today}
              value={String(payload.expiry ?? "")}
              onChange={(e) => change("expiry", e.target.value)}
            />
          </CardGrid>
        ) : null}
        {note ? (
          <Textarea
            label={rk(
              action === "order-add"
                ? "indication"
                : action === "urgent"
                  ? "handoffNote"
                  : "reasonText",
            )}
            value={String(payload.note ?? "")}
            onChange={(e) => change("note", e.target.value)}
          />
        ) : null}
        {[
          "sign",
          "order-add",
          "order-complete",
          "resolve-consent",
          "urgent",
        ].includes(action) ? (
          <Checkbox
            label={rk(action === "urgent" ? "handoffExternal" : "safety")}
            checked={payload.confirm === true}
            onChange={(e) => change("confirm", e.target.checked)}
          />
        ) : null}
      </div>
    </Modal>
  );
}
