"use client";
import { ArrowUpRight, CheckCheck, Hourglass, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink } from "@pepbits/reference-host";
import { ApiError, useApiClient } from "../../lib/api";
import { cx } from "../../lib/cx";
import { localizeRcmDefinitions } from "../../lib/metadata-localization";
import { useRcmFormat } from "../../lib/format";
import { Icon } from "../../lib/icons";
import type { ApprovalItem, RecordDto } from "../../lib/types";
import { useAction } from "../../lib/useAction";
import { rcmPaths } from "../../routes";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { SourceButton } from "../ui/controls";
import { useToast } from "../ui/Toast";
import { ActionDialog, type ActionRequest } from "../workspace/ActionDialog";
import { DashSkeleton, useDashboard } from "./useDashboard";

const BTN = { primary: "btn-primary", approve: "btn-approve", attention: "btn-attention", quiet: "btn-quiet", danger: "btn-danger" } as const;

/** Everything waiting for a second person, with the decision on the row. The server decides who may decide (`canDecide`) and enforces it again on the write. */
export function ApprovalsInbox() {
  const { meta, user, refreshPending } = useApp();
  const toast = useToast();
  const client = useApiClient();
  const fmt = useRcmFormat();
  const { t } = useLocalization();
  const { data, error } = useDashboard<ApprovalItem[]>("/approvals");
  const [scope, setScope] = useState<"mine" | "waiting">("mine");
  const [cat, setCat] = useState<string>("");
  const [dialog, setDialog] = useState<{ item: ApprovalItem; req: ActionRequest } | null>(null);
  const { busy, run: guard } = useAction();
  const [dlgErr, setDlgErr] = useState<{ msg: string; fields?: Record<string, string> } | null>(null);

  const localized = useMemo(() => (data ? localizeRcmDefinitions(data, t) : undefined), [data, t]);
  const items = useMemo(() => (localized ?? []).filter((i) => (scope === "mine" ? i.canDecide : !i.canDecide)), [localized, scope]);
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach((i) => { m[i.category] = (m[i.category] ?? 0) + 1; });
    return m;
  }, [items]);
  if (error) return <p role="alert" className="rounded-lg bg-madder-50 p-4 text-madder-700">{error}</p>;
  if (!data || !localized) return <DashSkeleton />;
  const shown = cat ? items.filter((i) => i.category === cat) : items;
  const mineCount = localized.filter((i) => i.canDecide).length;

  const run = (item: ApprovalItem, action: ApprovalItem["actions"][number], input: Record<string, any> = {}, reason = "") => guard(async () => {
    setDlgErr(null);
    try {
      const out = await client.post<RecordDto>(`/records/${item.resource}/${item.id}/actions/${action.key}`, { rowVersion: item.rowVersion, input, reason });
      setDialog(null);
      toast({ tone: "success", title: `${action.label}: ${item.ref}`, detail: out.timeline?.[0]?.summary });
      refreshPending();
    } catch (e) {
      const err = e as ApiError;
      if (dialog) setDlgErr({ msg: err.message, fields: err.fieldErrors });
      else toast({ tone: "error", title: t("Couldn’t {value0}", { value0: action.label.toLowerCase() }), detail: err.message });
      if (err.code === "STALE_VERSION") refreshPending();
    }
  });
  const start = (item: ApprovalItem, a: ApprovalItem["actions"][number]) => {
    if (a.inputs?.length || a.reason || a.tone === "danger") {
      setDlgErr(null);
      setDialog({ item, req: { action: { key: a.key, label: a.label, tone: a.tone, reason: a.reason ?? undefined, inputs: a.inputs ?? undefined, independent: true }, subject: `${item.resourceLabel} · ${item.ref}` } });
    } else void run(item, a);
  };

  return (
    <div className="grid h-full min-h-0 grid-cols-[250px_minmax(0,1fr)] gap-3">
      <aside className="panel flex min-h-0 flex-col p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-mist p-1" role="tablist">
          <SourceButton role="tab" aria-selected={scope === "mine"} onClick={() => { setScope("mine"); setCat(""); }} className={cx("rounded-lg px-2 py-1.5 text-[12px] font-semibold", scope === "mine" ? "bg-white shadow-sm" : "text-muted")}>{t("For me · {value0}", { value0: fmt.num(mineCount) })}</SourceButton>
          <SourceButton role="tab" aria-selected={scope === "waiting"} onClick={() => { setScope("waiting"); setCat(""); }} className={cx("rounded-lg px-2 py-1.5 text-[12px] font-semibold", scope === "waiting" ? "bg-white shadow-sm" : "text-muted")}>{t("Waiting · {value0}", { value0: fmt.num(localized.length - mineCount) })}</SourceButton>
        </div>
        <p className="px-1 pb-2 pt-3 text-[11.5px] leading-snug text-muted">
          <LocalizedText message={scope === "mine" ? "Steps someone else started. You can decide them." : "Steps you started or moved. Someone else has to decide them."} />
        </p>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          <CatRow on={!cat} onClick={() => setCat("")} icon="Inbox" label={t("All workflows")} n={items.length} />
          {meta.categories.filter((c) => byCat[c.key]).map((c) => <CatRow key={c.key} on={cat === c.key} onClick={() => setCat(c.key)} icon={c.icon} label={c.label} n={byCat[c.key]} />)}
        </ul>
      </aside>

      <section className="panel flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold"><LocalizedText message={scope === "mine" ? "Ready for your decision" : "Waiting on a colleague"} /></h2>
            <p className="text-[11.5px] text-muted"><LocalizedText message="Oldest first. Decisions are final and recorded with your name." /></p>
          </div>
          <span className="flex items-center gap-1.5 rounded-lg bg-jade-50 px-2.5 py-1 text-[11.5px] font-semibold text-jade-700"><ShieldCheck className="h-3.5 w-3.5" /> <LocalizedText message="Segregation of duties enforced by the server" /></span>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {shown.length === 0 && (
            <li className="flex flex-col items-center px-6 py-16 text-center">
              <CheckCheck className="h-8 w-8 text-jade-600" />
              <p className="mt-2 font-display text-[16px] font-semibold"><LocalizedText message="Nothing waiting" /></p>
              <p className="mt-1 text-[12.5px] text-muted"><LocalizedText message={scope === "mine" ? "You are all caught up." : "None of your requests are pending."} /></p>
            </li>
          )}
          {shown.map((i) => (
            <li key={`${i.resource}-${i.id}`} className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 hover:bg-mist/60">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-harbor-50 text-harbor-700"><Icon name={i.icon} className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 text-[12px]">
                  <span className="font-semibold text-muted">{i.resourceLabel}</span>
                  <ReferenceLink href={rcmPaths.resource(i.resource, { open: i.id })} className="inline-flex items-center gap-0.5 font-mono font-semibold text-harbor-800 hover:text-signal-700">{i.ref}<ArrowUpRight className="h-3 w-3" /></ReferenceLink>
                  <span className="rounded-full bg-saffron-50 px-1.5 text-[10.5px] font-semibold text-saffron-700">{i.statusLabel}</span>
                </p>
                <p className="truncate text-[13px] font-semibold">{i.patient ?? i.title}{i.patient && i.title && <span className="font-normal text-muted"> · {i.title}</span>}</p>
                <p className="flex items-center gap-1.5 truncate text-[11.5px] text-muted">
                  <Avatar user={user(i.requestedBy)} size="xs" /> {user(i.requestedBy)?.name} · {fmt.relative(i.requestedAt)}
                  {i.reason && <span className="truncate italic">· “{i.reason}”</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {i.amount > 0 && <span className="mr-2 text-right text-[13px] font-semibold tabular-nums">{fmt.money(i.amount, i.currency)}</span>}
                {i.canDecide ? i.actions.map((a) => (
                  <SourceButton key={a.key} disabled={busy} onClick={() => start(i, a)} className={cx(BTN[a.tone], "btn-sm")}>{a.label}</SourceButton>
                )) : <span className="flex items-center gap-1 text-[11.5px] text-muted"><Hourglass className="h-3.5 w-3.5" /> <LocalizedText message="Needs someone else" /></span>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {dialog && <ActionDialog req={dialog.req} busy={busy} error={dlgErr?.msg} fieldErrors={dlgErr?.fields} onCancel={() => setDialog(null)}
        onConfirm={(input, reason) => void run(dialog.item, dialog.item.actions.find((a) => a.key === dialog.req.action.key)!, input, reason)} />}
    </div>
  );
}

function CatRow({ on, onClick, icon, label, n }: { on: boolean; onClick: () => void; icon: string; label: string; n: number }) {
  const fmt = useRcmFormat();
  return (
    <li>
      <SourceButton onClick={onClick} aria-pressed={on} className={cx("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px]", on ? "bg-harbor-900 font-semibold text-white" : "hover:bg-mist")}>
        <Icon name={icon} className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className={cx("rounded-full px-1.5 text-[11px] font-bold", on ? "bg-white/20" : "bg-mist text-muted")}>{fmt.num(n)}</span>
      </SourceButton>
    </li>
  );
}
