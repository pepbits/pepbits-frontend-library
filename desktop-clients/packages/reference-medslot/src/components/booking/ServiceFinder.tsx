"use client";
import {SourceButton,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useMemo, useState } from "react";
import { Search, Clock, FileText, Share2 } from "lucide-react";
import { useApi } from "../../lib/hooks";
import { CATEGORY_LABEL, duration } from "../../lib/format";
import type { Category, Department, Resource, Service } from "../../lib/types";
import { CategoryIcon, ResourceCategoryIcon } from "../icons";
import { Input, Select, Skeleton, cx } from "../ui";

/**
 * One search box over services, departments, specialties and named resources (a doctor, a scanner, a chair).
 * Choosing a resource narrows services to what that resource can do and pre-selects it.
 */
export function ServiceFinder({ onPick, lockResourceId }: { onPick: (s: Service, resourceId?: number) => void; lockResourceId?: number }) {
  const { t: tr } = useLocalization();
  const services = useApi<Service[]>("/services");
  const resources = useApi<Resource[]>("/resources");
  const depts = useApi<Department[]>("/departments");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "">("");
  const [dept, setDept] = useState<number | "">("");
  const [resourceId, setResourceId] = useState<number | undefined>(lockResourceId);
  const linked = useApi<Service[]>(resourceId ? `/services?resource_id=${resourceId}` : null);

  const term = q.trim().toLowerCase();
  const pool = resourceId ? linked.data ?? [] : services.data ?? [];
  const list = useMemo(() => pool.filter((s) =>
    (!cat || s.category === cat) && (!dept || s.department_id === dept) &&
    (!term || [s.name, s.code, s.department_name, s.specialty_name ?? "", CATEGORY_LABEL[s.category]].some((x) => x.toLowerCase().includes(term)))
  ), [pool, cat, dept, term]);
  const resHits = useMemo(() => term.length < 2 || resourceId ? [] :
    (resources.data ?? []).filter((r) => [r.name, r.title ?? "", r.type_name, r.specialty_name ?? ""].some((x) => x.toLowerCase().includes(term))).slice(0, 6), [resources.data, term, resourceId]);
  const cats = useMemo(() => Array.from(new Set((services.data ?? []).map((s) => s.category))), [services.data]);
  const chosenRes = resources.data?.find((r) => r.id === resourceId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="Service, doctor, scanner, specialty…" aria-label="Search services and resources" data-autofocus />
        </div>
        <Select value={dept} onChange={(e) => setDept(e.target.value ? Number(e.target.value) : "")} className="sm:w-56" aria-label="Department">
          <option value=""><LocalizedText message="All departments" /></option>
          {depts.data?.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto scroll-thin px-1 pb-1">
        <Chip on={!cat} onClick={() => setCat("")}><LocalizedText message="All" /></Chip>
        {cats.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(cat === c ? "" : c)}><CategoryIcon category={c} className="size-3.5" />{CATEGORY_LABEL[c]}</Chip>)}
      </div>

      {chosenRes && (
        <div className="flex items-center gap-2 rounded-lg bg-scrub-soft px-3 py-2 text-sm text-scrub-dark">
          <ResourceCategoryIcon category={chosenRes.category} />
          <span className="flex-1"><LocalizedText message="Showing services for" />{" "}<strong>{chosenRes.name}</strong></span>
          {!lockResourceId && <SourceButton className="text-xs font-medium underline" onClick={() => setResourceId(undefined)}><LocalizedText message="Show all services" /></SourceButton>}
        </div>
      )}

      {resHits.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-mute"><LocalizedText message="People, rooms and equipment" /></p>
          <div className="flex flex-wrap gap-1.5">
            {resHits.map((r) => (
              <SourceButton key={r.id} onClick={() => { setResourceId(r.id); setQ(""); }}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-panel py-1 pl-2 pr-3 text-sm hover:border-scrub">
                <span className="flex size-6 items-center justify-center rounded-full" style={{ background: r.department_color + "1f", color: r.department_color }}><ResourceCategoryIcon category={r.category} className="size-3.5" /></span>
                {r.name}<span className="text-xs text-mute">{r.department_name}</span>
              </SourceButton>
            ))}
          </div>
        </div>
      )}

      {services.loading ? <div className="grid gap-2 sm:grid-cols-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[74px]" />)}</div> : (
        <div className="grid max-h-[420px] gap-2 overflow-y-auto scroll-thin pr-1 sm:grid-cols-2">
          {list.length === 0 && <p className="col-span-full py-8 text-center text-sm text-mute"><LocalizedText message="No services match. Try another word or clear the filters." /></p>}
          {list.map((s) => (
            <SourceButton key={s.id} onClick={() => onPick(s, resourceId)} disabled={!s.resource_count}
              className="group flex items-start gap-3 rounded-lg border border-line bg-panel p-3 text-left transition-colors hover:border-scrub hover:bg-scrub-soft/30 disabled:opacity-50">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ background: s.department_color + "18", color: s.department_color }}>
                <CategoryIcon category={s.category} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug">{s.name}</span>
                <span className="block truncate text-xs text-mute">{s.department_name}{s.needs && s.needs.includes("+") ? tr(", needs {value0}", { value0: (s.needs) ?? "" }) : ""}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-2">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3" />{duration(s.duration_minutes)}</span>
                  {s.requires_order && <span className="inline-flex items-center gap-1 text-amber"><FileText className="size-3" /><LocalizedText message="Order needed" /></span>}
                  {s.requires_referral && <span className="inline-flex items-center gap-1 text-amber"><Share2 className="size-3" /><LocalizedText message="Referral needed" /></span>}
                  {!s.resource_count && <span className="text-triage"><LocalizedText message="No resources linked" /></span>}
                </span>
              </span>
            </SourceButton>
          ))}
        </div>
      )}
    </div>
  );
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <SourceButton onClick={onClick} aria-pressed={on}
    className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
      on ? "border-ink bg-ink text-white" : "border-line bg-panel text-ink-2 hover:border-ink/30")}>{children}</SourceButton>
);
