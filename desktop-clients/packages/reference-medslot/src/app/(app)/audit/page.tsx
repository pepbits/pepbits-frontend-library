"use client";
import {TableHeader,TableRow,TableBody,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { qs } from "../../../lib/api";
import { useApi, useDebounced } from "../../../lib/hooks";
import { titleCase } from "../../../lib/format";
import { Badge, Button, Empty, ErrorNote, Input, PageHeader, Select, Skeleton, Table, Td, Th } from "../../../components/ui";

type Row = { id: number; user_name: string | null; action: string; entity: string; entity_id: string | null; details: string | null; ip: string | null; created_at: string };
const PAGE = 100;
const ENTITIES = ["patient", "appointment", "resource", "service", "user", "department", "holiday", "notification_template", "settings", "resource_block"];
const ACTIONS = ["view", "create", "update", "status", "reschedule", "duration", "delete", "login", "login_failed", "update_schedule", "retry"];

export default function AuditPage() {
  const { t: tr } = useLocalization();
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const dq = useDebounced(q.trim(), 300);
  const { data, error, loading, reload } = useApi<{ total: number; items: Row[] }>(`/audit${qs({ entity, action, q: dq, limit: PAGE, offset: page * PAGE })}`);
  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, record view and change, with who did it and from where. Entries can't be edited or deleted from the app." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="User name or record number" className="w-64" />
        <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }} className="w-48"><option value=""><LocalizedText message="All records" /></option>{ENTITIES.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select>
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} className="w-44"><option value=""><LocalizedText message="All actions" /></option>{ACTIONS.map((x) => <option key={x} value={x}>{titleCase(x)}</option>)}</Select>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <Skeleton className="h-96" /> : !data?.items.length ? <Empty icon={<ShieldCheck className="size-8" />} title="No entries match" /> : (
          <Table>
            <TableHeader><TableRow><Th><LocalizedText message="When (UTC)" /></Th><Th><LocalizedText message="User" /></Th><Th><LocalizedText message="Action" /></Th><Th><LocalizedText message="Record" /></Th><Th><LocalizedText message="Details" /></Th><Th><LocalizedText message="IP" /></Th></TableRow></TableHeader>
            <TableBody>{data.items.map((r) => (
              <TableRow key={r.id}>
                <Td className="tabular whitespace-nowrap text-xs">{r.created_at}</Td>
                <Td>{r.user_name ?? tr("System")}</Td>
                <Td><Badge tone={r.action === "login_failed" || r.action === "delete" ? "red" : r.action === "view" ? "neutral" : r.action.startsWith("login") ? "blue" : "green"}>{titleCase(r.action)}</Badge></Td>
                <Td>{titleCase(r.entity)} <span className="tabular text-mute">{r.entity_id ? `#${r.entity_id}` : ""}</span></Td>
                <Td className="max-w-xs truncate font-mono text-[11px] text-mute" title={r.details ?? ""}>{r.details}</Td>
                <Td className="tabular text-xs text-mute">{r.ip}</Td>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
        {data && data.total > PAGE && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm">
            <span className="tabular text-mute">{page * PAGE + 1}<LocalizedText message={"–{value0} of {value1}"} values={{ value0: (Math.min((page + 1) * PAGE, data.total)) ?? "", value1: (data.total) ?? "" }} /></span>
            <div className="flex gap-2"><Button size="sm" disabled={!page} onClick={() => setPage(page - 1)}><LocalizedText message="Previous" /></Button><Button size="sm" disabled={(page + 1) * PAGE >= data.total} onClick={() => setPage(page + 1)}><LocalizedText message="Next" /></Button></div>
          </div>
        )}
      </div>
    </>
  );
}
