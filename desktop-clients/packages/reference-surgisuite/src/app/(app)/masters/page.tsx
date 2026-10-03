"use client";
import {useLocalization} from "@pepbits/ops-ui";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceSelect, SourceButton, Table } from "@pepbits/ops-ui";

import { useEffect, useMemo, useState } from "react";
import { useSourceApi, useApi } from "./../../../lib/api";
import { useInvalidateMasters, useDiagnoses, useLookups, useTheatres, type Diagnosis, type Equipment, type Procedure, type Staff, type Theatre } from "./../../../lib/masters";
import { ROLE_LABEL, useSourceFormat} from "./../../../lib/format";
import { Badge, Button, Empty, ErrorNote, Field, PanelHeader, Segmented, Select, Spinner, cx, useAction } from "./../../../components/ui";
import { IconClose, IconPlus, IconSearch } from "./../../../components/icons";
import { CodePicker } from "./../../../components/BookCase";

type Tab = "procedures" | "diagnoses" | "theatres" | "equipment" | "staff" | "lists";

export default function MastersPage() {
  const [tab, setTab] = useState<Tab>("procedures");
  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-cond text-[24px] font-semibold"><LocalizedText message={"Masters & coding"}/></h1>
        <Segmented
          className="overflow-x-auto"
          value={tab}
          onChange={setTab}
          options={[
            { value: "procedures", label: "Procedures (CPT)" },
            { value: "diagnoses", label: "Diagnoses (ICD-10)" },
            { value: "theatres", label: "Theatres" },
            { value: "equipment", label: "Equipment" },
            { value: "staff", label: "Staff & roles" },
            { value: "lists", label: "Lists" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">
        {tab === "procedures" && <Procedures />}
        {tab === "diagnoses" && <Diagnoses />}
        {tab === "theatres" && <Theatres />}
        {tab === "equipment" && <EquipmentTab />}
        {tab === "staff" && <StaffTab />}
        {tab === "lists" && <Lists />}
      </div>
    </div>
  );
}

const SPECIALTIES = ["General Surgery", "Orthopedics", "Cardiothoracic", "Vascular Surgery", "Neurosurgery", "Obstetrics & Gynecology", "Urology", "ENT", "Ophthalmology", "Plastic Surgery", "Anesthesiology"];
const EMPTY_PROC = { cpt: "", name: "", specialty: "General Surgery", op_type: "Intermediate", default_approach: "Open", default_duration_min: 60, t_time_min: 120, wound_class: "I", rvu: 0, fee: 0, is_addon: 0, high_risk: 0, requires_implant: 0 };

function Procedures() {
 const {money}=useSourceFormat();
 const invalidateMasters=useInvalidateMasters();
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState("");
  const { data, loading, reload } = useApi<Procedure[]>(`/procedures?q=${encodeURIComponent(q)}&specialty=${encodeURIComponent(spec)}`);
  const [sel, setSel] = useState<number | "new" | null>(null);
  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <section className="panel flex min-h-0 flex-col overflow-hidden">
        <div className="flex gap-2 border-b border-line p-3">
          <div className="relative flex-1">
            <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <SourceInput className="input pl-8" placeholder="CPT or name" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <SourceSelect className="input w-40" value={spec} onChange={(e) => setSpec(e.target.value)} aria-label="Specialty"><option value=""><LocalizedText message={"All specialties"}/></option>{SPECIALTIES.map((s) => <option key={s}>{s}</option>)}</SourceSelect>
          <Button variant="primary" onClick={() => setSel("new")}><IconPlus size={16} /> {" "}<LocalizedText message={"Add"}/></Button>
        </div>
        {loading && !data ? <Spinner /> : (
          <ul className="scroll-y min-h-0 flex-1 divide-y divide-line">
            {data?.map((p) => (
              <li key={p.id}>
                <SourceButton onClick={() => setSel(p.id)} className={cx("flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-steel/60", sel === p.id && "bg-ceil-soft")}>
                  <span className="w-14 font-cond text-[16px] font-semibold">{p.cpt}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{p.name}</span>
                    <span className="block text-[12px] text-muted">{p.specialty}, {p.op_type}, {money(p.fee)}</span>
                  </span>
                  <span className="flex gap-1">
                    {!!p.is_addon && <Badge tone="muted"><LocalizedText message={"Add-on"}/></Badge>}
                    {!!p.requires_implant && <Badge tone="violet"><LocalizedText message={"Implant"}/></Badge>}
                    {p.dx_count === 0 && !p.is_addon && <Badge tone="amber"><LocalizedText message={"No ICD map"}/></Badge>}
                  </span>
                </SourceButton>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel scroll-y min-h-0">
        {sel === null ? <Empty title="Choose a procedure"><LocalizedText message={"Edit its CPT details, the diagnoses that support it, and the preference card that builds each case's pick list."}/></Empty> : <ProcEditor key={String(sel)} id={sel} onSaved={(id) => { reload(); invalidateMasters("/procedures"); setSel(id); }} />}
      </section>
    </div>
  );
}

type ProcDetail = Procedure & { diagnoses: Diagnosis[]; items: { id: number; name: string; sku: string; qty: number; category: string }[] };

function ProcEditor({ id, onSaved }: { id: number | "new"; onSaved: (id: number) => void }) {
 const {t:translateSource}=useLocalization();
 const api=useSourceApi();
  const lookups = useLookups();
  const diagnoses = useDiagnoses();
  const { data } = useApi<ProcDetail>(id === "new" ? null : `/procedures/${id}`);
  const [f, setF] = useState<typeof EMPTY_PROC>(EMPTY_PROC);
  const [dx, setDx] = useState<Diagnosis[]>([]);
  const [items, setItems] = useState<{ id: number; name: string; qty: number }[]>([]);
  const [inv, setInv] = useState<{ id: number; name: string; sku: string; category: string }[]>([]);
  const { run, busy, error } = useAction();
  useEffect(() => { api("/inventory").then(setInv).catch(() => {}); }, []);
  useEffect(() => {
    if (!data) return;
    const { diagnoses: d, items: it, ...rest } = data;
    setF(rest as unknown as typeof EMPTY_PROC);
    setDx(d);
    setItems(it.map((i) => ({ id: i.id, name: i.name, qty: i.qty })));
  }, [data]);
  if (id !== "new" && !data) return <Spinner />;

  const save = async () => {
    const res = await run(async () => {
      let pid = id as number;
      if (id === "new") pid = (await api<{ id: number }>("/procedures", { body: f })).id;
      else await api(`/procedures/${id}`, { method: "PUT", body: f });
      await api(`/procedures/${pid}/mapping`, { method: "PUT", body: { diagnosisIds: dx.map((d) => d.id) } });
      await api(`/procedures/${pid}/preference`, { method: "PUT", body: { items: items.map((i) => ({ itemId: i.id, qty: i.qty })) } });
      return pid;
    }, "Procedure saved");
    if (res) onSaved(res);
  };
  const num = (k: keyof typeof EMPTY_PROC) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });

  return (
    <div>
      <PanelHeader title={id === "new" ? "New procedure" : `${f.cpt} ${f.name}`}>
        <Button variant="primary" busy={busy} onClick={save} disabled={!f.cpt || !f.name}><LocalizedText message={"Save procedure"}/></Button>
      </PanelHeader>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <Field label="CPT code"><SourceInput className="input" value={f.cpt} onChange={(e) => setF({ ...f, cpt: e.target.value })} maxLength={5} /></Field>
        <Field label="Name" className="col-span-2 md:col-span-3"><SourceInput className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Specialty"><Select value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} options={SPECIALTIES} /></Field>
        <Field label="Operation type"><Select value={f.op_type} onChange={(e) => setF({ ...f, op_type: e.target.value })} options={lookups.OP_TYPE ?? []} /></Field>
        <Field label="Default approach"><Select value={f.default_approach} onChange={(e) => setF({ ...f, default_approach: e.target.value })} options={lookups.APPROACH ?? []} /></Field>
        <Field label="Wound class"><Select value={f.wound_class} onChange={(e) => setF({ ...f, wound_class: e.target.value })} options={lookups.WOUND_CLASS ?? []} /></Field>
        <Field label="Default minutes"><SourceInput type="number" className="input" value={f.default_duration_min} onChange={num("default_duration_min")} /></Field>
        <Field label="NNIS T-time (min)" hint="75th percentile duration"><SourceInput type="number" className="input" value={f.t_time_min} onChange={num("t_time_min")} /></Field>
        <Field label="RVU"><SourceInput type="number" step="0.1" className="input" value={f.rvu} onChange={num("rvu")} /></Field>
        <Field label="Fee (USD)"><SourceInput type="number" className="input" value={f.fee} onChange={num("fee")} /></Field>
        <div className="col-span-2 flex flex-wrap gap-4 md:col-span-4">
          {([["is_addon", "Add-on code (exempt from -51)"], ["high_risk", "High risk (needs head of department approval)"], ["requires_implant", "Uses an implant"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-[13px]"><SourceInput type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked ? 1 : 0 })} />{l}</label>
          ))}
        </div>
      </div>
      <div className="border-t border-line p-4">
        <h4 className="mb-2 font-cond text-[15px] font-semibold"><LocalizedText message={"Supporting diagnoses"}/></h4>
        <p className="mb-2 text-[12px] text-muted"><LocalizedText message={"Cases coded with this CPT are flagged when none of these diagnoses is on the case."}/></p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {dx.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1 rounded-[5px] border border-line bg-steel/60 py-0.5 pl-2 pr-1 text-[12px]">
              <b>{d.icd10}</b> {d.description.slice(0, 40)}
              <SourceButton aria-label={translateSource("Remove {value0}",{value0:d.icd10})} className="rounded p-0.5 hover:bg-stop-soft hover:text-stop" onClick={() => setDx(dx.filter((x) => x.id !== d.id))}><IconClose size={12} /></SourceButton>
            </span>
          ))}
        </div>
        <CodePicker label="" items={diagnoses} itemKey={(d) => d.id} render={(d) => (<><b>{d.icd10}</b> {d.description}</>)} match={(d, q) => `${d.icd10} ${d.description}`.toLowerCase().includes(q)} onPick={(d) => !dx.some((x) => x.id === d.id) && setDx([...dx, d])} />
      </div>
      <div className="border-t border-line p-4">
        <h4 className="mb-2 font-cond text-[15px] font-semibold"><LocalizedText message={"Preference card"}/></h4>
        <p className="mb-2 text-[12px] text-muted"><LocalizedText message={"These items are added to the pick list and reserved in stock when a case is booked."}/></p>
        <ul className="mb-2 divide-y divide-line rounded-[8px] border border-line">
          {items.length === 0 && <li className="px-3 py-2 text-[13px] text-muted"><LocalizedText message={"No items yet."}/></li>}
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
              <span className="flex-1">{i.name}</span>
              <SourceInput type="number" min={1} className="input h-7 w-16" value={i.qty} onChange={(e) => setItems(items.map((x) => (x.id === i.id ? { ...x, qty: Number(e.target.value) } : x)))} aria-label={translateSource("Quantity of {value0}",{value0:i.name})} />
              <SourceButton aria-label={translateSource("Remove {value0}",{value0:i.name})} className="rounded p-1 text-muted hover:bg-stop-soft hover:text-stop" onClick={() => setItems(items.filter((x) => x.id !== i.id))}><IconClose size={14} /></SourceButton>
            </li>
          ))}
        </ul>
        <CodePicker label="" items={inv} itemKey={(i) => i.id} render={(i) => (<>{i.name} <span className="text-muted">{i.sku}, {i.category}</span></>)} match={(i, q) => `${i.name} ${i.sku}`.toLowerCase().includes(q)} onPick={(i) => !items.some((x) => x.id === i.id) && setItems([...items, { id: i.id, name: i.name, qty: 1 }])} />
      </div>
      <ErrorNote error={error} className="m-4" />
    </div>
  );
}

