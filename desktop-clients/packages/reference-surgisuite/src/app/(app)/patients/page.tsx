"use client";
import {useReferenceSearchParams} from "@pepbits/reference-host";
import {LocalizedText} from "@pepbits/ops-ui";
import { SourceInput, SourceButton } from "@pepbits/ops-ui";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useEffect, useState } from "react";
import { useApi } from "./../../../lib/api";
import { age, useSourceFormat} from "./../../../lib/format";
import { Badge, Empty, KV, PanelHeader, Spinner, StatusBadge, cx } from "./../../../components/ui";
import { IconSearch } from "./../../../components/icons";

type Patient = { id: number; mrn: string; name: string; dob: string; sex: string; blood_group: string; phone: string; allergies: string; comorbidities: string; weight_kg: number; height_cm: number; insurer: string | null; policy_no: string | null };
type Detail = Patient & { cases: { id: number; case_no: string; scheduled_start: string; status: string; procedure_name: string; cpt: string }[] };

export default function PatientsPage() {
 const {date,dateTime}=useSourceFormat();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const selectedPatient=useReferenceSearchParams().get("id");
  useEffect(()=>{if(selectedPatient)setSel(Number(selectedPatient));},[selectedPatient]);
  const { data, loading } = useApi<Patient[]>(`/patients?q=${encodeURIComponent(q)}`);
  const { data: p } = useApi<Detail>(sel ? `/patients/${sel}` : null);

  return (
    <div className="grid h-full min-h-0 gap-3 p-3 md:grid-cols-[360px_1fr] md:p-4">
      <section className="panel flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-line p-3">
          <h1 className="mb-2 font-cond text-[22px] font-semibold"><LocalizedText message={"Patients"}/></h1>
          <div className="relative">
            <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <SourceInput className="input pl-8" placeholder="Name or MRN" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        {loading && !data ? <Spinner /> : (
          <ul className="scroll-y min-h-0 flex-1 divide-y divide-line">
            {data?.map((x) => (
              <li key={x.id}>
                <SourceButton onClick={() => setSel(x.id)} className={cx("flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-steel/60", sel === x.id && "bg-ceil-soft")}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{x.name}</span>
                    <span className="block text-[12px] text-muted">{x.mrn}, {age(x.dob)} {x.sex}</span>
                  </span>
                  {x.allergies !== "NKDA" && <Badge tone="stop"><LocalizedText message={"Allergy"}/></Badge>}
                </SourceButton>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel scroll-y min-h-0">
        {!sel ? (
          <Empty title="Choose a patient"><LocalizedText message={"See demographics, allergies, insurance and every surgical episode. New patients are registered while booking a case."}/></Empty>
        ) : !p ? (
          <Spinner />
        ) : (
          <>
            <PanelHeader title={<span className="text-[20px]">{p.name}</span>}>
              <Badge tone={p.allergies === "NKDA" ? "muted" : "stop"}>{p.allergies === "NKDA" ? "No known drug allergies" : `Allergy: ${p.allergies}`}</Badge>
            </PanelHeader>
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
              <KV label="MRN">{p.mrn}</KV>
              <KV label="Date of birth">{date(p.dob)} ({age(p.dob)})</KV>
              <KV label="Sex">{p.sex}</KV>
              <KV label="Blood group">{p.blood_group ?? "—"}</KV>
              <KV label="Weight / height">{p.weight_kg ?? "—"} {" "}<LocalizedText message={"kg,"}/>{" "}{p.height_cm ?? "—"} {" "}<LocalizedText message={"cm"}/></KV>
              <KV label="BMI">{p.weight_kg && p.height_cm ? (p.weight_kg / (p.height_cm / 100) ** 2).toFixed(1) : "—"}</KV>
              <KV label="Insurer">{p.insurer ?? "Self-pay"}</KV>
              <KV label="Policy">{p.policy_no ?? "—"}</KV>
              <div className="col-span-2 md:col-span-4"><KV label="Comorbidities">{p.comorbidities || "None recorded"}</KV></div>
            </div>
            <div className="border-t border-line">
              <h3 className="px-4 pb-1 pt-3 font-cond text-[15px] font-semibold"><LocalizedText message={"Surgical episodes ("}/>{p.cases.length})</h3>
              <ul className="divide-y divide-line">
                {p.cases.map((c) => (
                  <li key={c.id}>
                    <Link href={`/cases/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-steel/60">
                      <span className="w-40 text-[13px] text-muted">{dateTime(c.scheduled_start)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]"><b className="font-cond">{c.cpt}</b> {c.procedure_name}</span>
                      <span className="text-[12px] text-muted">{c.case_no}</span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
