"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Inbox, RefreshCw, XCircle } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink } from "@pepbits/reference-host";
import { useApi, useApiClient, useRefreshAll } from "../../lib/api";
import { cx } from "../../lib/cx";
import { useTenantFormat } from "../../lib/format";
import { Icon } from "../../lib/icons";
import { tenantAdminPaths } from "../../routes";
import { useApp } from "../shell/context";
import { Avatar } from "../ui/Avatar";
import { ReasonDialog, type ReasonRequest } from "../ui/ReasonDialog";
import { Card, SourceButton } from "../ui/controls";
import { useToast } from "../ui/Toast";

interface Item { resource: string; resourceLabel: string; category: string; id: number; code: string; name: string; revision: number; rowVersion: number; effectiveFrom: string | null; submittedBy: number; submittedAt: string; createdBy: number; changeReason: string | null }

const FILTERS = [{ key: "decide", label: "For you to decide" }, { key: "mine", label: "Your submissions" }, { key: "all", label: "Everything" }] as const;

/** Governed changes waiting for a decision. The server refuses a decision by the author or submitter; the buttons only mirror that. */
export function ApprovalsInbox() {
  const { actor, user, resource } = useApp();
  const { t } = useLocalization();
  const fmt = useTenantFormat();
  const toast = useToast();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const list = useApi<Item[]>("/approvals", { revalidateOnFocus: false });
  const items = list.data ?? null;
  const [filter, setFilter] = useState<"decide" | "mine" | "all">("decide");
  const [ask, setAsk] = useState<(ReasonRequest & { item: Item; action: "approve" | "reject" }) | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  const loadError = list.error;
  useEffect(() => { if (loadError) toast({ tone: "error", title: t("Couldn’t load approvals"), detail: loadError.message }); }, [loadError, toast, t]);

  const involvedIn = (i: Item) => i.submittedBy === actor.id || i.createdBy === actor.id;
  const shown = useMemo(() => (items ?? []).filter((i) => {
    const involved = i.submittedBy === actor.id || i.createdBy === actor.id;
    return filter === "all" ? true : filter === "mine" ? involved : !involved;
  }), [items, filter, actor]);

  const counts = useMemo(() => {
    const all = items ?? [];
    const mine = all.filter((i) => i.submittedBy === actor.id || i.createdBy === actor.id).length;
    return { decide: all.length - mine, mine, all: all.length };
  }, [items, actor]);

  const decide = async (reason: string) => {
    if (!ask || working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await api.post(`/resources/${encodeURIComponent(ask.item.resource)}/${ask.item.id}/${ask.action}`, { rowVersion: ask.item.rowVersion, reason: reason || undefined });
      toast({ tone: "success", title: t(ask.action === "approve" ? "Approved" : "Returned for changes"), detail: `${ask.item.code} ${ask.item.name}` });
      setAsk(null); void refreshAll();
    } catch (e) {
      toast({ tone: "error", title: t("That decision didn’t go through"), detail: (e as Error).message });
      setAsk(null); void list.mutate();
    } finally { working.current = false; setBusy(false); }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] text-muted">
          <LocalizedText message="Every governed change needs a decision from someone other than its author or submitter. Approved versions become immutable on approval." />
        </p>
        <div className="flex rounded-lg border border-line bg-white p-0.5" role="tablist" aria-label={t("Approvals")}>
          {FILTERS.map(({ key: k, label }) => (
            <SourceButton key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={cx("flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold", filter === k ? "bg-spruce-900 text-white" : "text-spruce-800 hover:bg-mist")}>
              <LocalizedText message={label} /><span className={cx("rounded px-1 text-[11px]", filter === k ? "bg-white/15" : "text-muted")}>{fmt.int(counts[k])}</span>
            </SourceButton>
          ))}
        </div>
        <SourceButton className="btn-ghost btn-sm" onClick={() => void list.mutate()}><RefreshCw className="h-4 w-4" /> <LocalizedText message="Refresh" /></SourceButton>
      </div>

      <Card shadow="none" tone="transparent" className="panel min-h-0 flex-1 overflow-auto">
        {items && shown.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
            <Inbox className="h-6 w-6 text-spruce-400" />
            <p className="font-display text-[17px] font-semibold"><LocalizedText message={filter === "decide" ? "Nothing needs your decision" : "No submissions here"} /></p>
            <p className="max-w-md text-muted"><LocalizedText message={filter === "decide" ? "Changes submitted by other administrators will appear here." : "Submit a draft from any configuration page to start a review."} /></p>
          </div>
        )}
        <ul className="divide-y divide-line">
          {shown.map((i) => {
            const r = resource(i.resource);
            const involved = involvedIn(i);
            return (
              <li key={`${i.resource}-${i.id}`} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-50 text-saffron-700"><Icon name={r?.icon ?? "Boxes"} className="h-5 w-5" /></span>
                <div className="min-w-[240px] flex-1">
                  <ReferenceLink href={tenantAdminPaths.resource(i.resource, { open: i.id })} className="text-[14px] font-semibold hover:underline">{i.name}</ReferenceLink>
                  <p className="text-[12px] text-muted">
                    {i.effectiveFrom
                      ? t("{value0}, {value1} revision {value2}, effective {value3}", { value0: i.resourceLabel, value1: i.code, value2: i.revision, value3: fmt.date(i.effectiveFrom) })
                      : t("{value0}, {value1} revision {value2}", { value0: i.resourceLabel, value1: i.code, value2: i.revision })}
                  </p>
                  {i.changeReason && <p className="mt-0.5 text-[12px] italic text-spruce-700">“{i.changeReason}”</p>}
                </div>
                <div className="flex w-[200px] items-center gap-2">
                  <Avatar user={user(i.submittedBy)} />
                  <div className="leading-tight">
                    <p className="text-[12.5px] font-semibold">{user(i.submittedBy)?.name}</p>
                    <p className="text-[11.5px] text-muted"><LocalizedText message="submitted {value0}" values={{ value0: fmt.relative(i.submittedAt) }} /></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {involved ? (
                    <span className="text-[12px] text-muted"><LocalizedText message="Waiting for another approver" /></span>
                  ) : (
                    <>
                      <SourceButton className="btn-danger btn-sm" onClick={() => setAsk({ item: i, action: "reject", title: t("Return for changes"), body: t("{value0} goes back to its author with your reason.", { value0: i.code }), confirm: t("Return for changes"), tone: "danger", required: true, placeholder: t("What needs to change") })}>
                        <XCircle className="h-4 w-4" /> <LocalizedText message="Return" />
                      </SourceButton>
                      <SourceButton className="btn-approve btn-sm" onClick={() => setAsk({ item: i, action: "approve", title: t("Approve {value0}", { value0: i.code }), body: i.effectiveFrom ? t("Revision {value0} of “{value1}” becomes immutable and takes effect on {value2}.", { value0: i.revision, value1: i.name, value2: fmt.date(i.effectiveFrom) }) : t("Revision {value0} of “{value1}” becomes immutable.", { value0: i.revision, value1: i.name }), confirm: t("Approve"), tone: "approve", required: false, placeholder: t("Optional approval note") })}>
                        <CheckCircle2 className="h-4 w-4" /> <LocalizedText message="Approve" />
                      </SourceButton>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {ask && <ReasonDialog req={ask} busy={busy} onCancel={() => setAsk(null)} onConfirm={(reason) => void decide(reason)} />}
    </div>
  );
}
