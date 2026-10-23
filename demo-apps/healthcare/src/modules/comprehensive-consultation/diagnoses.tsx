"use client";
import React, { useState } from "react";
import {Button, Input, Select, Badge} from '@pepbits/ui';
import {CardGrid} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import { ClinicLedgerTable } from "../clinic-billing/parts";
import { Panel, Hint, key, type ComprehensiveProps } from "./shared";
export function DiagnosisPanel(p: ComprehensiveProps) {
  const { t } = useLocalization(),
    [system, setSystem] = useState(""),
    [code, setCode] = useState(""),
    [description, setDescription] = useState(""),
    [error, setError] = useState("");
  const add = () => {
    if (p.disabled) return;
    if (
      !system ||
      !code.trim() ||
      !description.trim() ||
      p.values.diagnoses.some(
        (d) =>
          d.system === system &&
          d.code.toUpperCase() === code.trim().toUpperCase(),
      )
    ) {
      setError(key("invalid"));
      return;
    }
    p.change("diagnoses", [
      ...p.values.diagnoses,
      {
        id: crypto.randomUUID(),
        system,
        code: code.trim(),
        description: description.trim(),
        primary: !p.values.diagnoses.length,
      },
    ]);
    setCode("");
    setDescription("");
    setError("");
  };
  return (
    <Panel title={key("coding")}>
      <Hint message={key("codingHint")} />
      <CardGrid columns={3}>
        <Select
          label={key("system")}
          options={p.config.codeSystems}
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          disabled={p.disabled}
        />
        <Input
          label={key("code")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={80}
          disabled={p.disabled}
        />
        <Input
          label={key("description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          disabled={p.disabled}
        />
      </CardGrid>
      <Button
        name="diagnoses"
        onClick={add}
        disabled={p.disabled || p.values.diagnoses.length >= 30}
      >
        {t(key("addDiagnosis"))}
      </Button>
      {error || p.errors.diagnoses ? (
        <p role="alert">{t(error || p.errors.diagnoses || "")}</p>
      ) : null}
      {p.preferences ? (
        <ClinicLedgerTable
          preferences={p.preferences}
          headers={[
            key("code"),
            key("description"),
            key("primary"),
            key("edit"),
          ]}
          rows={p.values.diagnoses.map((d) => ({
            id: d.id,
            cells: [
              <span>
                {d.system} · {d.code}
              </span>,
              d.description,
              d.primary ? (
                <Badge>{t(key("primary"))}</Badge>
              ) : (
                <Button
                  size="xs"
                  disabled={p.disabled}
                  onClick={() =>
                    p.change(
                      "diagnoses",
                      p.values.diagnoses.map((row) => ({
                        ...row,
                        primary: row.id === d.id,
                      })),
                    )
                  }
                >
                  {t(key("makePrimary"))}
                </Button>
              ),
              <Button
                size="xs"
                disabled={p.disabled}
                onClick={() => {
                  if (p.values.orders.some((o) => o.diagnosisId === d.id)) {
                    setError(key("linkedWarning"));
                    return;
                  }
                  const remaining = p.values.diagnoses.filter(
                    (row) => row.id !== d.id,
                  );
                  p.change(
                    "diagnoses",
                    d.primary
                      ? remaining.map((row, i) => ({
                          ...row,
                          primary: i === 0,
                        }))
                      : remaining,
                  );
                  setError("");
                }}
              >
                {t(key("remove"))}
              </Button>,
            ],
          }))}
        />
      ) : null}
    </Panel>
  );
}
