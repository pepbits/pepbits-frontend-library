"use client";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceButton } from "@pepbits/ops-ui";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { useSourceApi, useApi } from "./../../../lib/api";
import { useLookups, useTheatres } from "./../../../lib/masters";
import { STATUS_META, TONE_BAR, age, duration, localDateKey, toLocalInput , useSourceFormat} from "./../../../lib/format";
import { Badge, Button, Drawer, ErrorNote, Field, KV, Select, Spinner, StatusBadge, cx, useAction } from "./../../../components/ui";
import { IconChevronLeft, IconChevronRight, IconPlus } from "./../../../components/icons";
import { useBookCase } from "./../../../components/Shell";

type Row = {
  id: number; case_no: string; scheduled_start: string; est_duration_min: number; status: string; case_class: string; theatre_id: number;
  patient_name: string; mrn: string; dob: string; sex: string; allergies: string; procedure_name: string; cpt: string; specialty: string;
  surgeon: string; anesthesiologist: string; anesthesia_type: string; asa_class: string; pending_approvals: number; in_room: string | null; out_of_room: string | null;
};

const HOUR_W = 96;

export default function SchedulePage() {
 const {time}=useSourceFormat();
  const [day, setDay] = useState(localDateKey());
  const theatres = useTheatres();
  const { data, loading, reload } = useApi<Row[]>(`/cases?date=${day}`, 30000);
  const [sel, setSel] = useState<Row | null>(null);
  const book = useBookCase();

  const shift = (n: number) => {
    const d = new Date(day + "T12:00:00");
    d.setDate(d.getDate() + n);
    setDay(localDateKey(d));
  };
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (data ?? []).forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [data]);
  // Window grows to fit cases outside normal hours (night emergencies).
  const midnight = new Date(day + "T00:00:00").getTime();
  const hourOf = (t: number) => (t - midnight) / 3600000;
  const START_H = Math.max(0, Math.floor(Math.min(6, ...(data ?? []).map((r) => hourOf(Date.parse(r.in_room ?? r.scheduled_start))))));
  const END_H = Math.min(24, Math.ceil(Math.max(22, ...(data ?? []).map((r) => hourOf(Date.parse(r.scheduled_start)) + r.est_duration_min / 60))));
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const dayStart = midnight + START_H * 3600000;
  const x = (iso: string) => ((Date.parse(iso) - dayStart) / 3600000) * HOUR_W;
  const isToday = day === localDateKey();

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-cond text-[24px] font-semibold"><LocalizedText message={"Schedule"}/></h1>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous day"><IconChevronLeft size={16} /></Button>
          <SourceInput type="date" className="input h-8 w-40" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next day"><IconChevronRight size={16} /></Button>
          {!isToday && <Button size="sm" onClick={() => setDay(localDateKey())}><LocalizedText message={"Today"}/></Button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([s, n]) => (
            <Badge key={s} tone={STATUS_META[s]?.tone}>{STATUS_META[s]?.label ?? s} {n}</Badge>
          ))}
        </div>
        <p className="ml-auto hidden text-[12px] text-muted lg:block"><LocalizedText message={"Click an empty slot to book it. Click a case to manage it."}/></p>
      </div>

      <section className="panel relative min-h-0 flex-1 overflow-hidden">
        {loading && !data ? (
          <Spinner />
        ) : (
          <div className="scroll-x scroll-y h-full">
            <div className="relative" style={{ width: 140 + hours.length * HOUR_W }}>
              <div className="sticky top-0 z-20 flex border-b border-line bg-white">
                <div className="sticky left-0 z-10 w-[140px] shrink-0 border-r border-line bg-white px-3 py-2 text-[12px] font-medium text-muted"><LocalizedText message={"Theatre"}/></div>
                {hours.map((h) => (
                  <div key={h} className="shrink-0 border-r border-line/70 px-2 py-2 font-cond text-[13px] font-semibold text-muted" style={{ width: HOUR_W }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {theatres.map((t) => {
                const rows = (data ?? []).filter((r) => r.theatre_id === t.id);
                return (
                  <div key={t.id} className="flex border-b border-line" style={{ height: 78 }}>
                    <div className="sticky left-0 z-10 flex w-[140px] shrink-0 flex-col justify-center border-r border-line bg-white px-3">
                      <span className="font-cond text-[17px] font-semibold leading-none">{t.code}</span>
                      <span className="text-[12px] text-muted">{t.kind}</span>
                    </div>
                    <div
                      className="relative flex-1 cursor-copy"
                      style={{ backgroundImage: `repeating-linear-gradient(90deg, transparent 0 ${HOUR_W - 1}px, #e6eaed ${HOUR_W - 1}px ${HOUR_W}px)` }}
                      onClick={(e) => {
                        if (e.target !== e.currentTarget) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mins = Math.floor((((e.clientX - rect.left) / HOUR_W) * 60) / 15) * 15;
                        const d = new Date(dayStart + mins * 60000);
                        book({ theatreId: t.id, start: d.toISOString() });
                      }}
                      title="Book this slot"
                    >
                      {rows.map((r) => {
                        const tone = STATUS_META[r.status]?.tone ?? "neutral";
                        const left = Math.max(0, x(r.in_room ?? r.scheduled_start));
                        const width = Math.max(40, (r.est_duration_min / 60) * HOUR_W - 4);
                        return (
                          <SourceButton
                            key={r.id}
                            onClick={() => setSel(r)}
                            className={cx(
                              "absolute top-1.5 flex h-[66px] flex-col overflow-hidden rounded-[6px] border border-line bg-white py-1 pl-2.5 pr-2 text-left shadow-[0_1px_2px_#0000000d] hover:border-ceil",
                              r.status === "CANCELLED" && "opacity-45 line-through",
                              sel?.id === r.id && "border-ceil ring-2 ring-ceil-soft",
                            )}
                            style={{ left: left + 2, width }}
                          >
                            <span className={cx("absolute inset-y-0 left-0 w-1", TONE_BAR[tone])} />
                            <span className="flex items-center gap-1.5 text-[12px]">
                              <span className="font-cond font-semibold">{time(r.scheduled_start)}</span>
                              {r.case_class !== "Elective" && <span className={cx("font-semibold", r.case_class === "Emergency" ? "text-stop" : "text-amber")}>{r.case_class}</span>}
                              {r.pending_approvals > 0 && <span className="text-amber"><LocalizedText message={"Approval"}/></span>}
                            </span>
                            <span className="truncate text-[13px] font-medium">{r.patient_name}</span>
                            <span className="truncate text-[12px] text-muted">{r.procedure_name}</span>
                          </SourceButton>
                        );
                      })}
                      {isToday && (() => {
                        const n = x(new Date().toISOString());
                        return n > 0 && n < hours.length * HOUR_W ? <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-stop" style={{ left: n }} /> : null;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <SourceButton onClick={() => book()} className="absolute bottom-4 right-4 inline-flex h-11 items-center gap-2 rounded-full bg-ceil px-4 font-medium text-white shadow-lg hover:bg-ceil-2 md:hidden">
          <IconPlus size={18} /> {" "}<LocalizedText message={"Book"}/></SourceButton>
      </section>

      <CasePreview row={sel} onClose={() => setSel(null)} onChanged={() => { reload(); setSel(null); }} />
    </div>
  );
}

function CasePreview({ row, onClose, onChanged }: { row: Row | null; onClose: () => void; onChanged: () => void }) {
 const {time}=useSourceFormat();
 const api=useSourceApi();
  const lookups = useLookups();
  const theatres = useTheatres();
  const { run, busy, error, setError } = useAction();
  const [mode, setMode] = useState<"view" | "move" | "cancel">("view");
  const [move, setMove] = useState({ theatre_id: "", start: "" });
  const [reason, setReason] = useState("");

  if (!row) return null;
  const editable = ["REQUESTED", "PENDING_APPROVAL", "SCHEDULED", "POSTPONED"].includes(row.status);

  return (
    <Drawer
      open={!!row}
      onClose={() => { setMode("view"); setError(null); onClose(); }}
      width={460}
      title={row.patient_name}
      subtitle={<span className="flex items-center gap-2">{row.case_no} <StatusBadge status={row.status} /></span>}
      footer={
        mode === "view" ? (
          <>
            {editable && <Button variant="danger" onClick={() => setMode("cancel")}><LocalizedText message={"Cancel case"}/></Button>}
            {editable && <Button onClick={() => { setMove({ theatre_id: String(row.theatre_id), start: toLocalInput(row.scheduled_start) }); setMode("move"); }}><LocalizedText message={"Reschedule"}/></Button>}
            <Link href={`/cases/${row.id}`} className="inline-flex h-[34px] items-center rounded-[6px] bg-ceil px-3.5 font-medium text-white hover:bg-ceil-2"><LocalizedText message={"Open case"}/></Link>
          </>
        ) : mode === "move" ? (
          <>
            <Button variant="ghost" onClick={() => setMode("view")}><LocalizedText message={"Back"}/></Button>
            <Button variant="primary" busy={busy} onClick={async () => {
              const ok = await run(() => api(`/cases/${row.id}`, { method: "PATCH", body: { theatre_id: Number(move.theatre_id), scheduled_start: new Date(move.start).toISOString() } }), "Case rescheduled");
              if (ok) onChanged();
            }}><LocalizedText message={"Save new time"}/></Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setMode("view")}><LocalizedText message={"Back"}/></Button>
            <Button variant="danger" busy={busy} disabled={!reason} onClick={async () => {
              const ok = await run(() => api(`/cases/${row.id}/cancel`, { body: { reason } }), "Case cancelled");
              if (ok) onChanged();
            }}><LocalizedText message={"Cancel this case"}/></Button>
          </>
        )
      }
    >
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <KV label="Time">{time(row.scheduled_start)}, {duration(row.est_duration_min)}</KV>
          <KV label="Patient">{age(row.dob)} {row.sex}, {row.mrn}</KV>
          <KV label="Procedure">{row.cpt} {row.procedure_name}</KV>
          <KV label="Specialty">{row.specialty}</KV>
          <KV label="Surgeon">{row.surgeon ?? "—"}</KV>
          <KV label="Anesthesia">{row.anesthesiologist ?? "—"}</KV>
          <KV label="Technique">{row.anesthesia_type ?? "—"}<LocalizedText message={", ASA"}/>{" "}{row.asa_class}</KV>
          <KV label="Allergies"><span className={row.allergies !== "NKDA" ? "text-stop" : ""}>{row.allergies}</span></KV>
        </div>
        {row.pending_approvals > 0 && <p className="rounded-[6px] bg-amber-soft px-3 py-2 text-[13px] text-amber">{row.pending_approvals} {" "}<LocalizedText message={"approval"}/>{row.pending_approvals > 1 ? "s" : ""} {" "}<LocalizedText message={"still pending."}/></p>}
        {mode === "move" && (
          <div className="grid gap-3 rounded-[8px] border border-line p-3">
            <Field label="Theatre"><Select value={move.theatre_id} onChange={(e) => setMove({ ...move, theatre_id: e.target.value })} options={theatres.map((t) => ({ value: t.id, label: `${t.code} ${t.name}` }))} /></Field>
            <Field label="Start"><SourceInput type="datetime-local" step={900} className="input" value={move.start} onChange={(e) => setMove({ ...move, start: e.target.value })} /></Field>
          </div>
        )}
        {mode === "cancel" && (
          <Field label="Reason for cancelling">
            <Select value={reason} placeholder="Choose a reason" onChange={(e) => setReason(e.target.value)} options={lookups.CANCEL_REASON ?? []} />
          </Field>
        )}
        <ErrorNote error={error} />
      </div>
    </Drawer>
  );
}
