"use client";

import { useCallback, useEffect, useState } from "react";
import { useClient } from "./api";

export type Staff = { id: number; emp_code: string; name: string; role: string; specialty: string | null; title: string | null; active: number };
export type Theatre = { id: number; code: string; name: string; kind: string; location: string; status: string; open_time: string; close_time: string };
export type Procedure = {
  id: number; cpt: string; name: string; specialty: string; op_type: string; default_approach: string; default_duration_min: number;
  t_time_min: number; wound_class: string; rvu: number; fee: number; is_addon: number; high_risk: number; requires_implant: number; dx_count?: number; item_count?: number;
};
export type Diagnosis = { id: number; icd10: string; description: string; category: string };
export type Equipment = { id: number; code: string; name: string; category: string; status: string; theatre_code: string | null; last_service: string; next_service: string };

export function useInvalidateMasters(){const client=useClient();return useCallback((path?:string)=>{if(path)client.masters.delete(path);else client.masters.clear();for(const notify of client.masterListeners)notify();},[client]);}
function useCached<T>(path:string,fallback:T):T {const client=useClient();const [v,setV]=useState<T>(fallback),[revision,setRevision]=useState(0);useEffect(()=>{const notify=()=>setRevision(n=>n+1);client.masterListeners.add(notify);return()=>{client.masterListeners.delete(notify);};},[client]);useEffect(()=>{let live=true;if(!client.masters.has(path))client.masters.set(path,client.call<T>(path).catch(e=>{client.masters.delete(path);throw e;}));client.masters.get(path)!.then(d=>live&&setV(d as T)).catch(()=>{});return()=>{live=false;};},[client,path,revision]);return v;}
export const useLookups = () => useCached<Record<string, string[]>>("/lookups", {});
export const useStaff = () => useCached<Staff[]>("/staff", []);
export const useTheatres = () => useCached<Theatre[]>("/theatres", []);
export const useProcedures = () => useCached<Procedure[]>("/procedures", []);
export const useDiagnoses = () => useCached<Diagnosis[]>("/diagnoses", []);
export const useEquipment = () => useCached<Equipment[]>("/equipment", []);

export const TEAM_ROLE_STAFF: Record<string, string[]> = {
  "Primary Surgeon": ["SURGEON"],
  "Secondary Surgeon": ["SURGEON"],
  "Assistant Surgeon": ["SURGEON", "ASSISTANT_SURGEON"],
  Anesthesiologist: ["ANESTHESIOLOGIST"],
  "Anesthesia Technician": ["ANESTHESIA_TECH"],
  "Scrub Nurse": ["SCRUB_NURSE"],
  "Circulating Nurse": ["CIRCULATING_NURSE"],
  Radiographer: ["RADIOGRAPHER"],
  Perfusionist: ["PERFUSIONIST"],
};
