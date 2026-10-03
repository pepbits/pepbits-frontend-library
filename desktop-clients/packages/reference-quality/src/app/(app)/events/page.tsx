"use client";
import { useReferenceHost } from "@pepbits/reference-host";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/controls";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi, useDebounced } from "../../../lib/hooks";
import { useAuth, useMeta } from "../../../lib/auth";
import { Badge, Button, ErrorState, Field, Input, Loading, Modal, PageHeader, Pager, Panel, Select, Tabs, DateTimeInput } from "../../../components/ui";
import { BarsChart } from "../../../components/charts";
import { TransactionDrawer } from "../../../components/TransactionDrawer";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface Stats {
  byDomain: { domain: string; transactions: number; complete: number; last24h: number }[];
  ingestion: { outcome: string; n: number }[];
  lastIngested: { source_system: string; last: string }[];
  corrections: { event_kind: string; n: number }[];
  hourly: { hour: string; n: number }[];
}
interface TxRow { id: string; domain: string; facility_code: string; priority: string; attributes: Record<string, unknown>; started_at: string; current_state: string; current_state_at: string; is_complete: number; last_sequence: number }
interface EventRow { event_id: string; transaction_id: string; domain: string; event_type: string; facility_code: string; occurred_at: string; ingested_at: string; source_system: string; source_event_key: string; actor: string | null; event_kind: string }


