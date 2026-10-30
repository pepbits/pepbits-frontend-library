"use client";
import React, {useCallback, type ReactNode} from "react";
import {AsyncLookup, Button, cn} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useClinicalPort} from "../context/clinical-context";
import {TEXT} from "../layout/panel";
import type {CatalogItem, CatalogName} from "../types";

interface CodedSearchBaseProps {
  catalog: CatalogName; label: string; placeholder?: string; disabledCodes?: string[];
  renderMeta?: (item: CatalogItem) => ReactNode; invalid?: boolean; disabled?: boolean;
  limit?: number; category?: string;
}
export type CodedSearchProps = CodedSearchBaseProps & (
  {multiple?: false; onPick: (item: CatalogItem) => void; value?: never; onChange?: never} |
  {multiple: true; value: CatalogItem[]; onChange: (items: CatalogItem[]) => void; onPick?: (item: CatalogItem) => void}
);
const itemKey = (item: CatalogItem) => `${item.system}/${item.code}`;
/** Coded lookup; multiple mode is controlled, preserves payloads and exposes keyboard-accessible removal. */
export function CodedSearch(props: CodedSearchProps) {
  const {catalog, label, placeholder, disabledCodes = [], renderMeta, invalid, limit, category, disabled = false} = props;
  const port = useClinicalPort(), {t} = useLocalization();
  const load = useCallback((query: string, signal: AbortSignal) => port.searchCatalog(catalog, query, signal, {limit, category}), [port, catalog, limit, category]);
  const selected = props.multiple ? props.value : [];
  const unavailable = (item: CatalogItem) => disabledCodes.includes(item.code) || selected.some(x => itemKey(x) === itemKey(item));
  return <div>
    <AsyncLookup<CatalogItem> label={label} placeholder={placeholder} loadOptions={load} invalid={invalid} disabled={disabled}
      getKey={itemKey}
      onPick={item => {
        if (disabled || unavailable(item)) return;
        if (props.multiple) props.onChange([...props.value, item]);
        props.onPick?.(item);
      }}
      renderOption={(item, active) => <span className={cn("flex w-full items-center justify-between gap-3", unavailable(item) && "opacity-50", active && "font-bold")}>
        <span className="min-w-0"><span className="block truncate">{item.display}</span>{renderMeta ? <span className={cn("block", TEXT.muted)}>{renderMeta(item)}</span> : null}</span>
        <span className={cn("shrink-0 tabular-nums", TEXT.muted)}>{unavailable(item) ? t("Added") : item.code}</span>
      </span>}/>
    {props.multiple && props.value.length > 0 && <ul aria-label={t(label)} className="mt-2 flex flex-wrap gap-2">
      {props.value.map(item => <li key={itemKey(item)} className={TEXT.body}>
        <span>{item.display}</span><Button variant="ghost" size="sm" disabled={disabled} aria-label={`${t("Remove")} ${item.display}`}
          onClick={() => {if (!disabled) props.onChange(props.value.filter(x => itemKey(x) !== itemKey(item)));}}>{t("Remove")}</Button>
      </li>)}
    </ul>}
  </div>;
}
