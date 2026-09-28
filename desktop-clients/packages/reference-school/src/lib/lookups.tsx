"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ErrorNote, Spinner } from "../ui/primitives";
import { useSchoolApi } from "./api";
import type { Meta, SchoolProfile, Term } from "./contract";
import type { ClassRoom, Subject, Teacher } from "./types";
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export type { Term };

interface Lookups {
  ready: boolean;
  meta: Meta;
  profile: SchoolProfile;
  classes: ClassRoom[];
  subjects: Subject[];
  teachers: Teacher[];
  cls: (id?: string | null) => ClassRoom | undefined;
  sub: (id?: string | null) => Subject | undefined;
  tch: (id?: string | null) => Teacher | undefined;
  reload: () => void;
  /** Error of the latest reload, when earlier data is still shown. */
  error: string | null;
}

interface Loaded { scope: string; meta: Meta; profile: SchoolProfile; classes: ClassRoom[]; subjects: Subject[]; teachers: Teacher[] }
const Ctx = createContext<Lookups | null>(null);

/** Reference data used on nearly every screen, including the school profile, all from the API. Loaded per host
    scope. A failed first load shows a retry instead of the pages; a failed reload keeps the loaded pages (and any
    form drafts in them) and reports the error. */
export function LookupsProvider({ children }: { children: ReactNode }) {
 const referenceT = useReferenceLocalization().t;

  const api = useSchoolApi();
  const [state, setState] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const scope = api.scopeKey;
    setState((s) => (s && s.scope === scope ? s : null));
    setError(null);
    Promise.all([
      api.get<Meta | { data: Meta }>("/meta"),
      api.get<{ data: SchoolProfile }>("/school-profile"),
      api.get<{ data: ClassRoom[] }>("/classes"),
      api.get<{ data: Subject[] }>("/subjects"),
      api.get<{ data: Teacher[] }>("/teachers"),
    ]).then(([meta, profile, c, s, t]) => {
      if (!alive) return;
      const m = "data" in meta ? meta.data : meta;
      setState({ scope, meta: m, profile: profile.data, classes: c.data, subjects: s.data, teachers: t.data });
    }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [api, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = state && state.scope === api.scopeKey ? state : null;
  const value = useMemo<Lookups | null>(() => {
    if (!current) return null;
    const cm = new Map(current.classes.map((x) => [x.id, x]));
    const sm = new Map(current.subjects.map((x) => [x.id, x]));
    const tm = new Map(current.teachers.map((x) => [x.id, x]));
    return {
      ready: true, meta: current.meta, profile: current.profile, classes: current.classes, subjects: current.subjects, teachers: current.teachers,
      cls: (id) => (id ? cm.get(id) : undefined), sub: (id) => (id ? sm.get(id) : undefined), tch: (id) => (id ? tm.get(id) : undefined),
      reload, error,
    };
  }, [current, reload, error]);

  if (!value) return error ? <ErrorNote message={error} onRetry={reload} /> : <Spinner label={referenceT("Loading school data")} />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLookups() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLookups must be used inside LookupsProvider");
  return c;
}
