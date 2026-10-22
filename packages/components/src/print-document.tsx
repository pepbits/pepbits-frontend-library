"use client";
import React from "react";
import { createPortal } from "react-dom";
/** Host-controlled print surface. No data fetching, formatting or authorization. */
export function PrintDocument({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="ops-print-document">
      <style>{`.ops-print-document{display:none}@media print{body:has(>.ops-print-document)>:not(.ops-print-document){display:none!important}body>.ops-print-document{display:block!important;color:#000;background:#fff;padding:12mm;font:12pt sans-serif;overflow-wrap:anywhere}body>.ops-print-document section{break-inside:avoid}body>.ops-print-document h2{margin-top:8mm}}`}</style>
      {children}
    </div>,
    document.body,
  );
}
