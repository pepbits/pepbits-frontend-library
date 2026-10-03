"use client";
import {TableHeader,TableRow,TableBody,SourceButton,LocalizedText,useLocalization} from "@pepbits/ops-ui";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, MessageCircle, MessageSquare, Plus, RefreshCw, Save, Trash, CircleCheck, CircleAlert } from "lucide-react";
import {useSourceApi, ApiError, qs } from "../../../lib/api";
import { useApi, useDebounced } from "../../../lib/hooks";
import { titleCase } from "../../../lib/format";
import type { Channel, Department, Resource, ResourceType, Specialty, Template } from "../../../lib/types";
import { useAuth } from "../../../components/shell/auth";
import { Badge, Button, Check, Drawer, Empty, ErrorNote, Field, Input, PageHeader, Panel, Segmented, Select, Skeleton, Table, Td, Textarea, Th, Toggle, cx } from "../../../components/ui";
import { useToast } from "../../../components/toast";

interface Meta { events: string[]; channels: Channel[]; variables: string[]; providers: Record<Channel, boolean> }
const CH_ICON = { email: Mail, sms: MessageSquare, whatsapp: MessageCircle };
const CH_LABEL = { email: "Email", sms: "SMS", whatsapp: "WhatsApp" };
const SCOPE_LABEL = { global: "Everyone (default)", department: "Department", specialty: "Specialty", resource_type: "Resource type", resource: "Single resource" } as const;
const EVENT_LABEL: Record<string, string> = { booked: "Booked", confirmed: "Confirmed", reminder: "Reminder", rescheduled: "Rescheduled", cancelled: "Cancelled", no_show: "Missed (no-show)", checked_in: "Checked in", completed: "Visit completed" };

export default function NotificationsPage() {
  const [tab, setTab] = useState<"templates" | "log" | "channels">("templates");
  const meta = useApi<Meta>("/notifications/meta");
  return (
    <>
      <PageHeader title="Notifications" description="Messages patients receive by email, SMS and WhatsApp. Set a default for each event, then override it for a department, specialty, resource type or one resource.">
        <Segmented value={tab} onChange={setTab} options={[["templates", "Templates"], ["log", "Delivery log"], ["channels", "Channels and reminders"]]} />
      </PageHeader>
      {meta.data && (tab === "templates" ? <Templates meta={meta.data} /> : tab === "log" ? <Log /> : <Channels meta={meta.data} />)}
      {meta.loading && <Skeleton className="h-96" />}
    </>
  );
}

