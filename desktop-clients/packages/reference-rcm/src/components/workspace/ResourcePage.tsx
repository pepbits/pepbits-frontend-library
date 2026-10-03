"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlarmClock, Columns3, List, Plus, Radio, Search, UserRound, X } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { useApi } from "../../lib/api";
import { cx } from "../../lib/cx";
import { TONE, useRcmFormat } from "../../lib/format";
import { isTyping, useKeyHandler, usePageSize, useShortcutsEnabled } from "../../lib/hooks";
import type { Kpi, ListResult, RecordDto, ResourceDef } from "../../lib/types";
import { useApp } from "../shell/context";
import { SourceButton, SourceInput } from "../ui/controls";
import { Board } from "./Board";
import { CreatePanel } from "./CreatePanel";
import { DetailPane } from "./DetailPane";
import { LifecycleMap } from "./LifecycleMap";
import { RecordTable } from "./RecordTable";

const LAYOUT_LABEL = { queue: "Worklist", ledger: "Ledger", board: "Board", monitor: "Live monitor" } as const;
/** The board shows the whole pipeline at once, so it asks for the server's largest page. */
const BOARD_PAGE_SIZE = 300;

/** The page state a deep link asks for. Defaults follow the source: open work, except boards, searches and `open=` links, which start unfiltered. */
function fromQuery(res: ResourceDef, params: URLSearchParams, openKeys: string) {
  const open = params.get("open");
  return {
    status: params.get("status") ?? (res.layout === "board" || params.get("q") || open ? "" : openKeys),
    q: params.get("q") ?? "",
    overdue: params.get("overdue") === "1",
    selected: Number(open) || null,
    openFirst: open === "first",
    creating: params.get("new") === "1" && res.create,
  };
}

/**
 * One registry page (`/w/<resource>`): KPI strip, status chips and filters, search, worklist/ledger/board/live monitor and the detail pane.
 * Deep links keep the source semantics: `?status=A,B`, `?q=`, `?overdue=1`, `?open=<id>`, `?open=first` (with `?q=`, selects the first match)
 * and `?new=1`. Mount it with `key={resource}`; a new query on the same page re-applies the link. The list page size is the host's managed
 * table page size (the source's fixed 50 is gone); the board keeps the server maximum because it shows every column at once.
 */
