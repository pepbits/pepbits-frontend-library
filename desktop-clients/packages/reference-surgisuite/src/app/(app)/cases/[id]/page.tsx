"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceButton } from "@pepbits/ops-ui";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useParams } from "@pepbits/reference-surgisuite/internal-navigation";
import { useState } from "react";
import { useSourceApi, useApi } from "./../../../../lib/api";
import { useLookups } from "./../../../../lib/masters";
import { age, duration, toLocalInput , useSourceFormat} from "./../../../../lib/format";
import { Badge, Button, ErrorNote, Field, Modal, Select, Spinner, StatusBadge, cx, useAction } from "./../../../../components/ui";
import {
  IconActivity, IconApprove, IconBox, IconCases, IconChevronLeft, IconCode, IconFlask, IconHeart, IconMoney, IconReport, IconScore, IconShield, IconTeam,
} from "./../../../../components/icons";
import type { CaseBundle } from "./../../../../components/case/types";
import { OverviewTab, TeamTab } from "./../../../../components/case/CaseCore";
import { CodingTab } from "./../../../../components/case/CaseCoding";
import { ApprovalsTab, SafetyTab } from "./../../../../components/case/CaseSafety";
import { AnesthesiaTab, OrdersTab } from "./../../../../components/case/CaseIntraop";
import { MaterialsTab, ScoresTab } from "./../../../../components/case/CaseMaterials";
import { ActivityTab, BillingTab, ReportTab } from "./../../../../components/case/CaseReport";

const TABS = [
  { key: "overview", label: "Overview", icon: IconCases, C: OverviewTab },
  { key: "team", label: "Team & equipment", icon: IconTeam, C: TeamTab },
  { key: "coding", label: "Diagnosis & CPT", icon: IconCode, C: CodingTab },
  { key: "approvals", label: "Approvals & consent", icon: IconApprove, C: ApprovalsTab },
  { key: "safety", label: "Checklist & counts", icon: IconShield, C: SafetyTab },
  { key: "anesthesia", label: "Anesthesia record", icon: IconHeart, C: AnesthesiaTab },
  { key: "orders", label: "Imaging, lab & blood", icon: IconFlask, C: OrdersTab },
  { key: "materials", label: "Materials & implants", icon: IconBox, C: MaterialsTab },
  { key: "scores", label: "Risk scores", icon: IconScore, C: ScoresTab },
  { key: "report", label: "Operative report", icon: IconReport, C: ReportTab },
  { key: "billing", label: "Charges & claim", icon: IconMoney, C: BillingTab },
  { key: "activity", label: "Activity & audit", icon: IconActivity, C: ActivityTab },
] as const;

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, error, loading, reload } = useApi<CaseBundle>(`/cases/${id}`, 30000);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");

  if (loading && !c) return <Spinner label="Opening case" />;
  if (error && !c) return <div className="p-6"><ErrorNote error={error} /></div>;
  if (!c) return null;

  const Active = TABS.find((t) => t.key === tab)!.C;
  const badges: Record<string, number> = {
    approvals: c.approvals.filter((a) => a.status === "Pending" && a.required).length + c.readiness.consents.length,
    orders: c.orders.filter((o) => o.status !== "Resulted").length,
  };

  return (
    <div className="flex h-full flex-col">
      <Banner c={c} reload={reload} />
      <MilestoneTrack c={c} reload={reload} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="scroll-x flex shrink-0 gap-1 border-b border-line bg-white px-2 py-1.5 md:w-56 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:py-3" aria-label="Case sections">
          {TABS.map((t) => (
            <SourceButton
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={cx(
                "flex shrink-0 items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-left text-[13px] transition-colors",
                tab === t.key ? "bg-ceil-soft font-medium text-ceil-2" : "text-muted hover:bg-steel hover:text-ink",
              )}
            >
              <t.icon size={17} className="shrink-0" />
              <span className="whitespace-nowrap"><LocalizedText message={t.label}/></span>
              {badges[t.key] > 0 && <span className="ml-auto rounded bg-amber px-1.5 text-[11px] font-semibold text-white">{badges[t.key]}</span>}
            </SourceButton>
          ))}
        </nav>
        <div className="scroll-y min-h-0 min-w-0 flex-1 p-3 md:p-4">
          <Active c={c} reload={reload} />
        </div>
      </div>
    </div>
  );
}

