"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FlaskConical, Plus, RefreshCw, Search, X } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { useApi } from "../../lib/api";
import { cx } from "../../lib/cx";
import { STATUS_LABEL, useTenantFormat } from "../../lib/format";
import { usePageSize } from "../../lib/hooks";
import { Icon } from "../../lib/icons";
import { useRouter } from "../../lib/navigation";
import type { FieldDef, ListResult, RecordDto, Status } from "../../lib/types";
import { tenantAdminPaths } from "../../routes";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { StatusPill } from "../ui/StatusPill";
import { Card, SourceButton, SourceInput, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from "../ui/controls";
import { Cell } from "./cells";
import { RecordDrawer } from "./RecordDrawer";
import { RouteTester } from "./RouteTester";

const VERSIONED_FILTERS: Status[] = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "RETIRED", "SUPERSEDED"];
const SIMPLE_FILTERS: Status[] = ["ACTIVE", "INACTIVE"];

/** The record id a deep link asks to open: `?new` wins, then the source's `?open=`, then `?id=`. Anything that is not a positive whole number is ignored. */
function requestedRecord(query: URLSearchParams): number | "new" | null {
  if (query.get("new")) return "new";
  const raw = query.get("open") ?? query.get("id");
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * One governed configuration page (`/config/<resource>`): status filter, search, sortable list, paging and the record drawer.
 * The page size is the host's managed table page size; the source's fixed 25 is gone. Mount it with `key={resourceKey}`.
 */
export function ResourceWorkspace({ resourceKey, query }: { resourceKey: string; query: URLSearchParams }) {
  const { resource, user } = useApp();
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const res = resource(resourceKey);
  const router = useRouter();
  const pageSize = usePageSize();

  const [status, setStatus] = useState<string>("ALL");
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "updated", dir: "desc" });
  const [openId, setOpenId] = useState<number | "new" | null>(() => requestedRecord(query));
  const [tester, setTester] = useState(false);

  const queryText = query.toString();
  useEffect(() => {
    const wanted = requestedRecord(new URLSearchParams(queryText));
    if (wanted !== null) setOpenId(wanted);
  }, [queryText, resourceKey]);

  useEffect(() => { const timer = setTimeout(() => { setDebounced(text.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [text]);
  // The managed page size changed (preference or policy): the current page number no longer means the same rows.
  useEffect(() => { setPage(1); }, [pageSize]);

  const listPath = useMemo(() => {
    if (!res) return null;
    const qs = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize), sort: sort.key, dir: sort.dir });
    if (debounced) qs.set("q", debounced);
    return `/resources/${encodeURIComponent(res.key)}?${qs}`;
  }, [res, status, page, pageSize, sort, debounced]);
  const list = useApi<ListResult>(listPath, { revalidateOnFocus: false });
  const data = list.data ?? null;
  const loading = list.isValidating;
  const error = list.error?.message ?? null;
  const reload = () => { void list.mutate(); };

  const columns = useMemo(() => res?.fields.filter((f) => f.list && f.type !== "lines").slice(0, 4) ?? [], [res]);

  if (!res) return <Card shadow="none" tone="transparent" className="panel p-8"><LocalizedText message="That configuration page doesn’t exist." /></Card>;

  const filters = res.governance === "versioned" ? VERSIONED_FILTERS : SIMPLE_FILTERS;
  const counts = data?.counts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const shownFilters = filters.filter((s) => counts[s] || ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ACTIVE", "INACTIVE"].includes(s) || status === s);

  const closeDrawer = () => {
    setOpenId(null);
    if (query.get("open") || query.get("id") || query.get("new")) router.replace(tenantAdminPaths.resource(res.key));
  };
  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "updated" ? "desc" : "asc" }));
  const from = data && data.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const lowerLabel = res.label.toLowerCase();
  const filtered = Boolean(debounced) || status !== "ALL";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Purpose and primary action */}
      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-spruce-900 text-saffron-400">
          <Icon name={res.icon} className="h-5 w-5" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-muted">
          {res.summary}
          <span className="ml-2 whitespace-nowrap text-spruce-700">
            <LocalizedText message={res.governance === "versioned" ? "Changes need an independent approver." : "Changes apply when saved."} />
          </span>
        </p>
        {res.key === "reimbursement-routes" && (
          <SourceButton className="btn-quiet" onClick={() => setTester(true)}><FlaskConical className="h-4 w-4" /> <LocalizedText message="Test route selection" /></SourceButton>
        )}
        <SourceButton className="btn-primary" onClick={() => setOpenId("new")}><Plus className="h-4 w-4" /> {t("New {value0}", { value0: res.singular })}</SourceButton>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label={t("Filter by status")}>
          {["ALL", ...shownFilters].map((s) => {
            const n = s === "ALL" ? all : counts[s] ?? 0;
            const on = status === s;
            return (
              <SourceButton key={s} role="tab" aria-selected={on} onClick={() => { setStatus(s); setPage(1); }}
                className={cx("flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold transition-colors", on ? "bg-spruce-900 text-white" : "text-spruce-800 hover:bg-mist")}>
                <LocalizedText message={s === "ALL" ? "All" : STATUS_LABEL[s as Status]} />
                <span className={cx("rounded px-1 text-[11px] tabular-nums", on ? "bg-white/15" : s === "PENDING_APPROVAL" && n ? "bg-saffron-100 text-saffron-700" : "text-muted")}>{fmt.int(n)}</span>
              </SourceButton>
            );
          })}
        </div>
        <div className="relative w-full max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <SourceInput value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Search {value0}", { value0: lowerLabel })} className="input pl-9 pr-8" aria-label="Search records" />
          {text && <SourceButton className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-spruce-900" onClick={() => setText("")} aria-label="Clear search"><X className="h-4 w-4" /></SourceButton>}
        </div>
        <span className="flex-1" />
        <SourceButton className="btn-ghost btn-sm" onClick={reload} disabled={loading} aria-label="Refresh"><RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} /> <LocalizedText message="Refresh" /></SourceButton>
      </div>

      {/* Table */}
      <Card shadow="none" tone="transparent" className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <TableContainer className="min-h-0 flex-1">
          <Table className="w-full min-w-[860px] border-separate border-spacing-0 text-left">
            <TableHeader>
              <TableRow className="bg-mist text-[12px] text-muted">
                <Th label="Code" k="code" sort={sort} onSort={toggleSort} className="w-[140px] pl-5" />
                <Th label="Name" k="name" sort={sort} onSort={toggleSort} />
                {columns.map((c) => <Th key={c.key} label={c.label} />)}
                <Th label="Status" k="status" sort={sort} onSort={toggleSort} className="w-[160px]" />
                {res.effectiveDated && <Th label="Effective" k="effective" sort={sort} onSort={toggleSort} className="w-[170px]" />}
                <Th label="Last change" k="updated" sort={sort} onSort={toggleSort} className="w-[170px] pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {error && (
                <TableRow><TableCell colSpan={99} className="px-5 py-10 text-center">
                  <p className="font-semibold" role="alert"><LocalizedText message="Couldn’t load {value0}" values={{ value0: lowerLabel }} /></p>
                  <p className="mt-1 text-muted"><LocalizedText message={error} /></p>
                  <SourceButton className="btn-quiet mt-3" onClick={reload}><LocalizedText message="Try again" /></SourceButton>
                </TableCell></TableRow>
              )}
              {!error && !data && Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={99} className="border-b border-line px-5 py-3"><div className="h-4 animate-pulse rounded bg-mist" style={{ width: `${55 + ((i * 13) % 40)}%` }} /></TableCell></TableRow>
              ))}
              {!error && data?.rows.length === 0 && (
                <TableRow><TableCell colSpan={99} className="px-5 py-14 text-center">
                  <p className="font-display text-[17px] font-semibold"><LocalizedText message={filtered ? "Nothing matches these filters" : "No {value0} yet"} values={{ value0: lowerLabel }} /></p>
                  <p className="mx-auto mt-1 max-w-md text-muted"><LocalizedText message={filtered ? "Clear the search or choose another status." : "Create the first {value0} to start configuring this area."} values={{ value0: res.singular }} /></p>
                  {filtered
                    ? <SourceButton className="btn-quiet mt-4" onClick={() => { setText(""); setStatus("ALL"); }}><LocalizedText message="Clear filters" /></SourceButton>
                    : <SourceButton className="btn-primary mt-4" onClick={() => setOpenId("new")}><Plus className="h-4 w-4" /> {t("New {value0}", { value0: res.singular })}</SourceButton>}
                </TableCell></TableRow>
              )}
              {data?.rows.map((r) => <Row key={r.id} r={r} columns={columns} effective={res.effectiveDated} selected={openId === r.id} onOpen={() => setOpenId(r.id)} user={user} />)}
            </TableBody>
          </Table>
        </TableContainer>
        <div className="flex items-center gap-3 border-t border-line px-5 py-2 text-[12px] text-muted">
          <span>{data ? (data.total ? t("Showing {value0}–{value1} of {value2}", { value0: fmt.int(from), value1: fmt.int(to), value2: fmt.int(data.total) }) : t("No records")) : t("Loading…")}</span>
          <span className="flex-1" />
          <SourceButton className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> <LocalizedText message="Previous" /></SourceButton>
          <span><LocalizedText message="Page {value0} of {value1}" values={{ value0: fmt.int(page), value1: fmt.int(pages) }} /></span>
          <SourceButton className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><LocalizedText message="Next" /> <ChevronRight className="h-4 w-4" /></SourceButton>
        </div>
      </Card>

      {openId !== null && (
        <RecordDrawer
          key={res.key}
          res={res}
          recordId={openId}
          onClose={closeDrawer}
          onChanged={(r) => { if (r && openId === "new") setOpenId(r.id); }}
          onOpen={(id) => setOpenId(id)}
        />
      )}
      {tester && <RouteTester onClose={() => setTester(false)} />}
    </div>
  );
}

