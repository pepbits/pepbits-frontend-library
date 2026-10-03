"use client";
/**
 * Native-layout controls for the imported Teleconsult designs. They are the shared ops-ui Source*
 * primitives (localized labels, ref and accessibility contract); the imported class names supply the
 * source appearance inside the scoped .teleconsult-provider / .teleconsult-patient styles.
 */
import { SourceDateInput } from "@pepbits/ops-ui";
import type { ComponentPropsWithRef } from "react";
import { useTeleconsultFormat } from "./format";

export {
  SourceButton,
  SourceInput,
  SourceDateInput,
  SourceSelect,
  SourceTextarea,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@pepbits/ops-ui";

/**
 * The shared native date field plus the chosen date written in the user's effective date format. The native
 * control keeps ISO values and its picker, but the browser draws its text in the device locale; the line
 * under it is what follows the host preference (format, language), so the date reads the same as everywhere else.
 */
export function SourceDateField({ value, ...props }: Omit<ComponentPropsWithRef<"input">, "type">) {
  const { fmtDate } = useTeleconsultFormat();
  const iso = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  return (
    <span className="block">
      <SourceDateInput {...props} value={value} />
      {iso && <span data-date-preview="true" className="mt-0.5 block text-xs tabular opacity-70">{fmtDate(iso)}</span>}
    </span>
  );
}
