"use client";
import React, {useState, useId} from "react";
import {Checkbox, Radio, RadioGroup, RangeField, RangeInput, Select, SignaturePad, Toggle} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";

export function ChoiceDemo() {
  const groupName = useId();
  const {t} = useLocalization();
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [choice, setChoice] = useState("active");
  const [amount, setAmount] = useState(40);
  const [signature, setSignature] = useState<string | null>(null);
  return <div className="space-y-4">
    <Checkbox label="Select" checked={checked} onChange={e => setChecked(e.target.checked)} />
    <Checkbox label="Selected" indeterminate checked={false} readOnly />
    <fieldset className="space-y-2"><legend>{t("Status")}</legend>
      <Radio label="Active" name={groupName} checked={choice === "active"} onChange={() => setChoice("active")} />
      <Radio label="Inactive" name={groupName} checked={choice === "inactive"} onChange={() => setChoice("inactive")} />
    </fieldset>
    <RadioGroup label="Status" options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]} value={choice} onChange={setChoice}/><RangeField label="Amount" min={0} max={100} value={amount} onChange={value=>setAmount(value??0)} disabled={!enabled}/><Toggle label="Enabled" checked={enabled} onChange={setEnabled} />
    <RangeInput label="Progress" min={0} max={100} value={amount} onChange={setAmount} unit="%" />
    <SignaturePad label="Signature" hint="Fictional example; nothing is stored" value={signature} onChange={setSignature} />
  </div>;
}

