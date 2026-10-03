"use client";
import { ArrowLeft, Plus, Search, ShieldAlert, UserRound } from "lucide-react";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { LocalizedText } from "@pepbits/ops-ui";
import { useEffect, useState } from "react";
import { Dialog } from "../ui/dialog";
import { SourceButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/controls";
import { Button, DateInput, EmptyState, ErrorNote, Field, Input, ListSkeleton, Panel, PanelHeader, Segmented, Skeleton, StatusPill, Tag } from "../ui/primitives";
import { useShell } from "../shell/ShellContext";
import { useApi, useApiClient } from "../../lib/api";
import { cx } from "../../lib/cx";
import { age, todayIso, usePharmacyFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { useAction } from "../../lib/useAction";

interface PatientRow {
  id: string; mrn: string; name: string; dob: string; gender: string; phone: string | null; allergies: string[]; conditions: string[];
  payer_code: string | null; coverage_to: string | null; last_visit: string | null; open_rx: number;
}
interface Profile extends PatientRow {
  email: string | null; address: string | null; weight_kg: number | null;
  coverages: { id: string; payer_name: string; payer_code: string; workflow: string; member_id: string; plan_name: string; priority: number; coverage_pct: number; valid_from: string; valid_to: string }[];
  prescriptions: { id: string; rx_no: string; status: string; received_at: string; diagnosis: string | null; doctor_name: string; items: string }[];
  medications: { name: string; generic: string; strength: string; last_supplied: string; total_qty: number; dispense_unit: string }[];
  balance: { billed: number | null; patient_share: number | null; paid: number | null };
}

export function PatientsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { int } = usePharmacyFormat();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [closed, setClosed] = useState(false); // mobile: user went back to the list
  const [creating, setCreating] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setDebounced(q.trim()), 180); return () => clearTimeout(timer); }, [q]);

  const { data, error, isLoading, mutate } = useApi<PatientRow[]>(`/patients${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`);
  // Selection lives in the URL so palette links and back/forward work; default to the first patient
  const selected = closed ? null : params.get("id") ?? data?.[0]?.id ?? null;

  const select = (id: string | null) => { setClosed(id === null); router.replace(id ? `/patients?id=${id}` : "/patients", { scroll: false }); };
  const move = (d: 1 | -1) => {
    if (!data?.length) return;
    const i = data.findIndex((p) => p.id === selected);
    const next = data[Math.min(Math.max(i + d, 0), data.length - 1)];
    select(next.id);
    document.querySelector(`[data-patient="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  useHotkeys({ j: () => move(1), k: () => move(-1), arrowdown: () => move(1), arrowup: () => move(-1) }, [data, selected]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={cx("flex min-h-0 flex-col border-r border-line bg-surface", selected && "hidden lg:flex")} aria-label="Patients">
        <div className="flex shrink-0 gap-2 border-b border-line p-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, MRN or phone" className="pl-8" aria-label="Search patients" />
          </div>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)} aria-label="New patient"><LocalizedText message="New" /></Button>
        </div>
        {error ? <ErrorNote error={error} onRetry={() => mutate()} /> : isLoading && !data ? <ListSkeleton /> : !data?.length ? (
          <EmptyState icon={<UserRound className="size-5" />} title="No patients match" body="Check the spelling or register a new patient." action={<Button onClick={() => setCreating(true)}><LocalizedText message="Register patient" /></Button>} />
        ) : (
          <ul className="scroll-y min-h-0 flex-1" role="listbox" aria-label="Patient list">
            {data.map((p) => {
              const lapsed = p.coverage_to && p.coverage_to < todayIso();
              return (
                <li key={p.id} data-patient={p.id} role="option" aria-selected={p.id === selected}>
                  <SourceButton onClick={() => select(p.id)} className={cx("flex w-full flex-col gap-0.5 border-b border-line px-4 py-2.5 text-left", p.id === selected ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
                    <span className="flex items-center gap-2">
                      <span className={cx("truncate text-[13.5px] font-semibold", p.id === selected && "text-cobalt-strong")}>{p.name}</span>
                      <span className="num text-xs text-ink-3">{age(p.dob)}{p.gender}</span>
                      <span className={cx("ml-auto text-[11.5px] font-medium", lapsed ? "text-danger" : "text-ink-2")}>{p.payer_code ? (lapsed ? <LocalizedText message="{value0} lapsed" values={{ value0: p.payer_code }} /> : p.payer_code) : <LocalizedText message="Self-pay" />}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-ink-3">
                      <span className="num">{p.mrn}</span>
                      {p.allergies.length > 0 && <span className="flex items-center gap-0.5 text-danger"><ShieldAlert className="size-3" />{p.allergies.join(", ")}</span>}
                      {p.open_rx > 0 && <span className="ml-auto text-cobalt"><LocalizedText message="{value0} open Rx" values={{ value0: int(p.open_rx) }} /></span>}
                    </span>
                  </SourceButton>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className={cx("min-h-0 min-w-0", !selected && "hidden lg:block")}>
        {selected ? <PatientProfile id={selected} onBack={() => select(null)} /> : <EmptyState icon={<UserRound className="size-5" />} title="Select a patient" className="h-full" />}
      </section>

      {creating && <NewPatientDialog open onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setQ(""); mutate(); select(id); }} />}
    </div>
  );
}

function PatientProfile({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: p, error, mutate } = useApi<Profile>(`/patients/${id}`);
  const { openNewRx } = useShell();
  const { t, moneyC, date, dateShort, int, num } = usePharmacyFormat();
  const [now] = useState(() => Date.now());
  if (error) return <ErrorNote error={error} onRetry={() => mutate()} />;
  if (!p || p.id !== id) return <div className="flex flex-col gap-4 p-5"><Skeleton className="h-16 w-1/2" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  const owed = Math.max(0, (p.balance.patient_share ?? 0) - (p.balance.paid ?? 0));
  const gender = p.gender === "F" ? t("female") : p.gender === "M" ? t("male") : t("unspecified");
  const summary = p.weight_kg
    ? t("{value0}, {value1} years ({value2}), {value3}, {value4} kg", { value0: p.mrn, value1: int(age(p.dob)), value2: date(p.dob), value3: gender, value4: p.weight_kg })
    : t("{value0}, {value1} years ({value2}), {value3}", { value0: p.mrn, value1: int(age(p.dob)), value2: date(p.dob), value3: gender });
  const today = todayIso();

  return (
    <div className="scroll-y h-full">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-4 p-3 md:p-5">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <SourceButton onClick={onBack} className="mt-1 rounded-md p-1 text-ink-3 hover:bg-surface-3 lg:hidden" aria-label="Back to list"><ArrowLeft className="size-4" /></SourceButton>
          <div className="min-w-0 flex-1">
            <h2 className="text-[20px] font-semibold tracking-tight">{p.name}</h2>
            <p className="num text-[13px] text-ink-2">{summary}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.allergies.length ? p.allergies.map((a) => <Tag key={a} tone="danger" className="capitalize"><ShieldAlert className="size-3" /><LocalizedText message="Allergy: {value0}" values={{ value0: a }} /></Tag>) : <Tag tone="muted"><LocalizedText message="No known allergies" /></Tag>}
              {p.conditions.map((c) => <Tag key={c} tone="muted">{c}</Tag>)}
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-x-6 text-[12.5px]">
            <div><dt className="text-ink-3"><LocalizedText message="Phone" /></dt><dd className="num">{p.phone ?? "—"}</dd></div>
            <div><dt className="text-ink-3"><LocalizedText message="Area" /></dt><dd>{p.address ?? "—"}</dd></div>
            <div><dt className="text-ink-3"><LocalizedText message="Owes" /></dt><dd className={cx("num font-semibold", owed > 0 ? "text-amber" : "text-ink")}>{moneyC(owed)}</dd></div>
          </dl>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openNewRx}><LocalizedText message="New prescription" /></Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Panel>
            <PanelHeader title="Coverage" sub="Primary pays first; the secondary payer covers part of what remains." />
            {p.coverages.length === 0 ? <EmptyState title="Self-pay" body="No insurance on file. The patient pays in full at the counter." className="py-6" /> : (
              <ul className="divide-y divide-line">
                {p.coverages.map((c) => {
                  const lapsed = c.valid_to < today;
                  const values = { value0: c.plan_name, value1: c.member_id, value2: dateShort(c.valid_from), value3: date(c.valid_to) };
                  return (
                    <li key={c.id} className="px-4 py-3">
                      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                        {c.payer_name}<Tag tone={c.priority === 1 ? "info" : "violet"}>{c.priority === 1 ? "Primary" : "Secondary"}</Tag>
                        {lapsed && <Tag tone="danger"><LocalizedText message="Lapsed {value0}" values={{ value0: dateShort(c.valid_to) }} /></Tag>}
                        <span className="num ml-auto text-[15px]">{c.coverage_pct}%</span>
                      </p>
                      <p className="num mt-0.5 text-xs text-ink-3">
                        {c.workflow === "pre_adjudication"
                          ? <LocalizedText message="{value0} plan, member {value1}, valid {value2} to {value3}, real-time claims" values={values} />
                          : <LocalizedText message="{value0} plan, member {value1}, valid {value2} to {value3}, claims after supply" values={values} />}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Medicines supplied" sub="Used by the interaction check for 90 days after each supply." />
            {p.medications.length === 0 ? <EmptyState title="Nothing supplied yet" className="py-6" /> : (
              <div className="scroll-y max-h-72">
                <Table className="w-full text-[13px]">
                  <TableHeader><TableRow className="text-left text-[11.5px] text-ink-3"><TableHead className="px-4 py-2 font-medium"><LocalizedText message="Medicine" /></TableHead><TableHead className="px-2 py-2 text-right font-medium"><LocalizedText message="Total supplied" /></TableHead><TableHead className="px-4 py-2 text-right font-medium"><LocalizedText message="Last supplied" /></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {p.medications.map((m) => {
                      const recent = now - new Date(m.last_supplied).getTime() < 90 * 86400000;
                      return (
                        <TableRow key={m.name} className="border-t border-line">
                          <TableCell className="px-4 py-2"><p className="font-medium">{m.name}</p><p className="text-xs text-ink-3">{m.generic} {m.strength}</p></TableCell>
                          <TableCell className="num px-2 py-2 text-right">{m.total_qty === 1 ? <LocalizedText message="{value0} {value1}" values={{ value0: num(m.total_qty), value1: m.dispense_unit }} /> : <LocalizedText message="{value0} {value1}s" values={{ value0: num(m.total_qty), value1: m.dispense_unit }} />}</TableCell>
                          <TableCell className="num px-4 py-2 text-right"><span className={recent ? "text-ink" : "text-ink-3"}>{dateShort(m.last_supplied)}</span></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Prescriptions" sub={t("{value0} on record", { value0: int(p.prescriptions.length) })} />
          {p.prescriptions.length === 0 ? <EmptyState title="No prescriptions yet" action={<Button onClick={openNewRx}><LocalizedText message="New prescription" /></Button>} className="py-6" /> : (
            <ul className="divide-y divide-line">
              {p.prescriptions.map((r) => (
                <li key={r.id}>
                  <Link href={`/workbench?rx=${r.id}`} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 hover:bg-surface-2 md:grid-cols-[110px_90px_minmax(0,1fr)_200px_auto]">
                    <span className="num text-[13px] font-medium text-cobalt">{r.rx_no}</span>
                    <span className="num hidden text-[12.5px] text-ink-3 md:block">{dateShort(r.received_at)}</span>
                    <span className="min-w-0"><span className="block truncate text-[13px]">{r.items}</span><span className="block truncate text-xs text-ink-3">{r.diagnosis}</span></span>
                    <span className="hidden truncate text-[12.5px] text-ink-2 md:block">{r.doctor_name}</span>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function NewPatientDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const api = useApiClient();
  const { t } = usePharmacyFormat();
  const blank = { name: "", dob: "", gender: "F" as "F" | "M" | "X", phone: "", email: "", address: "", weight: "", allergies: "", conditions: "" };
  const [f, setF] = useState(blank); // the dialog mounts fresh each time it opens, so state starts blank
  const { run, busy } = useAction();
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const valid = f.name.trim().length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(f.dob);

  const save = () => run("create", ({ operationKey }) => api.post<{ id: string; name: string; mrn: string }>("/patients", {
    name: f.name.trim(), dob: f.dob, gender: f.gender, phone: f.phone || undefined, email: f.email || undefined, address: f.address || undefined,
    weight_kg: f.weight ? Number(f.weight) : undefined, allergies: list(f.allergies), conditions: list(f.conditions),
  }, { operationKey }), (p) => t("{value0} registered as {value1}", { value0: p.name, value1: p.mrn })).then((p) => { if (p) onCreated(p.id); });

  return (
    <Dialog open={open} onClose={onClose} title="Register patient" sub="Allergies feed straight into the safety screen on every prescription."
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button><Button variant="primary" disabled={!valid} loading={busy === "create"} onClick={save}><LocalizedText message="Register patient" /></Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Date of birth"><DateInput max={todayIso()} value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Sex">
          <Segmented size="sm" value={f.gender} onChange={(v) => setF({ ...f, gender: v })} items={[{ value: "F", label: "Female" }, { value: "M", label: "Male" }, { value: "X", label: "Unspecified" }]} />
        </Field>
        <Field label="Mobile"><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Area"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Weight (kg)"><Input type="number" min={1} value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></Field>
        <Field label="Allergies" hint="Ingredients or drug classes, separated by commas, e.g. penicillin, NSAID" className="sm:col-span-2"><Input value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} /></Field>
        <Field label="Conditions" hint="Separated by commas" className="sm:col-span-2"><Input value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
