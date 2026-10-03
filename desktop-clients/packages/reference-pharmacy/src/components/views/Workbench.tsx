"use client";
import clsx from "clsx";
import { ArrowLeft, Bike, CirclePause, Inbox, Lock, Radio, Search, Snowflake } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { useRouter, useSearchParams } from "../../lib/navigation";
import { RxDetail } from "../rx/RxDetail";
import type { QueueRow, RxDetail as Rx } from "../rx/types";
import { SourceButton } from "../ui/controls";
import { Button, EmptyState, ErrorNote, Input, Kbd, ListSkeleton, Skeleton, Tag } from "../ui/primitives";
import { useToast } from "../ui/toast";
import { useApi, useApiClient, useRefreshAll } from "../../lib/api";
import { age, usePharmacyFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";

const STAGES = [
  { value: "intake", label: "Intake" }, { value: "review", label: "Review" }, { value: "fill", label: "Fill" },
  { value: "check", label: "Check" }, { value: "handover", label: "Ready" }, { value: "done", label: "Done" },
] as const;
type Stage = (typeof STAGES)[number]["value"];

const PRIORITY_LABEL: Record<string, string> = { routine: "Routine", urgent: "Urgent", stat: "Stat" };
/** Authorization statuses shown inside a queue row ("Auth requested"). Unknown codes show with underscores removed. */
const AUTH_LABEL: Record<string, string> = { requested: "requested", approved: "approved", partially_approved: "partially approved", denied: "denied", needed: "needed", expired: "expired" };

const WIDE = "(min-width: 1024px)";
const subscribeWide = (cb: () => void) => { const m = window.matchMedia(WIDE); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };

export function WorkbenchView() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const api = useApiClient();
  const refreshAll = useRefreshAll();
  const { t, int } = usePharmacyFormat();
  const [q, setQ] = useState("");
  const [dismissed, setDismissed] = useState(false); // user closed the detail (Esc / back on mobile)
  const [now, setNow] = useState(() => Date.now());
  const search = useRef<HTMLInputElement>(null);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  // The URL is the single source of truth for stage and selection, so deep links and back/forward just work
  const urlRx = params.get("rx");
  const urlStage = params.get("stage") as Stage | null;
  const detail = useApi<Rx>(urlRx ? `/prescriptions/${urlRx}` : null);
  const stage: Stage = urlStage ?? (detail.data && detail.data.id === urlRx ? (detail.data.stage as Stage) : "intake");
  const list = useApi<{ rows: QueueRow[]; counts: Record<string, number> }>(`/prescriptions?stage=${stage}&limit=${stage === "done" ? 60 : 200}${q ? `&q=${encodeURIComponent(q)}` : ""}`, { refreshInterval: 15_000 });
  const rows = useMemo(() => list.data?.rows ?? [], [list.data]);
  // On wide screens keep a prescription open so the next one is always one glance away
  const selected = urlRx ?? (wide && !dismissed ? rows[0]?.id ?? null : null);
  const shown = useApi<Rx>(selected && selected !== urlRx ? `/prescriptions/${selected}` : null);
  const current = selected === urlRx ? detail : shown;

  const go = useCallback((st: Stage, id: string | null) => {
    router.replace(`/workbench?stage=${st}${id ? `&rx=${id}` : ""}`, { scroll: false });
  }, [router]);
  const select = useCallback((id: string | null) => { setDismissed(id === null); go(stage, id); }, [go, stage]);

  const changeStage = (st: Stage) => { setDismissed(false); go(st, null); };

  const move = (dir: 1 | -1) => {
    if (!rows.length) return;
    const i = rows.findIndex((r) => r.id === selected);
    const next = rows[Math.min(Math.max(i + dir, 0), rows.length - 1)] ?? rows[0];
    select(next.id);
    document.getElementById(`q-${next.id}`)?.scrollIntoView({ block: "nearest" });
  };
  useHotkeys({
    j: () => move(1), k: () => move(-1), arrowdown: () => move(1), arrowup: () => move(-1), escape: () => select(null),
    ...Object.fromEntries(STAGES.map((s, i) => [String(i + 1), () => changeStage(s.value)])),
    f: () => search.current?.focus(),
  }, [rows, selected, stage]);

  /** After an action the queue follows the prescription; finished ones advance to the next in line. */
  const onChange = (next: Rx) => {
    current.mutate(next, { revalidate: false });
    if (next.stage === stage) return;
    if (next.stage === "done") {
      const i = rows.findIndex((r) => r.id === next.id);
      const after = rows.filter((r) => r.id !== next.id)[Math.min(i, rows.length - 2)];
      if (after) select(after.id);
      return;
    }
    go(next.stage as Stage, next.id);
  };

  const simulate = async () => {
    try {
      const rx = await api.post<Rx>("/prescriptions/simulate-erx");
      await refreshAll();
      toast({
        tone: "ok", title: t("{value0} received from the eRx network", { value0: rx.rx_no }),
        body: rx.items.length === 1 ? t("{value0}, 1 medicine", { value0: rx.patient.name }) : t("{value0}, {value1} medicines", { value0: rx.patient.name, value1: int(rx.items.length) }),
      });
      go("intake", rx.id);
    } catch (e) { toast({ tone: "error", title: (e as Error).message }); }
  };

  const counts = list.data?.counts ?? {};
  const stageLabel = t(STAGES.find((s) => s.value === stage)?.label ?? "");
  return (
    <div className="flex h-full min-h-0">
      {/* Queue */}
      <section aria-label={t("Prescription queue")} className={clsx("flex min-h-0 w-full flex-col border-r border-line bg-surface lg:w-[372px] lg:shrink-0", selected && "hidden lg:flex")}>
        <div className="shrink-0 space-y-2.5 border-b border-line p-3">
          <div role="tablist" aria-label={t("Stage")} className="grid grid-cols-6 gap-0.5 rounded-lg bg-surface-3 p-0.5">
            {STAGES.map((s, i) => {
              const on = s.value === stage;
              const n = counts[s.value] ?? 0;
              return (
                <SourceButton key={s.value} role="tab" aria-selected={on} onClick={() => changeStage(s.value)} title={t("{value0} ({value1})", { value0: t(s.label), value1: i + 1 })}
                  className={clsx("flex flex-col items-center rounded-md px-1 py-1 transition-colors", on ? "bg-surface shadow-[0_1px_2px_rgba(18,26,51,0.12)]" : "hover:bg-surface/60")}>
                  <span className={clsx("num text-[15px] font-semibold leading-tight", on ? "text-cobalt" : n ? "text-ink" : "text-ink-3")}>{s.value === "done" ? "✓" : int(n)}</span>
                  <span className={clsx("w-full truncate text-center text-[11px] leading-tight", on ? "font-medium text-ink" : "text-ink-3")}><LocalizedText message={s.label} /></span>
                </SourceButton>
              );
            })}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Patient, MRN or RX number" className="pl-8" aria-label="Filter queue" />
            </div>
            <Button title="Simulate an inbound electronic prescription" icon={<Radio className="size-4" />} onClick={simulate}><LocalizedText message="Test eRx" /></Button>
          </div>
        </div>
        <div className="scroll-y min-h-0 flex-1" role="listbox" aria-label={t("{value0} queue", { value0: stageLabel })}>
          {list.error && <ErrorNote error={list.error} onRetry={() => list.mutate()} />}
          {!list.data && !list.error && <ListSkeleton />}
          {list.data && rows.length === 0 && (
            <EmptyState icon={<Inbox className="size-5" />} title={q ? "No matches in this stage" : stage === "intake" ? "Intake is clear" : t("Nothing waiting in {value0}", { value0: stageLabel.toLowerCase() })}
              body={stage === "intake" ? "New eRx and paper prescriptions land here. Press N to enter one." : "Work moves here as prescriptions progress."} />
          )}
          <ul className="divide-y divide-line">
            {rows.map((r) => <QueueItem key={r.id} r={r} now={now} active={r.id === selected} onClick={() => select(r.id)} />)}
          </ul>
        </div>
        <div className="hidden shrink-0 items-center gap-3 border-t border-line px-3 py-2 text-[11.5px] text-ink-3 lg:flex">
          <span className="flex items-center gap-1"><Kbd><LocalizedText message="J" /></Kbd><Kbd><LocalizedText message="K" /></Kbd> <LocalizedText message="move" /></span>
          <span className="flex items-center gap-1"><Kbd>1</Kbd>–<Kbd>6</Kbd> <LocalizedText message="stage" /></span>
          <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>↵</Kbd> <LocalizedText message="next step" /></span>
        </div>
      </section>

      {/* Detail */}
      <section aria-label={t("Prescription detail")} className={clsx("min-h-0 min-w-0 flex-1 bg-surface lg:bg-transparent", !selected && "hidden lg:block")}>
        {selected && (
          <div className="flex h-full min-h-0 flex-col lg:m-3 lg:h-[calc(100%-1.5rem)] lg:overflow-hidden lg:rounded-xl lg:border lg:border-line lg:bg-surface">
            <SourceButton onClick={() => select(null)} className="flex shrink-0 items-center gap-1.5 border-b border-line px-4 py-2 text-[13px] text-cobalt lg:hidden"><ArrowLeft className="size-4" /><LocalizedText message="Back to queue" /></SourceButton>
            {current.error && <ErrorNote error={current.error} onRetry={() => current.mutate()} />}
            {!current.data && !current.error && <div className="space-y-3 p-5"><Skeleton className="h-14" /><Skeleton className="h-20" /><Skeleton className="h-48" /></div>}
            {current.data && <RxDetail key={current.data.id + current.data.stage} rx={current.data} onChange={onChange} />}
          </div>
        )}
        {!selected && (
          <EmptyState className="h-full" icon={<Inbox className="size-5" />} title="Choose a prescription from the queue"
            body="Its record chain, safety checks and the next step for this stage open here. Use J and K to move through the queue." />
        )}
      </section>
    </div>
  );
}

