"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, FileText, History, ListChecks, Pencil, ShieldCheck, X } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ApiError, useApi, useApiClient } from "../../lib/api";
import { cx } from "../../lib/cx";
import { TONE, useRcmFormat } from "../../lib/format";
import type { ActionDef, RecordDto, ResourceDef } from "../../lib/types";
import { useAction } from "../../lib/useAction";
import { FieldInput } from "../form/FieldInput";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { SourceButton } from "../ui/controls";
import { StatusPill, dueActive, statusOf } from "../ui/StatusPill";
import { useToast } from "../ui/Toast";
import { ActionDialog, type ActionRequest } from "./ActionDialog";
import { DocumentPreview } from "./DocumentPreview";
import { FieldValue, isEmpty } from "./values";

const BTN: Record<ActionDef["tone"], string> = {
  primary: "btn-primary", approve: "btn-approve", attention: "btn-attention", quiet: "btn-quiet", danger: "btn-danger",
};

/** Record detail: header, status path, always-visible actions, Document / Details / Activity tabs, in-place edit and the action dialog. */
export function DetailPane({ res, id, onChanged, onClose }: { res: ResourceDef; id: number; onChanged: (r: RecordDto) => void; onClose?: () => void }) {
  const { meta, actor, user } = useApp();
  const toast = useToast();
  const client = useApiClient();
  const fmt = useRcmFormat();
  const { t } = useLocalization();
  const record = useApi<RecordDto>(`/records/${res.key}/${id}`);
  const rec = record.data;
  const loading = record.isLoading;
  const error = record.error?.message ?? null;
  const [tab, setTab] = useState<"details" | "document" | "activity">(res.document ? "document" : "details");
  const [dialog, setDialog] = useState<ActionRequest | null>(null);
  const { busy, run: guard } = useAction();
  const [dlgErr, setDlgErr] = useState<{ msg: string; fields?: Record<string, string> } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  useEffect(() => { setEditing(false); setDialog(null); setEditErrors({}); }, [id]);
  useEffect(() => { setTab(res.document ? "document" : "details"); }, [res.key, res.document]);

  const available = useMemo(() => (rec ? res.actions.filter((a) => a.from.includes(rec.status)) : []), [rec, res]);

  if (loading && !rec) return <PaneSkeleton />;
  if (error || !rec) return <div role="alert" className="p-6 text-[13px] text-madder-700">{error ?? <LocalizedText message="Not found." />}</div>;

  const involved = actor.id === rec.createdBy || actor.id === rec.statusBy;
  const editable = res.editable.includes(rec.status) && res.fields.some((f) => !f.readonly);
  const st = statusOf(res, rec.status);
  const hasDue = res.fields.some((f) => f.key === "dueDate");
  const due = hasDue ? fmt.dueText(rec.dueDate) : null;
  const closed = !dueActive(res, rec.status);
  const hasAmount = res.fields.some((f) => f.key === "amount");
  const hasBalance = res.fields.some((f) => f.key === "balance");

  const run = (a: ActionDef | ActionRequest["action"], input: Record<string, any> = {}, reason = "") => guard(async () => {
    setDlgErr(null);
    try {
      const out = await client.post<RecordDto>(`/records/${res.key}/${rec.id}/actions/${a.key}`, { rowVersion: rec.rowVersion, input, reason });
      await record.mutate(out, { revalidate: false });
      setDialog(null);
      toast({ tone: "success", title: a.label, detail: out.timeline?.[0]?.summary });
      onChanged(out);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "STALE_VERSION") { void record.mutate(); setDialog(null); toast({ tone: "error", title: "Record changed", detail: err.message }); }
      else if (dialog) setDlgErr({ msg: err.message, fields: err.fieldErrors });
      else toast({ tone: "error", title: t("Couldn’t {value0}", { value0: a.label.toLowerCase() }), detail: err.message });
    }
  });
  const start = (a: ActionDef) => {
    if (a.inputs?.length || a.reason || a.tone === "danger") { setDlgErr(null); setDialog({ action: a, subject: `${rec.ref}${rec.patient ? ` · ${rec.patient.name}` : ""}` }); }
    else void run(a);
  };

  const save = () => guard(async () => {
    setEditErrors({});
    try {
      const out = await client.put<RecordDto>(`/records/${res.key}/${rec.id}`, { rowVersion: rec.rowVersion, values: draft });
      await record.mutate(out, { revalidate: false });
      setEditing(false); onChanged(out);
      toast({ tone: "success", title: "Saved", detail: t("{value0} updated.", { value0: out.ref }) });
    } catch (e) {
      const err = e as ApiError;
      setEditErrors(err.fieldErrors ?? {});
      toast({ tone: "error", title: "Not saved", detail: err.message });
      if (err.code === "STALE_VERSION") void record.mutate();
    }
  });

  const fields = res.fields.filter((f) => f.key !== "patient" && f.type !== "lines");
  const lineFields = res.fields.filter((f) => f.type === "lines");
  const pathIdx = res.path.indexOf(rec.status);
  const branchShort = meta.branches.find((b) => b.value === rec.branch)?.short;

  return (
    <div className="flex h-full min-h-0 flex-col" data-rcm-detail={rec.id}>
      {/* Header */}
      <div className="border-b border-line px-5 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12.5px] font-semibold text-harbor-700">{rec.ref}</span>
              <StatusPill res={res} status={rec.status} />
              {due && !closed && <span className={cx("text-[11.5px] font-semibold", TONE[due.tone].text)}>{res.dueLabel ?? t("Due")}: {due.text}</span>}
            </div>
            <h2 className="mt-1 truncate text-[19px] font-semibold leading-tight">{rec.patient?.name ?? (rec.title || res.singular)}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
              {rec.patient && <span>{rec.patient.mrn}</span>}
              {rec.patient && rec.title && <span>· {rec.title}</span>}
              {rec.branch && <span>· {branchShort}</span>}
              <span className="inline-flex items-center gap-1">· <Avatar user={user(rec.createdBy)} size="xs" /> {t("created {value0}", { value0: fmt.relative(rec.createdAt) })}</span>
            </p>
          </div>
          {onClose && <SourceButton onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-mist" aria-label="Close"><X className="h-5 w-5" /></SourceButton>}
        </div>

        {(hasAmount || hasBalance) && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {hasAmount && <Figure label={res.amountLabel ?? t("Amount")} value={fmt.money(rec.amount, rec.currency)} />}
            {hasBalance && <Figure label={res.balanceLabel ?? t("Balance")} value={fmt.money(rec.balance, rec.currency)} tone={rec.balance > 0 ? "text-saffron-700" : "text-jade-700"} />}
            {hasDue && <Figure label={res.dueLabel ?? t("Due")} value={fmt.date(rec.dueDate)} tone={due?.tone === "danger" && !closed ? "text-madder-700" : undefined} />}
          </div>
        )}

        {/* Status path */}
        <ol className="mt-3 flex items-center gap-1" aria-label={t("Progress")}>
          {res.path.map((k, i) => {
            const done = pathIdx >= 0 ? i < pathIdx : false;
            const here = k === rec.status;
            return (
              <li key={k} className="flex min-w-0 flex-1 flex-col gap-1" aria-current={here ? "step" : undefined}>
                <span className={cx("h-1.5 rounded-full", here ? TONE[st.tone].bar : done ? "bg-harbor-300" : "bg-line")} />
                <span className={cx("truncate text-[10.5px]", here ? "font-semibold text-harbor-900" : "text-muted")}>{statusOf(res, k).label}</span>
              </li>
            );
          })}
          {pathIdx < 0 && (
            <li className="flex min-w-0 flex-1 flex-col gap-1" aria-current="step">
              <span className={cx("h-1.5 rounded-full", TONE[st.tone].bar)} />
              <span className="truncate text-[10.5px] font-semibold text-harbor-900">{st.label}</span>
            </li>
          )}
        </ol>
      </div>

      {/* Actions: always visible, never below the fold */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-mist/70 px-5 py-2.5">
        {available.length === 0 && !editable && (
          <span className="flex items-center gap-1.5 text-[12.5px] text-muted"><Check className="h-4 w-4 text-jade-600" /> {t("No action at this step. This {value0} is {value1}.", { value0: res.singular, value1: st.label.toLowerCase() })}{res.key === "invoices" && rec.balance > 0 ? ` ${t("Payments are allocated from Receipts and corrections use credit or debit notes.")}` : ""}</span>
        )}
        {available.map((a) => {
          const blocked = a.independent && involved;
          return (
            <SourceButton key={a.key} className={cx(BTN[a.tone], "btn-sm")} disabled={busy || blocked} onClick={() => start(a)}
              title={blocked ? t("A different person must do this: you created this record or moved it to this step.") : a.hint}>
              {a.independent && <ShieldCheck className="h-3.5 w-3.5" />}{a.label}
            </SourceButton>
          );
        })}
        {editable && !editing && <SourceButton className="btn-ghost btn-sm" onClick={() => { setDraft({ ...rec.values }); setEditing(true); setTab("details"); }}><Pencil className="h-3.5 w-3.5" /> <LocalizedText message="Edit" /></SourceButton>}
        {available.some((a) => a.independent) && involved && (
          <span className="basis-full text-[11.5px] text-muted"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-jade-600" /><LocalizedText message="Shielded actions need a second person: someone other than whoever created this or moved it to this step." /></span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-line px-4" role="tablist">
        {res.document && <Tab on={tab === "document"} onClick={() => setTab("document")} icon={<FileText className="h-3.5 w-3.5" />}><LocalizedText message="Document" /></Tab>}
        <Tab on={tab === "details"} onClick={() => setTab("details")} icon={<ListChecks className="h-3.5 w-3.5" />}><LocalizedText message="Details" /></Tab>
        <Tab on={tab === "activity"} onClick={() => setTab("activity")} icon={<History className="h-3.5 w-3.5" />}><LocalizedText message="Activity" /> <span className="ml-1 rounded-full bg-mist px-1.5 text-[10.5px]">{fmt.num(rec.timeline?.length ?? 0)}</span></Tab>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "document" && res.document && <DocumentPreview res={res} rec={rec} meta={meta} />}

        {tab === "details" && !editing && (
          <>
            {rec.reason && (
              <p className="mb-3 rounded-lg border border-saffron-100 bg-saffron-50 px-3 py-2 text-[12.5px] text-saffron-700">
                <span className="font-semibold"><LocalizedText message="Last reason:" /></span> {rec.reason}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
              {fields.filter((f) => !(f.readonly && isEmpty(rec.values[f.key]))).map((f) => (
                <div key={f.key} className={cx("min-w-0", (f.span === 2 || f.type === "textarea") && "col-span-2")}>
                  <dt className="text-[11px] font-semibold text-muted">{f.label}</dt>
                  <dd className="mt-0.5 text-[13px]"><FieldValue field={f} rec={rec} /></dd>
                </div>
              ))}
            </dl>
            {!res.document && lineFields.map((f) => (
              <div key={f.key} className="mt-4">
                <p className="mb-1.5 text-[11px] font-semibold text-muted">{f.label}</p>
                {isEmpty(rec.values[f.key]) ? <p className="text-[12.5px] text-muted"><LocalizedText message="None yet." /></p> : <FieldValue field={f} rec={rec} />}
              </div>
            ))}
          </>
        )}

        {tab === "details" && editing && (
          <div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {res.fields.filter((f) => !f.readonly).map((f) => (
                <div key={f.key} className={cx((f.span === 2 || f.type === "textarea" || f.type === "lines") && "col-span-2")}>
                  <label className="field-label" htmlFor={`ed-${f.key}`}>{f.label}{f.required && <span className="text-madder-500">*</span>}</label>
                  <FieldInput id={`ed-${f.key}`} field={f} value={draft[f.key]} labelHint={rec.labels[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} invalid={!!editErrors[f.key]} />
                  {editErrors[f.key] ? <p className="field-error">{editErrors[f.key]}</p> : f.help && <p className="field-help">{f.help}</p>}
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 -mx-5 mt-4 flex justify-end gap-2 border-t border-line bg-white px-5 py-3">
              <SourceButton className="btn-quiet" onClick={() => setEditing(false)} disabled={busy}><LocalizedText message="Cancel" /></SourceButton>
              <SourceButton className="btn-primary" onClick={save} disabled={busy}>{busy ? t("Saving…") : t("Save changes")}</SourceButton>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <ol className="relative space-y-3 border-l border-line pl-4">
            {(rec.timeline ?? []).map((ev) => {
              const toTone = ev.to ? statusOf(res, ev.to).tone : null;
              return (
                <li key={ev.id} className="relative">
                  <span className={cx("absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white", toTone ? TONE[toTone].dot : "bg-harbor-300")} />
                  <p className="text-[12.5px] leading-snug">{ev.summary}</p>
                  {ev.reason && <p className="mt-0.5 text-[12px] italic text-muted">“{ev.reason}”</p>}
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted"><Avatar user={user(ev.actorId)} size="xs" /> {user(ev.actorId)?.name} · <Clock3 className="h-3 w-3" /> {fmt.dateTime(ev.at)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {dialog && (
        <ActionDialog req={dialog} busy={busy} error={dlgErr?.msg} fieldErrors={dlgErr?.fields} onCancel={() => setDialog(null)} onConfirm={(input, reason) => void run(dialog.action, input, reason)} />
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-mist px-3 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cx("mt-0.5 truncate text-[14.5px] font-bold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function Tab({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <SourceButton role="tab" aria-selected={on} onClick={onClick} className={cx("relative flex items-center gap-1.5 px-2.5 py-2.5 text-[12.5px] font-semibold transition-colors", on ? "text-harbor-900" : "text-muted hover:text-harbor-800")}>
      {icon}{children}
      {on && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-signal-500" />}
    </SourceButton>
  );
}

function PaneSkeleton() {
  return (
    <div className="space-y-3 p-5" role="status" aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded bg-mist" />
      <div className="h-6 w-64 animate-pulse rounded bg-mist" />
      <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-mist" />)}</div>
      <div className="h-24 animate-pulse rounded-lg bg-mist" />
    </div>
  );
}
