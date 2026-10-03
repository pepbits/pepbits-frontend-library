"use client";
import {LocalizedText,useLocalization} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useParams } from "../../../../navigation";
import { useEffect, useState } from "react";
import { CalendarDays, CalendarPlus, Pencil, Plus, Save, Trash } from "lucide-react";
import {useSourceApi, ApiError } from "../../../../lib/api";
import { useApi } from "../../../../lib/hooks";
import {CATEGORY_LABEL,duration,titleCase,useMedslotFormat} from "../../../../lib/format";
import type { ResourceDetail, ScheduleRow } from "../../../../lib/types";
import { useAuth } from "../../../../components/shell/auth";
import { Badge, Button, Drawer, Empty, ErrorNote, Field, IconButton, Input, Modal, Panel, Select, Skeleton, Textarea , DateTimeInput} from "../../../../components/ui";
import { ResourceCategoryIcon, CategoryIcon } from "../../../../components/icons";
import { ResourceForm } from "../../../../components/ResourceForm";
import { ScheduleEditor, scheduleValid } from "../../../../components/ScheduleEditor";
import { useToast } from "../../../../components/toast";

export default function ResourcePage() {
  const { fmtDateTime } = useMedslotFormat();
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const { id } = useParams<{ id: string }>();
  const { can, settings } = useAuth();
  const toast = useToast();
  const { data: r, error, loading, reload } = useApi<ResourceDetail>(`/resources/${id}`);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  useEffect(() => { if (r) { setRows(r.schedules.map(({ weekday, start_time, end_time, slot_minutes }) => ({ weekday, start_time, end_time, slot_minutes }))); setDirty(false); } }, [r]);

  if (loading && !r) return <div className="flex flex-col gap-4"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!r) return null;

  const saveHours = async () => {
    if (!scheduleValid(rows)) { toast.error(new Error("Some shifts overlap or end before they start"), "Check working hours"); return; }
    setSaving(true);
    try { await api(`/resources/${r.id}/schedules`, { method: "PUT", json: {schedules:rows.map((x) => ({ ...x, slot_minutes: x.slot_minutes ?? null }))} }); toast.success("Working hours saved", r.name); reload(); }
    catch (e) { toast.error(e); } finally { setSaving(false); }
  };
  const removeBlock = async (bid: number) => {
    try { await api(`/resources/${r.id}/blocks/${bid}`, { method: "DELETE" }); toast.success("Block removed"); reload(); } catch (e) { toast.error(e); }
  };
  const now = settings.facility_now;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start gap-4 rounded-xl border border-line bg-panel p-5">
        <span className="flex size-12 items-center justify-center rounded-xl bg-scrub-soft text-scrub"><ResourceCategoryIcon category={r.category} className="size-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{r.name}</h1>{!r.active && <Badge><LocalizedText message="Inactive" /></Badge>}{!r.online_booking && <Badge tone="neutral"><LocalizedText message="Not bookable online" /></Badge>}</div>
          <p className="text-sm text-mute">{[r.title, r.type_name, r.department_name, r.specialty_name, r.location].filter(Boolean).join(", ")}</p>
          <p className="mt-2 text-sm"><span className="tabular font-medium"><LocalizedText message={"{value0}-minute"} values={{ value0: (r.slot_minutes) ?? "" }} /></span> {" "}<LocalizedText message="default slots" />{r.capacity > 1 && <>, <span className="font-medium"><LocalizedText message={"{value0} patients"} values={{ value0: (r.capacity) ?? "" }} /></span> {" "}<LocalizedText message="at the same time" /></>}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/calendar?view=week&resource_ids=${r.id}`}><Button icon={<CalendarDays className="size-4" />}><LocalizedText message="Week calendar" /></Button></Link>
          {can("admin") && <Button icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}><LocalizedText message="Edit" /></Button>}
          {can("admin", "scheduler") && <Link href={`/book?resource_id=${r.id}`}><Button variant="primary" icon={<CalendarPlus className="size-4" />}><LocalizedText message="Book" /></Button></Link>}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Weekly working hours" actions={can("admin") && <Button size="sm" variant="primary" disabled={!dirty} loading={saving} onClick={saveHours} icon={<Save className="size-3.5" />}><LocalizedText message="Save hours" /></Button>}>
          {can("admin") ? <ScheduleEditor value={rows} onChange={(x) => { setRows(x); setDirty(true); }} slotMinutes={r.slot_minutes} />
            : <ul className="text-sm">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <li key={d} className="flex gap-3 py-1"><span className="w-12 text-mute">{d}</span>{rows.filter((x) => x.weekday === i).map((x) => `${x.start_time}–${x.end_time}`).join(", ") || tr("Closed")}</li>)}</ul>}
          {dirty && <p className="mt-3 text-xs text-amber"><LocalizedText message="Unsaved changes. Existing appointments are kept; new hours apply to new bookings." /></p>}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title="Leave and blocked time" flush actions={can("admin", "scheduler") && <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setBlockOpen(true)}><LocalizedText message="Block time" /></Button>}>
            {r.blocks.length === 0 ? <p className="px-4 py-6 text-center text-sm text-mute"><LocalizedText message="No leave or maintenance planned." /></p> : (
              <ul className="divide-y divide-line-2">
                {r.blocks.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <Badge tone={b.kind === "leave" ? "violet" : b.kind === "maintenance" ? "amber" : "neutral"}>{titleCase(b.kind)}</Badge>
                    <span className="min-w-0 flex-1"><span className="tabular block"><LocalizedText message={"{value0} to {value1}"} values={{ value0: (fmtDateTime(b.start_at)) ?? "", value1: (fmtDateTime(b.end_at)) ?? "" }} /></span>{b.reason && <span className="block truncate text-xs text-mute">{b.reason}</span>}</span>
                    {b.end_at < now && <span className="text-xs text-mute"><LocalizedText message="Past" /></span>}
                    {can("admin", "scheduler") && <IconButton label="Remove block" onClick={() => removeBlock(b.id)}><Trash className="size-4" /></IconButton>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Services" flush>
            {r.services.length === 0 ? <Empty title="No services linked"><LocalizedText message="Edit this resource to choose what it can be booked for." /></Empty> : (
              <ul className="divide-y divide-line-2">
                {r.services.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <CategoryIcon category={s.category} className="size-4 text-mute" /><span className="flex-1">{s.name}<span className="block text-xs text-mute">{CATEGORY_LABEL[s.category]}</span></span>
                    <span className="tabular text-xs text-mute">{duration(s.duration_minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Drawer open={edit} onClose={() => setEdit(false)} title={tr("Edit {value0}", { value0: (r.name) ?? "" })} width="max-w-2xl">
        <ResourceForm resource={r} onSaved={() => { setEdit(false); reload(); }} />
      </Drawer>
      <BlockModal open={blockOpen} resourceId={r.id} today={now.slice(0, 10)} onClose={() => setBlockOpen(false)} onDone={() => { setBlockOpen(false); reload(); }} />
    </div>
  );
}

function BlockModal({ open, resourceId, today, onClose, onDone }: { open: boolean; resourceId: number; today: string; onClose: () => void; onDone: () => void }) {
  const api = useSourceApi();
  const toast = useToast();
  const [f, setF] = useState({ start_at: `${today}T09:00`, end_at: `${today}T17:00`, kind: "leave", reason: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ affected_appointments: number }>(`/resources/${resourceId}/blocks`, { method: "POST", json: { ...f, reason: f.reason || null } });
      if (r.affected_appointments) toast.error(new Error(`${r.affected_appointments} existing appointment(s) fall in this time. Reschedule them from the calendar.`), "Time blocked, with clashes");
      else toast.success("Time blocked");
      onDone();
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Block time" footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} onClick={save}><LocalizedText message="Block time" /></Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From" required error={err?.fields.start_at}><DateTimeInput value={f.start_at} onChange={(e) => setF({ ...f, start_at: e.target.value })} /></Field>
        <Field label="Until" required error={err?.fields.end_at}><DateTimeInput value={f.end_at} onChange={(e) => setF({ ...f, end_at: e.target.value })} /></Field>
        <Field label="Kind" className="sm:col-span-2"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="leave"><LocalizedText message="Leave" /></option><option value="maintenance"><LocalizedText message="Maintenance" /></option><option value="meeting"><LocalizedText message="Meeting" /></option><option value="blocked"><LocalizedText message="Other" /></option></Select></Field>
        <Field label="Reason" className="sm:col-span-2" hint="Visible to staff only"><Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        {err && !Object.keys(err.fields).length && <div className="sm:col-span-2"><ErrorNote error={err} /></div>}
      </div>
    </Modal>
  );
}
