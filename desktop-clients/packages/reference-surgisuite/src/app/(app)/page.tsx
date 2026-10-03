"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceButton } from "@pepbits/ops-ui";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useEffect, useState } from "react";
import { useApi } from "./../../lib/api";
import { STATUS_META, TONE_BAR, duration, minutesBetween, useSourceFormat} from "./../../lib/format";
import { Badge, Empty, ErrorNote, PanelHeader, Spinner, cx } from "./../../components/ui";
import { IconAlert } from "./../../components/icons";
import { useBookCase } from "./../../components/Shell";

type BoardCase = {
  id: number; case_no: string; scheduled_start: string; est_duration_min: number; status: string; patient_name: string; mrn: string; allergies: string;
  procedure_name: string; cpt: string; surgeon: string; anesthesiologist: string; case_class: string; milestones: Record<string, string>;
};
type Lane = {
  id: number; code: string; name: string; kind: string; state: string; current: BoardCase | null; turnover: BoardCase | null; next: BoardCase | null;
  done: number; total: number; timeline: { id: number; case_no: string; start: string; est: number; status: string; procedure: string; inRoom: string | null; outRoom: string | null }[];
};
type Dash = {
  board: Lane[];
  kpis: Record<string, number | null>;
  alerts: { id: number; ts: string; text: string; severity: string; case_id: number; case_no: string; theatre_code: string }[];
  equipmentDown: { code: string; name: string; status: string }[];
};

const PHASES = [
  { code: "IN_ROOM", label: "In room" },
  { code: "INDUCTION_DONE", label: "Induction" },
  { code: "TIME_OUT", label: "Time-out" },
  { code: "INCISION", label: "Surgery" },
  { code: "CLOSURE_END", label: "Closure" },
  { code: "OUT_OF_ROOM", label: "Out" },
];

const STATE_STYLE: Record<string, { tone: string; label: string }> = {
  Surgery: { tone: "bg-go text-white", label: "Surgery" },
  Anesthesia: { tone: "bg-violet text-white", label: "Anesthesia" },
  Turnover: { tone: "bg-amber text-white", label: "Turnover" },
  Idle: { tone: "bg-steel-2 text-muted", label: "Idle" },
  Maintenance: { tone: "bg-stop text-white", label: "Closed" },
};

