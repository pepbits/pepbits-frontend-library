"use client";
import { LocalizedText, useLocalization, ConfirmDialog } from "@pepbits/ops-ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/controls";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useEffect, useState } from "react";
import { CalendarPlus, Pencil, Play, Trash2 } from "lucide-react";
import { useQualityApi } from "../../../lib/api";
import { useApi, useDebounced } from "../../../lib/hooks";
import { useAuth, useMeta } from "../../../lib/auth";
import { Badge, Button, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Panel, Select, Toggle, TimeInput } from "../../../components/ui";
import { FacilityPicker } from "../../../components/PeriodPicker";
import { useToast } from "../../../components/toast";
import { cls } from "../../../lib/format";
import { useQualityFormat } from "../../../lib/format";

interface Schedule {
  id: number;
  name: string;
  template_id: number;
  template_name: string;
  authority_id: number | null;
  authority_name: string | null;
  authority_code: string | null;
  channel: string | null;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  facility_ids: number[];
  recipients: string[];
  format: string;
  require_approval: number;
  active: number;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHANNEL: Record<string, string> = { portal_upload: "portal upload", sftp: "SFTP", api: "API", email: "email" };

type Translate = (message: string, values?: Record<string, string | number>) => string;

function describeSchedule(s: Pick<Schedule, "frequency" | "day_of_week" | "day_of_month" | "time_of_day">, t: Translate) {
  const ord = (n: number) => t(n % 10 === 1 && n !== 11 ? "{value0}st" : n % 10 === 2 && n !== 12 ? "{value0}nd" : n % 10 === 3 && n !== 13 ? "{value0}rd" : "{value0}th", { value0: n });
  switch (s.frequency) {
    case "daily":
      return t("Every day at {value0}", { value0: s.time_of_day });
    case "weekly":
      return t("Every {value0} at {value1}", { value0: t(DAYS[s.day_of_week ?? 0]), value1: s.time_of_day });
    case "monthly":
      return t("Monthly on the {value0} at {value1}", { value0: ord(s.day_of_month ?? 1), value1: s.time_of_day });
    case "quarterly":
      return t("Quarterly on the {value0} of Jan, Apr, Jul and Oct at {value1}", { value0: ord(s.day_of_month ?? 1), value1: s.time_of_day });
  }
}

const PERIOD_RULE: Record<string, string> = {
  daily: "Reports the most recent complete month.",
  weekly: "Reports the most recent complete month.",
  monthly: "Reports the previous calendar month.",
  quarterly: "Reports the previous calendar quarter.",
};

export default function SchedulesPage() {
  const { t } = useLocalization();
  const { api } = useQualityApi();
  const { fmtDateTime, fmtRelative } = useQualityFormat();
  const { can } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ timezone: string; rows: Schedule[] }>("/schedules");
  const [editing, setEditing] = useState<Schedule | "new" | null>(null);
  const [running, setRunning] = useState<number | null>(null);