export function ResourcePage({ res, query }: { res: ResourceDef; query: URLSearchParams }) {
  const { scopeInfo, refreshPending } = useApp();
  const { t } = useLocalization();
  const fmt = useRcmFormat();
  const shortcuts = useShortcutsEnabled();
  const hostPageSize = usePageSize();
  const openKeys = useMemo(() => res.statuses.filter((s) => !["success", "muted"].includes(s.tone)).map((s) => s.key).join(","), [res]);
  const initial = useMemo(() => fromQuery(res, query, openKeys), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [status, setStatus] = useState(initial.status);
  const [search, setSearch] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [overdue, setOverdue] = useState(initial.overdue);
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState("updated");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "board">(res.layout === "board" ? "board" : "list");
  const [selected, setSelected] = useState<number | null>(initial.selected);
  const [creating, setCreating] = useState(initial.creating);
  const [live, setLive] = useState(res.layout === "monitor");
  const [stamp, setStamp] = useState<Date | null>(null);
  const openFirst = useRef(initial.openFirst);
  const searchRef = useRef<HTMLInputElement>(null);

  // A different query on the same page (a link from this page to itself, the palette's "Open <ref>") re-applies the link.
  const queryText = query.toString();
  const applied = useRef(queryText);
  useEffect(() => {
    if (applied.current === queryText) return;
    applied.current = queryText;
    const next = fromQuery(res, new URLSearchParams(queryText), openKeys);
    setStatus(next.status); setSearch(next.q); setQ(next.q); setOverdue(next.overdue); setPage(1);
    setSelected(next.selected); openFirst.current = next.openFirst;
    if (next.creating) setCreating(true);
  }, [queryText, res, openKeys]);

  useEffect(() => { const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  // The managed page size changed (preference or policy): the current page number no longer means the same rows.
  useEffect(() => { setPage(1); }, [hostPageSize]);

  const board = view === "board";
  const listPath = useMemo(() => {
    const p = new URLSearchParams({ page: String(board ? 1 : page), pageSize: String(board ? BOARD_PAGE_SIZE : hostPageSize), sort, dir });
    const st = board ? "" : status;
    if (st) p.set("status", st);
    if (q) p.set("q", q);
    if (overdue) p.set("overdue", "1");
    if (mine) p.set("mine", "1");
    return `/records/${encodeURIComponent(res.key)}?${p}`;
  }, [res.key, board, page, hostPageSize, sort, dir, status, q, overdue, mine]);
  const list = useApi<ListResult>(listPath, { keepPreviousData: true, refreshInterval: live ? 10000 : undefined });
  const data = list.data ?? null;
  const loading = list.isValidating;
  const error = list.error?.message ?? null;
  const rows = useMemo(() => data?.rows ?? [], [data]);

  useEffect(() => { if (data) setStamp(new Date()); }, [data]);
  useEffect(() => {
    if (openFirst.current && rows.length) { openFirst.current = false; setSelected(rows[0].id); }
  }, [rows]);

  // Keyboard: arrows move through the list, N creates, / searches, Esc closes (only while the host's shortcut preference is on)
  useKeyHandler((e) => {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("[role=dialog]")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "j" || e.key === "k") {
      if (!rows.length) return;
      e.preventDefault();
      const i = rows.findIndex((r) => r.id === selected);
      const next = e.key === "ArrowDown" || e.key === "j" ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0);
      setSelected(rows[i < 0 ? 0 : next].id);
    } else if ((e.key === "n" || e.key === "N") && res.create) { e.preventDefault(); setCreating(true); }
    else if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
    else if (e.key === "Escape") setSelected(null);
  });

  const onChanged = useCallback((_r: RecordDto) => { refreshPending(); }, [refreshPending]);
  const pickStatus = (s: string) => { setStatus(s); setOverdue(false); setPage(1); if (board) setView("list"); };
  const applyKpi = (k: Kpi) => {
    const key = (k.statuses ?? []).join(",");
    const same = status === key && overdue === k.overdue;
    setStatus(same ? "" : key); setOverdue(same ? false : k.overdue); setPage(1);
    if (board && !same) setView("list");
  };
  const onSort = (s: string) => { if (sort === s) setDir((d) => (d === "asc" ? "desc" : "asc")); else { setSort(s); setDir(s === "ref" || s === "due" ? "asc" : "desc"); } };

  const counts = data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasAssignee = res.fields.some((f) => f.key === "assignee");
  const hasDue = res.fields.some((f) => f.key === "dueDate");
  const variant = res.layout === "board" ? "queue" : res.layout;
  const cur = scopeInfo.currency;
  const kpis: Kpi[] = (data?.kpis ?? res.kpis.map((k) => ({ ...k, value: 0, count: 0, tone: k.tone ?? null, statuses: k.statuses ?? null, overdue: !!k.overdue }))).map((k) => ({ ...k, label: t(k.label) }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2.5" data-rcm-page={res.key} data-rcm-layout={res.layout}>
      {/* KPI strip */}
      <div className="flex items-stretch gap-2.5">
        <div className="grid min-w-0 flex-1 gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.max(kpis.length, 1)}, minmax(0, 1fr))` }}>
          {kpis.map((k) => {
            const active = status === (k.statuses ?? []).join(",") && overdue === k.overdue && !!k.statuses;
            const tone = k.tone ?? "muted";
            return (
              <SourceButton key={k.label} onClick={() => k.statuses && applyKpi(k)} disabled={!k.statuses} aria-pressed={k.statuses ? active : undefined}
                className={cx("group relative overflow-hidden rounded-[12px] border bg-white px-3.5 py-2 text-left transition", active ? "border-signal-500 ring-2 ring-signal-100" : "border-line hover:border-harbor-200", !k.statuses && "cursor-default")}>
                <span className={cx("absolute inset-y-0 left-0 w-[3px]", TONE[tone].bar)} />
                <span className="block truncate text-[11.5px] font-medium text-muted">{k.label}</span>
                <span className="mt-0.5 flex items-baseline gap-2">
                  <span className={cx("font-display text-[21px] font-semibold leading-none tabular-nums", tone === "danger" && k.value > 0 && "text-madder-700")}>
                    {k.metric === "count" ? fmt.num(k.value) : fmt.money(k.value, null, { compact: k.value >= 100000 })}
                  </span>
                  {k.metric !== "count" && <span className="text-[11px] text-muted">{t("{value0} · {value1} items", { value0: cur, value1: fmt.num(k.count) })}</span>}
                </span>
              </SourceButton>
            );
          })}
        </div>
        {res.create && (
          <SourceButton onClick={() => setCreating(true)} className="btn-primary h-auto shrink-0 flex-col gap-0.5 px-4" title={shortcuts ? t("Keyboard: N") : undefined}>
            <Plus className="h-4 w-4" /><span className="text-[12px]">{t("New {value0}", { value0: res.singular })}</span>
          </SourceButton>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-[10px] border border-line bg-white p-1" role="group" aria-label={t("Filter by status")}>
          <Chip on={status === openKeys && !overdue} onClick={() => pickStatus(openKeys)} label={t("Open work")} n={openKeys.split(",").reduce((s, k) => s + (counts[k] ?? 0), 0)} />
          <Chip on={!status && !overdue} onClick={() => pickStatus("")} label={t("All")} n={total} />
          <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />
          {res.statuses.map((s) => (
            <Chip key={s.key} on={status === s.key} onClick={() => pickStatus(status === s.key ? "" : s.key)} label={s.label} n={counts[s.key] ?? 0} dot={TONE[s.tone].dot} />
          ))}
        </div>
        {hasDue && (
          <SourceButton onClick={() => { setOverdue((o) => !o); setPage(1); }} aria-pressed={overdue} className={cx("btn-sm btn border", overdue ? "border-madder-100 bg-madder-50 text-madder-700" : "border-line bg-white text-harbor-800 hover:bg-mist")} title={t("Only past their date")}>
            <AlarmClock className="h-3.5 w-3.5" /> <LocalizedText message="Overdue" />
          </SourceButton>
        )}
        {hasAssignee && (
          <SourceButton onClick={() => { setMine((m) => !m); setPage(1); }} aria-pressed={mine} className={cx("btn-sm btn border", mine ? "border-signal-500/40 bg-signal-50 text-signal-700" : "border-line bg-white text-harbor-800 hover:bg-mist")}>
            <UserRound className="h-3.5 w-3.5" /> <LocalizedText message="Mine" />
          </SourceButton>
        )}
        <div className="relative w-[240px] shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <SourceInput ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search {value0}", { value0: res.label.toLowerCase() })} className="input h-[34px] pl-8 pr-7" aria-label="Search" />
          {search ? <SourceButton onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-harbor-900" aria-label="Clear search"><X className="h-3.5 w-3.5" /></SourceButton>
            : shortcuts && <span className="kbd absolute right-2 top-1/2 -translate-y-1/2">/</span>}
        </div>
        {res.layout === "board" && (
          <div className="flex shrink-0 rounded-[10px] border border-line bg-white p-0.5">
            <SourceButton onClick={() => setView("board")} aria-pressed={board} className={cx("flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold", board ? "bg-harbor-900 text-white" : "text-muted")}><Columns3 className="h-3.5 w-3.5" /> <LocalizedText message="Board" /></SourceButton>
            <SourceButton onClick={() => setView("list")} aria-pressed={!board} className={cx("flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold", !board ? "bg-harbor-900 text-white" : "text-muted")}><List className="h-3.5 w-3.5" /> <LocalizedText message="List" /></SourceButton>
          </div>
        )}
        {res.layout === "monitor" ? (
          <SourceButton onClick={() => setLive((l) => !l)} aria-pressed={live} className={cx("btn-sm btn shrink-0 border", live ? "border-jade-100 bg-jade-50 text-jade-700" : "border-line bg-white text-muted")} title={t("Refreshes every 10 seconds")}>
            <Radio className={cx("h-3.5 w-3.5", live && "animate-pulse-soft")} /> {live ? t("Live · {value0}", { value0: stamp ? fmt.time(stamp) : "" }) : t("Paused")}
          </SourceButton>
        ) : (
          <span className="hidden shrink-0 rounded-md bg-harbor-50 px-2 py-1 text-[11px] font-semibold text-harbor-700 2xl:inline"><LocalizedText message={LAYOUT_LABEL[res.layout]} /></span>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-madder-50 px-3 py-2 text-[12.5px] text-madder-700">{error} <SourceButton className="font-semibold underline" onClick={() => void list.mutate()}><LocalizedText message="Try again" /></SourceButton></p>}

      {/* Body */}
      <div className="relative min-h-0 flex-1">
        {board ? (
          <>
            <Board res={res} rows={rows} selected={selected} onSelect={setSelected} loading={loading} />
            {selected && (
              <div className="absolute inset-y-0 right-0 z-20 w-[min(520px,100%)] animate-drawer-in overflow-hidden rounded-[14px] border border-line bg-white shadow-drawer">
                <DetailPane res={res} id={selected} onChanged={onChanged} onClose={() => setSelected(null)} />
              </div>
            )}
          </>
        ) : (
          <div className="grid h-full min-h-0 gap-2.5" style={{ gridTemplateColumns: "minmax(0, 1fr) clamp(380px, 37vw, 520px)" }}>
            <RecordTable res={res} variant={variant} data={data} selected={selected} onSelect={setSelected} sort={sort} dir={dir} onSort={onSort} page={page} onPage={setPage} loading={loading} />
            <div className="panel min-h-0 overflow-hidden">
              {selected ? <DetailPane res={res} id={selected} onChanged={onChanged} onClose={() => setSelected(null)} />
                : <LifecycleMap res={res} counts={counts} onPick={pickStatus} />}
            </div>
          </div>
        )}
        {creating && <CreatePanel res={res} onClose={() => setCreating(false)} onCreated={(r) => { setCreating(false); setStatus(""); setSearch(""); refreshPending(); setSelected(r.id); }} />}
      </div>
    </div>
  );
}

function Chip({ on, onClick, label, n, dot }: { on: boolean; onClick: () => void; label: string; n: number; dot?: string }) {
  const fmt = useRcmFormat();
  return (
    <SourceButton onClick={onClick} aria-pressed={on} className={cx("flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors", on ? "bg-harbor-900 text-white" : "text-harbor-800 hover:bg-mist", n === 0 && !on && "opacity-55")}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />}
      {label}
      <span className={cx("rounded-full px-1.5 text-[10.5px]", on ? "bg-white/20" : "bg-mist text-muted")}>{fmt.num(n)}</span>
    </SourceButton>
  );
}
