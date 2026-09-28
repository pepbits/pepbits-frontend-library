"use client";

import { useMemo } from "react";
import { Select } from "../../ui";
import { useApi } from "../../lib/api";
import { useLookups } from "../../lib/lookups";
import { useSession } from "../../lib/session";
import type { ClassRoom, TimetableSlot } from "../../lib/types";
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/**
 * Classes the signed-in user works with. Admins see every class; teachers see the classes they
 * teach (from the timetable) with their home class first; everyone else gets the full list.
 */
export function useMyClasses() {
  const { role, user } = useSession();
  const { classes, ready } = useLookups();
  const { data: slots } = useApi<TimetableSlot[]>(role === "teacher" ? `/timetable?teacherId=${encodeURIComponent(user.id)}` : null);
  return useMemo(() => {
    if (role !== "teacher") return { classes, homeClassId: classes[0]?.id, ready };
    const ids = new Set((slots ?? []).map((s) => s.classId));
    const home = classes.find((c) => c.classTeacherId === user.id);
    const mine = classes.filter((c) => ids.has(c.id) || c.id === home?.id).sort((a, b) => (a.id === home?.id ? -1 : b.id === home?.id ? 1 : a.grade - b.grade || a.section.localeCompare(b.section)));
    return { classes: mine, homeClassId: home?.id ?? mine[0]?.id, ready: ready && !!slots };
  }, [role, user.id, classes, slots, ready]);
}

export function ClassSelect({ value, onChange, classes, allLabel, className }: {
  value: string; onChange: (v: string) => void; classes: ClassRoom[]; allLabel?: string; className?: string;
}) {
 const referenceT = useReferenceLocalization().t;

  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={className ?? "w-36"} aria-label={referenceT("Class")}>
      {allLabel && <option value="">{allLabel}</option>}
      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </Select>
  );
}