function Banner({ c, reload }: { c: CaseBundle; reload: () => void }) {
 const {time,shortDate}=useSourceFormat();
 const api=useSourceApi();
  const p = c.patient;
  const surgeon = c.team.find((t) => t.role === "Primary Surgeon" && !t.time_out) ?? c.team.find((t) => t.role === "Primary Surgeon");
  const anes = c.team.find((t) => t.role === "Anesthesiologist");
  const primary = c.procedures.find((x) => x.role === "Primary");
  const [modal, setModal] = useState<"cancel" | "postpone" | null>(null);
  const lookups = useLookups();
  const [reason, setReason] = useState("");
  const { run, busy, error } = useAction();
  const preStart = ["REQUESTED", "PENDING_APPROVAL", "SCHEDULED", "CHECKED_IN", "POSTPONED"].includes(c.status);

  return (
    <div className="border-b border-line bg-white px-3 py-2.5 md:px-4">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <Link href="/cases" className="mt-1 rounded p-1 text-muted hover:bg-steel" aria-label="Back to cases">
          <IconChevronLeft size={18} />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-cond text-[22px] font-semibold leading-tight">{p.name}</h1>
            <span className="text-[13px] text-muted">{age(p.dob)} {p.sex}, {p.mrn}, {p.blood_group ?? "group unknown"}{p.weight_kg ? `, ${p.weight_kg} kg` : ""}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={c.status} />
            {c.case_class !== "Elective" && <Badge tone={c.case_class === "Emergency" ? "stop" : "amber"}>{c.case_class}</Badge>}
            <Badge tone={p.allergies === "NKDA" ? "muted" : "stop"}>{p.allergies === "NKDA" ? "No known drug allergies" : `Allergy: ${p.allergies}`}</Badge>
            {p.comorbidities && <Badge tone="neutral">{p.comorbidities}</Badge>}
          </div>
        </div>
        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-4">
          <div className="min-w-0"><dt className="text-[11px] text-muted">{c.case_no}</dt><dd className="truncate font-medium">{primary ? `${primary.cpt} ${primary.name}` : "No procedure"}</dd></div>
          <div><dt className="text-[11px] text-muted">{c.theatre?.code ?? "No theatre"}</dt><dd className="font-medium">{shortDate(c.scheduled_start)}, {time(c.scheduled_start)} ({duration(c.est_duration_min)})</dd></div>
          <div className="min-w-0"><dt className="text-[11px] text-muted"><LocalizedText message={"Surgeon"}/></dt><dd className="truncate font-medium">{surgeon?.name ?? "Not assigned"}</dd></div>
          <div className="min-w-0"><dt className="text-[11px] text-muted"><LocalizedText message={"Anesthesia"}/></dt><dd className="truncate font-medium">{anes?.name ?? "Not assigned"}<LocalizedText message={", ASA"}/>{" "}{c.asa_class}</dd></div>
        </dl>
        {preStart && c.status !== "POSTPONED" && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setReason(""); setModal("postpone"); }}><LocalizedText message={"Postpone"}/></Button>
            <Button size="sm" variant="danger" onClick={() => { setReason(""); setModal("cancel"); }}><LocalizedText message={"Cancel"}/></Button>
          </div>
        )}
      </div>
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "cancel" ? "Cancel case" : "Postpone case"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}><LocalizedText message={"Keep case"}/></Button>
            <Button variant="danger" busy={busy} disabled={!reason} onClick={async () => {
              const ok = await run(() => api(`/cases/${c.id}/${modal}`, { body: { reason } }), modal === "cancel" ? "Case cancelled" : "Case postponed");
              if (ok) { setModal(null); reload(); }
            }}>{modal === "cancel" ? "Cancel case" : "Postpone case"}</Button>
          </>
        }
      >
        <Field label="Reason">
          <Select value={reason} placeholder="Choose a reason" onChange={(e) => setReason(e.target.value)} options={(modal === "cancel" ? lookups.CANCEL_REASON : lookups.DELAY_REASON) ?? []} />
        </Field>
        <p className="mt-3 text-[13px] text-muted">{modal === "cancel" ? "Reserved stock is released. The case stays on record as cancelled." : "Pick a new time from the overview tab when you're ready to rebook."}</p>
        <ErrorNote error={error} className="mt-3" />
      </Modal>
    </div>
  );
}

