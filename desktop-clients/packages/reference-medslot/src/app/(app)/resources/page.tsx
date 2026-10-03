"use client";
import {TableHeader,TableRow,TableBody,LocalizedText} from "@pepbits/ops-ui";

import {ReferenceLink as Link} from "@pepbits/reference-host";
import { useMemo, useState } from "react";
import { useRouter } from "../../../navigation";
import { Plus, Search, Boxes, CalendarDays } from "lucide-react";
import { useApi } from "../../../lib/hooks";
import type { Department, Resource } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Badge, Button, Check, Drawer, Empty, ErrorNote, Input, PageHeader, Segmented, Select, Skeleton, Table, Td, Th, cx } from "../../../components/ui";
import { ResourceCategoryIcon } from "../../../components/icons";
import { ResourceForm } from "../../../components/ResourceForm";

const CATS = [["", "All"], ["person", "People"], ["room", "Rooms"], ["chair", "Chairs"], ["bed", "Beds"], ["equipment", "Equipment"]] as const;

export default function ResourcesPage() {
  const router = useRouter();
  const { can } = useAuth();
  const [showInactive, setShowInactive] = useState(false);
  const { data, error, loading, reload } = useApi<Resource[]>(`/resources${showInactive ? "?active=all" : ""}`);
  const depts = useApi<Department[]>("/departments");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number][0]>("");
  const [dept, setDept] = useState("");
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => (data ?? []).filter((r) => (!cat || r.category === cat) && (!dept || r.department_id === Number(dept)) &&
    (!q || `${r.name} ${r.title ?? ""} ${r.type_name} ${r.location ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [data, cat, dept, q]);

  return (
    <>
      <PageHeader title="Resources and schedules" description="Everything that can be booked: doctors, nurses, rooms, theatres, beds, chairs and machines. Each has its own hours and default slot length."
        actions={can("admin") && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}><LocalizedText message="Add resource" /></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, type or room" className="pl-9" /></div>
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-52"><option value=""><LocalizedText message="All departments" /></option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Segmented value={cat} onChange={setCat} options={CATS} />
        <Check label="Show inactive" checked={showInactive} onChange={setShowInactive} />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <div className="space-y-2 p-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          : !list.length ? <Empty icon={<Boxes className="size-8" />} title="No resources match"><LocalizedText message="Clear the filters or add a new resource." /></Empty> : (
            <Table>
              <TableHeader><TableRow><Th><LocalizedText message="Resource" /></Th><Th><LocalizedText message="Type" /></Th><Th><LocalizedText message="Department" /></Th><Th><LocalizedText message="Slot" /></Th><Th><LocalizedText message="At once" /></Th><Th><LocalizedText message="Hours set" /></Th><Th /></TableRow></TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id} onClick={() => router.push(`/resources/${r.id}`)} className={cx("cursor-pointer hover:bg-scrub-soft/30", !r.active && "opacity-50")}>
                    <Td><span className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: r.department_color + "1a", color: r.department_color }}><ResourceCategoryIcon category={r.category} /></span>
                      <span><span className="font-medium">{r.name}</span>{!r.active && <Badge className="ml-2"><LocalizedText message="Inactive" /></Badge>}<span className="block text-xs text-mute">{[r.title, r.location].filter(Boolean).join(", ")}</span></span>
                    </span></Td>
                    <Td className="text-ink-2">{r.type_name}</Td>
                    <Td>{r.department_name}{r.specialty_name && <span className="block text-xs text-mute">{r.specialty_name}</span>}</Td>
                    <Td className="tabular"><LocalizedText message={"{value0} min"} values={{ value0: (r.slot_minutes) ?? "" }} /></Td>
                    <Td className="tabular">{r.capacity}</Td>
                    <Td>{r.schedule_count ? <span className="tabular text-ink-2"><LocalizedText message={"{value0} shifts"} values={{ value0: (r.schedule_count) ?? "" }} /></span> : <Badge tone="amber"><LocalizedText message="No hours" /></Badge>}</Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/calendar?view=week&resource_ids=${r.id}`}><Button size="sm" variant="quiet" icon={<CalendarDays className="size-3.5" />}><LocalizedText message="Calendar" /></Button></Link>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </div>
      <Drawer open={adding} onClose={() => setAdding(false)} title="Add resource" width="max-w-2xl">
        <ResourceForm onSaved={(id) => { setAdding(false); router.push(`/resources/${id}`); }} />
      </Drawer>
    </>
  );
}