  const runNow = async (s: Schedule) => {
    setRunning(s.id);
    try {
      const r = await api<{ reference: string; status: string }>(`/schedules/${s.id}/run`, { method: "POST" });
      toast(r.status === "pending_approval" ? "{value0} produced {value1}, which is waiting for approval." : "{value0} produced {value1} ({value2}).", "success", { value0: s.name, value1: r.reference, value2: r.status });
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "The run failed.", "error");
    } finally {
      setRunning(null);
    }
  };

  const toggleActive = async (s: Schedule, active: boolean) => {
    try {
      await api(`/schedules/${s.id}`, { method: "PUT", body: { active } });
      toast(active ? "Resumed {value0}." : "Paused {value0}.", "success", { value0: s.name });
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update.", "error");
    }
  };

  const [deleting, setDeleting] = useState<Schedule | null>(null);
  const remove = async (s: Schedule) => {
    setDeleting(null);
    try {
      const r = await api<{ paused?: boolean; message?: string }>(`/schedules/${s.id}`, { method: "DELETE" });
      if (r.message) toast(r.message); else toast("Deleted {value0}.", "success", { value0: s.name });
      void reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete.", "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Schedules"
        description={t("Reports generated and delivered automatically to authorities or internal recipients. Times are in the schedule time zone ({value0}). Submissions to authorities can require approval before they are transmitted.", { value0: data?.timezone ?? "Asia/Dubai" })}
        actions={
          can("schedules.manage") && (
            <Button variant="primary" icon={<CalendarPlus className="size-4" />} onClick={() => setEditing("new")}><LocalizedText message="New schedule" /></Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        {error && <div className="p-4"><ErrorState message={error} onRetry={reload} /></div>}
        {!data && loading && <Loading className="p-4" rows={6} />}
        {data && data.rows.length === 0 && <EmptyState title="No schedules yet"><LocalizedText message="Create one to deliver a report automatically." /></EmptyState>}
        {data && data.rows.length > 0 && (
          <TableContainer overflow="horizontal">
            <Table className="data-table">
              <TableHeader>
                <TableRow>
                  <TableHead><LocalizedText message="Schedule" /></TableHead>
                  <TableHead><LocalizedText message="When" /></TableHead>
                  <TableHead><LocalizedText message="Delivers to" /></TableHead>
                  <TableHead><LocalizedText message="Next run" /></TableHead>
                  <TableHead><LocalizedText message="Last run" /></TableHead>
                  <TableHead><LocalizedText message="Active" /></TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((s) => (
                  <TableRow key={s.id} className={cls(!s.active && "text-ink-3")}>
                    <TableCell className="max-w-[300px]">
                      <div className="font-medium text-ink">{s.name}</div>
                      <Link href={`/reports/${s.template_id}`} className="text-xs text-ink-3 hover:underline">
                        {s.template_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-ink-2">{describeSchedule(s, t)}</TableCell>
                    <TableCell>
                      {s.authority_name ? (
                        <>
                          <div className="text-ink-2">{s.authority_name}</div>
                          <div className="text-xs text-ink-3">
                            <LocalizedText message={s.require_approval ? "By {value0}, {value1}, approval required" : "By {value0}, {value1}"} values={{ value0: CHANNEL[s.channel ?? ""] ? t(CHANNEL[s.channel ?? ""]) : s.channel ?? "", value1: s.format.toUpperCase() }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-ink-2"><LocalizedText message={s.recipients.length === 1 ? "{value0} internal recipient" : "{value0} internal recipients"} values={{ value0: s.recipients.length }} /></div>
                          <div className="max-w-[240px] truncate text-xs text-ink-3" title={s.recipients.join(", ")}>
                            {s.recipients.join(", ")}
                          </div>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.next_run_at ? (
                        <>
                          <div className="num text-ink-2">{fmtDateTime(s.next_run_at)}</div>
                          <div className="text-xs text-ink-3">{fmtRelative(s.next_run_at)}</div>
                        </>
                      ) : (
                        <span className="text-ink-3"><LocalizedText message="Paused" /></span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.last_run_at ? (
                        <>
                          <div className="text-xs text-ink-3">{fmtRelative(s.last_run_at)}</div>
                          {s.last_status && <Badge tone={s.last_status === "failed" ? "bad" : "neutral"}>{s.last_status.replace("_", " ")}</Badge>}
                        </>
                      ) : (
                        <span className="text-xs text-ink-3"><LocalizedText message="Never" /></span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Toggle checked={!!s.active} disabled={!can("schedules.manage")} onChange={(v) => toggleActive(s, v)} />
                    </TableCell>
                    <TableCell className="right whitespace-nowrap">
                      {can("schedules.manage") && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" icon={<Play className="size-3.5" />} loading={running === s.id} onClick={() => runNow(s)}><LocalizedText message="Run now" /></Button>
                          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(s)} aria-label={t("Edit {value0}", { value0: s.name })} />
                          <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setDeleting(s)} aria-label={t("Delete {value0}", { value0: s.name })} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Panel>
      <ScheduleModal
        schedule={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={t("Delete schedule")}
        message={deleting ? t("Delete the schedule “{value0}”?", { value0: deleting.name }) : ""}
        confirmLabel={t("Delete")}
        tone="danger"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function ScheduleModal({ schedule, onClose, onSaved }: { schedule: Schedule | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { api } = useQualityApi();
  const { fmtDateTime } = useQualityFormat();
  const meta = useMeta();
  const toast = useToast();
  const { t } = useLocalization();
  const templates = useApi<{ id: number; name: string; authority_id: number | null }[]>(schedule ? "/report-templates" : null);
  const [f, setF] = useState({ name: "", template_id: "", authority_id: "", frequency: "monthly", day_of_week: "0", day_of_month: "5", time_of_day: "08:00", recipients: "", format: "pdf", require_approval: true, active: true, facility_ids: [] as number[] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timing = useDebounced(`${f.frequency}|${f.day_of_week}|${f.day_of_month}|${f.time_of_day}`, 300);
  const preview = useApi<{ runs: string[] }>(schedule ? "/schedules/preview-next" : null, (() => {
    const [frequency, dow, dom, tod] = timing.split("|");
    return { frequency, day_of_week: dow, day_of_month: dom, time_of_day: tod };
  })());

  useEffect(() => {
    setErr(null);
    if (schedule === "new") setF({ name: "", template_id: "", authority_id: "", frequency: "monthly", day_of_week: "0", day_of_month: "5", time_of_day: "08:00", recipients: "", format: "pdf", require_approval: true, active: true, facility_ids: [] });
    else if (schedule)
      setF({
        name: schedule.name,
        template_id: String(schedule.template_id),
        authority_id: schedule.authority_id ? String(schedule.authority_id) : "",
        frequency: schedule.frequency,
        day_of_week: String(schedule.day_of_week ?? 0),
        day_of_month: String(schedule.day_of_month ?? 5),
        time_of_day: schedule.time_of_day,
        recipients: schedule.recipients.join(", "),
        format: schedule.format,
        require_approval: !!schedule.require_approval,
        active: !!schedule.active,
        facility_ids: schedule.facility_ids,
      });
  }, [schedule]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    setErr(null);
    const body = {
      name: f.name,
      template_id: Number(f.template_id) || null,
      authority_id: f.authority_id ? Number(f.authority_id) : null,
      frequency: f.frequency,
      day_of_week: Number(f.day_of_week),
      day_of_month: Number(f.day_of_month),
      time_of_day: f.time_of_day,
      recipients: f.recipients.split(/[,;\s]+/).map((r) => r.trim()).filter(Boolean),
      format: f.format,
      require_approval: f.require_approval,
      active: f.active,
      facility_ids: f.facility_ids,
    };
    try {
      if (schedule === "new") await api("/schedules", { body });
      else await api(`/schedules/${(schedule as Schedule).id}`, { method: "PUT", body });
      toast("Saved {value0}.", "success", { value0: f.name });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!schedule}
      onClose={onClose}
      wide
      title={schedule === "new" ? t("New schedule") : t("Edit schedule")}
      footer={
        <>
          {err && <p className="mr-auto self-center text-sm text-bad">{err}</p>}
          <Button variant="ghost" onClick={onClose}><LocalizedText message="Cancel" /></Button>
          <Button variant="primary" loading={busy} onClick={save}><LocalizedText message="Save schedule" /></Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Name" className="sm:col-span-3">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. DHA monthly dashboard" />
        </Field>
        <Field label="Report" className="sm:col-span-3">
          <Select
            value={f.template_id}
            onChange={(e) => {
              const t = templates.data?.find((x) => String(x.id) === e.target.value);
              setF((x) => ({ ...x, template_id: e.target.value, authority_id: x.authority_id || (t?.authority_id ? String(t.authority_id) : "") }));
            }}
          >
            <option value=""><LocalizedText message="Choose a report" /></option>
            {templates.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Frequency" className="sm:col-span-2">
          <Select value={f.frequency} onChange={(e) => set("frequency", e.target.value)}>
            <option value="daily"><LocalizedText message="Daily" /></option>
            <option value="weekly"><LocalizedText message="Weekly" /></option>
            <option value="monthly"><LocalizedText message="Monthly" /></option>
            <option value="quarterly"><LocalizedText message="Quarterly" /></option>
          </Select>
        </Field>
        {f.frequency === "weekly" && (
          <Field label="Day" className="sm:col-span-2">
            <Select value={f.day_of_week} onChange={(e) => set("day_of_week", e.target.value)}>
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {t(d)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {(f.frequency === "monthly" || f.frequency === "quarterly") && (
          <Field label="Day of month" className="sm:col-span-2">
            <Select value={f.day_of_month} onChange={(e) => set("day_of_month", e.target.value)}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Time (schedule time zone)" className="sm:col-span-2">
          <TimeInput value={f.time_of_day} onChange={(e) => set("time_of_day", e.target.value)} />
        </Field>
        <div className="rounded-md bg-surface px-3 py-2.5 text-sm sm:col-span-6">
          <span className="text-ink-2"><LocalizedText message={PERIOD_RULE[f.frequency]} /> <LocalizedText message="Next runs:" /></span>
          <span className="num text-ink">{preview.data?.runs.map((r) => fmtDateTime(r)).join("; ") || "—"}</span>
        </div>
        <Field label="Submit to authority" className="sm:col-span-3" hint="Leave empty to deliver to internal recipients only">
          <Select value={f.authority_id} onChange={(e) => set("authority_id", e.target.value)}>
            <option value=""><LocalizedText message="No authority" /></option>
            {meta.authorities.filter((a) => a.active).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({CHANNEL[a.channel] ? t(CHANNEL[a.channel]) : a.channel})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Format" className="sm:col-span-3">
          <Select value={f.format} onChange={(e) => set("format", e.target.value)}>
            <option value="pdf"><LocalizedText message="PDF" /></option>
            <option value="xlsx"><LocalizedText message="Excel workbook" /></option>
            <option value="csv"><LocalizedText message="CSV" /></option>
          </Select>
        </Field>
        <Field label="Internal recipients" className="sm:col-span-6" hint="Email addresses separated by commas. They receive a copy of every run.">
          <Input value={f.recipients} onChange={(e) => set("recipients", e.target.value)} placeholder="quality.team@allyvora.health" />
        </Field>
        <div className="sm:col-span-3">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-2"><LocalizedText message="Facilities" /></span>
          <FacilityPicker value={f.facility_ids} onChange={(v) => set("facility_ids", v)} />
        </div>
        <div className="flex flex-col justify-end gap-3 sm:col-span-3">
          <Toggle checked={f.require_approval} onChange={(v) => set("require_approval", v)} label="Require approval before transmission" />
          <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Schedule is active" />
        </div>
      </div>
    </Modal>
  );
}