function Diagnoses() {
 const invalidateMasters=useInvalidateMasters();
 const api=useSourceApi();
  const [q, setQ] = useState("");
  const { data, reload } = useApi<Diagnosis[]>(`/diagnoses?q=${encodeURIComponent(q)}`);
  const [f, setF] = useState({ icd10: "", description: "", category: "" });
  const { run, busy, error } = useAction();
  const cats = useMemo(() => [...new Set((data ?? []).map((d) => d.category))], [data]);
  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-end gap-2 border-b border-line p-3">
        <div className="relative w-64"><IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" /><SourceInput className="input pl-8" placeholder="Search ICD-10" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="flex-1" />
        <Field label="ICD-10" className="w-28"><SourceInput className="input" value={f.icd10} onChange={(e) => setF({ ...f, icd10: e.target.value.toUpperCase() })} placeholder="K80.20" /></Field>
        <Field label="Description" className="w-80"><SourceInput className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Category" className="w-40"><SourceInput className="input" list="dx-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="dx-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Button variant="primary" busy={busy} disabled={!f.icd10 || !f.description} onClick={() => run(() => api("/diagnoses", { body: f }), "Diagnosis added").then((r) => { if (r) { setF({ icd10: "", description: "", category: "" }); reload(); invalidateMasters("/diagnoses"); } })}><LocalizedText message={"Add"}/></Button>
        <ErrorNote error={error} className="w-full" />
      </div>
      <div className="scroll-y min-h-0 flex-1">
        <Table className="w-full text-[13px]">
          <tbody className="divide-y divide-line">
            {data?.map((d) => (
              <tr key={d.id}><td className="w-28 px-4 py-1.5 font-cond text-[15px] font-semibold">{d.icd10}</td><td className="px-2 py-1.5">{d.description}</td><td className="px-4 py-1.5 text-right text-muted">{d.category}</td></tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  );
}

function Theatres() {
 const invalidateMasters=useInvalidateMasters();
 const api=useSourceApi();
  const { data, reload } = useApi<Theatre[]>("/theatres");
  const [f, setF] = useState({ code: "", name: "", kind: "General", location: "" });
  const { run, busy, error } = useAction();
  return (
    <section className="panel">
      <Table className="w-full text-[13px]">
        <thead className="bg-steel/60 text-left text-[12px] text-muted"><tr><th className="px-4 py-2 font-medium"><LocalizedText message={"Code"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Name"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Type"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Location"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Hours"}/></th><th className="px-4 py-2 font-medium"><LocalizedText message={"Status"}/></th></tr></thead>
        <tbody className="divide-y divide-line">
          {data?.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-2 font-cond text-[16px] font-semibold">{t.code}</td><td className="px-2 py-2">{t.name}</td><td className="px-2 py-2">{t.kind}</td><td className="px-2 py-2 text-muted">{t.location}</td><td className="px-2 py-2">{t.open_time}–{t.close_time}</td>
              <td className="w-44 px-4 py-2"><SourceSelect className="input h-8" value={t.status} onChange={(e) => run(() => api(`/theatres/${t.id}`, { method: "PATCH", body: { status: e.target.value } }), "Theatre updated").then((r) => { if (r) { reload(); invalidateMasters("/theatres"); } })}>{["Available", "Maintenance", "Closed"].map((s) => <option key={s}>{s}</option>)}</SourceSelect></td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="flex flex-wrap items-end gap-2 border-t border-line p-4">
        <Field label="Code" className="w-24"><SourceInput className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Name" className="w-48"><SourceInput className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Type" className="w-40"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={["General", "Laminar flow", "Hybrid", "Day care"]} /></Field>
        <Field label="Location" className="w-56"><SourceInput className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <Button variant="primary" busy={busy} disabled={!f.code || !f.name} onClick={() => run(() => api("/theatres", { body: f }), "Theatre added").then((r) => { if (r) { setF({ code: "", name: "", kind: "General", location: "" }); reload(); invalidateMasters("/theatres"); } })}><LocalizedText message={"Add theatre"}/></Button>
        <ErrorNote error={error} className="w-full" />
      </div>
    </section>
  );
}

function EquipmentTab() {
 const invalidateMasters=useInvalidateMasters();
 const api=useSourceApi();
  const { data, reload } = useApi<Equipment[]>("/equipment");
  const theatres = useTheatres();
  const [f, setF] = useState({ code: "", name: "", category: "Imaging", home_theatre_id: "" });
  const { run, busy, error } = useAction();
  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="scroll-y min-h-0 flex-1">
        <Table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-white text-left text-[12px] text-muted shadow-[0_1px_0_#d5dbdf]"><tr><th className="px-4 py-2 font-medium"><LocalizedText message={"Equipment"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Category"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Home theatre"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Service"}/></th><th className="px-4 py-2 font-medium"><LocalizedText message={"Status"}/></th></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2"><span className="font-medium">{e.name}</span><span className="block text-[12px] text-muted">{e.code}</span></td>
                <td className="px-2 py-2">{e.category}</td><td className="px-2 py-2">{e.theatre_code ?? "Shared"}</td>
                <td className="px-2 py-2 text-[12px]"><LocalizedText message={"Last"}/>{" "}{e.last_service}<span className="block text-muted"><LocalizedText message={"Next"}/>{" "}{e.next_service}</span></td>
                <td className="w-44 px-4 py-2"><SourceSelect className={cx("input h-8", e.status !== "Ready" && "border-stop text-stop")} value={e.status} onChange={(ev) => run(() => api(`/equipment/${e.id}`, { method: "PATCH", body: { status: ev.target.value } }), "Equipment updated").then((r) => { if (r) { reload(); invalidateMasters("/equipment"); } })}>{["Ready", "In use", "Maintenance", "Out of service"].map((s) => <option key={s}>{s}</option>)}</SourceSelect></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-line p-4">
        <Field label="Code" className="w-32"><SourceInput className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Name" className="w-56"><SourceInput className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Category" className="w-36"><SourceInput className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
        <Field label="Home theatre" className="w-40"><Select value={f.home_theatre_id} placeholder="Shared" onChange={(e) => setF({ ...f, home_theatre_id: e.target.value })} options={theatres.map((t) => ({ value: String(t.id), label: t.code }))} /></Field>
        <Button variant="primary" busy={busy} disabled={!f.code || !f.name} onClick={() => run(() => api("/equipment", { body: { ...f, home_theatre_id: f.home_theatre_id ? Number(f.home_theatre_id) : null } }), "Equipment added").then((r) => { if (r) { setF({ code: "", name: "", category: "Imaging", home_theatre_id: "" }); reload(); invalidateMasters("/equipment"); } })}><LocalizedText message={"Add equipment"}/></Button>
        <ErrorNote error={error} className="w-full" />
      </div>
    </section>
  );
}

function StaffTab() {
 const invalidateMasters=useInvalidateMasters();
 const api=useSourceApi();
  const { data, reload } = useApi<(Staff & { email: string; phone: string })[]>("/staff");
  const [f, setF] = useState({ emp_code: "", name: "", role: "SURGEON", specialty: "", title: "", pin: "" });
  const { run, busy, error } = useAction();
  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="scroll-y min-h-0 flex-1">
        <Table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-white text-left text-[12px] text-muted shadow-[0_1px_0_#d5dbdf]"><tr><th className="px-4 py-2 font-medium"><LocalizedText message={"Name"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Role"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Specialty"}/></th><th className="px-2 py-2 font-medium"><LocalizedText message={"Contact"}/></th><th className="px-4 py-2 font-medium" /></tr></thead>
          <tbody className="divide-y divide-line">
            {data?.map((s) => (
              <tr key={s.id} className={cx(!s.active && "opacity-50")}>
                <td className="px-4 py-2"><span className="font-medium">{s.name}</span><span className="block text-[12px] text-muted">{s.emp_code}, {s.title}</span></td>
                <td className="px-2 py-2">{ROLE_LABEL[s.role]}</td><td className="px-2 py-2">{s.specialty ?? "—"}</td>
                <td className="px-2 py-2 text-[12px]">{s.email}<span className="block text-muted">{s.phone}</span></td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => run(() => api(`/staff/${s.id}`, { method: "PATCH", body: { active: !s.active } }), s.active ? "Access removed" : "Access restored").then((r) => { if (r) { reload(); invalidateMasters("/staff"); } })}>{s.active ? "Deactivate" : "Reactivate"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-line p-4">
        <Field label="Employee code" className="w-32"><SourceInput className="input" value={f.emp_code} onChange={(e) => setF({ ...f, emp_code: e.target.value })} /></Field>
        <Field label="Full name" className="w-52"><SourceInput className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role" className="w-48"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Specialty" className="w-40"><SourceInput className="input" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></Field>
        <Field label="Title" className="w-40"><SourceInput className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Starting PIN" className="w-28"><SourceInput className="input" type="password" value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value })} /></Field>
        <Button variant="primary" busy={busy} disabled={!f.emp_code || !f.name || !f.pin} onClick={() => run(() => api("/staff", { body: f }), "Staff member added").then((r) => { if (r) { setF({ emp_code: "", name: "", role: "SURGEON", specialty: "", title: "", pin: "" }); reload(); invalidateMasters("/staff"); } })}><LocalizedText message={"Add staff"}/></Button>
        <ErrorNote error={error} className="w-full" />
        <p className="w-full text-[12px] text-muted"><LocalizedText message={"Only administrators can add staff. Roles decide what each person can sign: consents, approvals, anesthesia records and operative reports."}/></p>
      </div>
    </section>
  );
}

const LIST_LABEL: Record<string, string> = {
  CASE_CLASS: "Case class", OP_TYPE: "Operation type", PROC_ROLE: "Procedure role", APPROACH: "Surgical approach", ANESTHESIA: "Anesthesia type", POSITION: "Patient position",
  WOUND_CLASS: "Wound class", ASA: "ASA class", LATERALITY: "Laterality", MODIFIER: "CPT modifiers", DELAY_REASON: "Delay reasons", CANCEL_REASON: "Cancellation reasons",
  TEAM_ROLE: "Team roles", IMAGING: "Intra-op imaging", LAB: "Intra-op lab tests", BLOOD: "Blood products", DRUG: "Anesthesia drugs", CONSENT_KIND: "Consent types", APPROVAL_KIND: "Approval types",
};

function Lists() {
 const invalidateMasters=useInvalidateMasters();
 const api=useSourceApi();
  const { data, reload } = useApi<Record<string, string[]>>("/lookups");
  const [cat, setCat] = useState("DELAY_REASON");
  const [label, setLabel] = useState("");
  const { run, busy, error } = useAction();
  if (!data) return <Spinner />;
  return (
    <div className="grid h-full min-h-0 gap-3 md:grid-cols-[260px_1fr]">
      <section className="panel scroll-y min-h-0">
        <ul className="py-1">
          {Object.keys(data).map((k) => (
            <li key={k}><SourceButton onClick={() => setCat(k)} className={cx("flex w-full justify-between px-4 py-1.5 text-left text-[13px] hover:bg-steel", cat === k && "bg-ceil-soft font-medium text-ceil-2")}>{LIST_LABEL[k] ?? k}<span className="text-muted">{data[k].length}</span></SourceButton></li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <PanelHeader title={LIST_LABEL[cat] ?? cat} />
        <ul className="flex flex-wrap gap-1.5 p-4">
          {data[cat]?.map((v) => <li key={v} className="rounded-[5px] border border-line bg-steel/50 px-2 py-0.5 text-[13px]">{cat === "DRUG" ? v.split("|").join(", ") : v}</li>)}
        </ul>
        <div className="flex items-end gap-2 border-t border-line p-4">
          <Field label="New value" className="w-80"><SourceInput className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={cat === "DRUG" ? "Name|unit|route" : ""} /></Field>
          <Button variant="primary" busy={busy} disabled={!label} onClick={() => run(() => api("/lookups", { body: { category: cat, label } }), "Value added").then((r) => { if (r) { setLabel(""); reload(); invalidateMasters("/lookups"); } })}><LocalizedText message={"Add value"}/></Button>
        </div>
        <ErrorNote error={error} className="mx-4 mb-4" />
      </section>
    </div>
  );
}
