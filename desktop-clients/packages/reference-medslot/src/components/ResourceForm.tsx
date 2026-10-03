"use client";
import {SourceInput,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import {useSourceApi, ApiError } from "../lib/api";
import { useApi } from "../lib/hooks";
import type { Department, ResourceDetail, ResourceType, ScheduleRow, Service } from "../lib/types";
import { Button, Check, ErrorNote, Field, Input, Select, Textarea } from "./ui";
import { ScheduleEditor, scheduleValid } from "./ScheduleEditor";
import { useToast } from "./toast";
import { CategoryIcon } from "./icons";

const SLOTS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

/** Create or edit a person, room, bed, chair or machine, with its default slot length, services and (when new) its hours. */
export function ResourceForm({ resource, onSaved }: { resource?: ResourceDetail; onSaved: (id: number) => void }) {
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const types = useApi<ResourceType[]>("/resource-types");
  const depts = useApi<Department[]>("/departments");
  const services = useApi<Service[]>("/services");
  const [f, setF] = useState({
    name: resource?.name ?? "", title: resource?.title ?? "", resource_type_id: resource?.resource_type_id ?? 0, department_id: resource?.department_id ?? 0,
    specialty_id: resource?.specialty_id ?? 0, slot_minutes: resource?.slot_minutes ?? 15, capacity: resource?.capacity ?? 1, location: resource?.location ?? "",
    description: resource?.description ?? "", online_booking: resource?.online_booking ?? true, active: resource?.active ?? true,
  });
  const [serviceIds, setServiceIds] = useState<number[]>(resource?.services.map((s) => s.id) ?? []);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([1, 2, 3, 4, 5].map((d) => ({ weekday: d, start_time: "09:00", end_time: "17:00" })));
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = err?.fields ?? {};
  const dept = depts.data?.find((d) => d.id === f.department_id);
  const svcInDept = useMemo(() => (services.data ?? []).filter((s) => !f.department_id || s.department_id === f.department_id || serviceIds.includes(s.id)), [services.data, f.department_id, serviceIds]);

  const pickType = (id: number) => {
    const t = types.data?.find((x) => x.id === id);
    setF((x) => ({ ...x, resource_type_id: id, slot_minutes: !resource && t ? t.default_slot_minutes : x.slot_minutes }));
  };

  const save = async () => {
    if (!resource && !scheduleValid(schedules)) { toast.error(new Error("Fix the overlapping shifts first"), "Check working hours"); return; }
    setBusy(true); setErr(null);
    const body = {
      ...f, title: f.title || null, specialty_id: f.specialty_id || null, location: f.location || null, description: f.description || null,
      resource_type_id: f.resource_type_id || undefined, department_id: f.department_id || undefined,
      service_ids: serviceIds, ...(resource ? {} : { schedules }),
    };
    try {
      const r = resource ? (await api(`/resources/${resource.id}`, { method: "PUT", json: body }), { id: resource.id })
        : await api<{ id: number }>("/resources", { method: "POST", json: body });
      toast.success(resource ? "Resource saved" : "Resource created", f.name);
      onSaved(r.id);
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      {err && !Object.keys(fe).length && <ErrorNote error={err} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required error={fe.name} className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Dr. Asha Rao, MRI 2, Dental Chair 4…" invalid={!!fe.name} /></Field>
        <Field label="Type" required error={fe.resource_type_id}>
          <Select value={f.resource_type_id || ""} onChange={(e) => pickType(Number(e.target.value))} invalid={!!fe.resource_type_id}>
            <option value=""><LocalizedText message="Choose…" /></option>
            {(["person", "room", "chair", "bed", "equipment", "other"] as const).map((c) => {
              const ts = types.data?.filter((t) => t.category === c) ?? [];
              return ts.length ? <optgroup key={c} label={c[0].toUpperCase() + c.slice(1)}>{ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup> : null;
            })}
          </Select>
        </Field>
        <Field label="Title or qualification"><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="MD, Cardiology" /></Field>
        <Field label="Department" required error={fe.department_id}>
          <Select value={f.department_id || ""} onChange={(e) => setF((x) => ({ ...x, department_id: Number(e.target.value), specialty_id: 0 }))} invalid={!!fe.department_id}>
            <option value=""><LocalizedText message="Choose…" /></option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Specialty">
          <Select value={f.specialty_id || ""} onChange={(e) => set("specialty_id", Number(e.target.value))} disabled={!dept?.specialties.length}>
            <option value=""><LocalizedText message="None" /></option>{dept?.specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Default slot length" required hint="Bookings start on these steps. Staff can still lengthen a booking.">
          <Select value={f.slot_minutes} onChange={(e) => set("slot_minutes", Number(e.target.value))}>{SLOTS.map((m) => <option key={m} value={m}><LocalizedText message={"{value0} minutes"} values={{ value0: (m) ?? "" }} /></option>)}</Select>
        </Field>
        <Field label="Patients at the same time" hint="More than 1 for collection bays, counters or group sessions" error={fe.capacity}>
          <Input type="number" min={1} max={100} value={f.capacity} onChange={(e) => set("capacity", Math.max(1, Number(e.target.value)))} />
        </Field>
        <Field label="Location" className="sm:col-span-2"><Input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Block B, room 204" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="flex flex-wrap gap-5 sm:col-span-2">
          <Check label="Bookable online" checked={f.online_booking} onChange={(v) => set("online_booking", v)} />
          <Check label="Active" description="Inactive resources can't be booked" checked={f.active} onChange={(v) => set("active", v)} />
        </div>
      </div>

      <section>
        <h3 className="mb-1 text-sm font-semibold"><LocalizedText message="Services this resource provides" /></h3>
        <p className="mb-2 text-xs text-mute"><LocalizedText message="Only linked services can be booked with it." /></p>
        <div className="grid max-h-56 gap-1 overflow-y-auto scroll-thin rounded-lg border border-line p-2 sm:grid-cols-2">
          {svcInDept.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-line-2">
              <SourceInput type="checkbox" className="size-4 accent-[var(--color-scrub)]" checked={serviceIds.includes(s.id)} onChange={(e) => setServiceIds((x) => e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id))} />
              <CategoryIcon category={s.category} className="size-3.5 text-mute" /><span className="truncate">{s.name}</span>
            </label>
          ))}
          {!svcInDept.length && <p className="col-span-full px-2 py-3 text-sm text-mute"><LocalizedText message="Choose a department to see its services." /></p>}
        </div>
      </section>

      {!resource && (
        <section>
          <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Working hours" /></h3>
          <ScheduleEditor value={schedules} onChange={setSchedules} slotMinutes={f.slot_minutes} />
        </section>
      )}
      <div className="flex justify-end"><Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}>{resource ? tr("Save changes") : tr("Create resource")}</Button></div>
    </div>
  );
}
