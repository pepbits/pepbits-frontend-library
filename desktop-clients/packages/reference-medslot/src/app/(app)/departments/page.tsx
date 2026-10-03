"use client";
import {SourceButton,SourceInput,TableHeader,TableRow,TableBody,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useState } from "react";
import { Pencil, Plus, Save } from "lucide-react";
import {useSourceApi, ApiError } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import type { Department, ResourceType, Specialty } from "../../../lib/types";
import { Badge, Button, Check, ErrorNote, Field, IconButton, Input, Modal, PageHeader, Panel, Segmented, Select, Skeleton, Table, Td, Th, cx } from "../../../components/ui";
import { ResourceCategoryIcon } from "../../../components/icons";
import { useToast } from "../../../components/toast";

export default function DepartmentsPage() {
  const [tab, setTab] = useState<"departments" | "types">("departments");
  return (
    <>
      <PageHeader title="Departments" description="How the hospital is organised. Departments group resources and services; specialties narrow them further; resource types describe what can be booked.">
        <Segmented value={tab} onChange={setTab} options={[["departments", "Departments and specialties"], ["types", "Resource types"]]} />
      </PageHeader>
      {tab === "departments" ? <Departments /> : <Types />}
    </>
  );
}

function Departments() {
  const { t: tr } = useLocalization();
  const { data, error, loading, reload } = useApi<Department[]>("/departments");
  const [edit, setEdit] = useState<Partial<Department> | null>(null);
  const [spec, setSpec] = useState<Partial<Specialty> | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit({ color: "#0F7A68", active: true })}><LocalizedText message="Add department" /></Button></div>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? <Skeleton className="h-96" /> : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {data?.map((d) => (
            <section key={d.id} className={cx("rounded-xl border border-line bg-panel", !d.active && "opacity-60")}>
              <header className="flex items-start gap-3 border-b border-line-2 p-4" style={{ boxShadow: `inset 3px 0 0 ${d.color}` }}>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{d.name} <span className="tabular text-xs font-normal text-mute">{d.code}</span>{!d.active && <Badge className="ml-2"><LocalizedText message="Inactive" /></Badge>}</h2>
                  <p className="text-xs text-mute">{d.location || tr("No location set")}<LocalizedText message={". {value0} resources, {value1} services."} values={{ value0: (d.resource_count) ?? "", value1: (d.service_count) ?? "" }} /></p>
                </div>
                <IconButton label={tr("Edit {value0}", { value0: (d.name) ?? "" })} onClick={() => setEdit(d)}><Pencil className="size-4" /></IconButton>
              </header>
              <div className="flex flex-wrap gap-1.5 p-3">
                {d.specialties.map((s) => <SourceButton key={s.id} onClick={() => setSpec(s)} className={cx("rounded-full border border-line px-2.5 py-1 text-xs hover:border-ink/30", !s.active && "line-through opacity-60")}>{s.name}</SourceButton>)}
                <SourceButton onClick={() => setSpec({ department_id: d.id, active: true })} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-scrub hover:border-scrub"><Plus className="size-3" /><LocalizedText message="Specialty" /></SourceButton>
              </div>
            </section>
          ))}
        </div>
      )}
      {edit && <DeptModal d={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
      {spec && <SpecModal s={spec} depts={data ?? []} onClose={() => setSpec(null)} onDone={() => { setSpec(null); reload(); }} />}
    </>
  );
}

function useSave(onDone: () => void, ok: string) {
  const api = useSourceApi();
  const toast = useToast();
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (path: string, method: string, json: unknown) => {
    setBusy(true); setErr(null);
    try { await api(path, { method, json }); toast.success(ok); onDone(); } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return { err, busy, run };
}

function DeptModal({ d, onClose, onDone }: { d: Partial<Department>; onClose: () => void; onDone: () => void }) {
  const { t: tr } = useLocalization();
  const [f, setF] = useState({ name: d.name ?? "", code: d.code ?? "", color: d.color ?? "#0F7A68", location: d.location ?? "", description: d.description ?? "", active: d.active ?? true });
  const { err, busy, run } = useSave(onDone, d.id ? "Department saved" : "Department created");
  const fe = err?.fields ?? {};
  return (
    <Modal open onClose={onClose} title={d.id ? tr("Edit {value0}", { value0: (d.name) ?? "" }) : tr("Add department")}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} icon={<Save className="size-4" />} onClick={() => run(d.id ? `/departments/${d.id}` : "/departments", d.id ? "PUT" : "POST", { ...f, location: f.location || null, description: f.description || null })}><LocalizedText message="Save" /></Button></>}>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="Name" required error={fe.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Code" required error={fe.code}><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} maxLength={10} /></Field>
        <Field label="Location" className="sm:col-span-2"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Block B, 2nd floor" /></Field>
        <Field label="Calendar colour" error={fe.color}><div className="flex items-center gap-2"><SourceInput type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-10 w-12 rounded border border-line" /><Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="tabular" /></div></Field>
        <div className="flex items-end pb-2"><Check label="Active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} /></div>
        {err && !Object.keys(fe).length && <div className="sm:col-span-2"><ErrorNote error={err} /></div>}
      </div>
    </Modal>
  );
}

