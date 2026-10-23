"use client";
import React, {useState, useId} from "react";
import {Button, IconButton} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {Plus} from "@pepbits/icons";

export function ButtonsDemo() {
  const {t} = useLocalization();
  const [count, setCount] = useState(0);
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">
    {(["primary","secondary","outline","ghost","success","danger"] as const).map(variant => <Button key={variant} variant={variant} onClick={() => setCount(count+1)}>{variant}</Button>)}
    <IconButton label="Add" onClick={() => setCount(count+1)}><Plus className="size-4"/></IconButton>
    <Button disabled>{t("Disabled")}</Button><Button loading>{t("Loading…")}</Button>
    </div><output aria-live="polite">{t("catalog.actionCount",{count})}</output></div>;
}