function Templates({ meta }: { meta: Meta }) {
  const { t: tr } = useLocalization();
  const [event, setEvent] = useState("");
  const [channel, setChannel] = useState("");
  const [scope, setScope] = useState("");
  const { data, error, loading, reload } = useApi<Template[]>(`/notifications/templates${qs({ event, channel, scope_type: scope })}`);
  const [edit, setEdit] = useState<Partial<Template> | null>(null);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={event} onChange={(e) => setEvent(e.target.value)} className="w-48"><option value=""><LocalizedText message="All events" /></option>{meta.events.map((e) => <option key={e} value={e}>{EVENT_LABEL[e]}</option>)}</Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-40"><option value=""><LocalizedText message="All channels" /></option>{meta.channels.map((c) => <option key={c} value={c}>{CH_LABEL[c]}</option>)}</Select>
        <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-48"><option value=""><LocalizedText message="All levels" /></option>{Object.entries(SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Button variant="primary" className="ml-auto" icon={<Plus className="size-4" />} onClick={() => setEdit({ event: "booked", channel: "sms", scope_type: "department", scope_id: 0, active: true, body: "" })}><LocalizedText message="Add template or override" /></Button>
      </div>
      <p className="mb-3 text-xs text-mute"><LocalizedText message="When a message is sent, the most specific active template wins: single resource, then resource type, then specialty, then department, then the default." /></p>
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <Skeleton className="h-96" /> : !data?.length ? <Empty title="No templates match" /> : (
          <Table>
            <TableHeader><TableRow><Th><LocalizedText message="Event" /></Th><Th><LocalizedText message="Channel" /></Th><Th><LocalizedText message="Applies to" /></Th><Th><LocalizedText message="Message" /></Th><Th><LocalizedText message="Status" /></Th></TableRow></TableHeader>
            <TableBody>{data.map((t) => {
              const I = CH_ICON[t.channel];
              return (
                <TableRow key={t.id} onClick={() => setEdit(t)} className={cx("cursor-pointer hover:bg-scrub-soft/30", !t.active && "opacity-50")}>
                  <Td className="whitespace-nowrap font-medium">{EVENT_LABEL[t.event]}</Td>
                  <Td><span className="inline-flex items-center gap-1.5"><I className="size-4 text-mute" />{CH_LABEL[t.channel]}</span></Td>
                  <Td>{t.scope_type === "global" ? <Badge tone="blue"><LocalizedText message="Default" /></Badge> : <span>{t.scope_name}<span className="block text-xs text-mute">{SCOPE_LABEL[t.scope_type]}</span></span>}</Td>
                  <Td className="max-w-md"><span className="line-clamp-2 text-ink-2">{t.subject ? <strong className="text-ink">{t.subject}. </strong> : null}{t.body}</span></Td>
                  <Td>{t.active ? <Badge tone="green"><LocalizedText message="On" /></Badge> : <Badge><LocalizedText message="Off" /></Badge>}</Td>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        )}
      </div>
      <Drawer open={!!edit} onClose={() => setEdit(null)} width="max-w-2xl" title={edit?.id ? tr("Edit template") : tr("New template")}>
        {edit && <TemplateForm t={edit} meta={meta} onDone={() => { setEdit(null); reload(); }} />}
      </Drawer>
    </>
  );
}

function TemplateForm({ t, meta, onDone }: { t: Partial<Template>; meta: Meta; onDone: () => void }) {
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const [f, setF] = useState({ event: t.event ?? "booked", channel: (t.channel ?? "sms") as Channel, scope_type: t.scope_type ?? "global", scope_id: t.scope_id ?? 0, subject: t.subject ?? "", body: t.body ?? "", active: t.active ?? true });
  const [err, setErr] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ subject: string | null; body: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const depts = useApi<Department[]>(f.scope_type === "department" ? "/departments" : null);
  const specs = useApi<Specialty[]>(f.scope_type === "specialty" ? "/specialties" : null);
  const types = useApi<ResourceType[]>(f.scope_type === "resource_type" ? "/resource-types" : null);
  const res = useApi<Resource[]>(f.scope_type === "resource" ? "/resources" : null);
  const targets = useMemo(() => {
    if (f.scope_type === "department") return depts.data?.map((d) => [d.id, d.name] as const);
    if (f.scope_type === "specialty") return specs.data?.map((s) => [s.id, `${s.name} (${s.department_name})`] as const);
    if (f.scope_type === "resource_type") return types.data?.map((x) => [x.id, x.name] as const);
    if (f.scope_type === "resource") return res.data?.map((r) => [r.id, `${r.name} (${r.department_name})`] as const);
    return [];
  }, [f.scope_type, depts.data, specs.data, types.data, res.data]);
  const fe = err?.fields ?? {};

  const dBody = useDebounced(f.body, 300), dSub = useDebounced(f.subject, 300);
  useEffect(() => {
    if (!dBody.trim()) { setPreview(null); return; }
    api<{ subject: string | null; body: string }>("/notifications/preview", { method: "POST", json: { body: dBody, subject: dSub || null } }).then(setPreview).catch(() => {});
  }, [dBody, dSub]);

  const insert = (v: string) => {
    const el = bodyRef.current, tok = `{{${v}}}`;
    if (!el) return setF((x) => ({ ...x, body: x.body + tok }));
    const s = el.selectionStart, e = el.selectionEnd;
    setF((x) => ({ ...x, body: x.body.slice(0, s) + tok + x.body.slice(e) }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tok.length, s + tok.length); });
  };
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await api(t.id ? `/notifications/templates/${t.id}` : "/notifications/templates", { method: t.id ? "PUT" : "POST", json: { ...f, subject: f.channel === "email" ? f.subject : null } });
      toast.success("Template saved"); onDone();
    } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!t.id || !confirm("Delete this template?")) return;
    try { await api(`/notifications/templates/${t.id}`, { method: "DELETE" }); toast.success("Template deleted"); onDone(); } catch (e) { toast.error(e); }
  };
  const len = (preview?.body ?? f.body).length;
  const segments = f.channel === "sms" ? Math.max(1, Math.ceil(len / (/[^\x00-\x7F]/.test(preview?.body ?? f.body) ? 67 : 153))) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="When"><Select value={f.event} onChange={(e) => setF({ ...f, event: e.target.value })}>{meta.events.map((e) => <option key={e} value={e}>{EVENT_LABEL[e]}</option>)}</Select></Field>
        <Field label="Channel"><Segmented value={f.channel} onChange={(c) => setF({ ...f, channel: c })} options={meta.channels.map((c) => [c, CH_LABEL[c]] as const)} /></Field>
        <Field label="Applies to"><Select value={f.scope_type} onChange={(e) => setF({ ...f, scope_type: e.target.value as Template["scope_type"], scope_id: 0 })}>{Object.entries(SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        {f.scope_type !== "global" && (
          <Field label={SCOPE_LABEL[f.scope_type]} required error={fe.scope_id}>
            <Select value={f.scope_id || ""} onChange={(e) => setF({ ...f, scope_id: Number(e.target.value) })} invalid={!!fe.scope_id}><option value=""><LocalizedText message="Choose…" /></option>{targets?.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
          </Field>
        )}
      </div>
      {f.channel === "email" && <Field label="Subject" required error={fe.subject}><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} invalid={!!fe.subject} /></Field>}
      <Field label="Message" required error={fe.body} hint={f.channel !== "email" ? tr("Keep SMS and WhatsApp free of diagnoses or test names: they can show on a locked phone screen.") : undefined}>
        <Textarea ref={bodyRef} rows={f.channel === "email" ? 9 : 4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} invalid={!!fe.body} />
      </Field>
      <div>
        <p className="mb-1.5 text-xs font-medium text-mute"><LocalizedText message="Insert a detail" /></p>
        <div className="flex flex-wrap gap-1">{meta.variables.map((v) => <SourceButton key={v} type="button" onClick={() => insert(v)} className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] hover:border-scrub hover:text-scrub">{v}</SourceButton>)}</div>
      </div>
      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium text-mute"><LocalizedText message="Preview with sample patient" /></p>
          {f.channel === "sms" && <span className="tabular text-xs text-mute"><LocalizedText message={"{value0} characters, {value1} SMS"} values={{ value0: (len) ?? "", value1: (segments) ?? "" }} /></span>}</div>
        {preview ? (
          <div className={cx("whitespace-pre-wrap text-sm", f.channel !== "email" && "max-w-sm rounded-2xl rounded-bl-sm bg-panel px-3.5 py-2.5 shadow-sm")}>
            {preview.subject && <p className="mb-2 font-semibold">{preview.subject}</p>}{preview.body}
          </div>
        ) : <p className="text-sm text-mute"><LocalizedText message="Write a message to see it here." /></p>}
      </div>
      <Check label="Active" checked={f.active} onChange={(v) => setF({ ...f, active: v })} />
      {err && !Object.keys(fe).length && <ErrorNote error={err} />}
      <div className="flex justify-between">
        {t.id ? <Button variant="ghost" className="text-triage" icon={<Trash className="size-4" />} onClick={remove}><LocalizedText message="Delete" /></Button> : <span />}
        <Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}><LocalizedText message="Save template" /></Button>
      </div>
    </div>
  );
}

