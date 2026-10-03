"use client";
import {TableHeader,TableRow,TableBody,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useState } from "react";
import { CalendarX, Plus, Trash } from "lucide-react";
import {useSourceApi, ApiError } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import {useMedslotFormat} from "../../../lib/format";
import type { Department } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Badge, Button, Empty, ErrorNote, Field, IconButton, Input, Modal, PageHeader, Segmented, Select, Skeleton, Table, Td, Th , DateInput} from "../../../components/ui";
import { useToast } from "../../../components/toast";

type Holiday = { id: number; date: string; name: string; department_id: number | null; department_name: string | null; affected: number };

export default function HolidaysPage() {
  const { fmtLongDay } = useMedslotFormat();
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const { can, settings } = useAuth();
  const toast = useToast();
  const thisYear = Number(settings.facility_now.slice(0, 4));
  const [year, setYear] = useState(String(thisYear));
  const { data, error, loading, reload } = useApi<Holiday[]>(`/holidays?year=${year}`);
  const depts = useApi<Department[]>("/departments");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: "", name: "", department_id: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true); setErr(null);
    try { await api("/holidays", { method: "POST", json: { ...f, department_id: f.department_id ? Number(f.department_id) : null } }); toast.success("Holiday added", f.name); setOpen(false); setF({ date: "", name: "", department_id: "" }); reload(); }
    catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const remove = async (h: Holiday) => {
    if (!confirm(`Remove ${h.name}? That day will open for booking again.`)) return;
    try { await api(`/holidays/${h.id}`, { method: "DELETE" }); toast.success("Holiday removed"); reload(); } catch (e) { toast.error(e); }
  };

  return (
    <>
      <PageHeader title="Holidays" description="Closed days for the whole hospital or a single department. No new bookings are offered on these dates."
        actions={<>
          <Segmented value={year} onChange={setYear} options={[[String(thisYear - 1), String(thisYear - 1)], [String(thisYear), String(thisYear)], [String(thisYear + 1), String(thisYear + 1)]]} />
          {can("admin") && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}><LocalizedText message="Add holiday" /></Button>}
        </>} />
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <Skeleton className="h-64" /> : !data?.length ? <Empty icon={<CalendarX className="size-8" />} title={tr("No holidays in {value0}", { value0: (year) ?? "" })} /> : (
          <Table>
            <TableHeader><TableRow><Th><LocalizedText message="Date" /></Th><Th><LocalizedText message="Holiday" /></Th><Th><LocalizedText message="Applies to" /></Th><Th><LocalizedText message="Bookings on that day" /></Th><Th /></TableRow></TableHeader>
            <TableBody>{data.map((h) => (
              <TableRow key={h.id}>
                <Td className="tabular whitespace-nowrap font-medium">{fmtLongDay(h.date)}</Td>
                <Td>{h.name}</Td>
                <Td>{h.department_name ?? <Badge tone="blue"><LocalizedText message="Whole hospital" /></Badge>}</Td>
                <Td>{h.affected ? <Badge tone="red"><LocalizedText message={"{value0} to move"} values={{ value0: (h.affected) ?? "" }} /></Badge> : <span className="text-mute"><LocalizedText message="None" /></span>}</Td>
                <Td className="text-right">{can("admin") && <IconButton label={tr("Remove {value0}", { value0: (h.name) ?? "" })} onClick={() => remove(h)}><Trash className="size-4" /></IconButton>}</Td>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add holiday" footer={<><Button variant="ghost" onClick={() => setOpen(false)}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} onClick={add}><LocalizedText message="Add holiday" /></Button></>}>
        <div className="flex flex-col gap-3">
          <Field label="Date" required error={err?.fields.date}><DateInput  value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Name" required error={err?.fields.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Independence Day" /></Field>
          <Field label="Applies to" hint="Choose a department to close only that department">
            <Select value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}><option value=""><LocalizedText message="Whole hospital" /></option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          </Field>
          {err && !Object.keys(err.fields).length && <ErrorNote error={err} />}
        </div>
      </Modal>
    </>
  );
}
