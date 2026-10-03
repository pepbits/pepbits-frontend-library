"use client";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceSelect, Table } from "@pepbits/ops-ui";

import { useRouter } from "@pepbits/reference-surgisuite/internal-navigation";
import { useMemo, useState } from "react";
import { useApi } from "./../../../lib/api";
import { useTheatres } from "./../../../lib/masters";
import { age, duration, localDateKey, useSourceFormat} from "./../../../lib/format";
import { Badge, Empty, ErrorNote, Segmented, Spinner, StatusBadge, cx } from "./../../../components/ui";
import { IconSearch } from "./../../../components/icons";

type Row = {
  id: number; case_no: string; scheduled_start: string; est_duration_min: number; status: string; case_class: string; asa_class: string; laterality: string;
  patient_name: string; mrn: string; dob: string; sex: string; allergies: string; theatre_code: string; cpt: string; procedure_name: string; specialty: string;
  surgeon: string; anesthesiologist: string; procedure_count: number; pending_approvals: number;
};

const RANGES = {
  today: () => ({ from: localDateKey(), to: localDateKey() }),
  week: () => ({ from: localDateKey(), to: localDateKey(new Date(Date.now() + 7 * 86400000)) }),
  past: () => ({ from: localDateKey(new Date(Date.now() - 30 * 86400000)), to: localDateKey(new Date(Date.now() - 86400000)) }),
};

const GROUPS: Record<string, string[]> = {
  all: [],
  waiting: ["REQUESTED", "PENDING_APPROVAL"],
  ready: ["SCHEDULED", "CHECKED_IN"],
  live: ["IN_OR", "IN_SURGERY", "RECOVERY"],
  done: ["COMPLETED"],
  cancelled: ["CANCELLED", "POSTPONED"],
};

export default function CasesPage() {
 const {time,shortDate}=useSourceFormat();
  const router = useRouter();
  const theatres = useTheatres();
  const [range, setRange] = useState<keyof typeof RANGES>("today");
  const [group, setGroup] = useState("all");
  const [q, setQ] = useState("");
  const [theatre, setTheatre] = useState("");
  const r = RANGES[range]();
  const { data, error, loading } = useApi<Row[]>(`/cases?from=${r.from}&to=${r.to}${theatre ? `&theatre=${theatre}` : ""}${q.length > 1 ? `&q=${encodeURIComponent(q)}` : ""}`, 30000);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length ?? 0 };
    for (const [g, s] of Object.entries(GROUPS)) if (g !== "all") c[g] = (data ?? []).filter((x) => s.includes(x.status)).length;
    return c;
  }, [data]);
  const rows = (data ?? []).filter((x) => group === "all" || GROUPS[group].includes(x.status));

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-cond text-[24px] font-semibold"><LocalizedText message={"Cases"}/></h1>
        <Segmented value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "week", label: "Next 7 days" }, { value: "past", label: "Last 30 days" }]} />
        <div className="relative ml-auto w-full sm:w-72">
          <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <SourceInput className="input pl-8" placeholder="Patient, MRN, case or CPT" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <SourceSelect className="input w-40" value={theatre} onChange={(e) => setTheatre(e.target.value)} aria-label="Theatre">
          <option value=""><LocalizedText message={"All theatres"}/></option>
          {theatres.map((t) => <option key={t.id} value={t.id}>{t.code} {t.name}</option>)}
        </SourceSelect>
      </div>
      <Segmented
        className="self-start overflow-x-auto"
        value={group}
        onChange={setGroup}
        options={[
          { value: "all", label: "All", count: counts.all },
          { value: "waiting", label: "Awaiting approval", count: counts.waiting },
          { value: "ready", label: "Ready", count: counts.ready },
          { value: "live", label: "In progress", count: counts.live },
          { value: "done", label: "Completed", count: counts.done },
          { value: "cancelled", label: "Cancelled or postponed", count: counts.cancelled },
        ]}
      />
      <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <ErrorNote error={error} className="m-4" />
        ) : rows.length === 0 ? (
          <Empty title="No cases match"><LocalizedText message={"Try another date range or status, or clear the search."}/></Empty>
        ) : (
          <div className="scroll-y scroll-x min-h-0 flex-1">
            <Table className="w-full min-w-[1000px] text-[13px]">
              <thead className="sticky top-0 z-10 bg-white text-left text-[12px] text-muted shadow-[0_1px_0_#d5dbdf]">
                <tr>
                  <th className="px-4 py-2 font-medium"><LocalizedText message={"When"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Patient"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Procedure"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Surgeon"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Anesthesia"}/></th>
                  <th className="px-2 py-2 font-medium"><LocalizedText message={"Theatre"}/></th>
                  <th className="px-4 py-2 font-medium"><LocalizedText message={"Status"}/></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((x) => (
                  <tr key={x.id} onClick={() => router.push(`/cases/${x.id}`)} className="cursor-pointer hover:bg-steel/60" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && router.push(`/cases/${x.id}`)}>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="font-cond text-[16px] font-semibold">{time(x.scheduled_start)}</span>
                      <span className="block text-[12px] text-muted">{shortDate(x.scheduled_start)}, {duration(x.est_duration_min)}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-medium">{x.patient_name}</span>
                      <span className="block text-[12px] text-muted">{x.mrn}, {age(x.dob)} {x.sex}{x.allergies !== "NKDA" && <span className="text-stop"><LocalizedText message={", allergy"}/></span>}</span>
                    </td>
                    <td className="max-w-[320px] px-2 py-2">
                      <span className="block truncate">{x.cpt} {x.procedure_name}{x.procedure_count > 1 ? ` +${x.procedure_count - 1}` : ""}</span>
                      <span className="block text-[12px] text-muted">{x.specialty}{x.laterality !== "N/A" ? `, ${x.laterality.toLowerCase()}` : ""}</span>
                    </td>
                    <td className="px-2 py-2">{x.surgeon ?? "—"}</td>
                    <td className="px-2 py-2">{x.anesthesiologist ?? "—"}<span className="block text-[12px] text-muted"><LocalizedText message={"ASA"}/>{" "}{x.asa_class}</span></td>
                    <td className="px-2 py-2 font-medium">{x.theatre_code}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={x.status} />
                        {x.case_class !== "Elective" && <Badge tone={x.case_class === "Emergency" ? "stop" : "amber"}>{x.case_class}</Badge>}
                        {x.pending_approvals > 0 && x.status !== "PENDING_APPROVAL" && <Badge tone="amber">{x.pending_approvals} {" "}<LocalizedText message={"approval"}/></Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        <div className={cx("border-t border-line px-4 py-2 text-[12px] text-muted")}>{rows.length} {" "}<LocalizedText message={"case"}/>{rows.length === 1 ? "" : "s"} {" "}<LocalizedText message={"shown. Click a row to open the case."}/></div>
      </section>
    </div>
  );
}
