"use client";
import {useCallback} from "react";
import {AsyncLookup} from "@pepbits/ui";
import {LocalizedText,useLocalization} from "@pepbits/i18n/react";
import {ReferenceLink as Link} from "../../host";
import {quickMatch} from "../../lib/search";
import {useStore} from "../../lib/store";
import {useMaster} from "../../lib/master";
import {useMedbandFormat} from "../../lib/format";
import type {Patient} from "../../lib/types";
import {fullName} from "../../lib/utils";
import {medbandPaths} from "../../routes";
export function PatientPicker({onPick,autoFocus,size="md",placeholder="Name, MRN, phone, ID or member number",registerHref=medbandPaths.patientNew()}:{onPick:(p:Patient)=>void;autoFocus?:boolean;size?:"md"|"lg";placeholder?:string;registerHref?:string}){
 const {patients}=useStore(),{payer}=useMaster(),{ageOf}=useMedbandFormat(),{t}=useLocalization();
 const load=useCallback(async(query:string)=>patients.filter(p=>quickMatch(p,query)).slice(0,7),[patients]);
 return <div><AsyncLookup label="Search patient" placeholder={placeholder} autoFocus={autoFocus} minChars={2} loadOptions={load} getKey={p=>p.id} onPick={onPick}
 inputClassName={size==="lg"?"h-14 text-lg":"h-11 text-sm"} renderOption={p=>{const primary=p.coverages.find(c=>c.priority==="Primary");return <><b>{fullName(p)}</b><span className="block text-sm">{p.mrn}, {ageOf(p.dob)} {p.gender[0]}, {p.phone}</span><span>{primary?payer(primary.payerId)?.short:t("Self pay")}</span></>;}}/>
 <Link href={registerHref} className="text-sm font-semibold text-scrub-700"><LocalizedText message="Register a new patient"/></Link></div>;
}
