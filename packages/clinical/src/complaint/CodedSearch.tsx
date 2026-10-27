"use client";
import React, {useCallback, type ReactNode} from "react";
import {AsyncLookup, cn} from "@pepbits/ui";
import {useClinicalPort} from "../context/clinical-context";
import {TEXT} from "../layout/panel";
import type {CatalogItem, CatalogName} from "../types";

/** Searchable coded lookup bound to a catalogue; the picked item keeps code, system and display together. */
export function CodedSearch({catalog, label, placeholder, onPick, disabledCodes = [], renderMeta, invalid}: {
  catalog: CatalogName; label: string; placeholder?: string; onPick: (item: CatalogItem) => void;
  disabledCodes?: string[]; renderMeta?: (item: CatalogItem) => ReactNode; invalid?: boolean;
}) {
  const port = useClinicalPort();
  const load = useCallback((query: string, signal: AbortSignal) => port.searchCatalog(catalog, query, signal), [port, catalog]);
  return <AsyncLookup<CatalogItem> label={label} placeholder={placeholder} loadOptions={load} invalid={invalid}
    getKey={item => `${item.system}/${item.code}`}
    onPick={item => { if (!disabledCodes.includes(item.code)) onPick(item); }}
    renderOption={(item, active) => <span className={cn("flex w-full items-center justify-between gap-3", disabledCodes.includes(item.code) && "opacity-50", active && "font-bold")}>
      <span className="min-w-0"><span className="block truncate">{item.display}</span>{renderMeta ? <span className={cn("block", TEXT.muted)}>{renderMeta(item)}</span> : null}</span>
      <span className={cn("shrink-0 tabular-nums", TEXT.muted)}>{disabledCodes.includes(item.code) ? "Added" : item.code}</span>
    </span>}/>;
}
