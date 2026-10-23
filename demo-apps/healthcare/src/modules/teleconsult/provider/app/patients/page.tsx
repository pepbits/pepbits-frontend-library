"use client";
import {CollectionView, type CollectionColumn} from "@pepbits/components/collection-view";
import {Pagination} from "@pepbits/components";
import {useReferenceHost} from "../../../host";
import {usePreferenceChoice} from "../../../../preference-choice";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";
import { SourceInput, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../shared/controls";
import { useState } from "react";
import { Search, ShieldAlert, UserPlus } from "@pepbits/icons";
import type { Patient } from "../../../shared/types";
import { useApi, useDebounced } from "../../lib/hooks";
import { age, fullName, sexShort, useTeleconsultFormat } from "../../lib/format";
import { useSession } from "../../lib/session";
import { Avatar, Badge, Button, Empty, ErrorNote, Spinner, cx } from "../../components/ui";
import { RegisterPatientDrawer } from "../../components/RegisterPatientDrawer";
import { PatientChartDrawer } from "../../components/PatientChartDrawer";

export default function PatientsPage() {
  const host=useReferenceHost();
  const [pageSize,setPageSize,pageSizeLocked]=usePreferenceChoice(host.preferenceHost??{preferences:host.preferences},'pageSize');
  const [page,setPage]=useState(1);
  const { t } = useLocalization();
  const { fmtDate } = useTeleconsultFormat();
  const { canRegister } = useSession();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 200);
  const list = useApi<Patient[]>(`/api/patients?q=${encodeURIComponent(dq)}`);
  const [registering, setRegistering] = useState(false);
  const [open, setOpen] = useState<Patient>();

  const rows=list.data??[], current=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));
  const columns:CollectionColumn<Patient>[]=[
   {key:'patient',header:'Patient',render:p=><div><span>{fullName(p)}</span><p>{p.phone}</p></div>},
   {key:'mrn',header:'MRN'},
   {key:'age',header:'Age / sex',render:p=><span>{age(p.dob)} {sexShort(p.sex)}</span>},
   {key:'allergies',header:'Allergies',render:p=>p.allergies.filter(a=>a.status==='active').map(a=>a.substance).join(', ')||t(p.noKnownAllergies?'No known allergies':'Not recorded')},
   {key:'problems',header:'Active problems',render:p=>p.problems.map(x=>x.display).join(', ')||'–'},
   {key:'coverage',header:'Coverage',render:p=>p.insurance.payer},
   {key:'registered',header:'Registered',render:p=>fmtDate(p.createdAt)},
  ];
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
          <><CollectionView columns={columns} rows={rows.slice((current-1)*pageSize,current*pageSize)} rowKey={p=>p.id} onRowClick={setOpen}/>
          <Pagination page={current} pageSize={pageSize} total={rows.length} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1);}} pageSizeDisabled={pageSizeLocked}/></>
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
