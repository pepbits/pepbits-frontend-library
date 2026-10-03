"use client";

import { ArrowRightLeft, BedDouble, CalendarClock, ChevronRight, Siren } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useRouter } from "../lib/navigation";
import { useMemo, useState } from "react";
import { canAdmit, pendingReason, URGENCY_TONE } from "../lib/admission";
import { ENCOUNTER_TYPES, encounterType, NEXT_STATUS } from "../lib/encounter-config";
import { followUpsDue } from "../lib/followup";
import { useCounter, useStore } from "../lib/store";
import type { EncounterStatus } from "../lib/types";
import { cx, fullName, isSameDay } from "../lib/utils";
import { PatientPicker } from "../components/patient/patient-picker";
import { StatusPill, TYPE_ICON, TypeTag } from "../components/encounter/type-tag";
import { Segmented } from "../components/ui/form";
import { Badge, Button, EmptyState, LinkButton, Panel, PanelHeader } from "../components/ui/primitives";
import { useErrorToast, useToast } from "../components/ui/overlay";
import { useMaster } from "../lib/master";
import { useMedbandFormat } from "../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { medbandPaths } from "../routes";

const FLOW: EncounterStatus[] = ["Planned", "Arrived", "In progress", "Completed"];

export default function TodayPage() {
  const { department, practitioner } = useMaster();
  const { fmtDay, fmtTime, relativeDay } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const router = useRouter();
  const toast = useToast();
  const fail = useErrorToast();
  const desk = useCounter();
  const [scope, setScope] = useState<"desk" | "all">("desk");
  const now = useMemo(() => new Date(), []);

  const today = useMemo(
    () => store.encounters.filter((e) => isSameDay(new Date(e.start), now)).sort((a, b) => a.start.localeCompare(b.start)),
    [store.encounters, now],
  );
  const queue = scope === "all" || !desk ? today : today.filter((e) => desk.encounterTypes.includes(e.type));
  const due = useMemo(() => followUpsDue(store.encounters, now, department, 3), [store.encounters, now, department]);
  const rank = { Emergency: 0, Urgent: 1, Elective: 2 } as const;
  const openRequests = store.admissionRequests
    .filter((r) => r.status === "Pending" || r.status === "Ready")
    .sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.plannedDate.localeCompare(b.plannedDate));
  const deskTypes = ENCOUNTER_TYPES.filter((t) => desk?.encounterTypes.includes(t.code));

  const byType = ENCOUNTER_TYPES.map((t) => ({ t, n: today.filter((e) => e.type === t.code).length })).filter((x) => x.n > 0);
  const byStatus = FLOW.map((s) => ({ s, n: today.filter((e) => e.status === s).length }));

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-5 p-4 md:p-6">
      {/* Desk: the first job of the day is finding the person in front of you */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel className="relative overflow-visible p-5 md:p-6">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight md:text-[30px]"><LocalizedText message="Who is at the desk?" /></h1>
          <p className="mt-1 mb-4 text-[14px] text-ink-soft"><LocalizedText message="Find the patient to start an encounter. If they are new, register them in under a minute." /></p>
          <PatientPicker size="lg" autoFocus onPick={(p) => router.push(medbandPaths.encounterNew({ patientId: p.id }))} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12.5px] text-ink-faint"><LocalizedText message="Or start at" />{" "}{desk?.name ?? tr("this counter")}:</span>
            {deskTypes.map((t) => {
              const Icon = TYPE_ICON[t.code];
              return (
                <Link
                  key={t.code}
                  href={medbandPaths.encounterNew({ type: t.code })}
                  className={cx("inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-shadow hover:ring-2 hover:ring-current/30", t.tone.soft, t.tone.text)}
                >
                  <Icon className="size-3.5" />
                  <LocalizedText message={t.label ?? ""} />
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel className="flex flex-col p-5 md:p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold"><LocalizedText message="Today so far" /></h2>
            <span className="text-[13px] text-ink-faint">{fmtDay(now)}</span>
          </div>
          <p className="mt-3 text-[40px] leading-none font-bold tracking-tight">
            {today.length}
            <span className="ml-2 text-[15px] font-medium text-ink-soft"><LocalizedText message="encounters" /></span>
          </p>
          {/* Type mix shown as a band of colours, the same colours as the type tags everywhere */}
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-canvas" role="img" aria-label={tr("Encounter mix by type")}>
            {byType.map(({ t, n }) => (
              <span key={t.code} className={t.tone.band} style={{ width: `${(n / Math.max(today.length, 1)) * 100}%` }} title={tr("{value0}: {value1}", { value0: tr(t.label ?? ""), value1: (n) ?? "" })} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {byType.map(({ t, n }) => (
              <span key={t.code} className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
                <span className={cx("size-2 rounded-full", t.tone.dot)} /> <LocalizedText message={t.label} /> {n}
              </span>
            ))}
          </div>
          <div className="mt-auto grid grid-cols-4 gap-2 pt-4">
            {byStatus.map(({ s, n }) => (
              <div key={s} className="rounded-lg bg-canvas px-3 py-2">
                <p className="text-[18px] font-bold">{n}</p>
                <p className="truncate text-[11.5px] text-ink-faint"><LocalizedText message={s} /></p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel className="flex min-h-80 flex-col">
          <PanelHeader
            title="Today's queue"
            sub={scope === "desk" ? tr("Visits handled at {value0}", { value0: (desk?.name ?? "this counter") ?? "" }) : tr("Every counter")}
            action={
              <Segmented<"desk" | "all">
                size="sm"
                ariaLabel="Queue scope"
                value={scope}
                onChange={setScope}
                options={[
                  { value: "desk", label: "This counter" },
                  { value: "all", label: "All counters" },
                ]}
              />
            }
          />
          <div className="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-2">
            {queue.length === 0 && (
              <EmptyState
                icon={<CalendarClock className="size-5" />}
                title={scope === "desk" ? tr("Nothing in this counter's queue today") : tr("No encounters yet today")}
                body="Find a patient above to create the first one."
              />
            )}
            {queue.map((e) => {
              const p = store.patientById(e.patientId);
              const next = NEXT_STATUS[e.status];
              return (
                <div key={e.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas">
                  <span className={cx("h-10 w-1.5 shrink-0 rounded-full", encounterType(e.type).tone.band)} />
                  <span className="w-12 shrink-0 text-[13px] font-semibold text-ink-soft">{fmtTime(e.start)}</span>
                  <Link href={medbandPaths.patient(e.patientId)} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold group-hover:text-scrub-700">{p ? fullName(p) : tr("Unknown")}</span>
                    <span className="block truncate text-[12.5px] text-ink-soft">
                      {department(e.departmentId)?.name}
                      {e.practitionerId ? `, ${practitioner(e.practitionerId)?.name}` : ""}
                    </span>
                  </Link>
                  <TypeTag type={e.type} className="hidden sm:inline-flex" />
                  <StatusPill status={e.status} />
                  {next ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-28"
                      onClick={() => {
                        store
                          .setEncounterStatus(e.id, next)
                          .then(() => toast({ title: e.type === "IP" && next === "Completed" ? tr("{value0} discharged, bed {value1} released", { value0: (e.code) ?? "", value1: (e.bed ?? "") ?? "" }) : tr("{value0} marked {value1}", { value0: (e.code) ?? "", value1: tr(next ?? "").toLowerCase() }) }))
                          .catch((err) => fail(err, "Could not update the encounter"));
                      }}
                    >
                      {next === "Arrived" ? tr("Check in") : next === "In progress" ? tr("Start") : e.type === "IP" ? tr("Discharge") : tr("Complete")}
                    </Button>
                  ) : (
                    <span className="w-28" />
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="grid min-h-0 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-1 lg:grid-rows-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel className="flex min-h-64 flex-col">
            <PanelHeader title="Follow-up windows closing" sub="Free follow-up still available, window ends within 3 days" />
            <div className="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-2">
              {due.length === 0 && <EmptyState icon={<ArrowRightLeft className="size-5" />} title="Nothing closing soon" body="Patients whose free follow-up is about to lapse show up here." />}
              {due.map(({ encounter: e, daysLeft, freeLeft }) => {
                const p = store.patientById(e.patientId);
                return (
                  <Link key={e.id} href={medbandPaths.encounterNew({ patientId: e.patientId, department: e.departmentId })} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-amber-50">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-center leading-none font-bold text-amber-900">
                      <span>
                        {daysLeft}
                        <span className="block text-[9.5px] font-semibold">{daysLeft === 1 ? tr("day") : tr("days")}</span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p ? fullName(p) : ""}</span>
                      <span className="block truncate text-[12.5px] text-ink-soft">
                        <LocalizedText message={"{value0}, seen {value1}, {value2} free left"} values={{ value0: (department(e.departmentId)?.name) ?? "", value1: (relativeDay(e.start, now)) ?? "", value2: (freeLeft) ?? "" }} /></span>
                    </span>
                    <ChevronRight className="size-4 text-ink-faint group-hover:text-amber-700" />
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel className="flex min-h-52 flex-col">
            <PanelHeader
              title="Admissions waiting"
              sub={tr("{value0} ready, {value1} pending clearance", { value0: (openRequests.filter((r) => r.status === "Ready").length) ?? "", value1: (openRequests.filter((r) => r.status === "Pending").length) ?? "" })}
              action={<LinkButton href={medbandPaths.admissions()} variant="ghost" size="sm"><LocalizedText message="Open queue" /></LinkButton>}
            />
            <div className="scroll-thin min-h-0 flex-1 overflow-auto px-2 pb-2">
              {openRequests.length === 0 && <EmptyState icon={<BedDouble className="size-5" />} title="No admission requests waiting" />}
              {openRequests.slice(0, 6).map((r) => {
                const p = store.patientById(r.patientId);
                return (
                  <Link key={r.id} href={medbandPaths.admissions()} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-canvas">
                    {r.urgency === "Emergency" ? <Siren className="size-4 shrink-0 text-rose-600" /> : <BedDouble className="size-4 shrink-0 text-violet-600" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">{p ? fullName(p) : ""}</span>
                      <span className="block truncate text-[12px] text-ink-soft">
                        {r.reason}, {canAdmit(r) ? (r.status === "Ready" ? tr("ready to admit") : tr("emergency, admit now")) : pendingReason(r, tr)}
                      </span>
                    </span>
                    <Badge tone={URGENCY_TONE[r.urgency]}><LocalizedText message={r.urgency ?? ""} /></Badge>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}