export default function BoardPage() {
  const {shortDate}=useSourceFormat();
 const {time}=useSourceFormat();
  const { data, error, loading } = useApi<Dash>("/dashboard", 20000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (loading && !data) return <Spinner label="Loading the theatre board" />;
  if (error && !data) return <div className="p-6"><ErrorNote error={error} /></div>;
  if (!data) return null;
  const k = data.kpis;

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="font-cond text-[24px] font-semibold leading-none"><LocalizedText message={"Theatre board"}/></h1>
          <p className="mt-1 text-[13px] text-muted">{shortDate(new Date().toISOString())}<LocalizedText message={". Refreshes every 20 seconds."}/></p>
        </div>
        <dl className="flex flex-wrap items-stretch divide-x divide-line rounded-[10px] border border-line bg-white">
          <Stat label="Cases today" value={k.total} />
          <Stat label="In surgery" value={k.inProgress} tone="text-go" />
          <Stat label="Recovery" value={k.recovery} />
          <Stat label="Still to go" value={k.upcoming} />
          <Stat label="First starts on time" value={k.onTimeStart === null ? "—" : `${k.onTimeStart}%`} />
          <Stat label="Avg turnover" value={k.avgTurnover === null ? "—" : `${k.avgTurnover}m`} />
          <Stat label="Approvals waiting" value={k.pendingApprovals} tone={k.pendingApprovals ? "text-amber" : ""} href="/approvals" />
          <Stat label="Low stock" value={k.lowStock} tone={k.lowStock ? "text-stop" : ""} href="/inventory?flag=low" />
        </dl>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        <section className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="hidden grid-cols-[150px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-4 border-b border-line bg-steel/60 px-4 py-2 text-[12px] font-medium text-muted xl:grid">
            <span><LocalizedText message={"Theatre"}/></span>
            <span><LocalizedText message={"Now"}/></span>
            <span><LocalizedText message={"Today, with the red line at now"}/></span>
            <span><LocalizedText message={"Next"}/></span>
          </div>
          <div className="scroll-y min-h-0 flex-1 divide-y divide-line">
            {data.board.map((lane) => (
              <LaneRow key={lane.id} lane={lane} now={now} />
            ))}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col gap-3">
          <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelHeader title="Alerts, last 24 hours">
              <Badge tone={data.alerts.some((a) => a.severity === "critical") ? "stop" : "neutral"}>{data.alerts.length}</Badge>
            </PanelHeader>
            <ul className="scroll-y min-h-0 flex-1 divide-y divide-line">
              {data.alerts.length === 0 && <Empty title="No alerts"><LocalizedText message={"Critical results, count discrepancies and delays show up here."}/></Empty>}
              {data.alerts.map((a) => (
                <li key={a.id}>
                  <Link href={`/cases/${a.case_id}`} className="flex gap-2.5 px-4 py-2.5 hover:bg-steel/60">
                    <IconAlert size={16} className={cx("mt-0.5 shrink-0", a.severity === "critical" ? "text-stop" : "text-amber")} />
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-snug">{a.text}</span>
                      <span className="block text-[12px] text-muted">{a.theatre_code} {a.case_no}, {time(a.ts)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel shrink-0">
            <PanelHeader title="Equipment not ready" />
            <ul className="px-4 py-2 text-[13px]">
              {data.equipmentDown.length === 0 && <li className="py-1 text-muted"><LocalizedText message={"All equipment is ready."}/></li>}
              {data.equipmentDown.map((e) => (
                <li key={e.code} className="flex justify-between py-1">
                  <span>{e.name}</span>
                  <Badge tone="stop">{e.status}</Badge>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: React.ReactNode; tone?: string; href?: string }) {
  const inner = (
    <>
      <dd className={cx("font-cond text-[22px] font-semibold leading-none", tone)}>{value ?? "—"}</dd>
      <dt className="mt-1 whitespace-nowrap text-[11px] text-muted">{label}</dt>
    </>
  );
  return href ? (
    <Link href={href} className="flex flex-col justify-center px-3.5 py-2 hover:bg-steel/60">{inner}</Link>
  ) : (
    <div className="flex flex-col justify-center px-3.5 py-2">{inner}</div>
  );
}

function LaneRow({ lane, now }: { lane: Lane; now: number }) {
 const {t:translateSource}=useLocalization();
 const {time}=useSourceFormat();
  const book = useBookCase();
  const c = lane.current;
  const st = STATE_STYLE[lane.state] ?? STATE_STYLE.Idle;
  const elapsed = c?.milestones.IN_ROOM ? Math.round((now - Date.parse(c.milestones.IN_ROOM)) / 60000) : null;
  const over = c && elapsed !== null && elapsed > c.est_duration_min;

  return (
    <div className="grid gap-x-4 gap-y-2 px-4 py-3 xl:grid-cols-[150px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)] xl:items-center">
      <div className="flex items-center justify-between gap-2 xl:block">
        <div>
          <div className="font-cond text-[20px] font-semibold leading-none">{lane.code}</div>
          <div className="text-[12px] text-muted">{lane.name}, {lane.done}/{lane.total} {" "}<LocalizedText message={"done"}/></div>
        </div>
        <span className={cx("mt-1.5 inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[12px] font-semibold", st.tone)}>
          {(lane.state === "Surgery" || lane.state === "Anesthesia") && <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />}
          {st.label}
        </span>
      </div>

      <div className="min-w-0">
        {c ? (
          <Link href={`/cases/${c.id}`} className="block rounded-[8px] px-2 py-1 -mx-2 hover:bg-steel/60">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{c.patient_name}</span>
              <span className={cx("shrink-0 text-[12px] font-medium", over ? "text-stop" : "text-muted")}>
                {duration(elapsed)} {" "}<LocalizedText message={"of"}/>{" "}{duration(c.est_duration_min)}
              </span>
            </div>
            <div className="truncate text-[13px] text-muted">
              {c.cpt} {c.procedure_name}, {c.surgeon}
            </div>
            <div className="mt-1.5 grid grid-cols-6 gap-1" aria-label="Case progress">
              {PHASES.map((p) => (
                <div key={p.code} title={translateSource("{value0}{value1}",{value0:p.label,value1:c.milestones[p.code] ? ` at ${time(c.milestones[p.code])}` : ""})} className={cx("phase-cell", c.milestones[p.code] && (p.code === "INCISION" || p.code === "CLOSURE_END" ? "bg-go" : "bg-violet"))} />
              ))}
            </div>
            {c.allergies !== "NKDA" && <div className="mt-1 text-[12px] font-medium text-stop"><LocalizedText message={"Allergy:"}/>{" "}{c.allergies}</div>}
          </Link>
        ) : lane.turnover ? (
          <div className="text-[13px]">
            <div className="font-medium text-amber"><LocalizedText message={"Cleaning after"}/>{" "}{lane.turnover.case_no}</div>
            <div className="text-muted"><LocalizedText message={"Out at"}/>{" "}{time(lane.turnover.milestones.OUT_OF_ROOM)}, {duration(minutesBetween(lane.turnover.milestones.OUT_OF_ROOM, new Date(now).toISOString()))} {" "}<LocalizedText message={"ago"}/></div>
          </div>
        ) : (
          <div className="text-[13px] text-muted"><LocalizedText message={"No patient in the room."}/></div>
        )}
      </div>

      <DayStrip lane={lane} now={now} />

      <div className="min-w-0 text-[13px]">
        {lane.next ? (
          <Link href={`/cases/${lane.next.id}`} className="block rounded-[8px] px-2 py-1 -mx-2 hover:bg-steel/60">
            <div className="flex items-center gap-2">
              <span className="font-cond text-[16px] font-semibold">{time(lane.next.scheduled_start)}</span>
              {lane.next.status === "PENDING_APPROVAL" && <Badge tone="amber"><LocalizedText message={"Awaiting approval"}/></Badge>}
              {lane.next.case_class === "Emergency" && <Badge tone="stop"><LocalizedText message={"Emergency"}/></Badge>}
            </div>
            <div className="truncate">{lane.next.patient_name}</div>
            <div className="truncate text-muted">{lane.next.procedure_name}</div>
          </Link>
        ) : (
          <SourceButton className="text-ceil hover:underline" onClick={() => book({ theatreId: lane.id })}>
            <LocalizedText message={"Nothing booked. Book this theatre"}/></SourceButton>
        )}
      </div>
    </div>
  );
}

function DayStrip({ lane, now }: { lane: Lane; now: number }) {
 const {t:translateSource}=useLocalization();
  const day = new Date(now);
  const starts = lane.timeline.map((t) => Date.parse(t.inRoom ?? t.start));
  const ends = lane.timeline.map((t, i) => (t.outRoom ? Date.parse(t.outRoom) : starts[i] + t.est * 60000));
  const start = Math.min(new Date(day).setHours(7, 0, 0, 0), ...starts, now - 3600000);
  const end = Math.max(new Date(day).setHours(20, 0, 0, 0), ...ends, now + 3600000);
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100));
  return (
    <div className="relative h-7 rounded-[5px] bg-steel" aria-label={translateSource("{value0} schedule today",{value0:lane.code})}>
      {Array.from({ length: Math.ceil((end - start) / 7200000) }, (_, i) => Math.ceil(start / 7200000) * 7200000 + i * 7200000).map((h) => (
        <span key={h} className="absolute top-0 h-full w-px bg-white" style={{ left: `${pct(h)}%` }} />
      ))}
      {lane.timeline.map((t) => {
        const s = t.inRoom ? Date.parse(t.inRoom) : Date.parse(t.start);
        const e = t.outRoom ? Date.parse(t.outRoom) : Math.max(s + t.est * 60000, t.inRoom ? now : 0);
        const tone = STATUS_META[t.status]?.tone ?? "neutral";
        const left = pct(s);
        const width = Math.max(1.5, pct(e) - left);
        return (
          <Link
            key={t.id}
            href={`/cases/${t.id}`}
            title={translateSource("{value0} {value1} ({value2})",{value0:t.case_no,value1:t.procedure,value2:STATUS_META[t.status]?.label})}
            className={cx("absolute top-1 h-5 rounded-[3px] opacity-90 hover:opacity-100", TONE_BAR[tone], t.status === "COMPLETED" && "opacity-50")}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })}
      {now >= start && now <= end && <span className="absolute -top-0.5 h-8 w-0.5 rounded bg-stop" style={{ left: `${pct(now)}%` }} aria-label="Now" />}
    </div>
  );
}
