"use client";

import { useApi } from "../../lib/api";
import { useLookups } from "../../lib/lookups";
import { useSession } from "../../lib/session";
import type { Student } from "../../lib/types";
import { cn } from "../../lib/utils";
import { Avatar } from "../../ui";
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/** Student id the current page is about: the signed-in student, or the parent's selected child.
    The children come from the verified /session payload; the selection lives in module state only. */
export function useActiveStudent() {
  const { role, user, activeChild, setActiveChild } = useSession();
  if (role === "student") return { studentId: user.id, setStudentId: () => {} };
  return { studentId: activeChild ?? "", setStudentId: setActiveChild };
}

/** The parent's children, as student records (names and classes come from the API, not a fixed table). */
export function useChildren() {
  const { role, children } = useSession();
  return useApi<Student[]>(role === "parent" && children.length ? `/students?id=${children.map(encodeURIComponent).join(",")}` : null);
}

export function ChildSwitcher({ className }: { className?: string }) {
 const referenceT = useReferenceLocalization().t;

  const { role, children } = useSession();
  const { studentId, setStudentId } = useActiveStudent();
  const { data: kids } = useChildren();
  const { cls } = useLookups();
  if (role !== "parent") return null;
  const byId = new Map((kids ?? []).map((k) => [k.id, k]));
  return (
    <div className={cn("inline-flex rounded-lg border border-line bg-surface p-0.5", className)} role="tablist" aria-label={referenceT("Choose child")}>
      {children.map((id) => {
        const kid = byId.get(id);
        const name = kid?.name ?? id;
        return (
          <button key={id} type="button" role="tab" aria-selected={studentId === id} onClick={() => setStudentId(id)}
            className={cn("flex items-center gap-2 rounded-md py-1 pr-3 pl-1 text-left transition", studentId === id ? "bg-brand/10" : "hover:bg-subtle")}>
            <Avatar name={name} size={26} />
            <span>
              <span className={cn("block text-xs leading-4 font-medium", studentId === id && "text-brand")}>{name.split(" ")[0]}</span>
              <span className="block text-[10px] leading-3 text-muted">{kid ? cls(kid.classId)?.name ?? "" : ""}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
