"use client";
import { History, Search } from "@pepbits/icons";
import { ReferenceLink as Link } from "../../host";
import { LocalizedText } from "@pepbits/i18n/react";
import { useEffect, useState } from "react";
import {CollectionView,type CollectionColumn} from "@pepbits/components/collection-view";
import { Button, EmptyState, ErrorNote, Input, ListSkeleton, Segmented, StatusPill, Td, Th } from "../ui/primitives";
import { useApi } from "../../lib/api";
import { ENTITY_LABEL, usePharmacyFormat } from "../../lib/format";
import { usePageSize } from "../../lib/hooks";

interface Row { id: number; entity: string; entity_id: string; ref: string; from_status: string | null; to_status: string; note: string | null; actor: string; actor_name: string | null; at: string }

const ENTITIES = ["", "prescription", "authorization", "dispensing", "bill", "claim", "remittance", "payment", "purchase_order", "batch"] as const;
type Entity = (typeof ENTITIES)[number];

/** Where a record opens in the app, when it has a home screen. */
const HREF: Partial<Record<string, (r: Row) => string>> = {
  prescription: (r) => `/workbench?rx=${r.entity_id}`,
  claim: (r) => `/claims?claim=${r.entity_id}`,
  remittance: (r) => `/remittance?ra=${r.entity_id}`,
  purchase_order: (r) => `/purchasing?po=${r.entity_id}`,
};

export function AuditView() {
  const PAGE = usePageSize();
  const { t, dateTime, int, entityLabel } = usePharmacyFormat();
  const [entity, setEntity] = useState<Entity>("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [limit, setLimit] = useState(PAGE);

  // Reset paging inside the callbacks that change the filter, not in an effect
  useEffect(() => { const timer = setTimeout(() => { setDebounced(q.trim()); setLimit(PAGE); }, 220); return () => clearTimeout(timer); }, [q, PAGE]);
  const pickEntity = (e: Entity) => { setEntity(e); setLimit(PAGE); };

  const { data, error, isLoading, mutate } = useApi<{ rows: Row[]; total: number }>(
    `/audit?limit=${limit}${entity ? `&entity=${entity}` : ""}${debounced ? `&q=${encodeURIComponent(debounced)}` : ""}`,
  );
  const who = (r: Row) => r.actor_name ?? (r.actor === "payer" ? t("Payer") : r.actor === "system" ? t("System") : r.actor === "erx-gateway" ? t("eRx gateway") : r.actor);

  const columns:CollectionColumn<Row>[]=[
   {key:'at',header:'When',render:r=>dateTime(r.at)},
   {key:'ref',header:'Record',render:r=><><span>{entityLabel(r.entity)} </span>{HREF[r.entity]?<Link href={HREF[r.entity]!(r)}>{r.ref}</Link>:r.ref}</>},
   {key:'change',header:'Change',render:r=><span className="flex items-center gap-1.5">{r.from_status?<><StatusPill status={r.from_status}/><LocalizedText message="to"/></>:<LocalizedText message="Created as"/>}<StatusPill status={r.to_status}/></span>},
   {key:'note',header:'Note',render:r=>r.note??'—'},{key:'actor',header:'By',render:who},
  ];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-surface px-3 py-2 md:px-5">
        <div className="scroll-x max-w-full">
          <Segmented size="sm" value={entity} onChange={pickEntity}
            items={ENTITIES.map((e) => ({ value: e, label: e ? ENTITY_LABEL[e] : "All records" }))} />
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, note or person" className="pl-8" aria-label="Search audit trail" />
        </div>
      </div>

      {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton rows={12} /> : !data?.rows.length ? (
        <EmptyState icon={<History className="size-5" />} title="No changes match" body="Try another record type or clear the search." />
      ) : (
        <div className="scroll-y min-h-0 flex-1">
          <CollectionView columns={columns} rows={data.rows} rowKey={row=>String(row.id)}/>
          <div className="flex items-center justify-between gap-3 px-5 py-3 text-[12.5px] text-ink-3">
            <span className="num"><LocalizedText message="Showing {value0} of {value1} changes" values={{ value0: int(data.rows.length), value1: int(data.total) }} /></span>
            {data.rows.length < data.total && <Button size="sm" onClick={() => setLimit((l) => l + PAGE)} loading={isLoading}>{t("Load {value0} more", { value0: int(Math.min(PAGE, data.total - data.rows.length)) })}</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