function QueueItem({ r, now, active, onClick }: { r: QueueRow; now: number; active: boolean; onClick: () => void }) {
  const { t, ago, int } = usePharmacyFormat();
  const wait = (now - new Date(r.received_at).getTime()) / 60000;
  const priority = PRIORITY_LABEL[r.priority] ? t(PRIORITY_LABEL[r.priority]) : r.priority;
  return (
    <li id={`q-${r.id}`} role="option" aria-selected={active}>
      <SourceButton onClick={onClick} className={clsx("relative flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors", active ? "bg-cobalt-wash" : "hover:bg-surface-2")}>
        {r.priority !== "routine" && <span className={clsx("absolute inset-y-0 left-0 w-[3px]", r.priority === "stat" ? "bg-danger" : "bg-amber-mark")} aria-label={priority} />}
        {active && <span className="absolute inset-y-0 right-0 w-[3px] bg-cobalt" aria-hidden />}
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold">{r.patient_name}</span>
          <span className="num shrink-0 text-xs text-ink-3"><LocalizedText message="{value0} y" values={{ value0: int(age(r.dob)) }} /></span>
          <span className={clsx("num ml-auto shrink-0 text-xs", r.stage !== "done" && wait > 60 ? "font-medium text-amber" : "text-ink-3")}>{ago(r.stage === "done" ? r.updated_at : r.received_at)}</span>
        </div>
        <p className="truncate text-xs text-ink-2"><span className="num font-medium text-ink">{r.rx_no}</span>  {r.item_names}</p>
        <div className="flex flex-wrap items-center gap-1">
          <Tag tone={r.payer_code ? "info" : "muted"}>{r.payer_code ?? t("Self-pay")}</Tag>
          {r.priority !== "routine" && <Tag tone={r.priority === "stat" ? "danger" : "warn"} className="capitalize">{priority}</Tag>}
          {r.status === "on_hold" && <Tag tone="warn"><CirclePause className="size-3" /><LocalizedText message="On hold" /></Tag>}
          {r.status === "partially_dispensed" && <Tag tone="warn"><LocalizedText message="Balance owed" /></Tag>}
          {r.cold > 0 && <Tag tone="info"><Snowflake className="size-3" /><LocalizedText message="Fridge" /></Tag>}
          {r.controlled > 0 && <Tag tone="violet"><Lock className="size-3" /><LocalizedText message="Controlled" /></Tag>}
          {r.auth_status && <Tag tone={r.auth_status === "approved" ? "ok" : r.auth_status === "denied" ? "danger" : "warn"}>{t("Auth {value0}", { value0: AUTH_LABEL[r.auth_status] ? t(AUTH_LABEL[r.auth_status]) : r.auth_status.replace("_", " ") })}</Tag>}
          {r.collection === "delivery" && <Tag tone="violet"><Bike className="size-3" /><LocalizedText message="Delivery" /></Tag>}
          {r.stage === "done" && <Tag tone={r.status === "cancelled" ? "muted" : "ok"}>{r.status === "cancelled" ? "Cancelled" : "Supplied"}</Tag>}
        </div>
      </SourceButton>
    </li>
  );
}