export default function EventsPage() {
  const PAGE = useReferenceHost().preferences.pageSize; // the effective page-size preference
  const { t } = useLocalization();
  const { fmtDateTime, fmtNumber, fmtRelative, humanize } = useQualityFormat();
  const meta = useMeta();
  const { can } = useAuth();
  const [tab, setTab] = useState<"transactions" | "events">("transactions");
  const [domain, setDomain] = useState("");
  const [facility, setFacility] = useState("");
  const [state, setState] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [tx, setTx] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const q = useDebounced(search);
  useEffect(() => setOffset(0), [tab, domain, facility, state, kind, q]);

  const stats = useApi<Stats>("/events/stats");
  const txs = useApi<{ total: number; rows: TxRow[] }>(tab === "transactions" ? "/transactions" : null, { domain, facility, state, search: q, limit: PAGE, offset });
  const events = useApi<{ total: number; rows: EventRow[] }>(tab === "events" ? "/events" : null, { domain, facility, kind, search: q, limit: PAGE, offset });

  const ing = Object.fromEntries((stats.data?.ingestion ?? []).map((r) => [r.outcome, r.n]));
  const kinds = Object.fromEntries((stats.data?.corrections ?? []).map((r) => [r.event_kind, r.n]));
  const domainLabel = (id: string) => t(meta.eventDomains.find((d) => d.id === id)?.label ?? id);

  return (
    <>
      <PageHeader
        title="Event Pulse"
        description="Each clinical workflow is a transaction: an immutable history of stage events plus its current state. Indicators and turnaround times are calculated from this history."
        actions={
          can("events.ingest") && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setIngesting(true)}><LocalizedText message="Record an event" /></Button>
          )
        }
      />

      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}
      {stats.data && (
        <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Transactions by domain" bodyClassName="overflow-x-auto p-0">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="Domain" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Transactions" /></TableHead>
                  <TableHead className="right"><LocalizedText message="In progress" /></TableHead>
                  <TableHead className="right"><LocalizedText message="Started in last 24 h" /></TableHead>
                  <TableHead><LocalizedText message="Source" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.data.byDomain.map((d) => {
                  const src = meta.eventDomains.find((x) => x.id === d.domain)?.source;
                  const last = stats.data!.lastIngested.find((l) => l.source_system === src)?.last;
                  return (
                    <TableRow key={d.domain} className="cursor-pointer" onClick={() => { setDomain(d.domain); setTab("transactions"); }}>
                      <TableCell className="font-medium">{domainLabel(d.domain)}</TableCell>
                      <TableCell className="num right">{fmtNumber(d.transactions)}</TableCell>
                      <TableCell className="num right">{fmtNumber(d.transactions - d.complete)}</TableCell>
                      <TableCell className="num right">{fmtNumber(d.last24h)}</TableCell>
                      <TableCell className="text-xs text-ink-3"><LocalizedText message="{value0}, last event {value1}" values={{ value0: src ?? "", value1: fmtRelative(last) }} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>
          <Panel title="Ingestion" description="Every delivery from a source system is logged, including those not stored">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-ink-3"><LocalizedText message="Accepted" /></div>
                <div className="num text-lg font-semibold">{fmtNumber(ing.accepted ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-ink-3"><LocalizedText message="Duplicates ignored" /></div>
                <div className="num text-lg font-semibold">{fmtNumber(ing.duplicate ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-ink-3"><LocalizedText message="Rejected" /></div>
                <div className={cls("num text-lg font-semibold", (ing.rejected ?? 0) > 0 && "text-bad")}>{fmtNumber(ing.rejected ?? 0)}</div>
              </div>
              <div>
                <div className="text-xs text-ink-3"><LocalizedText message="Corrections" /></div>
                <div className="num text-lg font-semibold">{fmtNumber(kinds.correction ?? 0)}</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-ink-3"><LocalizedText message="Events per hour, last 24 hours" /></div>
            <BarsChart data={stats.data.hourly.map((h) => ({ hour: `${String(new Date(`${h.hour.slice(0, 10)}T${h.hour.slice(11, 13)}:00:00Z`).getHours()).padStart(2, "0")}:00`, n: h.n }))} xKey="hour" bars={[{ key: "n", name: "Events", color: "#0e6b5c" }]} height={120} />
          </Panel>
        </div>
      )}

      <Panel bodyClassName="p-0">
        <div className="px-4 pt-2">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: "transactions", label: "Transactions (current state)" },
              { id: "events", label: "Event stream" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-ink-3" />
            <Input className="pl-9" placeholder={tab === "transactions" ? "Transaction ID or patient reference" : "Transaction ID or source event key"} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Domain" className="w-40" value={domain} onChange={(e) => setDomain(e.target.value)}>
            <option value=""><LocalizedText message="All domains" /></option>
            {meta.eventDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.label)}
              </option>
            ))}
          </Select>
          <Select aria-label="Facility" className="w-52" value={facility} onChange={(e) => setFacility(e.target.value)}>
            <option value=""><LocalizedText message="All facilities" /></option>
            {meta.facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          {tab === "transactions" ? (
            <Select aria-label="State" className="w-36" value={state} onChange={(e) => setState(e.target.value)}>
              <option value=""><LocalizedText message="Any state" /></option>
              <option value="open"><LocalizedText message="In progress" /></option>
              <option value="complete"><LocalizedText message="Complete" /></option>
            </Select>
          ) : (
            <Select aria-label="Kind" className="w-36" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value=""><LocalizedText message="All kinds" /></option>
              <option value="normal"><LocalizedText message="Normal" /></option>
              <option value="correction"><LocalizedText message="Corrections" /></option>
            </Select>
          )}
        </div>

        {tab === "transactions" && (
          <>
            {txs.error && <div className="p-4"><ErrorState message={txs.error} onRetry={txs.reload} /></div>}
            {!txs.data && txs.loading && <Loading className="p-4" rows={8} />}
            {txs.data && (
              <TableContainer overflow="horizontal" className={cls("overflow-x-auto", txs.loading && "opacity-60")}>
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead><LocalizedText message="Transaction" /></TableHead>
                      <TableHead><LocalizedText message="Domain" /></TableHead>
                      <TableHead><LocalizedText message="Facility" /></TableHead>
                      <TableHead><LocalizedText message="Detail" /></TableHead>
                      <TableHead><LocalizedText message="Current state" /></TableHead>
                      <TableHead><LocalizedText message="Updated" /></TableHead>
                      <TableHead className="right"><LocalizedText message="Events" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.data.rows.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer" onClick={() => setTx(t.id)}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell>{domainLabel(t.domain)}</TableCell>
                        <TableCell className="text-ink-2">{t.facility_code}</TableCell>
                        <TableCell className="text-ink-2">
                          {t.priority === "STAT" && <Badge tone="bad" className="mr-1.5"><LocalizedText message="STAT" /></Badge>}
                          {String(t.attributes.test ?? t.attributes.modality ?? t.attributes.department ?? t.attributes.acuity ?? t.attributes.ward ?? "")}
                        </TableCell>
                        <TableCell>
                          <Badge tone={t.is_complete ? (/cancel|without/.test(t.current_state) ? "neutral" : "ok") : "warn"} dot>
                            {humanize(t.current_state)}
                          </Badge>
                        </TableCell>
                        <TableCell className="num text-ink-2">{fmtDateTime(t.current_state_at)}</TableCell>
                        <TableCell className="num right text-ink-3">{t.last_sequence}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pager total={txs.data.total} offset={offset} limit={PAGE} onChange={setOffset} />
              </TableContainer>
            )}
          </>
        )}

        {tab === "events" && (
          <>
            {events.error && <div className="p-4"><ErrorState message={events.error} onRetry={events.reload} /></div>}
            {!events.data && events.loading && <Loading className="p-4" rows={8} />}
            {events.data && (
              <TableContainer overflow="horizontal" className={cls("overflow-x-auto", events.loading && "opacity-60")}>
                <Table className="data-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead><LocalizedText message="Occurred" /></TableHead>
                      <TableHead><LocalizedText message="Event" /></TableHead>
                      <TableHead><LocalizedText message="Transaction" /></TableHead>
                      <TableHead><LocalizedText message="Facility" /></TableHead>
                      <TableHead><LocalizedText message="Source" /></TableHead>
                      <TableHead className="right"><LocalizedText message="Received after" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.data.rows.map((e) => {
                      const lag = (Date.parse(e.ingested_at) - Date.parse(e.occurred_at)) / 1000;
                      return (
                        <TableRow key={e.event_id} className="cursor-pointer" onClick={() => setTx(e.transaction_id)}>
                          <TableCell className="num text-ink-2">{fmtDateTime(e.occurred_at)}</TableCell>
                          <TableCell>
                            <span className="font-medium">{humanize(e.event_type)}</span>
                            {e.event_kind !== "normal" && <Badge tone="warn" className="ml-2">{humanize(e.event_kind)}</Badge>}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{e.transaction_id}</TableCell>
                          <TableCell className="text-ink-2">{e.facility_code}</TableCell>
                          <TableCell className="text-xs text-ink-3">
                            {e.source_system} <span className="font-mono">{e.source_event_key}</span>
                          </TableCell>
                          <TableCell className={cls("num right text-xs", lag > 300 ? "text-warn" : "text-ink-3")}>{lag < 60 ? `${Math.round(lag)} s` : lag < 3600 ? `${Math.round(lag / 60)} min` : `${Math.round(lag / 3600)} h`}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Pager total={events.data.total} offset={offset} limit={PAGE} onChange={setOffset} />
              </TableContainer>
            )}
          </>
        )}
      </Panel>

      <TransactionDrawer id={tx} onClose={() => setTx(null)} />
      <IngestModal
        open={ingesting}
        onClose={() => setIngesting(false)}
        onDone={(id) => {
          void stats.reload();
          void txs.reload();
          void events.reload();
          if (id) setTx(id);
        }}
      />
    </>
  );
}

function IngestModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (txId?: string) => void }) {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const { fmtTime, humanize } = useQualityFormat();
  const meta = useMeta();
  const toast = useToast();
  const [domain, setDomain] = useState("lab");
  const [facility, setFacility] = useState(String(meta.facilities[0]?.id ?? ""));
  const [txId, setTxId] = useState("");
  const [eventType, setEventType] = useState("");
  const [occurred, setOccurred] = useState("");
  const [priority, setPriority] = useState("routine");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const cfg = meta.eventDomains.find((d) => d.id === domain)!;

  useEffect(() => {
    if (!open) return;
    const stamp = Date.now().toString(36).toUpperCase();
    setTxId(`${domain.slice(0, 3).toUpperCase()}-MAN-${stamp}`);
    setKey(`${stamp}:1`);
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    setOccurred(`${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`);
    setResult(null);
  }, [open, domain]);
  useEffect(() => setEventType(cfg.stages[0]), [cfg]);

  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await api<{ outcome: string; message?: string }>("/events/ingest", {
        body: {
          domain,
          facility_id: Number(facility),
          transaction_id: txId,
          event_type: eventType,
          occurred_at: new Date(occurred).toISOString(),
          source_system: cfg.source,
          source_event_key: key,
          priority,
          actor: "Manual entry",
        },
      });
      if (res.outcome === "duplicate") {
        setResult(res.message ?? "Duplicate ignored.");
      } else {
        toast("Recorded {value0} for {value1}.", "success", { value0: humanize(eventType).toLowerCase(), value1: txId });
        const [base, seq] = key.split(":");
        setKey(`${base}:${Number(seq ?? 1) + 1}`);
        const next = cfg.stages[cfg.stages.indexOf(eventType) + 1];
        if (next) setEventType(next);
        onDone();
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Could not record the event.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an event"
      description="Normally events arrive from source systems. Use this to test ingestion: sending the same source key twice is recognised as a duplicate and ignored."
      footer={
        <>
          <Button variant="ghost" onClick={() => { onDone(txId); onClose(); }}><LocalizedText message="Open transaction" /></Button>
          <Button variant="primary" loading={busy} onClick={submit}><LocalizedText message="Record event" /></Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Domain">
          <Select value={domain} onChange={(e) => setDomain(e.target.value)}>
            {meta.eventDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {t(d.label)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Facility">
          <Select value={facility} onChange={(e) => setFacility(e.target.value)}>
            {meta.facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Transaction ID">
          <Input value={txId} onChange={(e) => setTxId(e.target.value)} className="font-mono text-xs" />
        </Field>
        <Field label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="routine"><LocalizedText message="Routine" /></option>
            <option value="STAT"><LocalizedText message="STAT" /></option>
          </Select>
        </Field>
        <Field label="Stage">
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {[...cfg.stages, cfg.cancel].map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Occurred at (your local time)">
          <DateTimeInput value={occurred} onChange={(e) => setOccurred(e.target.value)} />
        </Field>
        <Field label="Source system">
          <Input value={cfg.source} disabled />
        </Field>
        <Field label="Source event key" hint="Unique per source system; used to detect duplicates">
          <Input value={key} onChange={(e) => setKey(e.target.value)} className="font-mono text-xs" />
        </Field>
      </div>
      {result && <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-ink" role="status"><LocalizedText message={result} /></p>}
      <p className="mt-3 text-xs text-ink-3"><LocalizedText message="Current time: {value0}" values={{ value0: fmtTime(new Date().toISOString()) }} /></p>
    </Modal>
  );
}
