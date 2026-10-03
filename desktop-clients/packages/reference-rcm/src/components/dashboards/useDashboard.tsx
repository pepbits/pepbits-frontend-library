"use client";
import { useApi } from "../../lib/api";

/** One dashboard read through the scoped store (the source's `useDashboard`): refetched on a scope-filter change and after every mutation. */
export function useDashboard<T>(path: string) {
  const r = useApi<T>(path);
  return { data: r.data ?? null, error: r.error?.message ?? null, reload: () => { void r.mutate(); } };
}

export function DashSkeleton() {
  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3" role="status" aria-busy="true">
      <div className="h-[118px] animate-pulse rounded-[16px] bg-white/70" />
      <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="animate-pulse rounded-[14px] bg-white/70" />)}</div>
    </div>
  );
}
