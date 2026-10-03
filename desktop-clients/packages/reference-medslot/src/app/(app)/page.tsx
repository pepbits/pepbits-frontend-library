"use client";
import {SourceButton,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { ArrowUpRight, LogIn, Play, CircleCheck } from "lucide-react";
import {useSourceApi, qs } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import {CATEGORY_LABEL,SOURCES,STATUS,addDays,pct,titleCase,useMedslotFormat} from "../../lib/format";
import type { Appointment, Category, Department, Status } from "../../lib/types";
import { useAuth } from "../../components/shell/auth";
import { Button, Empty, ErrorNote, Panel, Segmented, Select, Skeleton, StatusBadge, cx } from "../../components/ui";
import { AppointmentDrawer } from "../../components/AppointmentDrawer";
import { CategoryIcon } from "../../components/icons";
import { useToast } from "../../components/toast";

interface Kpis {
  from: string; to: string; total: number; by_status: Partial<Record<Status, number>>;
  rates: { completion: number; no_show: number; cancellation: number; utilisation: number };
  avg_lead_days: number; avg_wait_minutes: number; avg_arrival_offset_minutes: number;
  patient_kinds: { new?: number; existing?: number }; sources: { source: string; n: number }[];
  trend: { date: string; total: number; completed: number; no_show: number; cancelled: number }[];
  by_department: { id: number; name: string; color: string; total: number; no_show: number; completed: number }[];
  top_services: { name: string; category: Category; n: number }[];
  utilisation: { id: number; name: string; type_name: string; open_minutes: number; booked_minutes: number; rate: number }[];
  notifications: Record<string, number>; today: { total: number; waiting: number; done: number; upcoming: number };
}

export default function Dashboard() {
  const {t: tr} = useLocalization();
  const { settings, user } = useAuth();
  const today = settings.facility_now.slice(0, 10);
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const [dept, setDept] = useState("");
  const depts = useApi<Department[]>("/departments");
  const k = useApi<Kpis>(`/kpis${qs({ from: addDays(today, -(Number(days) - 1)), to: today, department_id: dept })}`);
  const queue = useApi<{ items: Appointment[] }>(`/appointments${qs({ from: today, to: today, department_id: dept, status: "requested,scheduled,confirmed,checked_in,in_progress", limit: 200 })}`);
  const [openId, setOpenId] = useState<number | null>(null);
  const d = k.data;
  const greeting = Number(settings.facility_now.slice(11, 13)) < 12 ? "Good morning" : Number(settings.facility_now.slice(11, 13)) < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-mute">{greeting}, {user.name}</p>
          <h1 className="text-[26px] font-semibold tracking-[-0.015em]"><LocalizedText message="How the hospital is running" /></h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-52" aria-label="Department">
            <option value=""><LocalizedText message="All departments" /></option>
            {depts.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
          <Segmented value={days} onChange={setDays} options={[["7", "7 days"], ["30", "30 days"], ["90", "90 days"]]} />
        </div>
      </div>

      <ErrorNote error={k.error} onRetry={k.reload} />

      {/* Today, live */}
      <section className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl bg-ink text-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col justify-between gap-6 p-5">
          <div>
            <p className="text-sm text-white/60"><LocalizedText message="Today" /></p>
            <p className="tabular mt-1 text-5xl font-semibold tracking-tight">{d?.today.total ?? "–"}</p>
            <p className="text-sm text-white/60"><LocalizedText message="appointments on the books" /></p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TodayStat label="Waiting or in visit" value={d?.today.waiting} accent="text-[#b9a8ff]" />
            <TodayStat label="Still to come" value={d?.today.upcoming} accent="text-[#8fb6ea]" />
            <TodayStat label="Seen" value={d?.today.done} accent="text-[#7fe0c9]" />
          </div>
        </div>
        <TodayQueue items={queue.data?.items} loading={queue.loading} onOpen={setOpenId} onChanged={() => { queue.reload(); k.reload(); }} />
      </section>

      {/* Rates */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <Metric label="Appointments" value={d ? d.total.toLocaleString() : null} note={tr("last {value0} days", {value0: days})} />
        <Metric label="Completed" value={d ? pct(d.rates.completion) : null} note="of visits that were due" good />
        <Metric label="No-shows" value={d ? pct(d.rates.no_show) : null} note="aim below 8%" bad={!!d && d.rates.no_show > 0.08} />
        <Metric label="Cancellations" value={d ? pct(d.rates.cancellation) : null} note="of visits that were due" bad={!!d && d.rates.cancellation > 0.12} />
        <Metric label="Resource use" value={d ? pct(d.rates.utilisation) : null} note="booked of open time" />
        <Metric label="Booking lead time" value={d ? `${d.avg_lead_days.toFixed(1)} d` : null} note="request to visit" />
        <Metric label="Wait after check-in" value={d ? `${Math.round(d.avg_wait_minutes)} min` : null} note={d ? `patients arrive ${Math.abs(Math.round(d.avg_arrival_offset_minutes))} min ${d.avg_arrival_offset_minutes < 0 ? "early" : "late"}` : ""} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Daily volume and outcomes" actions={<Legend />}>
          {d ? <Trend data={d.trend} today={today} /> : <Skeleton className="h-56" />}
        </Panel>
        <Panel title="Patients" flush>
          {d ? <PatientMix d={d} /> : <div className="p-4"><Skeleton className="h-56" /></div>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="By department" flush>
          {d ? (
            <ul className="divide-y divide-line-2">
              {d.by_department.filter((x) => x.total).slice(0, 9).map((x) => {
                const max = d.by_department[0]?.total || 1;
                return (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ background: x.color }} />
                    <span className="w-36 truncate">{x.name}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-line-2"><span className="block h-full rounded-full" style={{ width: `${(x.total / max) * 100}%`, background: x.color }} /></span>
                    <span className="tabular w-12 text-right font-medium">{x.total}</span>
                    <span className={cx("tabular w-14 text-right text-xs", x.total && x.no_show / x.total > 0.1 ? "text-triage" : "text-mute")}>{x.total ? pct(x.no_show / x.total) : "–"} {" "}<LocalizedText message="NS" /></span>
                  </li>
                );
              })}
            </ul>
          ) : <div className="p-4"><Skeleton className="h-64" /></div>}
        </Panel>
        <Panel title="Busiest resources" flush actions={<Link href="/resources" className="text-xs font-medium text-scrub hover:underline"><LocalizedText message="Manage" /></Link>}>
          {d ? (
            <ul className="divide-y divide-line-2">
              {d.utilisation.slice(0, 9).map((u) => (
                <li key={u.id} className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate">{u.name} <span className="text-xs text-mute">{u.type_name}</span></span><span className="tabular font-medium">{pct(u.rate)}</span></div>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line-2"><span className={cx("block h-full rounded-full", u.rate > 0.85 ? "bg-triage" : u.rate > 0.6 ? "bg-amber" : "bg-scrub")} style={{ width: `${u.rate * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : <div className="p-4"><Skeleton className="h-64" /></div>}
        </Panel>
        <Panel title="Most booked services" flush>
          {d ? (
            <ul className="divide-y divide-line-2">
              {d.top_services.map((s) => (
                <li key={s.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <CategoryIcon category={s.category} className="size-4 text-mute" />
                  <span className="min-w-0 flex-1 truncate">{s.name}<span className="block text-xs text-mute">{CATEGORY_LABEL[s.category]}</span></span>
                  <span className="tabular font-medium">{s.n}</span>
                </li>
              ))}
              <li className="px-4 py-3">
                <p className="mb-2 text-xs font-medium text-mute"><LocalizedText message="Messages to patients" /></p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {Object.entries(d.notifications).map(([s, n]) => <span key={s}>{titleCase(s)} <strong className="tabular">{n}</strong></span>)}
                  {!Object.keys(d.notifications).length && <span className="text-mute"><LocalizedText message="None in this period." /></span>}
                </div>
              </li>
            </ul>
          ) : <div className="p-4"><Skeleton className="h-64" /></div>}
        </Panel>
      </div>

      <AppointmentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={(nid) => { queue.reload(); k.reload(); if (nid) setOpenId(nid); }} />
    </div>
  );
}

const TodayStat = ({ label, value, accent }: { label: string; value?: number; accent: string }) => (
  <div><p className={cx("tabular text-2xl font-semibold", accent)}>{value ?? "–"}</p><p className="text-xs text-white/55">{label}</p></div>
);

function TodayQueue({ items, loading, onOpen, onChanged }: { items?: Appointment[]; loading: boolean; onOpen: (id: number) => void; onChanged: () => void }) {
  const { fmtTime } = useMedslotFormat();
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const { settings, can } = useAuth();
  const [busy, setBusy] = useState<number | null>(null);
  const now = settings.facility_now;
  const list = useMemo(() => (items ?? []).filter((a) => a.end_at >= now || ["checked_in", "in_progress"].includes(a.status)).slice(0, 7), [items, now]);
  const act = async (a: Appointment, to: Status) => {
    setBusy(a.id);
    try { await api(`/appointments/${a.id}/status`, { method: "POST", json: { status: to } }); toast.success(STATUS[to].label, `${a.first_name} ${a.last_name}`); onChanged(); }
    catch (e) { toast.error(e); } finally { setBusy(null); }
  };
  return (
    <div className="border-t border-white/10 bg-white/[0.03] lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between px-5 pb-2 pt-4">
        <p className="text-sm font-medium"><LocalizedText message="Up next" /></p>
        <Link href="/appointments" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"><LocalizedText message="All of today" /><ArrowUpRight className="size-3.5" /></Link>
      </div>
      {loading && !items ? <div className="space-y-2 px-5 pb-5">{[...Array(4)].map((_, i) => <div key={i} className="h-11 animate-pulse rounded-lg bg-white/5" />)}</div> : list.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-white/50"><LocalizedText message="No more patients expected today." /></p>
      ) : (
        <ul className="px-2 pb-3">
          {list.map((a) => {
            const next: Status | undefined = a.status === "checked_in" ? "in_progress" : a.status === "in_progress" ? "completed" : a.allowed.includes("checked_in") ? "checked_in" : undefined;
            const Icon = next === "in_progress" ? Play : next === "completed" ? CircleCheck : LogIn;
            return (
              <li key={a.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.06]">
                <SourceButton onClick={() => onOpen(a.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="tabular w-16 shrink-0 text-sm font-semibold text-white/90">{fmtTime(a.start_at)}</span>
                  <span className="min-w-0"><span className="block truncate text-sm">{a.first_name} {a.last_name}{a.patient_kind === "new" && <span className="ml-1.5 text-[11px] text-[#f0c879]"><LocalizedText message="new" /></span>}</span>
                    <span className="block truncate text-xs text-white/50">{a.service_name}, {a.resources[0]?.name}</span></span>
                </SourceButton>
                <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                {next && can("admin", "scheduler", "provider") && (
                  <Button size="sm" variant="secondary" loading={busy === a.id} onClick={() => act(a, next)} className="border-white/15 bg-white/10 text-white hover:bg-white/20" icon={<Icon className="size-3.5" />}>
                    {next === "checked_in" ? tr("Check in") : next === "in_progress" ? tr("Start") : tr("Done")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value, note, good, bad }: { label: string; value: string | null; note?: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-xs text-mute">{label}</p>
      {value === null ? <Skeleton className="mt-1.5 h-7 w-20" /> : <p className={cx("tabular mt-0.5 text-[22px] font-semibold tracking-tight", bad ? "text-triage" : good ? "text-scrub-dark" : "")}>{value}</p>}
      {note && <p className="truncate text-[11px] text-mute"><LocalizedText message={note}/></p>}
    </div>
  );
}

const Legend = () => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mute">
    <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-scrub" /><LocalizedText message="Completed" /></span>
    <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-slot/60" /><LocalizedText message="Booked" /></span>
    <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-triage" /><LocalizedText message="No-show" /></span>
    <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-line" /><LocalizedText message="Cancelled" /></span>
  </div>
);

function Trend({ data, today }: { data: Kpis["trend"]; today: string }) {
  const { fmtDay } = useMedslotFormat();
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <Empty title="No appointments in this period" />;
  const max = Math.max(...data.map((x) => x.total), 1);
  const H = 200, gap = data.length > 40 ? 1 : 3;
  const h = hover !== null ? data[hover] : null;
  return (
    <div>
      <div className="mb-2 h-5 text-xs text-ink-2">{h ? <><strong>{fmtDay(h.date)}</strong><LocalizedText message={": {value0} total, {value1} completed, {value2} no-show, {value3} cancelled"} values={{ value0: (h.total) ?? "", value1: (h.completed) ?? "", value2: (h.no_show) ?? "", value3: (h.cancelled) ?? "" }} /></> : <span className="text-mute"><LocalizedText message="Hover a day for details" /></span>}</div>
      <div className="flex items-end" style={{ height: H, gap }} onMouseLeave={() => setHover(null)}>
        {data.map((x, i) => {
          const other = x.total - x.completed - x.no_show - x.cancelled;
          const seg = (n: number) => `${(n / max) * H}px`;
          return (
            <div key={x.date} onMouseEnter={() => setHover(i)} className={cx("flex flex-1 flex-col-reverse overflow-hidden rounded-t-[3px]", hover === i && "opacity-80", x.date === today && "outline-2 outline-offset-2 outline-ink/30")} style={{ height: "100%" }}>
              <span className="bg-scrub" style={{ height: seg(x.completed) }} />
              <span className="bg-slot/60" style={{ height: seg(other) }} />
              <span className="bg-triage" style={{ height: seg(x.no_show) }} />
              <span className="bg-line" style={{ height: seg(x.cancelled) }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-mute"><span>{fmtDay(data[0].date)}</span><span>{fmtDay(data[data.length - 1].date)}</span></div>
    </div>
  );
}

function PatientMix({ d }: { d: Kpis }) {
  const n = d.patient_kinds.new ?? 0, e = d.patient_kinds.existing ?? 0, t = n + e || 1;
  const srcTotal = d.sources.reduce((a, s) => a + s.n, 0) || 1;
  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <div className="mb-2 flex justify-between text-sm"><span><LocalizedText message="New patients" />{" "}<strong className="tabular">{n}</strong></span><span><LocalizedText message="Existing" />{" "}<strong className="tabular">{e}</strong></span></div>
        <div className="flex h-3 overflow-hidden rounded-full"><span className="bg-amber" style={{ width: `${(n / t) * 100}%` }} /><span className="flex-1 bg-scrub" /></div>
        <p className="mt-1.5 text-xs text-mute"><LocalizedText message={"{value0} of visits are a patient's first visit here."} values={{ value0: (pct(n / t)) ?? "" }} /></p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-mute"><LocalizedText message="How patients booked" /></p>
        <ul className="flex flex-col gap-1.5">
          {d.sources.map((s) => (
            <li key={s.source} className="flex items-center gap-2 text-sm">
              <span className="w-24 truncate">{SOURCES.find(([v]) => v === s.source)?.[1] ?? s.source}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-2"><span className="block h-full rounded-full bg-ink-2" style={{ width: `${(s.n / srcTotal) * 100}%` }} /></span>
              <span className="tabular w-12 text-right text-xs text-mute">{pct(s.n / srcTotal)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
