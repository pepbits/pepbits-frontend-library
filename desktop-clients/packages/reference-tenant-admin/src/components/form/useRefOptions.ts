"use client";
import { useMemo } from "react";
import { useLocalization } from "@pepbits/ops-ui";
import { useApi } from "../../lib/api";
import { STATUS_LABEL } from "../../lib/format";
import type { RefOption } from "../../lib/types";
import type { ComboItem } from "../ui/Combobox";

/**
 * Options for a reference field (`GET /resources/<key>/options`). They live in the scope-keyed data store, not in a module-level
 * cache: another tenant, branch or user never sees them, a response for an earlier request is dropped, and a mutation that
 * refreshes the store re-reads them (the source's cachedOptions/invalidateOptions pair).
 */
export function useRefOptions(resource?: string) {
  const { t } = useLocalization();
  const { data, isLoading } = useApi<RefOption[]>(resource ? `/resources/${encodeURIComponent(resource)}/options` : null, { revalidateOnFocus: false });
  const items = useMemo<ComboItem[]>(() => (data ?? []).map((r) => ({
    value: String(r.id),
    label: `${r.name}`,
    hint: `${r.code}${r.revision > 1 ? ` r${r.revision}` : ""}${["APPROVED", "ACTIVE"].includes(r.status) ? "" : `, ${t(STATUS_LABEL[r.status]).toLowerCase()}`}`,
    muted: !["APPROVED", "ACTIVE"].includes(r.status),
  })), [data, t]);
  return { items, loading: !!resource && isLoading };
}