type LogRow = { id: number; appointment_id: number; event: string; channel: Channel; recipient: string; status: string; error: string | null; created_at: string; sent_at: string | null; ref_code: string; patient_name: string };
function Log() {
  const api = useSourceApi();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const { data, error, loading, reload } = useApi<LogRow[]>(`/notifications/log${qs({ status, channel })}`);
  const [busy, setBusy] = useState<number | null>(null);
  const retry = async (id: number) => {
    setBusy(id);
    try { const r = await api<{ status: string; error?: string }>(`/notifications/${id}/retry`, { method: "POST" }); r.status === "sent" ? toast.success("Message sent") : toast.error(new Error(r.error ?? r.status), "Still not sent"); reload(); }
    catch (e) { toast.error(e); } finally { setBusy(null); }
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48"><option value=""><LocalizedText message="All results" /></option>{["sent", "failed", "queued", "not_configured", "opted_out"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-40"><option value=""><LocalizedText message="All channels" /></option>{(["email", "sms", "whatsapp"] as const).map((c) => <option key={c} value={c}>{CH_LABEL[c]}</option>)}</Select>
        <Button className="ml-auto" icon={<RefreshCw className="size-4" />} onClick={reload}><LocalizedText message="Refresh" /></Button>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        {loading && !data ? <Skeleton className="h-96" /> : !data?.length ? <Empty title="No messages yet"><LocalizedText message="Messages appear here as appointments are booked and changed." /></Empty> : (
          <Table>
            <TableHeader><TableRow><Th><LocalizedText message="Created (UTC)" /></Th><Th><LocalizedText message="Patient" /></Th><Th><LocalizedText message="Event" /></Th><Th><LocalizedText message="Channel" /></Th><Th><LocalizedText message="To" /></Th><Th><LocalizedText message="Result" /></Th><Th /></TableRow></TableHeader>
            <TableBody>{data.map((n) => (
              <TableRow key={n.id}>
                <Td className="tabular whitespace-nowrap text-xs text-ink-2">{n.created_at}</Td>
                <Td>{n.patient_name}<span className="tabular block text-xs text-mute">{n.ref_code}</span></Td>
                <Td>{EVENT_LABEL[n.event] ?? n.event}</Td>
                <Td>{CH_LABEL[n.channel]}</Td>
                <Td className="tabular text-ink-2">{n.recipient}</Td>
                <Td><Badge tone={n.status === "sent" ? "green" : n.status === "failed" ? "red" : n.status === "queued" ? "blue" : "neutral"}>{titleCase(n.status)}</Badge>{n.error && <span className="block max-w-56 truncate text-xs text-mute" title={n.error}>{n.error}</span>}</Td>
                <Td className="text-right">{["failed", "not_configured"].includes(n.status) && <Button size="sm" loading={busy === n.id} onClick={() => retry(n.id)}><LocalizedText message="Send again" /></Button>}</Td>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </div>
    </>
  );
}

function Channels({ meta }: { meta: Meta }) {
  const api = useSourceApi();
  const { t: tr } = useLocalization();
  const toast = useToast();
  const { refreshSettings } = useAuth();
  const { data, reload } = useApi<Record<string, string>>("/settings");
  const [s, setS] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  useEffect(() => { if (data) setS(data); }, [data]);
  if (!s) return <Skeleton className="h-64" />;
  const save = async () => {
    setBusy(true); setErr(null);
    const { facility_now: _n, ...rest } = s; void _n;
    try { await api("/settings", { method: "PUT", json: rest }); toast.success("Settings saved"); reload(); refreshSettings(); } catch (e) { setErr(e as ApiError); } finally { setBusy(false); }
  };
  return (
    <div className="grid max-w-4xl gap-5 lg:grid-cols-2">
      <Panel title="Channels">
        <ul className="flex flex-col gap-4">
          {meta.channels.map((c) => {
            const I = CH_ICON[c];
            return (
              <li key={c} className="flex items-start gap-3">
                <I className="mt-0.5 size-5 text-mute" />
                <div className="flex-1">
                  <p className="font-medium">{CH_LABEL[c]}</p>
                  {meta.providers[c]
                    ? <p className="inline-flex items-center gap-1 text-xs text-scrub"><CircleCheck className="size-3.5" /><LocalizedText message="Provider connected" /></p>
                    : <p className="inline-flex items-center gap-1 text-xs text-amber"><CircleAlert className="size-3.5" /><LocalizedText message="Not connected. Add" />{" "}{c === "email" ? tr("SMTP") : tr("Twilio")} {" "}<LocalizedText message="details to the server's .env file." /></p>}
                </div>
                <Toggle label={tr("Send {value0}", { value0: (CH_LABEL[c]) ?? "" })} checked={s[`channel_${c}_enabled`] === "1"} onChange={(v) => setS({ ...s, [`channel_${c}_enabled`]: v ? "1" : "0" })} />
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel title="Reminders">
        <Field label="Send reminders this many hours before" hint="Separate with commas. Example: 24,2 sends one a day before and one two hours before." error={err?.fields.reminder_hours}>
          <Input value={s.reminder_hours} onChange={(e) => setS({ ...s, reminder_hours: e.target.value.replace(/[^\d,]/g, "") })} />
        </Field>
      </Panel>
      <div className="flex justify-end lg:col-span-2"><Button variant="primary" loading={busy} onClick={save} icon={<Save className="size-4" />}><LocalizedText message="Save settings" /></Button></div>
    </div>
  );
}
