"use client";
import {TableHeader,TableRow,TableBody,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useEffect, useState } from "react";
import { Plus, Save, Pencil } from "lucide-react";
import {useSourceApi, ApiError } from "../../../lib/api";
import { useApi } from "../../../lib/hooks";
import {useMedslotFormat} from "../../../lib/format";
import type { Resource, Role } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Badge, Button, Check, ErrorNote, Field, IconButton, Input, Modal, PageHeader, Panel, Select, Skeleton, Table, Td, Th, cx } from "../../../components/ui";
import { useToast } from "../../../components/toast";

type U = { id: number; name: string; email: string; role: Role; resource_id: number | null; resource_name: string | null; active: boolean; last_login_at: string | null };
const ROLE: Record<Role, string> = { admin: "Administrator: everything, including setup and audit", scheduler: "Front desk: book, reschedule, register patients", provider: "Clinician: own calendar, check-in and visit status" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Users and settings" description="Scheduling roster and booking rules. Workspace access is managed separately." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Users />
        <Rules />
      </div>
    </>
  );
}

function Users() {
  const { t: tr } = useLocalization();
  const { user: me } = useAuth();
  const { data, error, loading, reload } = useApi<U[]>("/users");
  const [edit, setEdit] = useState<Partial<U> | null>(null);
  return (
    <Panel title="Users" flush actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEdit({ role: "scheduler", active: true })}><LocalizedText message="Add user" /></Button>}>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? <div className="p-4"><Skeleton className="h-64" /></div> : (
        <Table>
          <TableHeader><TableRow><Th><LocalizedText message="Name" /></Th><Th><LocalizedText message="Role" /></Th><Th><LocalizedText message="Linked calendar" /></Th><Th><LocalizedText message="Last sign-in (UTC)" /></Th><Th /></TableRow></TableHeader>
          <TableBody>{data?.map((u) => (
            <TableRow key={u.id} className={cx(!u.active && "opacity-50")}>
              <Td><span className="font-medium">{u.name}</span>{u.id === me.id && <Badge tone="blue" className="ml-2"><LocalizedText message="You" /></Badge>}{!u.active && <Badge className="ml-2"><LocalizedText message="Disabled" /></Badge>}<span className="block text-xs text-mute">{u.email}</span></Td>
              <Td className="capitalize">{u.role}</Td>
              <Td className="text-ink-2">{u.resource_name ?? "–"}</Td>
              <Td className="tabular text-xs text-ink-2">{u.last_login_at ?? tr("Never")}</Td>
              <Td className="text-right"><IconButton label={tr("Edit {value0}", { value0: (u.name) ?? "" })} onClick={() => setEdit(u)}><Pencil className="size-4" /></IconButton></Td>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      {edit && <UserModal u={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </Panel>
  );
}

function UserModal({ u, onClose, onDone }: { u: Partial<U>; onClose: () => void; onDone: () => void }) {
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const people = useApi<Resource[]>("/resources?category=person");
  const [f, setF] = useState({ name: u.name ?? "", email: u.email ?? "", role: u.role ?? "scheduler", resource_id: u.resource_id ?? 0, active: u.active ?? true, password: "" });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const fe = err?.fields ?? {};
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api(u.id ? `/users/${u.id}` : "/users", { method: u.id ? "PUT" : "POST", json: { ...f, resource_id: f.resource_id || null, password: f.password || undefined } });
      toast.success(u.id ? "User saved" : "User added", f.email); onDone();
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} width="max-w-lg" title={u.id ? tr("Edit {value0}", { value0: (u.name) ?? "" }) : tr("Add user")}
      footer={<><Button variant="ghost" onClick={onClose}><LocalizedText message="Close" /></Button><Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}><LocalizedText message="Save" /></Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Full name" required error={fe.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Work email" required error={fe.email}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role" hint={ROLE[f.role]}><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}><option value="admin"><LocalizedText message="Administrator" /></option><option value="scheduler"><LocalizedText message="Front desk" /></option><option value="provider"><LocalizedText message="Clinician" /></option></Select></Field>
        {f.role === "provider" && (
          <Field label="Their calendar" hint="Clinicians see appointments for this resource only">
            <Select value={f.resource_id || ""} onChange={(e) => setF({ ...f, resource_id: Number(e.target.value) })}><option value=""><LocalizedText message="None" /></option>{people.data?.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.department_name})</option>)}</Select>
          </Field>
        )}
        <Field label={u.id ? tr("New password") : tr("Password")} required={!u.id} error={fe.password} hint="At least 10 characters with an uppercase letter and a number">
          <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder={u.id ? tr("Leave blank to keep the current one") : ""} />
        </Field>
        <Check label="Roster active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
        {err && !Object.keys(fe).length && <ErrorNote error={err} />}
      </div>
    </Modal>
  );
}

function Rules() {
  const { fmtDateTime } = useMedslotFormat();
  const api = useSourceApi();
  const toast = useToast();
  const { refreshSettings } = useAuth();
  const { data, reload } = useApi<Record<string, string>>("/settings");
  const [s, setS] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  useEffect(() => { if (data) setS(data); }, [data]);
  if (!s) return <Skeleton className="h-80" />;
  const fe = err?.fields ?? {};
  const save = async () => {
    setBusy(true); setErr(null);
    const { facility_now: _n, ...rest } = s; void _n;
    try { await api("/settings", { method: "PUT", json: rest }); toast.success("Settings saved"); reload(); refreshSettings(); } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <Panel title="Booking rules">
      <div className="flex flex-col gap-3">
        <Field label="Hospital name" error={fe.facility_name} hint="Shown in messages to patients"><Input value={s.facility_name} onChange={(e) => setS({ ...s, facility_name: e.target.value })} /></Field>
        <Field label="Default slot length for new resource types"><Select value={s.default_slot_minutes} onChange={(e) => setS({ ...s, default_slot_minutes: e.target.value })}>{["10", "15", "20", "30", "45", "60"].map((m) => <option key={m} value={m}><LocalizedText message={"{value0} minutes"} values={{ value0: (m) ?? "" }} /></option>)}</Select></Field>
        <Field label="Book up to this many days ahead" error={fe.booking_horizon_days}><Input type="number" min={1} value={s.booking_horizon_days} onChange={(e) => setS({ ...s, booking_horizon_days: e.target.value })} /></Field>
        <Field label="Minimum notice (minutes)" hint="0 lets the desk book any time later today" error={fe.min_notice_minutes}><Input type="number" min={0} value={s.min_notice_minutes} onChange={(e) => setS({ ...s, min_notice_minutes: e.target.value })} /></Field>
        <p className="tabular text-xs text-mute"><LocalizedText message={"Facility clock: {value0}. Set FACILITY_TZ on the server to change the time zone."} values={{ value0: (fmtDateTime(s.facility_now)) ?? "" }} /></p>
        {err && !Object.keys(fe).length && <ErrorNote error={err} />}
        <div className="flex justify-end"><Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}><LocalizedText message="Save settings" /></Button></div>
      </div>
    </Panel>
  );
}
