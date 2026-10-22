import React from "react";
import { cn } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";

/** Business values are never translated. Supply the application's preference-aware
 * formatter for money, dates, percentages and numbers instead of duplicating it. */
export function DataValue<T>({ value, format, empty = "—", numeric, wrap, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & {
  value: T | null | undefined;
  format?: (value: T) => string;
  empty?: string;
  numeric?: boolean;
  wrap?: boolean;
}) {
  const text = value === null || value === undefined || value === "" ? empty : format ? format(value) : String(value);
  return <span {...props} title={props.title ?? (wrap ? undefined : text)} className={cn(numeric && "tabular-nums", wrap ? "whitespace-normal break-words" : "truncate", className)}>{text}</span>;
}

export interface DescriptionItem { id: string; label: string; value: React.ReactNode; }
export function DescriptionList({ items, layout = "inline", className, itemClassName, termClassName, valueClassName, ...props }: React.ComponentProps<"dl"> & {
  items: DescriptionItem[];
  layout?: "inline" | "stacked" | "rows";
  itemClassName?: string;
  termClassName?: string;
  valueClassName?: string;
}) {
  const { t } = useLocalization();
  return <dl {...props} className={cn(layout === "inline" ? "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-4 gap-y-2" : "grid", className)}>{items.map(item => {
    const pair = <><dt className={termClassName ?? "text-[var(--text-muted)]"}>{t(item.label)}</dt><dd className={valueClassName ?? "min-w-0 break-words"}>{item.value}</dd></>;
    return layout === "inline" ? <React.Fragment key={item.id}>{pair}</React.Fragment> : <div key={item.id} className={cn(layout === "rows" && "flex justify-between gap-3", itemClassName)}>{pair}</div>;
  })}</dl>;
}
