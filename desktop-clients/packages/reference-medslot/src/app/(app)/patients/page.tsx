"use client";
import {TableHeader,TableRow,TableBody,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useState } from "react";
import { useRouter } from "../../../navigation";
import { Search, UserPlus, Users, CalendarPlus } from "lucide-react";
import { qs } from "../../../lib/api";
import { useApi, useDebounced } from "../../../lib/hooks";
import {age,useMedslotFormat} from "../../../lib/format";
import type { Patient } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Badge, Button, Check, Drawer, Empty, ErrorNote, Input, PageHeader, Skeleton, Table, Td, Th } from "../../../components/ui";
import { PatientForm } from "../../../components/PatientForm";

export default function PatientsPage() {
  const { fmtDate } = useMedslotFormat();
  const router = useRouter();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [prov, setProv] = useState(false);
  const dq = useDebounced(q.trim(), 250);
  const { data, error, loading, reload } = useApi<Patient[]>(`/patients${qs({ q: dq, provisional: prov ? 1 : undefined, limit: 100 })}`);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader title="Patients" description="Contact details are partly hidden in lists. Open a record to see everything; each view is logged."
        actions={can("admin", "scheduler") && <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setAdding(true)}><LocalizedText message="Register patient" /></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, MRN, phone or email" className="pl-9" />
        </div>
        <Check label="Only unregistered (new) patients" checked={prov} onChange={setProv} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <div className="space-y-2 p-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          : data?.length === 0 ? <Empty icon={<Users className="size-8" />} title="No patients found" action={can("admin", "scheduler") && <Button onClick={() => setAdding(true)}><LocalizedText message="Register a new patient" /></Button>}><LocalizedText message="Check the spelling, or search by phone number." /></Empty>
          : (
            <Table>
              <TableHeader><TableRow><Th><LocalizedText message="Patient" /></Th><Th><LocalizedText message="MRN" /></Th><Th><LocalizedText message="Age" /></Th><Th><LocalizedText message="Phone" /></Th><Th><LocalizedText message="Last visit" /></Th><Th><LocalizedText message="Next visit" /></Th><Th /></TableRow></TableHeader>
              <TableBody>
                {data?.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-scrub-soft/30" onClick={() => router.push(`/patients/${p.id}`)}>
                    <Td><span className="font-medium">{p.first_name} {p.last_name}</span>{p.is_provisional && <Badge tone="amber" className="ml-2"><LocalizedText message="Unregistered" /></Badge>}</Td>
                    <Td className="tabular text-ink-2">{p.mrn}</Td>
                    <Td className="tabular">{age(p.dob) ?? "–"}{p.sex && p.sex !== "unknown" ? <span className="text-mute">, {p.sex[0].toUpperCase()}</span> : ""}</Td>
                    <Td className="tabular text-ink-2">{p.phone_masked}</Td>
                    <Td className="tabular text-ink-2">{p.last_visit ? fmtDate(p.last_visit) : "–"}</Td>
                    <Td className="tabular">{p.next_visit ? fmtDate(p.next_visit) : <span className="text-mute">–</span>}</Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      {can("admin", "scheduler") && <Link href={`/book?patient_id=${p.id}`}><Button size="sm" variant="quiet" icon={<CalendarPlus className="size-3.5" />}><LocalizedText message="Book" /></Button></Link>}
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </div>
      <Drawer open={adding} onClose={() => setAdding(false)} title="Register patient" subtitle="Full registration. For a quick booking with minimal details, use Book appointment.">
        <PatientForm onSaved={(p) => { setAdding(false); router.push(`/patients/${p.id}`); }} />
      </Drawer>
    </>
  );
}