function SpecModal({ s, depts, onClose, onDone }: { s: Partial<Specialty>; depts: Department[]; onClose: () => void; onDone: () => void }) {
  const { t: tr } = useLocalization();
  const [f, setF] = useState({ name: s.name ?? "", department_id: s.department_id ?? 0, active: s.active ?? true });
  const { err, busy, run } = useSave(onDone, s.id ? "Specialty saved" : "Specialty added");
  return (
    <Modal open onClose={onClose} title={s.id ? tr("Edit {value0}", { value0: (s.name) ?? "" }) : tr("Add specialty")}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} onClick={() => run(s.id ? `/specialties/${s.id}` : "/specialties", s.id ? "PUT" : "POST", f)}><LocalizedText message="Save" /></Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Name" required error={err?.fields.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Department" required><Select value={f.department_id} onChange={(e) => setF({ ...f, department_id: Number(e.target.value) })}>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        <Check label="Active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
        {err && !Object.keys(err.fields).length && <ErrorNote error={err} />}
      </div>
    </Modal>
  );
}

const CATS = ["person", "room", "chair", "bed", "equipment", "other"] as const;
function Types() {
  const { t: tr } = useLocalization();
  const { data, error, loading, reload } = useApi<ResourceType[]>("/resource-types");
  const [edit, setEdit] = useState<Partial<ResourceType> | null>(null);
  const [f, setF] = useState({ name: "", category: "person" as ResourceType["category"], default_slot_minutes: 15 });
  const { err, busy, run } = useSave(() => { setEdit(null); reload(); }, "Resource type saved");
  const openEdit = (t: Partial<ResourceType>) => { setEdit(t); setF({ name: t.name ?? "", category: t.category ?? "person", default_slot_minutes: t.default_slot_minutes ?? 15 }); };
  return (
    <>
      <div className="mb-3 flex justify-end"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openEdit({})}><LocalizedText message="Add resource type" /></Button></div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <Skeleton className="h-80" /> : (
          <Table>
            <TableHeader><TableRow><Th><LocalizedText message="Type" /></Th><Th><LocalizedText message="Kind" /></Th><Th><LocalizedText message="Default slot" /></Th><Th><LocalizedText message="Active resources" /></Th><Th /></TableRow></TableHeader>
            <TableBody>{data?.map((t) => (
              <TableRow key={t.id}>
                <Td><span className="flex items-center gap-2"><ResourceCategoryIcon category={t.category} className="size-4 text-mute" /><span className="font-medium">{t.name}</span></span></Td>
                <Td className="capitalize text-ink-2">{t.category}</Td><Td className="tabular"><LocalizedText message={"{value0} min"} values={{ value0: (t.default_slot_minutes) ?? "" }} /></Td><Td className="tabular">{t.resource_count}</Td>
                <Td className="text-right"><IconButton label={tr("Edit {value0}", { value0: (t.name) ?? "" })} onClick={() => openEdit(t)}><Pencil className="size-4" /></IconButton></Td>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? tr("Edit {value0}", { value0: (edit.name) ?? "" }) : tr("Add resource type")}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} onClick={() => run(edit?.id ? `/resource-types/${edit.id}` : "/resource-types", edit?.id ? "PUT" : "POST", f)}><LocalizedText message="Save" /></Button></>}>
        <div className="flex flex-col gap-3">
          <Field label="Name" required error={err?.fields.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dialysis chair, Echo machine…" /></Field>
          <Field label="Kind"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as ResourceType["category"] })}>{CATS.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}</Select></Field>
          <Field label="Default slot for new resources of this type" hint="Each resource can override it">
            <Select value={f.default_slot_minutes} onChange={(e) => setF({ ...f, default_slot_minutes: Number(e.target.value) })}>{[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}><LocalizedText message={"{value0} minutes"} values={{ value0: (m) ?? "" }} /></option>)}</Select>
          </Field>
          {err && !Object.keys(err.fields).length && <ErrorNote error={err} />}
        </div>
      </Modal>
    </>
  );
}
