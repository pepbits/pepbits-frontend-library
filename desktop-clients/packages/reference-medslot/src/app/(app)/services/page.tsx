"use client";
import {TableHeader,TableRow,TableBody,SourceInput,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useMemo, useState } from "react";
import { Plus, Search, Stethoscope, Save, X, FileText, Share2 } from "lucide-react";
import {useSourceApi, ApiError } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import { CATEGORY_LABEL, duration } from "../../../lib/format";
import type { Category, Department, Resource, ResourceType, Service, ServiceDetail } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Badge, Button, Check, Drawer, Empty, ErrorNote, Field, IconButton, Input, PageHeader, Select, Skeleton, Table, Td, Textarea, Th, cx } from "../../../components/ui";
import { CategoryIcon } from "../../../components/icons";
import { useToast } from "../../../components/toast";

export default function ServicesPage() {
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const { can } = useAuth();
  const { data, error, loading, reload } = useApi<Service[]>("/services?active=all");
  const depts = useApi<Department[]>("/departments");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [dept, setDept] = useState("");
  const [editing, setEditing] = useState<ServiceDetail | "new" | null>(null);
  const list = useMemo(() => (data ?? []).filter((s) => (!cat || s.category === cat) && (!dept || s.department_id === Number(dept)) && (!q || `${s.name} ${s.code}`.toLowerCase().includes(q.toLowerCase()))), [data, q, cat, dept]);
  const open = async (id: number) => setEditing(await api<ServiceDetail>(`/services/${id}`));

  return (
    <>
      <PageHeader title="Services" description="What patients can book. Each service sets its length, turnover time, preparation steps, and which people, rooms and machines it needs together."
        actions={can("admin") && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}><LocalizedText message="Add service" /></Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services or codes" className="pl-9" /></div>
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-52"><option value=""><LocalizedText message="All departments" /></option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-48"><option value=""><LocalizedText message="All types" /></option>{(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <div className="space-y-2 p-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          : !list.length ? <Empty icon={<Stethoscope className="size-8" />} title="No services match" /> : (
            <Table>
              <TableHeader><TableRow><Th><LocalizedText message="Service" /></Th><Th><LocalizedText message="Department" /></Th><Th><LocalizedText message="Length" /></Th><Th><LocalizedText message="Needs" /></Th><Th><LocalizedText message="Rules" /></Th><Th><LocalizedText message="Resources" /></Th></TableRow></TableHeader>
              <TableBody>
                {list.map((s) => (
                  <TableRow key={s.id} onClick={() => can("admin") && open(s.id)} className={cx(can("admin") && "cursor-pointer hover:bg-scrub-soft/30", !s.active && "opacity-50")}>
                    <Td><span className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg" style={{ background: s.department_color + "1a", color: s.department_color }}><CategoryIcon category={s.category} /></span>
                      <span><span className="font-medium">{s.name}</span>{!s.active && <Badge className="ml-2"><LocalizedText message="Inactive" /></Badge>}<span className="tabular block text-xs text-mute">{s.code}, {CATEGORY_LABEL[s.category]}</span></span></span></Td>
                    <Td>{s.department_name}{s.specialty_name && <span className="block text-xs text-mute">{s.specialty_name}</span>}</Td>
                    <Td className="tabular whitespace-nowrap">{duration(s.duration_minutes)}{s.buffer_minutes ? <span className="block text-xs text-mute"><LocalizedText message={"+{value0} min turnover"} values={{ value0: (s.buffer_minutes) ?? "" }} /></span> : null}</Td>
                    <Td className="text-ink-2">{s.needs ?? <span className="text-mute"><LocalizedText message="Any linked" /></span>}</Td>
                    <Td><span className="flex flex-wrap gap-1">{s.requires_order && <Badge tone="amber"><FileText className="size-3" /><LocalizedText message="Order" /></Badge>}{s.requires_referral && <Badge tone="amber"><Share2 className="size-3" /><LocalizedText message="Referral" /></Badge>}{!s.online_booking && <Badge><LocalizedText message="Desk only" /></Badge>}</span></Td>
                    <Td className="tabular">{s.resource_count || <Badge tone="red"><LocalizedText message="None" /></Badge>}</Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </div>
      <Drawer open={!!editing} onClose={() => setEditing(null)} width="max-w-2xl" title={editing === "new" ? tr("Add service") : editing ? tr("Edit {value0}", { value0: (editing.name) ?? "" }) : ""}>
        {editing && <ServiceForm service={editing === "new" ? undefined : editing} depts={depts.data ?? []} onSaved={() => { setEditing(null); reload(); }} />}
      </Drawer>
    </>
  );
}

function ServiceForm({ service, depts, onSaved }: { service?: ServiceDetail; depts: Department[]; onSaved: () => void }) {
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const types = useApi<ResourceType[]>("/resource-types");
  const resources = useApi<Resource[]>("/resources");
  const [f, setF] = useState({
    name: service?.name ?? "", code: service?.code ?? "", category: service?.category ?? "consultation", department_id: service?.department_id ?? 0, specialty_id: service?.specialty_id ?? 0,
    duration_minutes: service?.duration_minutes ?? 15, buffer_minutes: service?.buffer_minutes ?? 0, prep_instructions: service?.prep_instructions ?? "", requires_order: service?.requires_order ?? false,
    requires_referral: service?.requires_referral ?? false, online_booking: service?.online_booking ?? true, price: service?.price ?? "", active: service?.active ?? true,
  });
  const [reqs, setReqs] = useState(service?.requirements.map((r) => ({ resource_type_id: r.resource_type_id, role: r.role, is_primary: r.is_primary })) ?? []);
  const [rids, setRids] = useState<number[]>(service?.resources.map((r) => r.id) ?? []);
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = err?.fields ?? {};
  const dept = depts.find((d) => d.id === f.department_id);
  const eligible = (resources.data ?? []).filter((r) => reqs.some((q) => q.resource_type_id === r.resource_type_id));

  const save = async () => {
    setBusy(true); setErr(null);
    const body = { ...f, department_id: f.department_id || undefined, specialty_id: f.specialty_id || null, prep_instructions: f.prep_instructions || null, price: f.price === "" ? null : Number(f.price),
      requirements: reqs, resource_ids: rids.filter((id) => eligible.some((r) => r.id === id)) };
    try {
      await api(service ? `/services/${service.id}` : "/services", { method: service ? "PUT" : "POST", json: body });
      toast.success(service ? "Service saved" : "Service created", f.name); onSaved();
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      {err && !Object.keys(fe).length && <ErrorNote error={err} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required error={fe.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} invalid={!!fe.name} /></Field>
        <Field label="Code" required error={fe.code} hint="Short unique code, used on reports"><Input value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} invalid={!!fe.code} /></Field>
        <Field label="Type" required><Select value={f.category} onChange={(e) => set("category", e.target.value as Category)}>{(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</Select></Field>
        <Field label="Department" required error={fe.department_id}><Select value={f.department_id || ""} onChange={(e) => setF((x) => ({ ...x, department_id: Number(e.target.value), specialty_id: 0 }))} invalid={!!fe.department_id}><option value=""><LocalizedText message="Choose…" /></option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Field label="Specialty"><Select value={f.specialty_id || ""} onChange={(e) => set("specialty_id", Number(e.target.value))} disabled={!dept?.specialties.length}><option value=""><LocalizedText message="None" /></option>{dept?.specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Price"><Input type="number" min={0} value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="Length in minutes" required error={fe.duration_minutes}><Input type="number" min={5} step={5} value={f.duration_minutes} onChange={(e) => set("duration_minutes", Number(e.target.value))} /></Field>
        <Field label="Turnover after (minutes)" hint="Cleaning or reset time; blocks the room but not the patient"><Input type="number" min={0} step={5} value={f.buffer_minutes} onChange={(e) => set("buffer_minutes", Number(e.target.value))} /></Field>
        <Field label="Preparation instructions" className="sm:col-span-2" hint="Sent to the patient in booking and reminder messages"><Textarea rows={2} value={f.prep_instructions} onChange={(e) => set("prep_instructions", e.target.value)} placeholder="e.g. Fast for 8 hours. Bring previous reports." /></Field>
        <div className="flex flex-wrap gap-x-5 gap-y-2 sm:col-span-2">
          <Check label="Needs a doctor's order" checked={f.requires_order} onChange={(v) => set("requires_order", v)} />
          <Check label="Needs a referral" checked={f.requires_referral} onChange={(v) => set("requires_referral", v)} />
          <Check label="Bookable online" checked={f.online_booking} onChange={(v) => set("online_booking", v)} />
          <Check label="Active" checked={f.active} onChange={(v) => set("active", v)} />
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold"><LocalizedText message="Needs, all at the same time" /></h3>
        <p className="mb-2 text-xs text-mute"><LocalizedText message="The first line is the main resource the patient chooses. Times are offered only when every line has someone or something free." /></p>
        <div className="flex flex-col gap-2">
          {reqs.map((q, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2">
              <Badge tone={i === 0 ? "green" : "neutral"}>{i === 0 ? tr("Main") : tr("Also")}</Badge>
              <Select value={q.resource_type_id} onChange={(e) => setReqs(reqs.map((x, j) => j === i ? { ...x, resource_type_id: Number(e.target.value), role: types.data?.find((t) => t.id === Number(e.target.value))?.name ?? x.role } : x))} className="h-9 w-52">
                {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Input value={q.role} onChange={(e) => setReqs(reqs.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} className="h-9 w-44" aria-label="Role label" placeholder="Role shown to staff" />
              <IconButton label="Remove" className="ml-auto" onClick={() => setReqs(reqs.filter((_, j) => j !== i).map((x, j) => ({ ...x, is_primary: j === 0 })))}><X className="size-4" /></IconButton>
            </div>
          ))}
          <div><Button size="sm" variant="quiet" icon={<Plus className="size-3.5" />} disabled={!types.data?.length}
            onClick={() => { const t = types.data![0]; setReqs([...reqs, { resource_type_id: t.id, role: t.name, is_primary: reqs.length === 0 }]); }}><LocalizedText message="Add requirement" /></Button></div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold"><LocalizedText message="Who and what can deliver it" /></h3>
        {!reqs.length ? <p className="text-sm text-mute"><LocalizedText message="Add a requirement first." /></p> : (
          <div className="grid max-h-60 gap-1 overflow-y-auto scroll-thin rounded-lg border border-line p-2 sm:grid-cols-2">
            {eligible.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-line-2">
                <SourceInput type="checkbox" className="size-4 accent-[var(--color-scrub)]" checked={rids.includes(r.id)} onChange={(e) => setRids((x) => e.target.checked ? [...x, r.id] : x.filter((y) => y !== r.id))} />
                <span className="truncate">{r.name}</span><span className="ml-auto text-[11px] text-mute">{r.type_name}</span>
              </label>
            ))}
            {!eligible.length && <p className="col-span-full px-2 py-3 text-sm text-mute"><LocalizedText message="No active resources of these types yet." /></p>}
          </div>
        )}
      </section>
      <div className="flex justify-end"><Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}>{service ? tr("Save changes") : tr("Create service")}</Button></div>
    </div>
  );
}
