"use client";
import React, {useState, useId} from "react";
import {Button} from "@pepbits/ui";
import {ReferenceDataWarning, ReferenceField} from "@pepbits/components";
import {LocalizedText} from "@pepbits/i18n/react";

export function ReferenceDemo() {
  const [failed, setFailed] = useState(true);
  const [value, setValue] = useState("");
  return <div className="space-y-3">
    <ReferenceDataWarning failures={failed ? [{key:"status",code:"network"}] : []} labels={{status:"Status"}} onRetry={() => setFailed(false)} />
    <ReferenceField label="Status" state={failed ? "failed" : "ready"} value={value} onChange={setValue} options={[{value:"active",label:"Active"}]} />
    <Button onClick={() => setFailed(true)}><LocalizedText message="catalog.simulateFailure" /></Button>
  </div>;
}

