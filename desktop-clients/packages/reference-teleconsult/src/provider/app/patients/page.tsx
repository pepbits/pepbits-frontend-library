"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceInput, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../shared/controls";
import { useState } from "react";
import { Search, ShieldAlert, UserPlus } from "lucide-react";
import type { Patient } from "../../../shared/types";
import { useApi, useDebounced } from "../../lib/hooks";
import { age, fullName, sexShort, useTeleconsultFormat } from "../../lib/format";
import { useSession } from "../../lib/session";
import { Avatar, Badge, Button, Empty, ErrorNote, Spinner, cx } from "../../components/ui";
import { RegisterPatientDrawer } from "../../components/RegisterPatientDrawer";
import { PatientChartDrawer } from "../../components/PatientChartDrawer";

export default function PatientsPage() {
  const { t } = useLocalization();
  const { fmtDate } = useTeleconsultFormat();
  const { canRegister } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const list = useApi<Patient[]>(`/api/patients?q=${encodeURIComponent(dq)}`);
  const [registering, setRegistering] = useState(false);
  const [open, setOpen] = useState<Patient>();

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
          <SourceInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, MRN, phone or email"
            className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm focus:border-pulse-500 focus:outline-none focus:ring-2 focus:ring-pulse-500/20"
          />
        </div>
        {canRegister && (
          <Button variant="primary" className="ml-auto" icon={<UserPlus className="h-4 w-4" />} onClick={() => setRegistering(true)}>
            
            <LocalizedText message={"Register patient"} />
          </Button>
        )}
      </div>

      {list.error && <ErrorNote message={list.error} />}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-line bg-white shadow-panel scroll-thin">
        {list.loading && !list.data ? (
          <Spinner />
        ) : !list.data?.length ? (
          <Empty title="No patients match" action={canRegister ? <Button size="sm" onClick={() => setRegistering(true)}><LocalizedText message={"Register a new patient"} /></Button> : undefined}>
            
            <LocalizedText message={"Check the spelling, or search by MRN or phone."} />
          </Empty>
        ) : (
          <Table className="w-full min-w-[760px] text-sm">
            <TableHeader className="sticky top-0 bg-white text-left text-xs text-ink-400">
              <TableRow className="border-b border-line">
                <TableHead className="px-4 py-2.5 font-medium"><LocalizedText message={"Patient"} /></TableHead>
                <TableHead className="px-4 py-2.5 font-medium"><LocalizedText message={"MRN"} /></TableHead>
                <TableHead className="px-4 py-2.5 font-medium"><LocalizedText message={"Age / sex"} /></TableHead>
                <TableHead className="px-4 py-2.5 font-medium"><LocalizedText message={"Allergies"} /></TableHead>
                <TableHead className="px-4 py-2.5 font-medium"><LocalizedText message={"Active problems"} /></TableHead>
                <TableHead className="px-4 py-2.5 font-medium"><LocalizedText message={"Coverage"} /></TableHead>
                <TableHead className="px-4 py-2.5 font-medium"><LocalizedText message={"Registered"} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-line">
              {list.data.map((p) => (
                <TableRow key={p.id} onClick={() => setOpen(p)} className="cursor-pointer hover:bg-canvas" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen(p)}>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={fullName(p)} size={30} />
                      <div>
                        <p className="font-medium text-ink">{fullName(p)}</p>
                        <p className="text-2xs text-ink-400">{p.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-ink-600 tabular">{p.mrn}</TableCell>
                  <TableCell className="px-4 py-2.5 text-ink-600 tabular">{age(p.dob)} {sexShort(p.sex)}</TableCell>
                  <TableCell className="px-4 py-2.5">
                    {p.allergies.filter((a) => a.status === "active").length ? (
                      <div className="flex flex-wrap gap-1">
                        {p.allergies.filter((a) => a.status === "active").map((a) => (
                          <Badge key={a.id} className={cx(a.severity === "severe" ? "bg-alarm-500 text-white" : "bg-alarm-50 text-alarm-600")}>
                            <ShieldAlert className="h-3 w-3" /> {a.substance}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">{t(p.noKnownAllergies ? "No known allergies" : "Not recorded")}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate px-4 py-2.5 text-ink-600">{p.problems.map((x) => x.display).join(", ") || "–"}</TableCell>
                  <TableCell className="px-4 py-2.5 text-ink-600">{p.insurance.payer}</TableCell>
                  <TableCell className="px-4 py-2.5 text-ink-400 tabular">{fmtDate(p.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <RegisterPatientDrawer
        open={registering}
        onClose={() => setRegistering(false)}
        onCreated={(p) => {
          setRegistering(false);
          list.reload();
          setOpen(p);
        }}
      />
      <PatientChartDrawer patient={open} onClose={() => setOpen(undefined)} />
    </div>
  );
}
