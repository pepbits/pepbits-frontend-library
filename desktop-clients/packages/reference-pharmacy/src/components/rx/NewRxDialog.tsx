"use client";
import { Snowflake, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { useRouter } from "../../lib/navigation";
import { Dialog } from "../ui/dialog";
import { Lookup } from "../ui/lookup";
import { SourceButton } from "../ui/controls";
import { Button, Field, Input, Segmented, Select, Tag } from "../ui/primitives";
import { useToast } from "../ui/toast";
import { useShell } from "../shell/ShellContext";
import { ApiError, useApiClient, useRefreshAll } from "../../lib/api";
import { age, usePharmacyFormat } from "../../lib/format";

interface PatientHit { id: string; name: string; mrn: string; dob: string; gender: string; allergies: string[]; payer_code: string | null }
interface ProductHit { id: string; name: string; generic: string; strength: string; form: string; schedule: string; price_per_unit: number; dispense_unit: string; available: number }
interface Line { product: ProductHit; dose: number; freq: number; days: number; qty: number; sig: string; qtyTouched: boolean; sigTouched: boolean }

const patientEndpoint = (q: string) => `/patients?q=${encodeURIComponent(q)}`;
const productEndpoint = (q: string) => `/products/lookup?q=${encodeURIComponent(q)}`;

export function NewRxDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { meta } = useShell();
  const router = useRouter();
  const toast = useToast();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const { t, moneyC, int, num } = usePharmacyFormat();
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [doctor, setDoctor] = useState("");
  const [source, setSource] = useState<"paper" | "erx" | "hospital">("paper");
  const [priority, setPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [dx, setDx] = useState({ code: "", text: "" });
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The label text printed for a line, in the viewer's language: "2 tablets twice daily for 30 days". */
  const sigFor = (l: Pick<Line, "dose" | "freq" | "days" | "product">) => {
    const freq = l.freq === 1 ? t("once daily") : l.freq === 2 ? t("twice daily") : l.freq === 3 ? t("three times daily") : l.freq === 4 ? t("four times daily") : t("{value0} times daily", { value0: l.freq });
    const values = { value0: String(l.dose), value1: l.product.dispense_unit, value2: freq, value3: l.days };
    return l.dose > 1 ? t("{value0} {value1}s {value2} for {value3} days", values) : t("{value0} {value1} {value2} for {value3} days", values);
  };

  const reset = () => { setPatient(null); setDoctor(""); setSource("paper"); setPriority("routine"); setDx({ code: "", text: "" }); setLines([]); setError(null); };
  const close = () => { reset(); onClose(); };
  const update = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => {
    if (k !== i) return l;
    const n = { ...l, ...patch };
    if (!n.qtyTouched) n.qty = Math.ceil(n.dose * n.freq * n.days);
    if (!n.sigTouched) n.sig = sigFor(n);
    return n;
  }));

  const ready = patient && doctor && lines.length > 0 && lines.every((l) => l.qty > 0 && l.sig.length > 2);
  const submit = async () => {
    if (!patient || !ready) return;
    setBusy(true); setError(null);
    try {
      const rx = await api.post<{ id: string; rx_no: string }>("/prescriptions", {
        patient_id: patient.id, doctor_id: doctor, source, priority, diagnosis_code: dx.code || undefined, diagnosis: dx.text || undefined,
        items: lines.map((l) => ({ product_id: l.product.id, dose: l.dose, frequency_per_day: l.freq, days: l.days, qty: l.qty, sig: l.sig })),
      });
      await refreshAll();
      toast({ tone: "ok", title: t("{value0} received", { value0: rx.rx_no }), body: t("It’s at the top of the intake queue.") });
      close();
      router.push(`/workbench?rx=${rx.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Could not save the prescription."));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={close} size="lg" title="New prescription" sub="Enter what the prescriber wrote. Safety checks run when the pharmacist reviews it."
      footer={<>
        {error && <p className="mr-auto text-[13px] text-danger">{error}</p>}
        <Button variant="ghost" onClick={close}><LocalizedText message="Cancel" /></Button>
        <Button variant="primary" disabled={!ready} loading={busy} onClick={submit}><LocalizedText message="Add to intake queue" /></Button>
      </>}>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Patient">
            {patient ? (
              <div className="flex h-8 items-center gap-2 rounded-md border border-line-strong bg-surface-2 px-2.5 text-[13px]">
                <span className="truncate font-medium">{patient.name}</span>
                <span className="text-ink-3">{patient.mrn}</span>
                {patient.allergies.length > 0 && <Tag tone="danger"><TriangleAlert className="size-3" />{patient.allergies.join(", ")}</Tag>}
                <SourceButton className="ml-auto text-xs text-cobalt hover:underline" onClick={() => setPatient(null)}><LocalizedText message="Change" /></SourceButton>
              </div>
            ) : (
              <Lookup<PatientHit> autoFocus endpoint={patientEndpoint} placeholder="Name, MRN or phone" onPick={setPatient}
                render={(p) => (
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="font-medium">{p.name}</span><span className="text-ink-3">{p.mrn}, {int(age(p.dob))}{p.gender}</span>
                    <span className="ml-auto text-xs text-ink-3">{p.payer_code ?? t("Self-pay")}</span>
                  </div>
                )} />
            )}
          </Field>
          <Field label="Prescriber">
            <Select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
              <option value="">{t("Choose prescriber")}</option>
              {meta?.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}, {d.specialty}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Received as"><Segmented size="sm" value={source} onChange={setSource} items={[{ value: "paper", label: "Paper" }, { value: "erx", label: "eRx" }, { value: "hospital", label: "Hospital" }]} /></Field>
          <Field label="Priority"><Segmented size="sm" value={priority} onChange={setPriority} items={[{ value: "routine", label: "Routine" }, { value: "urgent", label: "Urgent" }, { value: "stat", label: "Stat" }]} /></Field>
          <Field label="Diagnosis code" className="w-28"><Input value={dx.code} onChange={(e) => setDx({ ...dx, code: e.target.value })} placeholder="ICD-10" /></Field>
          <Field label="Diagnosis" className="min-w-40 flex-1"><Input value={dx.text} onChange={(e) => setDx({ ...dx, text: e.target.value })} placeholder="e.g. Essential hypertension" /></Field>
        </div>

        <div className="rounded-lg border border-line">
          <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-3 py-2">
            <p className="text-[13px] font-medium"><LocalizedText message="Medicines" /></p>
            <Lookup<ProductHit> className="ml-auto w-72" endpoint={productEndpoint} placeholder="Add medicine by name or barcode"
              onPick={(p) => setLines((ls) => [...ls, { product: p, dose: 1, freq: 1, days: 30, qty: 30, sig: sigFor({ product: p, dose: 1, freq: 1, days: 30 }), qtyTouched: false, sigTouched: false }])}
              render={(p) => (
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium">{p.name}</span><span className="truncate text-ink-3">{p.generic} {p.strength}</span>
                  <span className="num ml-auto text-xs text-ink-3"><LocalizedText message="{value0} in stock" values={{ value0: num(p.available) }} /></span>
                </div>
              )} />
          </div>
          {lines.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-ink-3"><LocalizedText message="Search above to add the first medicine." /></p>
          ) : (
            <div className="divide-y divide-line">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{l.product.name}</span>
                    <span className="truncate text-xs text-ink-3">{l.product.generic} {l.product.strength}, {moneyC(l.product.price_per_unit)}/{l.product.dispense_unit}</span>
                    {l.product.schedule === "controlled" && <Tag tone="violet"><LocalizedText message="Controlled" /></Tag>}
                    {l.product.form === "Pen" && <Snowflake className="size-3.5 text-cobalt" />}
                  </div>
                  <SourceButton aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} className="text-ink-3 hover:text-danger"><Trash2 className="size-4" /></SourceButton>
                  <div className="col-span-2 grid grid-cols-[repeat(4,minmax(0,5.5rem))_1fr] gap-2">
                    <Field label="Per dose"><Input type="number" min={0.5} step={0.5} value={l.dose} onChange={(e) => update(i, { dose: Number(e.target.value) })} /></Field>
                    <Field label="Times a day"><Input type="number" min={1} max={6} value={l.freq} onChange={(e) => update(i, { freq: Number(e.target.value) })} /></Field>
                    <Field label="Days"><Input type="number" min={1} value={l.days} onChange={(e) => update(i, { days: Number(e.target.value) })} /></Field>
                    <Field label="Quantity"><Input type="number" min={1} value={l.qty} onChange={(e) => update(i, { qty: Number(e.target.value), qtyTouched: true })} /></Field>
                    <Field label="Directions (label text)"><Input value={l.sig} onChange={(e) => update(i, { sig: e.target.value, sigTouched: true })} /></Field>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
