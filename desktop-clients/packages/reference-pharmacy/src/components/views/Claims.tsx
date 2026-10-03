"use client";
import { ExternalLink, FileCheck2, Gavel, Search, Send, X } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText } from "@pepbits/ops-ui";
import { useEffect, useMemo, useState } from "react";
import { useShell, useUserName } from "../shell/ShellContext";
import { SourceButton, SourceInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/controls";
import { Button, EmptyState, ErrorNote, Input, Kbd, ListSkeleton, Panel, PanelHeader, Segmented, Select, Skeleton, StatusPill, Tag, Td, Th } from "../ui/primitives";
import { useApi, useApiClient } from "../../lib/api";
import { cx } from "../../lib/cx";
import { usePharmacyFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useAction } from "../../lib/useAction";

interface ClaimRow {
  id: string; claim_no: string; status: string; payer_id: string; payer_name: string; payer_code: string; workflow: string; priority: number; claimed: number; expected: number;
  approved: number; paid: number; denial_code: string | null; denial_reason: string | null; submissions: number; bill_no: string; patient_name: string | null; mrn: string | null;
  rx_no: string | null; prescription_id: string | null; age_days: number; created_at: string;
}
interface ClaimDetail extends ClaimRow {
  lines: { id: string; name: string; drug_code: string; qty: number; claimed: number; expected: number; approved: number; denial_code: string | null }[];
  remits: { id: string; ra_no: string; remittance_id: string; received_at: string; submission: number; claimed: number; approved: number; outcome: string; denial_code: string | null; denial_reason: string | null }[];
  allocations: { id: string; payment_ref: string; method: string; amount: number; at: string }[];
  coverage: { member_id: string; plan_name: string; coverage_pct: number; valid_to: string };
  siblings: { id: string; claim_no: string; priority: number; status: string; payer_code: string }[];
  history: { id: number; from_status: string | null; to_status: string; note: string | null; actor: string; at: string }[];
}
interface Summary {
  byStatus: { status: string; n: number; claimed: number; approved: number; paid: number }[];
  underpaid: { n: number; amount: number | null };
  aging: { payer_id: string; code: string; name: string; b30: number; b60: number; b90: number; b90p: number; total: number }[];
  denials: { code: string; reason: string; n: number }[];
}
interface SubmitResult { submitted: number; results: { ok: boolean; error?: string }[] }

const TABS = [
  { value: "draft", label: "Draft" }, { value: "submitted", label: "Submitted" }, { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" }, { value: "partially_approved", label: "Part approved" }, { value: "partially_paid", label: "Part paid" },
  { value: "paid", label: "Paid" }, { value: "underpaid", label: "Underpaid" }, { value: "", label: "All" },
] as const;
type TabValue = (typeof TABS)[number]["value"];

const AGING = [
  { key: "b30", label: "0–30 days", color: "var(--cobalt)" }, { key: "b60", label: "31–60", color: "var(--amber-mark)" },
  { key: "b90", label: "61–90", color: "var(--danger)" }, { key: "b90p", label: "Over 90", color: "var(--violet)" },
] as const;

export function ClaimsView() {
  const params = useSearchParams();
  const router = useRouter();
  const api = useApiClient();
  const { meta } = useShell();
  const { t, plural, int, moneyC, money } = usePharmacyFormat();
  const [status, setStatus] = useState<TabValue>((params.get("status") as TabValue) ?? "draft");
  const [payer, setPayer] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const openId = params.get("claim");
  // A link that targets a tab ("Fix rejected claims" from the palette, the dashboard) selects it even while this page is open.
  const urlStatus = params.get("status");
  useEffect(() => { if (urlStatus !== null && urlStatus !== status) { setStatus(urlStatus as TabValue); setPicked(new Set()); } }, [urlStatus]); // eslint-disable-line react-hooks/exhaustive-deps
  const { run, busy } = useAction();

  useEffect(() => { const timer = setTimeout(() => setDebounced(q.trim()), 200); return () => clearTimeout(timer); }, [q]);
  const { data, error, isLoading, mutate } = useApi<ClaimRow[]>(`/claims?status=${status}${payer ? `&payer=${payer}` : ""}${debounced ? `&q=${encodeURIComponent(debounced)}` : ""}`);
  const { data: summary } = useApi<Summary>("/claims/summary");
  const rows = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of summary?.byStatus ?? []) m[s.status] = s.n;
    m.underpaid = summary?.underpaid.n ?? 0;
    m[""] = (summary?.byStatus ?? []).reduce((s, x) => s + x.n, 0);
    return m;
  }, [summary]);

  const changeTab = (s: TabValue) => { setStatus(s); setPicked(new Set()); router.replace(`/claims?status=${s}`, { scroll: false }); };
  const open = (id: string | null) => router.replace(`/claims?status=${status}${id ? `&claim=${id}` : ""}`, { scroll: false });
  const move = (d: 1 | -1) => {
    const i = rows.findIndex((r) => r.id === openId);
    const n = rows[Math.min(Math.max(i + d, 0), rows.length - 1)];
    if (n) { open(n.id); document.querySelector(`[data-claim="${n.id}"]`)?.scrollIntoView({ block: "nearest" }); }
  };
  useHotkeys({ j: () => move(1), k: () => move(-1), escape: () => open(null), x: () => { if (openId) toggle(openId); } }, [rows, openId, picked]);

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const submittable = pickedRows.filter((r) => ["draft", "rejected"].includes(r.status));
  const awaiting = pickedRows.filter((r) => r.status === "submitted");
  const pickedValue = pickedRows.reduce((s, r) => s + r.claimed, 0);

  const submit = () => run("submit", ({ operationKey }) => api.post<SubmitResult>("/claims/submit", { ids: submittable.map((r) => r.id) }, { operationKey }),
    (r) => {
      const held = r.results.find((x) => !x.ok);
      return held
        ? t("{value0} submitted, {value1} held back: {value2}", { value0: int(r.submitted), value1: int(r.results.length - r.submitted), value2: held.error ?? "" })
        : t("{value0} submitted", { value0: plural(r.submitted, "claim") });
    }).then((r) => {
    if (r) setPicked(new Set());
  });
  const adjudicate = () => run("adj", ({ operationKey }) => api.post<{ remittances: string[] }>("/claims/adjudicate", { ids: awaiting.map((r) => r.id) }, { operationKey }),
    (r) => (r.remittances.length === 1 ? t("Payer responded with 1 remittance advice") : t("Payer responded with {value0} remittance advices", { value0: int(r.remittances.length) })),
    "Post the payments from Remittance & payments.").then((r) => { if (r) setPicked(new Set()); });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 md:px-5">
        <div className="scroll-x max-w-full">
          <Segmented size="sm" value={status} onChange={changeTab}
            items={TABS.map((tab) => ({ value: tab.value, label: tab.label, count: int(counts[tab.value] ?? 0), tone: tab.value === "rejected" || tab.value === "underpaid" ? "danger" : tab.value === "draft" ? "warn" : undefined }))} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={payer} onChange={(e) => setPayer(e.target.value)} className="w-44" aria-label="Payer">
            <option value=""><LocalizedText message="All payers" /></option>
            {meta?.payers.map((p) => <option key={p.id} value={p.id}>{p.code}, {p.name}</option>)}
          </Select>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Claim, patient or RX" className="pl-8" aria-label="Search claims" />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-h-0 flex-col">
          {picked.size > 0 && (
            <div className="anim-pop flex shrink-0 flex-wrap items-center gap-2 border-b border-cobalt/30 bg-cobalt-wash px-3 py-2 md:px-5">
              <p className="num mr-auto text-[13px] font-medium text-cobalt-strong"><LocalizedText message="{value0} selected, {value1} claimed" values={{ value0: int(picked.size), value1: moneyC(pickedValue) }} /></p>
              <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => setPicked(new Set())}><LocalizedText message="Clear" /></Button>
              {awaiting.length > 0 && <Button size="sm" icon={<Gavel className="size-3.5" />} loading={busy === "adj"} onClick={adjudicate}>{t("Get payer response for {value0} (demo)", { value0: int(awaiting.length) })}</Button>}
              {submittable.length > 0 && <Button size="sm" variant="primary" icon={<Send className="size-3.5" />} loading={busy === "submit"} onClick={submit}>{t("Submit {value0} to payer", { value0: int(submittable.length) })}</Button>}
            </div>
          )}
          {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton rows={10} /> : !rows.length ? (
            <EmptyState icon={<FileCheck2 className="size-5" />} title="No claims here" body={status === "rejected" ? "No rejections to work. Nice." : "Try another status or payer."} />
          ) : (
            <div className="scroll-y min-h-0 flex-1 bg-surface">
              <Table className="w-full min-w-[980px] border-separate border-spacing-0">
                <TableHeader>
                  <TableRow>
                    <Th className="w-10"><SourceInput type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" className="size-4 accent-[var(--cobalt)]" /></Th>
                    <Th><LocalizedText message="Claim" /></Th><Th><LocalizedText message="Patient" /></Th><Th><LocalizedText message="Payer" /></Th><Th><LocalizedText message="Status" /></Th><Th align="right"><LocalizedText message="Claimed" /></Th><Th align="right"><LocalizedText message="Expected" /></Th><Th align="right"><LocalizedText message="Approved" /></Th><Th align="right"><LocalizedText message="Paid" /></Th><Th align="right"><LocalizedText message="Age" /></Th><Th><LocalizedText message="Note" /></Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const short = r.approved > 0 && r.approved < r.expected - 0.01;
                    return (
                      <TableRow key={r.id} data-claim={r.id} onClick={() => open(r.id)} className={cx("cursor-pointer", r.id === openId ? "bg-cobalt-wash" : picked.has(r.id) ? "bg-surface-2" : "hover:bg-surface-2")}>
                        <Td><SourceInput type="checkbox" checked={picked.has(r.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} aria-label={t("Select {value0}", { value0: r.claim_no })} className="size-4 accent-[var(--cobalt)]" /></Td>
                        <Td className="num font-medium">{r.claim_no}{r.submissions > 1 && <span className="ml-1 text-xs text-ink-3">×{r.submissions}</span>}</Td>
                        <Td className="max-w-44 truncate">{r.patient_name}</Td>
                        <Td><span className="font-medium">{r.payer_code}</span> <span className="text-xs text-ink-3">{r.priority === 1 ? <LocalizedText message="primary" /> : <LocalizedText message="secondary" />}</span></Td>
                        <Td><StatusPill status={r.status} /></Td>
                        <Td align="right">{money(r.claimed)}</Td>
                        <Td align="right" className={r.expected < r.claimed - 0.01 ? "text-amber" : "text-ink-2"}>{money(r.expected)}</Td>
                        <Td align="right" className={short ? "text-amber" : ""}>{r.approved ? money(r.approved) : <span className="text-ink-3">—</span>}</Td>
                        <Td align="right">{r.paid ? money(r.paid) : <span className="text-ink-3">—</span>}</Td>
                        <Td align="right" className={r.age_days > 45 && !["paid", "reversed"].includes(r.status) ? "font-medium text-danger" : "text-ink-2"}><LocalizedText message="{value0}d" values={{ value0: int(r.age_days) }} /></Td>
                        <Td className="max-w-56 truncate text-xs text-ink-2">{r.denial_reason ? <span className="text-danger">{r.denial_code}: {r.denial_reason}</span> : ""}</Td>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="flex items-center gap-1.5 px-5 py-3 text-[11.5px] text-ink-3"><Kbd>{"J"}</Kbd><Kbd>{"K"}</Kbd> <LocalizedText message="move" /> <Kbd>{"X"}</Kbd> <LocalizedText message="select" /> <Kbd>{"Esc"}</Kbd> <LocalizedText message="close detail" /></p>
            </div>
          )}
        </div>
        <aside className={cx("min-h-0 border-l border-line bg-surface", openId ? "fixed inset-0 z-30 xl:static" : "hidden xl:block")}>
          {openId ? <ClaimPane id={openId} onClose={() => open(null)} /> : <SummaryPane summary={summary} onPayer={(id) => { setPayer(id); changeTab("submitted"); }} />}
        </aside>
      </div>
    </div>
  );
}

