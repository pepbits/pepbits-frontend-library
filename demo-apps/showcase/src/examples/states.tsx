"use client";
import React, {useState, useId} from "react";
import {Select} from "@pepbits/ui";
import {AccessDenied, ConflictState, EmptyState, ErrorState, LoadingState, NotFoundState, SessionExpiredState} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";

export function StatesDemo() {
  const {t} = useLocalization();
  const [state,setState] = useState("empty");
  const [count,setCount] = useState(0);
  const action = () => setCount(count+1);
  return <div className="space-y-3">
    <Select label="Status" value={state} onChange={e => setState(e.target.value)} options={[{value:"empty",label:"EmptyState"},{value:"error",label:"ErrorState"},{value:"denied",label:"AccessDenied"},{value:"missing",label:"NotFoundState"},{value:"conflict",label:"ConflictState"},{value:"session",label:"SessionExpiredState"},{value:"loading",label:"LoadingState"}]}/>
    {state === "empty" ? <EmptyState/> : state === "error" ? <ErrorState onRetry={action} referenceId="DEMO-001"/> : state === "denied" ? <AccessDenied/> : state === "missing" ? <NotFoundState/> : state === "conflict" ? <ConflictState onReload={action}/> : state === "session" ? <SessionExpiredState onSignIn={action}/> : <LoadingState/>}
    <output aria-live="polite">{t("catalog.actionCount",{count})}</output>
  </div>;
}

