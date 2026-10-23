"use client";
import React from "react";
import { usePresentationPreferences } from "./presentation";
import { cn } from "@pepbits/ui";

/** Semantic building blocks shared by static, editable, grouped and reporting tables.
 * Cell content, sorting, selection and persistence belong to the consuming controller.
 * No extra DOM wrappers: printing, classification attributes and sticky cells survive.
 */
export function Table({ className, density, striped, bordered, stickyHeader, ...props }: React.ComponentProps<"table"> & {
  density?: "compact" | "comfortable" | "spacious";
  striped?: boolean;
  bordered?: boolean;
  stickyHeader?: boolean;
}) {
  const managed = usePresentationPreferences();
  if (managed) {
    density = managed.density;
    striped = managed.zebraStripes;
    stickyHeader = managed.stickyTableHeader;
  }
  return <table {...props} data-managed-table={managed ? "true" : undefined}
    data-density={density} data-striped={striped ? "true" : "false"}
    data-wrap={managed ? String(managed.wrapCellText) : undefined}
    data-sticky={stickyHeader ? "true" : "false"}
    style={{...props.style, "--fs-scale": "var(--fs-result)"} as React.CSSProperties} className={cn(className,
    density === "compact" && "[&_th]:px-3 [&_th]:py-1 [&_td]:px-3 [&_td]:py-1",
    density === "comfortable" && "[&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3",
    density === "spacious" && "[&_th]:px-4 [&_th]:py-4 [&_td]:px-4 [&_td]:py-4",
    striped && "[&_tbody_tr:nth-child(even)]:bg-[var(--surface-2)]",
    bordered && "[&_th]:border [&_td]:border [&_th]:border-[var(--border)] [&_td]:border-[var(--border)]",
    stickyHeader && "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-[var(--surface-2)]"
  )} />;
}
export function TableHeader(props: React.ComponentProps<"thead">) { return <thead {...props} />; }
export function TableBody(props: React.ComponentProps<"tbody">) { return <tbody {...props} />; }
export function TableFooter(props: React.ComponentProps<"tfoot">) { return <tfoot {...props} />; }
/** A row action is keyboard reachable; nested controls keep their own activation. */
export function TableRow({onClick,onKeyDown,tabIndex,...props}: React.ComponentProps<"tr">) {
  return <tr {...props} onClick={onClick} tabIndex={tabIndex??(onClick?0:undefined)} onKeyDown={event=>{
    onKeyDown?.(event);
    if(onClick&&!event.defaultPrevented&&event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.currentTarget.click();}
  }}/>;
}
export function TableHead(props: React.ComponentProps<"th">) { return <th {...props} />; }
export function TableCell(props: React.ComponentProps<"td">) { return <td {...props} />; }
export function TableCaption(props: React.ComponentProps<"caption">) { return <caption {...props} />; }
export function TableContainer({ className, overflow = "both", tabIndex, ...props }: React.ComponentProps<"div"> & { overflow?: "both" | "horizontal" | "hidden" }) {
  return <div {...props} tabIndex={tabIndex??(overflow==="hidden"?undefined:0)} className={cn("nex-scrollbar", overflow === "both" && "overflow-auto", overflow === "horizontal" && "overflow-x-auto", overflow === "hidden" && "overflow-hidden", className)} />;
}
