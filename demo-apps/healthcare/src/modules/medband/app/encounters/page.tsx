"use client";
import {CollectionView,type CollectionColumn} from "@pepbits/components/collection-view";

import { CalendarPlus, ClipboardList, Search } from "@pepbits/icons";
import { ReferenceLink as Link } from "../../host";
import { useEffect, useMemo, useState } from "react";
import { usePageSize } from "../../lib/hooks";
import { ENCOUNTER_TYPES, NEXT_STATUS, START_TYPES, encounterType } from "../../lib/encounter-config";
import { useStore } from "../../lib/store";
import type { Encounter, EncounterStatus, EncounterType } from "../../lib/types";
import { cx, daysBetween, fullName, normalize } from "../../lib/utils";
import { StatusPill, TYPE_ICON } from "../../components/encounter/type-tag";
import { Input, Segmented, Select } from "../../components/ui/form";
import { useErrorToast, useToast } from "../../components/ui/overlay";
import { Button, EmptyState, LinkButton, Panel } from "../../components/ui/primitives";
import { SourceButton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/controls";
import { useMaster } from "../../lib/master";
import { useMedbandFormat } from "../../lib/format";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";
import { medbandPaths } from "../../routes";

const STATUSES: Array<EncounterStatus | "All"> = ["All", "Planned", "Arrived", "In progress", "Completed", "Cancelled"];

export default function EncountersPage() {
  const { DEPARTMENTS, department, payer, practitioner } = useMaster();
  const { fmtDateTime } = useMedbandFormat();
  const { t: tr } = useLocalization();
  const store = useStore();
  const toast = useToast();
  const fail = useErrorToast();
  const [types, setTypes] = useState<EncounterType[]>([]);
  const [status, setStatus] = useState<EncounterStatus | "All">("All");
  const [range, setRange] = useState<"today" | "7" | "30" | "all">("7");
  const [dept, setDept] = useState("");
  const [q, setQ] = useState("");
  // The host's managed table page size is the step of the list: the first page, then "Show more".
  const pageSize = usePageSize();
  const [shown, setShown] = useState<number>(pageSize);

  const rows = useMemo(() => {
    const now = new Date();
    return store.encounters
      .filter((e) => !types.length || types.includes(e.type))
      .filter((e) => status === "All" || e.status === status)
      .filter((e) => !dept || e.departmentId === dept)
      .filter((e) => {
        if (range === "all") return true;
        const d = Math.abs(daysBetween(new Date(e.start), now));
        return range === "today" ? d === 0 : d <= Number(range);
      })
      .filter((e) => {
        if (!q) return true;
        const p = store.patientById(e.patientId);
        return [e.code, p ? fullName(p) : "", p?.mrn ?? ""].some((v) => normalize(v).includes(normalize(q)));
      })
      .sort((a, b) => b.start.localeCompare(a.start));
  }, [store, types, status, dept, range, q]);

  useEffect(() => setShown(pageSize), [types, status, dept, range, q, pageSize]);

  const columns:CollectionColumn<Encounter>[] = [
{key:"0",header:"Encounter",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <>
                        <div className="flex items-center gap-2.5">
                          <span className={cx("grid size-7 shrink-0 place-items-center rounded-md text-white", t.tone.band)} title={tr(t.label)}>
                            <Icon className="size-3.5" />
                          </span>
                          <span>
                            <span className="block font-semibold">{e.code}</span>
                            <span className="block text-[12px] text-ink-faint">
                              <LocalizedText message={t.label ?? ""} />
                              {e.parentEncounterId ? tr(", follows {value0}", { value0: (store.encounterById(e.parentEncounterId)?.code) ?? "" }) : ""}
                            </span>
                          </span>
                        </div>
                      </>;}},
{key:"1",header:"Patient",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <>
                        <Link href={medbandPaths.patient(e.patientId)} className="font-semibold hover:text-scrub-700">{p ? fullName(p) : ""}</Link>
                        <span className="block text-[12px] text-ink-faint">{p?.mrn}</span>
                      </>;}},
{key:"2",header:"Start",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <>
                        {fmtDateTime(e.start)}
                        <span className="block text-[12px] text-ink-faint"><LocalizedText message={START_TYPES[e.startType].label ?? ""} /></span>
                      </>;}},
{key:"3",header:"Department and clinician",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <>
                        {department(e.departmentId)?.name}
                        <span className="block text-[12px] text-ink-faint">{practitioner(e.practitionerId)?.name ?? tr("No clinician")}</span>
                      </>;}},
{key:"4",header:"Case and episode",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <>
                        <span className="block truncate font-medium">{store.caseById(e.caseId)?.title}</span>
                        <span className="block truncate text-[12px] text-ink-faint">{store.caseById(e.caseId)?.code}, {store.episodeById(e.episodeId)?.title}</span>
                      </>;}},
{key:"5",header:"Billing",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <>{e.billingMode === "Insurance" ? payer(cov?.payerId)?.short ?? tr("Insurance") : e.billingMode}</>;}},
{key:"6",header:"Status",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <><StatusPill status={e.status} /></>;}},
{key:"7",header:"Actions",render:e=>{                  const p = store.patientById(e.patientId);
                  const t = encounterType(e.type);
                  const next = NEXT_STATUS[e.status];
                  const Icon = TYPE_ICON[e.type];
                  const cov = p?.coverages.find((c) => c.id === e.coverageIds[0]);
return <>
                        {next && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              store
                                .setEncounterStatus(e.id, next)
                                .then(() => toast({ title: e.type === "IP" && next === "Completed" ? tr("{value0} discharged, bed {value1} released", { value0: (e.code) ?? "", value1: (e.bed ?? "") ?? "" }) : tr("{value0} marked {value1}", { value0: (e.code) ?? "", value1: tr(next ?? "").toLowerCase() }) }))
                                .catch((err) => fail(err, "Could not update the encounter"));
                            }}
                          >
                            {next === "Arrived" ? tr("Check in") : next === "In progress" ? tr("Start") : e.type === "IP" ? tr("Discharge") : tr("Complete")}
                          </Button>
                        )}
                      </>;}}
  ];

  const toggle = (t: EncounterType) => setTypes((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]));

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-bold tracking-tight"><LocalizedText message="Encounters" /></h1>
        <Segmented
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "all", label: "All" },
          ]}
        />
        <LinkButton href={medbandPaths.encounterNew()} size="sm">
          <CalendarPlus className="size-4" /> {" "}<LocalizedText message="New encounter" /></LinkButton>
      </div>

      {/* Type filter doubles as a legend */}
      <div className="flex flex-wrap gap-1.5">
        {ENCOUNTER_TYPES.map((t) => {
          const Icon = TYPE_ICON[t.code];
          const on = types.includes(t.code);
          const n = store.encounters.filter((e) => e.type === t.code).length;
          return (
            <SourceButton
              key={t.code}
              aria-pressed={on}
              onClick={() => toggle(t.code)}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors",
                on ? cx("border-transparent text-white", t.tone.band) : "border-line bg-paper text-ink-soft hover:border-ink-faint",
              )}
            >
              <Icon className="size-3.5" /> <LocalizedText message={t.label} />
              <span className={cx("text-[11px]", on ? "text-white/80" : "text-ink-faint")}>{n}</span>
            </SourceButton>
          );
        })}
        {types.length > 0 && (
          <SourceButton onClick={() => setTypes([])} className="px-2 text-[12.5px] font-semibold text-scrub-700 hover:underline">
            <LocalizedText message="Show all types" /></SourceButton>
        )}
      </div>

      <Panel className="flex min-h-[420px] flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
          <div className="w-full sm:w-72">
            <Input icon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Encounter no., patient or MRN" />
          </div>
          <Select aria-label="Any status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as EncounterStatus | "All")} options={STATUSES.map((s) => ({ value: s, label: s === "All" ? tr("Any status") : s }))} />
          <Select aria-label="Any department" className="w-auto" value={dept} placeholder="Any department" onChange={(e) => setDept(e.target.value)} options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} />
          <span className="ml-auto text-[13px] text-ink-faint"><LocalizedText message={"{value0} encounters"} values={{ value0: (rows.length) ?? "" }} /></span>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-5" />} title="No encounters match" body="Widen the date range or clear the type filter." />
          ) : (
            <CollectionView columns={columns} rows={rows.slice(0,shown)} rowKey={e=>e.id}/>
          )}
          {rows.length > shown && (
            <div className="flex justify-center border-t border-line-soft p-3">
              <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + pageSize)}>
                <LocalizedText message="Show {value0} more" values={{ value0: Math.min(pageSize, rows.length - shown) }} />
              </Button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