function SummaryPane({ summary, onPayer }: { summary?: Summary; onPayer: (id: string) => void }) {
  const { t, money, moneyC, int, plural } = usePharmacyFormat();
  if (!summary) return <div className="p-4"><Skeleton className="h-64" /></div>;
  const max = Math.max(1, ...summary.aging.map((a) => a.total));
  const totalDenials = summary.denials.reduce((s, d) => s + d.n, 0) || 1;
  return (
    <div className="scroll-y h-full">
      <PanelHeader title="Receivables by payer" sub="Unpaid amount by days since submission" />
      <ul className="flex flex-col gap-3 px-4 py-3">
        {summary.aging.map((a) => (
          <li key={a.payer_id}>
            <SourceButton onClick={() => onPayer(a.payer_id)} className="w-full text-left" title={t("Show {value0} claims", { value0: a.name })}>
              <span className="flex items-baseline gap-2 text-[13px]"><span className="font-semibold">{a.code}</span><span className="truncate text-xs text-ink-3">{a.name}</span><span className="num ml-auto font-medium">{money(a.total)}</span></span>
              <span className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-3" style={{ width: `${Math.max(8, (a.total / max) * 100)}%` }}>
                {AGING.map((b) => {
                  const v = a[b.key];
                  return v > 0 ? <span key={b.key} style={{ width: `${(v / a.total) * 100}%`, background: b.color }} title={t("{value0}: {value1}", { value0: t(b.label), value1: money(v) })} /> : null;
                })}
              </span>
            </SourceButton>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3 text-[11.5px] text-ink-3">
        {AGING.map((b) => (
          <span key={b.key} className="flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: b.color }} /><LocalizedText message={b.label} /></span>
        ))}
      </div>
      <div className="border-t border-line">
        <PanelHeader title="Why claims are denied" sub="All remittance lines to date" />
        <ul className="flex flex-col gap-2 px-4 py-3">
          {summary.denials.length === 0 && <li className="text-[13px] text-ink-3"><LocalizedText message="No denials recorded." /></li>}
          {summary.denials.map((d) => (
            <li key={d.code} className="text-[13px]">
              <span className="flex items-baseline gap-2"><span className="num font-semibold">{d.code}</span><span className="truncate text-ink-2">{d.reason}</span><span className="num ml-auto">{int(d.n)}</span></span>
              <span className="mt-1 block h-1.5 rounded-full bg-danger/70" style={{ width: `${(d.n / totalDenials) * 100}%` }} />
            </li>
          ))}
        </ul>
      </div>
      {summary.underpaid.n > 0 && (
        <p className="mx-4 mb-4 rounded-lg border border-amber-mark/40 bg-amber-wash px-3 py-2 text-[12.5px] text-amber">
          <LocalizedText message="{value0} paid below contract or short-paid, {value1} in total. Open the Underpaid tab to follow up." values={{ value0: plural(summary.underpaid.n, "claim"), value1: moneyC(summary.underpaid.amount ?? 0) }} />
        </p>
      )}
    </div>
  );
}

function ClaimPane({ id, onClose }: { id: string; onClose: () => void }) {
  const api = useApiClient();
  const { data: c, error, mutate } = useApi<ClaimDetail>(`/claims/${id}`);
  const { run, busy } = useAction();
  const who = useUserName();
  const { t, money, moneyC, dateShort, dateTime, int, num } = usePharmacyFormat();
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!c || c.id !== id) return <div className="flex flex-col gap-3 p-4"><Skeleton className="h-12" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>;
  const gap = Math.max(0, c.expected - c.approved) + (c.status.includes("paid") ? Math.max(0, c.approved - c.paid) : 0);
  const totals = [{ label: "Claimed", v: c.claimed }, { label: "Expected", v: c.expected }, { label: "Approved", v: c.approved }, { label: "Paid", v: c.paid }];

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-start gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2"><span className="num text-[15px] font-semibold">{c.claim_no}</span><StatusPill status={c.status} /></p>
          <p className="truncate text-[12.5px] text-ink-2">
            {c.priority === 1
              ? <LocalizedText message="{value0}, primary, member {value1}" values={{ value0: c.payer_name, value1: c.coverage.member_id }} />
              : <LocalizedText message="{value0}, secondary, member {value1}" values={{ value0: c.payer_name, value1: c.coverage.member_id }} />}
          </p>
        </div>
        <SourceButton onClick={onClose} aria-label="Close claim" className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"><X className="size-4" /></SourceButton>
      </div>
      <div className="scroll-y min-h-0 flex-1">
        <dl className="grid grid-cols-4 gap-2 border-b border-line px-4 py-3 text-[12px]">
          {totals.map((x) => (
            <div key={x.label}><dt className="text-ink-3"><LocalizedText message={x.label} /></dt><dd className="num text-[14px] font-semibold">{x.v === 0 ? "—" : money(x.v)}</dd></div>
          ))}
        </dl>
        {c.denial_reason && <p className="mx-4 mt-3 rounded-lg border border-danger/30 bg-danger-wash px-3 py-2 text-[12.5px] text-danger"><span className="num font-semibold">{c.denial_code}</span> {c.denial_reason}</p>}
        {gap > 0.01 && c.status !== "rejected" && <p className="mx-4 mt-3 rounded-lg border border-amber-mark/40 bg-amber-wash px-3 py-2 text-[12.5px] text-amber"><LocalizedText message="{value0} below what the contract says this claim should pay." values={{ value0: moneyC(gap) }} /></p>}

        <div className="px-4 py-3 text-[12.5px]">
          <p className="mb-1 flex items-center gap-2 text-ink-3">
            {c.patient_name} <span className="num">{c.mrn}</span>
            {c.prescription_id && <Link href={`/workbench?rx=${c.prescription_id}`} className="ml-auto inline-flex items-center gap-1 text-cobalt hover:underline"><span className="num">{c.rx_no}</span><ExternalLink className="size-3" /></Link>}
          </p>
          <Table className="w-full">
            <TableHeader><TableRow className="text-left text-[11.5px] text-ink-3"><TableHead className="py-1 font-medium"><LocalizedText message="Line" /></TableHead><TableHead className="py-1 text-right font-medium"><LocalizedText message="Qty" /></TableHead><TableHead className="py-1 text-right font-medium"><LocalizedText message="Claimed" /></TableHead><TableHead className="py-1 text-right font-medium"><LocalizedText message="Approved" /></TableHead></TableRow></TableHeader>
            <TableBody>
              {c.lines.map((l) => (
                <TableRow key={l.id} className="border-t border-line">
                  <TableCell className="py-1.5"><p className="font-medium">{l.name}</p><p className="num text-[11px] text-ink-3">{l.drug_code}{l.denial_code ? `, ${l.denial_code}` : ""}</p></TableCell>
                  <TableCell className="num py-1.5 text-right">{num(l.qty)}</TableCell>
                  <TableCell className="num py-1.5 text-right">{money(l.claimed)}</TableCell>
                  <TableCell className={cx("num py-1.5 text-right", l.denial_code ? "text-danger" : "")}>{money(l.approved)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {c.siblings.length > 0 && <p className="mt-2 text-ink-3"><LocalizedText message="Same bill:" /> {c.siblings.map((s) => <Tag key={s.id} tone="muted" className="ml-1"><span className="num">{s.claim_no}</span> {s.payer_code}</Tag>)}</p>}
        </div>

        <Panel className="mx-4 mb-3">
          <PanelHeader title="Remittance advice" />
          {c.remits.length === 0 ? <p className="px-4 py-3 text-[12.5px] text-ink-3"><LocalizedText message="No payer response yet." /></p> : (
            <ul className="divide-y divide-line text-[12.5px]">
              {c.remits.map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-4 py-2">
                  <Link href={`/remittance?ra=${r.remittance_id}`} className="num font-medium text-cobalt hover:underline">{r.ra_no}</Link>
                  <StatusPill status={r.outcome} /><span className="text-ink-3"><LocalizedText message="submission {value0}" values={{ value0: int(r.submission) }} /></span>
                  <span className="num ml-auto">{money(r.approved)}</span>
                </li>
              ))}
            </ul>
          )}
          {c.allocations.length > 0 && (
            <ul className="border-t border-line text-[12.5px]">
              {c.allocations.map((a) => <li key={a.id} className="flex items-center gap-2 px-4 py-2"><span className="num">{a.payment_ref}</span><span className="text-ink-3">{a.method.toUpperCase()}, {dateShort(a.at)}</span><span className="num ml-auto text-ok">+{money(a.amount)}</span></li>)}
            </ul>
          )}
        </Panel>

        <div className="px-4 pb-4">
          <p className="mb-1.5 text-[12px] font-medium text-ink-3"><LocalizedText message="History" /></p>
          <ol className="flex flex-col gap-1.5">
            {[...c.history].reverse().map((h) => (
              <li key={h.id} className="text-[12px]">
                <span className="flex items-center gap-1.5"><StatusPill status={h.to_status} /><span className="text-ink-2">{who(h.actor)}</span><span className="num ml-auto text-ink-3">{dateTime(h.at)}</span></span>
                {h.note && <p className="mt-0.5 text-ink-3">{h.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {["draft", "rejected", "submitted"].includes(c.status) && (
        <div className="flex shrink-0 justify-end gap-2 border-t border-line px-4 py-2.5">
          {c.status === "submitted" && <Button loading={busy === "adj"} icon={<Gavel className="size-4" />}
            onClick={() => run("adj", ({ operationKey }) => api.post("/claims/adjudicate", { ids: [c.id] }, { operationKey }), "Payer response received").then(() => mutate())}><LocalizedText message="Get payer response (demo)" /></Button>}
          {["draft", "rejected"].includes(c.status) && <Button variant="primary" loading={busy === "submit"} icon={<Send className="size-4" />}
            onClick={() => run("submit", ({ operationKey }) => api.post<SubmitResult>("/claims/submit", { ids: [c.id], note: c.status === "rejected" ? "Corrected and resubmitted" : undefined }, { operationKey }).then((r) => {
              if (!r.submitted) throw new Error(r.results[0]?.error ?? t("Could not submit"));
              return r;
            }), c.status === "rejected" ? t("{value0} resubmitted", { value0: c.claim_no }) : t("{value0} submitted", { value0: c.claim_no })).then(() => mutate())}>{c.status === "rejected" ? "Resubmit" : "Submit to payer"}</Button>}
        </div>
      )}
    </div>
  );
}