function MilestoneTrack({ c, reload }: { c: CaseBundle; reload: () => void }) {
 const {t:translateSource}=useLocalization();
 const {time}=useSourceFormat();
 const api=useSourceApi();
  const done = Object.fromEntries(c.milestones.map((m) => [m.code, m]));
  const [pick, setPick] = useState<CaseBundle["nextMilestones"][number] | null>(null);
  const [ts, setTs] = useState("");
  const [delay, setDelay] = useState("");
  const lookups = useLookups();
  const { run, busy, error, setError } = useAction();
  const blocked = c.status === "CANCELLED" || c.status === "POSTPONED";
  const lateMin = Math.round((Date.now() - Date.parse(c.scheduled_start)) / 60000);

  const open = (m: CaseBundle["nextMilestones"][number]) => {
    setPick(m);
    setTs(toLocalInput(new Date().toISOString()));
    setDelay("");
    setError(null);
  };

  return (
    <div className="scroll-x border-b border-line bg-steel/70 px-3 py-2 md:px-4">
      <ol className="flex min-w-max items-center gap-1">
        {c.milestoneDefs.map((m, i) => {
          const d = done[m.code];
          const next = c.nextMilestones.find((n) => n.code === m.code);
          return (
            <li key={m.code} className="flex items-center gap-1">
              {i > 0 && <span className={cx("h-px w-3", d ? "bg-go" : "bg-line")} />}
              {d ? (
                <span className="flex flex-col rounded-[6px] border border-[#bfe0cf] bg-go-soft px-2 py-1 leading-tight" title={translateSource("Recorded by {value0}",{value0:d.recorded_by})}>
                  <span className="text-[11px] text-go">{m.label}</span>
                  <span className="font-cond text-[14px] font-semibold">{time(d.ts)}</span>
                </span>
              ) : next && !blocked ? (
                <SourceButton
                  onClick={() => open(next)}
                  className={cx(
                    "flex flex-col rounded-[6px] border px-2 py-1 text-left leading-tight transition-colors",
                    next.blockers.length ? "border-dashed border-[#d9c08a] bg-white hover:bg-amber-soft" : "border-ceil bg-ceil text-white hover:bg-ceil-2",
                  )}
                  title={next.blockers.length ? next.blockers.join("\n") : "Record now"}
                >
                  <span className={cx("text-[11px]", next.blockers.length ? "text-amber" : "text-[#dfe6fb]")}>{next.blockers.length ? `${next.blockers.length} to do` : "Record"}</span>
                  <span className="text-[13px] font-semibold">{m.label}</span>
                </SourceButton>
              ) : (
                <span className="flex flex-col rounded-[6px] border border-line bg-white/60 px-2 py-1 leading-tight text-faint">
                  <span className="text-[11px]"><LocalizedText message=" "/></span>
                  <span className="text-[13px]">{m.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <Modal
        open={!!pick}
        onClose={() => setPick(null)}
        title={pick ? `Record ${pick.label.toLowerCase()}` : ""}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPick(null)}><LocalizedText message={"Cancel"}/></Button>
            <Button variant="primary" busy={busy} disabled={!!pick?.blockers.length} onClick={async () => {
              const ok = await run(() => api(`/cases/${c.id}/milestones`, { body: { code: pick!.code, ts: new Date(ts).toISOString(), delayReason: delay || undefined } }), `${pick!.label} recorded`);
              if (ok) { setPick(null); reload(); }
            }}><LocalizedText message={"Record"}/>{" "}{pick?.label.toLowerCase()}</Button>
          </>
        }
      >
        {pick && pick.blockers.length > 0 ? (
          <div>
            <p className="mb-2 text-[13px]"><LocalizedText message={"Finish these first:"}/></p>
            <ul className="space-y-1.5">
              {pick.blockers.map((b) => (
                <li key={b} className="flex gap-2 rounded-[6px] bg-amber-soft px-3 py-2 text-[13px]"><span className="text-amber">●</span>{b}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Time" hint="Defaults to now. Change it only to record something that already happened.">
              <SourceInput type="datetime-local" className="input" value={ts} onChange={(e) => setTs(e.target.value)} />
            </Field>
            {pick?.code === "IN_ROOM" && lateMin > 10 && (
              <Field label={translateSource("Starting {value0} min late. Reason",{value0:lateMin})}>
                <Select value={delay} placeholder="Choose a delay reason" onChange={(e) => setDelay(e.target.value)} options={lookups.DELAY_REASON ?? []} />
              </Field>
            )}
          </div>
        )}
        <ErrorNote error={error} className="mt-3" />
      </Modal>
    </div>
  );
}