function Th({ label, k, sort, onSort, className }: { label: string; k?: string; sort?: { key: string; dir: string }; onSort?: (k: string) => void; className?: string }) {
  const active = k && sort?.key === k;
  return (
    <TableHead scope="col" className={cx("border-b border-line px-3 py-2.5 font-semibold", className)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
      {k && onSort ? (
        <SourceButton className={cx("inline-flex items-center gap-1 hover:text-spruce-900", active && "text-spruce-900")} onClick={() => onSort(k)}>
          <LocalizedText message={label} />
          {active && (sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </SourceButton>
      ) : <LocalizedText message={label} />}
    </TableHead>
  );
}

function Row({ r, columns, effective, selected, onOpen, user }: {
  r: RecordDto; columns: FieldDef[]; effective: boolean; selected: boolean; onOpen: () => void; user: ReturnType<typeof useApp>["user"];
}) {
  const fmt = useTenantFormat();
  return (
    <TableRow
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className={cx("group cursor-pointer text-[13px] outline-none transition-colors hover:bg-spruce-50/60 focus-visible:bg-spruce-50", selected && "bg-saffron-50/70")}
    >
      <TableCell className="relative border-b border-line py-2.5 pl-5 pr-3">
        {selected && <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-saffron-500" />}
        <span className="font-semibold text-spruce-800">{r.code}</span>
        {r.revision > 1 && <span className="ml-1.5 text-[11px] text-muted">{`r${r.revision}`}</span>}
      </TableCell>
      <TableCell className="max-w-[320px] border-b border-line px-3 py-2.5"><span className="block truncate font-medium text-spruce-950">{r.name}</span></TableCell>
      {columns.map((c) => (
        <TableCell key={c.key} className="max-w-[220px] border-b border-line px-3 py-2.5 text-spruce-900"><span className="flex min-w-0"><Cell field={c} record={r} /></span></TableCell>
      ))}
      <TableCell className="border-b border-line px-3 py-2.5"><StatusPill status={r.status} /></TableCell>
      {effective && (
        <TableCell className="border-b border-line px-3 py-2.5 text-spruce-900">
          {r.effectiveFrom ? fmt.date(r.effectiveFrom) : <span className="text-[#A6B3B0]"><LocalizedText message="Not set" /></span>}
          {r.effectiveUntil && <span className="block text-[11px] text-muted"><LocalizedText message="until {value0}" values={{ value0: fmt.date(r.effectiveUntil) }} /></span>}
        </TableCell>
      )}
      <TableCell className="border-b border-line px-3 py-2.5 pr-5">
        <span className="flex items-center gap-2">
          <Avatar user={user(r.updatedBy)} size="sm" />
          <span className="text-muted">{fmt.relative(r.updatedAt)}</span>
        </span>
      </TableCell>
    </TableRow>
  );
}
