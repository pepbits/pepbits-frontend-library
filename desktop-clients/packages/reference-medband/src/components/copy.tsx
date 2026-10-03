"use client";
import type { ReactNode } from "react";
import { LocalizedText } from "@pepbits/ops-ui";

/** Copy handed to a source component as a plain string is localized here; nodes (values, links) pass through unchanged. Record data that is not in the catalog passes through as written. */
export function Copy({ children }: { children?: ReactNode }) {
  return typeof children === "string" ? <LocalizedText message={children} /> : <>{children}</>;
}
