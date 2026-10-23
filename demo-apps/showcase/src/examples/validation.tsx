"use client";
import React, {useState, useId} from "react";
import {FieldShell, Input} from "@pepbits/ui";
import {FormErrorSummary} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";

export function ValidationDemo() {
  const {t} = useLocalization();
  const [value, setValue] = useState("");
  return <div className="space-y-3">
    <Input label="Name" required value={value} onChange={e => setValue(e.target.value)} error={!value.trim() ? "Required" : undefined} />
    <FormErrorSummary title={t("Required")} errors={value.trim()?[]:[{id:"name",label:t("Name"),message:t("Required")}]}/><Input label="Record ID" value="DEMO-001" readOnly />
    <Input label="Status" value={t("Disabled")} disabled />
    <FieldShell label="Progress" hint="catalog.fieldShellHint">{describedBy => <progress aria-label={t("Progress")} aria-describedby={describedBy} value={60} max={100} />}</FieldShell>
  </div>;
}

