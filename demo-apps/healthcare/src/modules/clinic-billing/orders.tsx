"use client";
import React from "react";
import {Badge, Button, Checkbox, Input, Select} from '@pepbits/ui';
import {CardGrid} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import type {ClinicBillingView, ClinicBillingCommand} from '../../domain/clinic-billing';
import type {Formatters} from '@pepbits/i18n';
import type {UserPreferences} from '@pepbits/preferences';
import { ClinicLedgerTable, ClinicPanel } from "./parts";
export function ClinicOrders({
  data,
  selected,
  onSelect,
  disabled,
  onCommand,
  format,
  preferences,
  service,
  onService,
  quantity,
  onQuantity,
  doctor,
  onDoctor,
}: {
  data: ClinicBillingView;
  selected: string[];
  onSelect: (ids: string[]) => void;
  disabled: boolean;
  onCommand: (c: ClinicBillingCommand) => void;
  format: Formatters;
  preferences: UserPreferences;
  service: string;
  onService: (v: string) => void;
  quantity: string;
  onQuantity: (v: string) => void;
  doctor: string;
  onDoctor: (v: string) => void;
}) {
  const { t } = useLocalization(),
    prescribed = data.state.orders.filter(
      (o) => o.status === "prescribed" && selected.includes(o.id),
    );
  return (
    <ClinicPanel
      title="template.clinic.orders"
      action={
        <Button
          disabled={disabled || !prescribed.length}
          onClick={() =>
            onCommand({
              action: "order",
              orderIds: prescribed.map((o) => o.id),
            })
          }
        >
          {t("template.clinic.toOrder")}
        </Button>
      }
    >
      <p className="text-sm text-[var(--text-muted)]">
        {t("template.clinic.ordersHint")}
      </p>
      <ClinicLedgerTable
        preferences={preferences}
        headers={[
          "template.clinic.select",
          "template.clinic.service",
          "template.clinic.doctor",
          "template.clinic.date",
          "template.clinic.quantity",
          "template.clinic.status",
        ]}
        rows={data.state.orders.map((o) => ({
          id: o.id,
          cells: [
            <Checkbox
              aria-label={t(o.label)}
              checked={selected.includes(o.id)}
              disabled={disabled || o.status === "billed"}
              onChange={(e) =>
                onSelect(
                  e.target.checked
                    ? [...selected, o.id]
                    : selected.filter((id) => id !== o.id),
                )
              }
            />,
            <div>
              <strong>{t(o.label)}</strong>
              <p className="text-xs text-[var(--text-muted)]">{t(o.detail)}</p>
              {o.sourceId ? <Badge>{o.sourceId}</Badge> : null}
            </div>,
            o.doctor || "—",
            format.date(o.date),
            format.number(o.quantity),
            <Badge
              tone={
                o.status === "billed"
                  ? "success"
                  : o.status === "prescribed"
                    ? "warning"
                    : "brand"
              }
            >
              {t("template.clinic.status." + o.status)}
            </Badge>,
          ],
        }))}
      />
      <CardGrid columns={4}>
        <Select
          label="template.clinic.service"
          value={service}
          options={[
            { value: "", label: "template.clinical.select" },
            ...data.services.map((s) => ({ value: s.id, label: s.label })),
          ]}
          disabled={disabled}
          onChange={(e) => onService(e.target.value)}
        />
        <Input
          label="template.clinic.quantity"
          type="number"
          min={1}
          max={100}
          step={1}
          value={quantity}
          disabled={disabled}
          onChange={(e) => onQuantity(e.target.value)}
        />
        <Input
          label="template.clinic.doctor"
          value={doctor}
          disabled={disabled}
          onChange={(e) => onDoctor(e.target.value)}
        />
        <div className="flex items-end">
          <Button
            disabled={
              disabled ||
              !service ||
              !doctor.trim() ||
              !Number.isInteger(Number(quantity)) ||
              Number(quantity) < 1 ||
              Number(quantity) > 100
            }
            onClick={() =>
              onCommand({
                action: "add",
                serviceId: service,
                quantity: Number(quantity),
                doctor,
              })
            }
          >
            {t("template.clinic.addService")}
          </Button>
        </div>
      </CardGrid>
    </ClinicPanel>
  );
}
