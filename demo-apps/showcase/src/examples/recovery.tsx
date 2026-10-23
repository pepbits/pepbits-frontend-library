"use client";
import React, {useState, useId} from "react";
import {Button, Input} from "@pepbits/ui";
import {RecoveryNotice, failureFromError} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";

export function RecoveryDemo() {
  const {t} = useLocalization();
  const [failed,setFailed] = useState(true);
  const [value,setValue] = useState("");
  return <div className="space-y-3"><Input label="Notes" value={value} onChange={e => setValue(e.target.value)}/>
    {failed ? <RecoveryNotice failure={failureFromError({status:408,reference:"DEMO-001"})} preservesValues onRetry={() => setFailed(false)}/> : <p role="status">{t("catalog.recovered")}</p>}
    <Button onClick={() => setFailed(true)}>{t("catalog.simulateFailure")}</Button>
  </div>;
}

