"use client";
import {AsyncLookup} from "@pepbits/ui";
import {useReferenceHost} from "../../host";
import {SourceInput,SourceButton} from "@pepbits/ui";
import {LocalizedText} from "@pepbits/i18n/react";

import {ReferenceLink as Link} from "../../host";
import { useRouter } from "../../navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { Menu, Search, CalendarPlus, UserRound, Hash } from "@pepbits/icons";
import {useSourceApi, qs } from "../../lib/api";
import { useDebounced } from "../../lib/hooks";
import {useMedslotFormat} from "../../lib/format";
import type { Appointment, Patient } from "../../lib/types";
import { Button, IconButton, cx, StatusBadge } from "../ui";
import { useAuth } from "./auth";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { settings, can } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur lg:px-6">
      <IconButton label="Open menu" className="lg:hidden" onClick={onMenu}><Menu className="size-5" /></IconButton>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-3">
        <FacilityClock start={settings.facility_now} name={settings.facility_name} />
        {can("admin", "scheduler") && (
          <Link href="/book"><Button variant="primary" icon={<CalendarPlus className="size-4" />}><span className="hidden sm:inline"><LocalizedText message="Book" /></span></Button></Link>
        )}
      </div>
    </header>
  );
}

/** Shows facility wall-clock time (not the browser's), so staff in other zones see the right "now". */
function FacilityClock({ start, name }: { start: string; name: string }) {
  const { fmtLongDay, fmtTime } = useMedslotFormat();
  const [now, setNow] = useState(start);
  useEffect(() => {
    const base = Date.parse(start + ":00Z"), t0 = Date.now();
    const tick = () => setNow(new Date(base + (Date.now() - t0)).toISOString().slice(0, 16));
    const i = setInterval(tick, 15_000);
    return () => clearInterval(i);
  }, [start]);
  return (
    <div className="hidden text-right leading-tight md:block" title={name}>
      <p className="tabular text-sm font-semibold">{fmtTime(now)}</p>
      <p className="text-xs text-mute">{fmtLongDay(now.slice(0, 10))}</p>
    </div>
  );
}

function GlobalSearch() {
 const {preferences}=useReferenceHost(),api=useSourceApi(),router=useRouter(),box=useRef<HTMLDivElement>(null);
 const loadOptions=useCallback(async(q:string,signal:AbortSignal)=>{
  const [patients,appointments]=await Promise.all([api<Patient[]>(`/patients${qs({q,limit:5})}`,{signal}),api<{items:Appointment[]}>(`/appointments${qs({q,limit:5,order:'desc'})}`,{signal})]);
  return [...patients.map(p=>({key:'p'+p.id,href:'/patients/'+p.id,node:<PatientRow p={p}/>})),...appointments.items.map(a=>({key:'a'+a.id,href:'/appointments?open='+a.id,node:<ApptRow a={a}/>}))];
 },[api]);
 useEffect(()=>{if(!preferences.keyboardShortcuts)return;const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();box.current?.querySelector('input')?.focus();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[preferences.keyboardShortcuts]);
 return <div ref={box} className="w-full max-w-md"><AsyncLookup label="Search patients and appointments" placeholder="Find a patient, MRN, phone or booking ref" minChars={2} loadOptions={loadOptions} getKey={row=>row.key} renderOption={row=><span className="flex items-center gap-3">{row.node}</span>} onPick={row=>router.push(row.href)}/></div>;
}
const PatientRow = ({ p }: { p: Patient }) => (
  <>
    <span className="flex size-8 items-center justify-center rounded-full bg-scrub-soft text-scrub"><UserRound className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.first_name} {p.last_name}</span>
      <span className="tabular text-xs text-mute">{p.mrn} {"\u00a0"}{p.phone_masked}</span></span>
  </>
);
const ApptRow = ({ a }: { a: Appointment }) => {
  const { fmtDateTime } = useMedslotFormat(); return (
  <>
    <span className="flex size-8 items-center justify-center rounded-full bg-slot-soft text-slot"><Hash className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.ref_code} {"\u00a0"}{a.first_name} {a.last_name}</span>
      <span className="text-xs text-mute">{fmtDateTime(a.start_at)}, {a.service_name}</span></span>
    <StatusBadge status={a.status} />
  </>
); };
