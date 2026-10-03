"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, CopyPlus, History, Lock, Save, Send, Trash2, Undo2, XCircle } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { useReferenceHost } from "@pepbits/reference-host";
import { ApiError, useApiClient, useRefreshAll } from "../../lib/api";
import { cx } from "../../lib/cx";
import { todayIso, useTenantFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";
import { Icon } from "../../lib/icons";
import type { AuditEvent, FieldDef, RecordData, RecordDto, ResourceDef } from "../../lib/types";
import { FieldInput } from "../form/FieldInput";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { ConfirmDialog, type ConfirmRequest } from "../ui/ConfirmDialog";
import { ReasonDialog, type ReasonRequest } from "../ui/ReasonDialog";
import { StatusPill } from "../ui/StatusPill";
import { SourceButton, SourceDateInput, SourceInput } from "../ui/controls";
import { SideDrawer } from "../ui/dialog";
import { useToast } from "../ui/Toast";
import { LifecycleTrack } from "./LifecycleTrack";

interface FormState { code: string; name: string; effectiveFrom: string; effectiveUntil: string; reason: string; data: RecordData }
type Action = "submit" | "approve" | "reject" | "withdraw" | "retire" | "new-version" | "activate" | "deactivate";

const GENERAL = "General";
const HEAD_KEYS = ["code", "name", "effectiveFrom", "effectiveUntil", "reason"];
const DONE_MESSAGE: Record<Exclude<Action, "new-version">, string> = {
  submit: "Submitted for approval", approve: "Approved", reject: "Returned for changes", withdraw: "Withdrawn to draft",
  retire: "Retired", activate: "Activated", deactivate: "Deactivated",
};

const blankForm = (res: ResourceDef): FormState => {
  const data: RecordData = {};
  for (const f of res.fields) if (f.type === "boolean" && ["enabled", "billable", "humanReviewRequired", "postingAllowed"].includes(f.key)) data[f.key] = true;
  if (res.key === "billing-policies") data.scope = "TENANT";
  return { code: "", name: "", effectiveFrom: res.effectiveDated ? todayIso() : "", effectiveUntil: "", reason: "", data };
};

const toForm = (r: RecordDto): FormState => ({
  code: r.code, name: r.name, effectiveFrom: r.effectiveFrom ?? "", effectiveUntil: r.effectiveUntil ?? "", reason: r.changeReason ?? "", data: structuredClone(r.data),
});

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The record drawer on the shared Drawer: details form, history and revisions, and the governed lifecycle actions. Every call
 * carries the host session; the server decides who may submit, approve or retire, and refuses an approval by the author or
 * submitter. The buttons mirror that rule from `actor` only so a refusal is explained before it happens.
 */
export function RecordDrawer({ res, recordId, onClose, onChanged, onOpen }: {
  res: ResourceDef; recordId: number | "new"; onClose: () => void; onChanged: (rec?: RecordDto) => void; onOpen: (id: number) => void;
}) {
  const { actor, user } = useApp();
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const toast = useToast();
  const { preferences } = useReferenceHost();
  const isNew = recordId === "new";
  const [rec, setRec] = useState<RecordDto | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(res));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"details" | "history">("details");
  const [section, setSection] = useState(GENERAL);
  const [ask, setAsk] = useState<(ReasonRequest & { action: Action }) | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [history, setHistory] = useState<AuditEvent[] | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const working = useRef(false);

  const loadedId = useRef<number | null>(null);
  const loadFlight = useRef<AbortController | null>(null);
  useEffect(() => () => loadFlight.current?.abort(), []);
  const load = useCallback(async (id: number) => {
    loadFlight.current?.abort();
    const controller = (loadFlight.current = new AbortController());
    setLoading(true); setLoadError(null);
    try {
      const r = await api.get<RecordDto>(`/resources/${encodeURIComponent(res.key)}/${id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setRec(r); setForm(toForm(r)); setDirty(false); setErrors({}); setHistory(null);
      loadedId.current = r.id;
    } catch (e) {
      if (!controller.signal.aborted) setLoadError((e as Error).message);
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [api, res.key]);

  useEffect(() => {
    // A record created in this drawer is already loaded; keep its state (including errors).
    if (recordId !== "new" && loadedId.current === recordId) return;
    setTab("details"); setSection(res.sections?.[0] ?? GENERAL);
    if (recordId === "new") { loadFlight.current?.abort(); setRec(null); setForm(blankForm(res)); setDirty(false); setErrors({}); setLoading(false); setLoadError(null); }
    else void load(recordId);
  }, [recordId, res, load]);

  const code = rec?.code;
  useEffect(() => {
    if (tab !== "history" || !code || history) return;
    const controller = new AbortController();
    api.get<AuditEvent[]>(`/audit?resource=${encodeURIComponent(res.key)}&code=${encodeURIComponent(code)}&limit=100`, { signal: controller.signal })
      .then((h) => { if (!controller.signal.aborted) setHistory(h); })
      .catch(() => { if (!controller.signal.aborted) setHistory([]); });
    return () => controller.abort();
  }, [api, tab, code, history, res.key]);

  const versioned = res.governance === "versioned";
  const editable = isNew || !versioned || (rec ? ["DRAFT", "REJECTED"].includes(rec.status) : false);
  const isBranchPolicy = res.key === "billing-policies" && form.data.scope === "BRANCH";

  const sections = useMemo(() => res.sections ?? [GENERAL], [res.sections]);
  const HEAD = sections[0];
  const fieldsFor = (s: string): FieldDef[] =>
    res.fields.filter((f) => (res.sections ? f.section === s : true) && !(isBranchPolicy && f.tenantOnly));
  const keysFor = (s: string) => {
    const keys = new Set(fieldsFor(s).map((f) => f.key));
    if (s === HEAD) HEAD_KEYS.forEach((k) => keys.add(k));
    return keys;
  };
  const errorCount = (s: string) => { const keys = keysFor(s); return Object.keys(errors).filter((k) => keys.has(k)).length; };

  const setField = (key: string, v: unknown) => {
    setForm((f) => ({ ...f, data: { ...f.data, [key]: v } }));
    setDirty(true);
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };
  const setHead = (key: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setDirty(true);
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  const showError = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.fieldErrors) {
      const fieldErrors = e.fieldErrors;
      setErrors(fieldErrors);
      const first = sections.find((s) => { const keys = keysFor(s); return Object.keys(fieldErrors).some((k) => keys.has(k)); });
      if (first) { setTab("details"); setSection(first); }
    }
    toast({ tone: "error", title: fallback, detail: (e as Error).message });
  };

  const payload = () => {
    const data: RecordData = {};
    for (const [k, v] of Object.entries(form.data)) {
      if (isBranchPolicy && res.fields.find((f) => f.key === k)?.tenantOnly) continue;
      if (v !== "" && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) data[k] = v;
    }
    return { code: form.code || undefined, name: form.name, effectiveFrom: form.effectiveFrom || null, effectiveUntil: form.effectiveUntil || null, reason: form.reason || null, data };
  };

  // One mutation at a time: a second click or shortcut while one is running is ignored (state is stale within the same tick).
  const exclusive = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (working.current) return undefined;
    working.current = true;
    setBusy(true);
    try { return await fn(); } finally { working.current = false; setBusy(false); }
  };

  const afterChange = (r?: RecordDto) => { void refreshAll(); onChanged(r); };
  const base = `/resources/${encodeURIComponent(res.key)}`;

  const saveRecord = async (quiet = false): Promise<RecordDto | null> => {
    try {
      const r = isNew
        ? await api.post<RecordDto>(base, payload())
        : await api.put<RecordDto>(`${base}/${rec!.id}`, { ...payload(), rowVersion: rec!.rowVersion });
      setRec(r); setForm(toForm(r)); setDirty(false); setErrors({}); setHistory(null);
      loadedId.current = r.id;
      if (!quiet) toast({ tone: "success", title: isNew ? t("{value0} created", { value0: capital(res.singular) }) : t("Changes saved"), detail: t(versioned && r.status === "DRAFT" ? "{value0} is saved as a draft." : "{value0} is up to date.", { value0: r.code }) });
      afterChange(r);
      return r;
    } catch (e) {
      showError(e, isNew ? t("Couldn’t create the {value0}", { value0: res.singular }) : t("Couldn’t save changes"));
      return null;
    }
  };
  const save = (quiet = false) => exclusive(() => saveRecord(quiet));

  const run = (action: Action, reason?: string) => exclusive(async () => {
    let current = rec;
    if (action === "submit" && (dirty || isNew)) { current = await saveRecord(true); if (!current) { setAsk(null); return; } }
    if (!current) return;
    try {
      const r = await api.post<RecordDto>(`${base}/${current.id}/${action}`, { rowVersion: current.rowVersion, reason });
      setAsk(null);
      toast({ tone: "success", title: action === "new-version" ? t("Revision {value0} started", { value0: r.revision }) : t(DONE_MESSAGE[action]), detail: `${r.code} ${r.name}` });
      afterChange(r);
      if (r.id !== current.id) onOpen(r.id);
      else { setRec(r); setForm(toForm(r)); setDirty(false); setErrors({}); setHistory(null); }
    } catch (e) {
      setAsk(null);
      if (e instanceof ApiError && e.code === "STALE_VERSION") { toast({ tone: "error", title: t("This record changed"), detail: e.message }); void load(current.id); }
      else showError(e, t(action === "submit" ? "Saved as a draft, not submitted yet" : "That action didn’t go through"));
    }
  });

  const discard = () => exclusive(async () => {
    if (!rec) return;
    setConfirm(null);
    try {
      await api.delete(`${base}/${rec.id}?rowVersion=${rec.rowVersion}`);
      toast({ tone: "success", title: t("Draft discarded"), detail: rec.code });
      afterChange();
      onClose();
    } catch (e) { showError(e, t("Couldn’t discard the draft")); }
  });

  const requestClose = useCallback(() => {
    if (dirty) { setConfirm({ title: t("Unsaved changes"), body: t("You have unsaved changes. Close without saving?"), confirm: t("Close without saving"), tone: "danger", onConfirm: () => { setConfirm(null); onClose(); } }); return; }
    onClose();
  }, [dirty, onClose, t]);

  // Ctrl/Cmd+S saves, only while shortcuts are on, the form is editable and nothing else is open or running.
  useHotkeys(editable && !busy && !ask && !confirm && !loading && !loadError ? { "mod+s": () => { void save(); } } : {}, [editable, busy, ask, confirm, loading, loadError, dirty, form, rec], { allowInInputs: true });

  const selfInvolved = rec ? actor.id === rec.createdBy || actor.id === rec.submittedBy : false;

  const askFor = (action: Action) => {
    const R: Partial<Record<Action, ReasonRequest>> = {
      submit: { title: t("Submit for approval"), body: t("Another administrator will review this version. You can withdraw it until it is decided."), confirm: t("Submit for approval"), tone: "attention", required: false, placeholder: t("What changed and why") },
      approve: { title: t("Approve this version"), body: rec?.effectiveFrom ? t("Revision {value0} becomes effective on {value1}. Approved versions are immutable.", { value0: rec.revision, value1: fmt.date(rec.effectiveFrom) }) : t("Revision {value0} becomes effective. Approved versions are immutable.", { value0: rec?.revision ?? "" }), confirm: t("Approve"), tone: "approve", required: false, placeholder: t("Optional approval note") },
      reject: { title: t("Return for changes"), body: t("The author sees your reason and can edit and resubmit."), confirm: t("Return for changes"), tone: "danger", required: true, placeholder: t("What needs to change") },
      retire: { title: t("Retire this version"), body: t("It stops applying from today. History and documents that used it keep their snapshot."), confirm: t("Retire"), tone: "danger", required: true, placeholder: t("Why it is being retired") },
      "new-version": { title: t("Start a new version"), body: t("A draft copy is created as the next revision. This version stays in force until the new one is approved."), confirm: t("Start new version"), tone: "primary", required: false, placeholder: t("What you intend to change") },
      deactivate: { title: t("Deactivate"), body: t("It will no longer be offered for new configuration. Existing references are kept."), confirm: t("Deactivate"), tone: "danger", required: false },
    };
    const r = R[action];
    if (r) setAsk({ ...r, action }); else void run(action);
  };

  const title = isNew ? t("New {value0}", { value0: res.singular }) : capital(res.singular);
  const heading = form.name || (isNew ? title : rec?.name ?? t("Loading…"));
  const codePlaceholder = `${res.codePrefix}-0001`;
  const shortcutsOn = preferences.keyboardShortcuts !== false && editable;
  const sectionBox = (s: string) => (
    <div className="ta-fields-box">
      <div className="ta-fields">
        {s === HEAD && (
          <>
            <Field label="Name" required error={errors.name} id="f-name" span={2}>
              <SourceInput id="f-name" className={cx("input", errors.name && "input-invalid")} value={form.name} disabled={!editable} onChange={(e) => setHead("name", e.target.value)} placeholder={t("Name this {value0}", { value0: res.singular })} autoFocus={isNew} />
            </Field>
            <Field label="Code" error={errors.code} id="f-code" help={isNew ? t("Leave empty to assign the next {value0} number.", { value0: res.codePrefix }) : t("Codes never change after creation.")}>
              <SourceInput id="f-code" className={cx("input uppercase", errors.code && "input-invalid")} value={form.code} disabled={!isNew} onChange={(e) => setHead("code", e.target.value.toUpperCase())} placeholder={codePlaceholder} />
            </Field>
            {res.effectiveDated ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Effective from" required error={errors.effectiveFrom} id="f-ef">
                  <SourceDateInput id="f-ef" className={cx("input", errors.effectiveFrom && "input-invalid")} value={form.effectiveFrom} disabled={!editable} onChange={(e) => setHead("effectiveFrom", e.target.value)} />
                </Field>
                <Field label="Effective until" error={errors.effectiveUntil} id="f-eu">
                  <SourceDateInput id="f-eu" className={cx("input", errors.effectiveUntil && "input-invalid")} value={form.effectiveUntil} disabled={!editable} onChange={(e) => setHead("effectiveUntil", e.target.value)} />
                </Field>
              </div>
            ) : <div className="ta-spacer" />}
          </>
        )}
        {fieldsFor(s).map((f) => (
          <FormField key={f.key} f={f} value={form.data[f.key]} error={errors[f.key]} disabled={!editable} onChange={(v) => setField(f.key, v)} relaxed={isBranchPolicy} />
        ))}
        {s === HEAD && versioned && (
          <Field label="Change reason" id="f-reason" span={2} help={t("Recorded in the audit trail with this version.")}>
            <SourceInput id="f-reason" className="input" value={form.reason} disabled={!editable} onChange={(e) => setHead("reason", e.target.value)} placeholder="For example: annual tariff review" />
          </Field>
        )}
      </div>
    </div>
  );

  const footer = (
    <>
      {selfInvolved && rec?.status === "PENDING_APPROVAL" && (
        <p className="mr-auto flex items-center gap-2 text-[12.5px] text-muted">
          <AlertTriangle className="h-4 w-4 text-saffron-600" /> <LocalizedText message={actor.id === rec.submittedBy ? "You submitted this, so someone else must decide it." : "You created this, so someone else must decide it."} />
        </p>
      )}
      {!(selfInvolved && rec?.status === "PENDING_APPROVAL") && <span className="mr-auto text-[11.5px] text-muted"><LocalizedText message={shortcutsOn ? "Ctrl+S saves. Esc closes." : "Esc closes."} /></span>}

      {isNew && (
        <>
          <SourceButton className="btn-quiet" onClick={requestClose} disabled={busy}><LocalizedText message="Cancel" /></SourceButton>
          {versioned && <SourceButton className="btn-quiet" onClick={() => void save()} disabled={busy}><Save className="h-4 w-4" /> <LocalizedText message="Save draft" /></SourceButton>}
          {versioned
            ? <SourceButton className="btn-attention" onClick={() => askFor("submit")} disabled={busy}><Send className="h-4 w-4" /> <LocalizedText message="Save and submit" /></SourceButton>
            : <SourceButton className="btn-primary" onClick={() => void save()} disabled={busy}><Save className="h-4 w-4" /> {t("Create {value0}", { value0: res.singular })}</SourceButton>}
        </>
      )}

      {!isNew && rec && versioned && ["DRAFT", "REJECTED"].includes(rec.status) && (
        <>
          <SourceButton className="btn-danger" onClick={() => setConfirm({ title: t("Discard draft"), body: t("Discard draft {value0}? This cannot be undone.", { value0: rec.code }), confirm: t("Discard draft"), tone: "danger", onConfirm: () => void discard() })} disabled={busy}><Trash2 className="h-4 w-4" /> <LocalizedText message="Discard draft" /></SourceButton>
          <SourceButton className="btn-quiet" onClick={() => void save()} disabled={busy || !dirty}><Save className="h-4 w-4" /> <LocalizedText message="Save draft" /></SourceButton>
          <SourceButton className="btn-attention" onClick={() => askFor("submit")} disabled={busy}><Send className="h-4 w-4" /> <LocalizedText message="Submit for approval" /></SourceButton>
        </>
      )}

      {!isNew && rec?.status === "PENDING_APPROVAL" && (
        <>
          {actor.id === rec.submittedBy && <SourceButton className="btn-quiet" onClick={() => void run("withdraw")} disabled={busy}><Undo2 className="h-4 w-4" /> <LocalizedText message="Withdraw" /></SourceButton>}
          <SourceButton className="btn-danger" onClick={() => askFor("reject")} disabled={busy || selfInvolved}><XCircle className="h-4 w-4" /> <LocalizedText message="Return for changes" /></SourceButton>
          <SourceButton className="btn-approve" onClick={() => askFor("approve")} disabled={busy || selfInvolved} title={selfInvolved ? t("Independent approval required") : undefined}><CheckCircle2 className="h-4 w-4" /> <LocalizedText message="Approve" /></SourceButton>
        </>
      )}

      {!isNew && rec?.status === "APPROVED" && (
        <>
          <SourceButton className="btn-danger" onClick={() => askFor("retire")} disabled={busy}><Archive className="h-4 w-4" /> <LocalizedText message="Retire" /></SourceButton>
          <SourceButton className="btn-primary" onClick={() => askFor("new-version")} disabled={busy}><CopyPlus className="h-4 w-4" /> <LocalizedText message="New version" /></SourceButton>
        </>
      )}
      {!isNew && rec && ["RETIRED", "SUPERSEDED"].includes(rec.status) && (
        <SourceButton className="btn-quiet" onClick={() => setTab("history")}><History className="h-4 w-4" /> <LocalizedText message="See newer revisions" /></SourceButton>
      )}

      {!isNew && rec && !versioned && (
        <>
          {rec.status === "ACTIVE"
            ? <SourceButton className="btn-danger" onClick={() => askFor("deactivate")} disabled={busy}><LocalizedText message="Deactivate" /></SourceButton>
            : <SourceButton className="btn-quiet" onClick={() => void run("activate")} disabled={busy}><LocalizedText message="Activate" /></SourceButton>}
          <SourceButton className="btn-primary" onClick={() => void save()} disabled={busy || !dirty}><Save className="h-4 w-4" /> <LocalizedText message="Save changes" /></SourceButton>
        </>
      )}
    </>
  );

  return (
    <>
      <SideDrawer open onClose={requestClose} title={title} footer={footer}>
        {/* Header */}
        <div className="border-b border-line px-6 pb-4 pt-4">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-spruce-900 text-saffron-400">
              <Icon name={res.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                <span className="font-semibold text-spruce-800">{rec?.code ?? `${res.codePrefix}-auto`}</span>
                {rec && versioned && <span><LocalizedText message="Revision {value0}" values={{ value0: rec.revision }} /></span>}
                {rec && <StatusPill status={rec.status} />}
                {dirty && <span className="rounded bg-saffron-50 px-1.5 font-semibold text-saffron-700"><LocalizedText message="Unsaved changes" /></span>}
              </div>
              <p className="mt-1 truncate text-[21px] font-semibold leading-tight">{heading}</p>
            </div>
          </div>
          {versioned && <div className="mt-4"><LifecycleTrack record={rec} user={user} /></div>}
        </div>

        {/* Banners */}
        {rec?.status === "REJECTED" && rec.decisionReason && (
          <div className="flex items-start gap-3 border-b border-madder-100 bg-madder-50 px-6 py-2.5 text-[12.5px] text-madder-700">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p><span className="font-semibold"><LocalizedText message="Returned by {value0}:" values={{ value0: user(rec.decidedBy)?.name ?? "—" }} /></span> {rec.decisionReason}</p>
          </div>
        )}
        {!editable && rec && (
          <div className="flex items-center gap-3 border-b border-line bg-mist px-6 py-2.5 text-[12.5px] text-muted">
            <Lock className="h-4 w-4 shrink-0 text-spruce-500" />
            <LocalizedText message={rec.status === "PENDING_APPROVAL"
              ? "Locked while awaiting a decision. Withdraw it to make changes."
              : "This version is locked. Start a new version to change it; this one stays in force until the new one is approved."} />
          </div>
        )}
        {isBranchPolicy && editable && (
          <div className="flex items-start gap-3 border-b border-cobalt-100 bg-cobalt-50 px-6 py-2.5 text-[12.5px] text-cobalt-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <LocalizedText message="Branch overrides only carry the keys the tenant default lets branches change. Leave everything else empty so the tenant value applies." />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-line px-6">
          {(["details", "history"] as const).map((k) => (
            <SourceButton key={k} disabled={k === "history" && isNew} onClick={() => setTab(k)}
              className={cx("relative px-3 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-40", tab === k ? "text-spruce-950" : "text-muted hover:text-spruce-800")}>
              <LocalizedText message={k === "details" ? "Details" : "History and versions"} />
              {tab === k && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded bg-spruce-900" />}
            </SourceButton>
          ))}
          {rec && <span className="ml-auto text-[11.5px] text-muted"><LocalizedText message="Updated {value0} by {value1}" values={{ value0: fmt.relative(rec.updatedAt), value1: user(rec.updatedBy)?.name ?? "—" }} /></span>}
        </div>

        {/* Body */}
        <div className="relative flex min-h-0 flex-1">
          {loading && <div role="status" className="flex flex-1 items-center justify-center text-muted"><LocalizedText message="Loading record…" /></div>}
          {loadError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p role="alert" className="font-semibold"><LocalizedText message={loadError} /></p>
              <SourceButton className="btn-quiet" onClick={onClose}><LocalizedText message="Close" /></SourceButton>
            </div>
          )}

          {!loading && !loadError && tab === "details" && (
            <>
              {sections.length > 1 && (
                <nav className="w-[184px] shrink-0 overflow-y-auto border-r border-line bg-mist/60 p-3" aria-label={t("Form sections")}>
                  {sections.map((s) => {
                    const n = errorCount(s);
                    return (
                      <SourceButton key={s} onClick={() => { setSection(s); bodyRef.current?.scrollTo?.({ top: 0 }); }}
                        className={cx("flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                          section === s ? "bg-white font-semibold text-spruce-950 shadow-[0_0_0_1px_#D5DDDA]" : "text-spruce-800 hover:bg-white/70")}>
                        <span className="truncate"><LocalizedText message={s} /></span>
                        {n > 0 && <span className="rounded-full bg-madder-600 px-1.5 text-[10.5px] font-bold text-white">{n}</span>}
                      </SourceButton>
                    );
                  })}
                </nav>
              )}
              <div ref={bodyRef} className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
                {sectionBox(section)}
              </div>
            </>
          )}

          {!loading && !loadError && tab === "history" && rec && (
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_260px]">
              <div className="min-h-0 overflow-y-auto px-6 py-5">
                <p className="mb-3 text-[13px] font-semibold"><LocalizedText message="Audit trail for {value0}" values={{ value0: rec.code }} /></p>
                {!history && <p className="text-muted"><LocalizedText message="Loading…" /></p>}
                {history?.length === 0 && <p className="text-muted"><LocalizedText message="No events recorded." /></p>}
                <ol className="relative space-y-4 border-l border-line pl-5">
                  {history?.map((h) => (
                    <li key={h.id} className="relative">
                      <span className={cx("absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-white", dotFor(h.action))} />
                      <div className="flex items-center gap-2 text-[12px] text-muted">
                        <Avatar user={user(h.actorId)} size="sm" />
                        <span className="font-semibold text-spruce-900">{user(h.actorId)?.name}</span>
                        <span>{fmt.dateTime(h.at)}</span>
                      </div>
                      <p className="mt-1 text-[13px]"><LocalizedText message={h.summary} /></p>
                      {h.reason && <p className="mt-0.5 text-[12.5px] italic text-muted">“{h.reason}”</p>}
                    </li>
                  ))}
                </ol>
              </div>
              <aside className="min-h-0 overflow-y-auto border-l border-line bg-mist/60 p-4">
                <p className="mb-2 text-[13px] font-semibold"><LocalizedText message="Revisions" /></p>
                <ul className="space-y-1.5">
                  {rec.revisions?.map((v) => (
                    <li key={v.id}>
                      <SourceButton onClick={() => v.id !== rec.id && onOpen(v.id)} className={cx("w-full rounded-lg border px-3 py-2 text-left", v.id === rec.id ? "border-spruce-300 bg-white" : "border-transparent hover:border-line hover:bg-white")}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold"><LocalizedText message="Revision {value0}" values={{ value0: v.revision }} /></span>
                          <StatusPill status={v.status} />
                        </div>
                        <p className="mt-1 text-[11.5px] text-muted"><LocalizedText message={v.effective_from ? "From {value0}" : "No effective date yet"} values={{ value0: fmt.date(v.effective_from) }} /></p>
                      </SourceButton>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          )}
        </div>
      </SideDrawer>
      {ask && <ReasonDialog req={ask} busy={busy} onCancel={() => setAsk(null)} onConfirm={(reason) => void run(ask.action, reason || undefined)} />}
      {confirm && <ConfirmDialog req={confirm} busy={busy} onCancel={() => setConfirm(null)} />}
    </>
  );
}

function FormField({ f, value, error, disabled, onChange, relaxed }: { f: FieldDef; value: any; error?: string; disabled: boolean; onChange: (v: any) => void; relaxed?: boolean }) {
  const wide = f.span === 2 || f.type === "lines" || f.type === "textarea";
  return (
    <Field label={f.label} required={f.required && (!relaxed || f.alwaysRequired)} error={error} help={f.help} id={`f-${f.key}`} span={wide ? 2 : 1}>
      <FieldInput id={`f-${f.key}`} field={f} value={value} onChange={onChange} disabled={disabled} invalid={Boolean(error)} />
    </Field>
  );
}

function Field({ label, required, error, help, id, span = 1, children }: { label: string; required?: boolean; error?: string; help?: string; id: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div className={cx(span === 2 && "ta-span-2")}>
      <label className="field-label" htmlFor={id}><LocalizedText message={label} />{required && <span className="text-madder-500" aria-hidden>*</span>}</label>
      {children}
      {error ? <p className="field-error" role="alert"><LocalizedText message={error} /></p> : help ? <p className="field-help"><LocalizedText message={help} /></p> : null}
    </div>
  );
}

function dotFor(action: string) {
  if (action === "APPROVED" || action === "ACTIVATED") return "bg-jade-500";
  if (action === "SUBMITTED") return "bg-saffron-500";
  if (action === "REJECTED" || action === "RETIRED" || action === "DISCARDED" || action === "DEACTIVATED") return "bg-madder-500";
  return "bg-cobalt-500";
}
