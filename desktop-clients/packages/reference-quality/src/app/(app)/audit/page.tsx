"use client";
import { useReferenceHost } from "@pepbits/reference-host";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/controls";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "../../../lib/navigation";
import { Download, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi, useDebounced } from "../../../lib/hooks";
import { useMeta } from "../../../lib/auth";
import { Badge, Button, Drawer, ErrorState, Input, Loading, PageHeader, Pager, Panel, Select, DateInput } from "../../../components/ui";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface Entry {
  id: number;
  ts: string;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown>;
  ip: string | null;
  prev_hash: string;
  hash: string;
}

function AuditInner() {
  const PAGE = useReferenceHost().preferences.pageSize; // the effective page-size preference
  const { t } = useLocalization();
  const { api, download } = useQualityApi();
  const { fmtDateTime, fmtNumber, humanize } = useQualityFormat();
  const meta = useMeta();
  const toast = useToast();
  const params = useSearchParams();
  const [user, setUser] = useState(params.get("user") ?? "");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<Entry | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verify, setVerify] = useState<{ valid: boolean; checked: number; brokenAt: number | null; verifiedAt: string } | null>(null);
  const q = useDebounced(search);
  useEffect(() => setOffset(0), [user, entity, action, from, to, q]);
  const { data, error, loading, reload } = useApi<{ total: number; rows: Entry[]; entities: string[]; actions: string[] }>("/audit", { user, entity, action, from, to, search: q, limit: PAGE, offset });

  const runVerify = async () => {
    setVerifying(true);
    try {
      setVerify(await api("/audit/verify"));
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Verification failed.", "error");
    } finally {
      setVerifying(false);
    }
  };

  const actionGroups = [...new Set((data?.actions ?? []).map((a) => a.split(".")[0]))];

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every sign-in, data change, review decision, export and submission is recorded here. Entries cannot be edited or deleted, and each one is hash-linked to the one before it, so any tampering is detectable."
        actions={
          <>
            <Button icon={<ShieldCheck className="size-4" />} loading={verifying} onClick={runVerify}><LocalizedText message="Verify integrity" /></Button>
            <Button
              icon={<Download className="size-4" />}
              onClick={async () => {
                try {
                  await download("/audit/export.csv");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Export failed.", "error");
                }
              }}
            ><LocalizedText message="Export CSV" /></Button>
          </>
        }
      />

      {verify && (
        <div className={cls("mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm", verify.valid ? "border-ok/30 bg-ok-soft/60" : "border-bad/30 bg-bad-soft/60")}>
          {verify.valid ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-bad" />}
          <div>
            <p className="font-medium text-ink">{verify.valid ? <LocalizedText message="All {value0} entries are intact." values={{ value0: fmtNumber(verify.checked) }} /> : <LocalizedText message="The chain is broken at entry {value0}." values={{ value0: verify.brokenAt ?? "" }} />}</p>
            <p className="text-ink-2">
              {verify.valid ? <LocalizedText message="Every entry's hash matches its content and the entry before it." /> : <LocalizedText message="An entry was altered or removed outside the application. Investigate before relying on this trail." />} <LocalizedText message="Checked {value0}." values={{ value0: fmtDateTime(verify.verifiedAt) }} />
            </p>
          </div>
        </div>
      )}

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-3" />
            <Input className="pl-9" placeholder="Search summaries or an entity ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="User" className="w-48" value={user} onChange={(e) => setUser(e.target.value)}>
            <option value=""><LocalizedText message="All users" /></option>
            {meta.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Area" className="w-40" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value=""><LocalizedText message="All areas" /></option>
            {data?.entities.map((e) => (
              <option key={e} value={e}>
                {humanize(e)}
              </option>
            ))}
          </Select>
          <Select aria-label="Action" className="w-40" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value=""><LocalizedText message="All actions" /></option>
            {actionGroups.map((a) => (
              <option key={a} value={a}>
                {humanize(a)}
              </option>
            ))}
          </Select>
          <DateInput aria-label="From" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <DateInput aria-label="To" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {error && <div className="p-4"><ErrorState message={error} onRetry={reload} /></div>}
        {!data && loading && <Loading className="p-4" rows={10} />}
        {data && (
          <TableContainer overflow="horizontal" className={cls("overflow-x-auto", loading && "opacity-60")}>
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="When" /></TableHead>
                  <TableHead><LocalizedText message="Who" /></TableHead>
                  <TableHead><LocalizedText message="Action" /></TableHead>
                  <TableHead><LocalizedText message="What happened" /></TableHead>
                  <TableHead><LocalizedText message="Entry" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                    <TableCell className="num whitespace-nowrap text-ink-2">{fmtDateTime(r.ts)}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.user_name ?? <LocalizedText message="System" />}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge tone={/reject|failed|deactivat|cancel/.test(r.action) ? "bad" : /approv|accepted|verified/.test(r.action) ? "ok" : "neutral"}>{r.action}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[560px]">
                      <span className="line-clamp-2">{r.summary}</span>
                    </TableCell>
                    <TableCell className="num text-xs text-ink-3">#{r.id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager total={data.total} offset={offset} limit={PAGE} onChange={setOffset} />
          </TableContainer>
        )}
      </Panel>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.summary ?? ""} subtitle={open ? t("Entry #{value0}, {value1}", { value0: open.id, value1: fmtDateTime(open.ts) }) : undefined}>
        {open && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-xs text-ink-3"><LocalizedText message="User" /></dt><dd>{open.user_name ?? <LocalizedText message="System" />}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Network address" /></dt><dd className="font-mono text-xs">{open.ip ?? "—"}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Action" /></dt><dd className="font-mono text-xs">{open.action}</dd></div>
              <div><dt className="text-xs text-ink-3"><LocalizedText message="Entity" /></dt><dd>{humanize(open.entity_type)} {open.entity_id && <span className="font-mono text-xs">{open.entity_id}</span>}</dd></div>
            </dl>
            <Changes details={open.details} />
            <section>
              <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Integrity" /></h3>
              <dl className="space-y-2">
                <div><dt className="text-xs text-ink-3"><LocalizedText message="Previous entry hash" /></dt><dd className="font-mono text-[11px] break-all text-ink-2">{open.prev_hash}</dd></div>
                <div><dt className="text-xs text-ink-3"><LocalizedText message="This entry hash" /></dt><dd className="font-mono text-[11px] break-all text-ink-2">{open.hash}</dd></div>
              </dl>
            </section>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Changes({ details }: { details: Record<string, unknown> }) {
  const { humanize } = useQualityFormat();
  const before = (details.before ?? null) as Record<string, unknown> | null;
  const after = (details.after ?? null) as Record<string, unknown> | null;
  if (before || after) {
    const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Changes" /></h3>
        <TableContainer overflow="horizontal" className="rounded-md border border-line">
          <Table className="data-table">
            <TableHeader>
              <TableRow>
                <TableHead><LocalizedText message="Field" /></TableHead>
                <TableHead><LocalizedText message="Before" /></TableHead>
                <TableHead><LocalizedText message="After" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k}>
                  <TableCell className="font-medium">{humanize(k)}</TableCell>
                  <TableCell className="text-bad">{fmt(before?.[k])}</TableCell>
                  <TableCell className="text-ok">{fmt(after?.[k])}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </section>
    );
  }
  const rest = Object.entries(details);
  if (!rest.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Details" /></h3>
      <pre className="max-h-72 overflow-auto rounded-md bg-surface p-3 font-mono text-xs leading-relaxed text-ink-2">{JSON.stringify(details, null, 2)}</pre>
    </section>
  );
}

function fmt(v: unknown) {
  if (v === undefined) return "—";
  if (v === null) return "empty";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export default function AuditPage() {
  return (
    <Suspense>
      <AuditInner />
    </Suspense>
  );
}
