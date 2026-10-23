"use client";
import React, {useState, useId} from "react";
import {Input, StatusBadge} from "@pepbits/ui";
import {DataValue} from "@pepbits/components";
import {LocalizationAliasProvider, LocalizationProvider, LocalizedText, useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";

export function LocalizationDemo() {
  const locale = useLocalization();
  const format = useFormatters();
  return <LocalizationProvider value={locale}><div dir={locale.direction} className="space-y-3"><LocalizedText message="catalog.localizationHint"/>
    <LocalizationAliasProvider aliases={{Name:"ui.common.name"}}><Input label="Name"/></LocalizationAliasProvider><StatusBadge value="Active"/><DataValue value={1234.5} format={format.number}/></div></LocalizationProvider>;
}

