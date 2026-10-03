"use client";
import { LocalizedText } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { TONE, humanize, useRcmFormat } from "../../lib/format";
import type { RecordDto, ResourceDef } from "../../lib/types";
import { useApp } from "../shell/context";
import { SourceButton } from "../ui/controls";
import { Avatar } from "../ui/Avatar";
import { dueActive, statusOf } from "../ui/StatusPill";

/** Kanban view: one column per stage, sized to the viewport so the whole pipeline is visible at once. */
export function Board({ res, rows, selected, onSelect, loading }: { res: ResourceDef; rows: RecordDto[]; selected: number | null; onSelect: (id: number) => void; loading: boolean }) {
  const { user } = useApp();
  const fmt = useRcmFormat();
  const columns = res.board ?? res.path;
  const has = (k: string) => res.fields.some((f) => f.key === k);
  return (
    <div className={cx("flex h-full min-h-0 gap-3 overflow-x-auto pb-1", loading && "opacity-60")} data-rcm-board="true">
      {columns.map((k) => {
        const st = statusOf(res, k);
        const items = rows.filter((r) => r.status === k);
        const sum = items.reduce((s, r) => s + (has("balance") && r.balance ? r.balance : r.amount), 0);
        const cur = items[0]?.currency;
        return (
          <section key={k} aria-label={st.label} className="flex min-w-[196px] flex-1 flex-col rounded-[14px] border border-line bg-white/70">
            <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <span className={cx("h-2.5 w-2.5 rounded-full", TONE[st.tone].dot)} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{st.label}</span>
              <span className="rounded-full bg-mist px-2 text-[11px] font-bold text-harbor-800">{fmt.num(items.length)}</span>
            </header>
            {has("amount") && <p className="border-b border-line px-3 py-1 text-[11px] font-semibold tabular-nums text-muted">{items.length ? fmt.money(sum, cur, { compact: true }) : "—"}</p>}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {items.map((r) => {
                const due = fmt.dueText(r.dueDate);
                const done = !dueActive(res, r.status);
                return (
                  <SourceButton key={r.id} onClick={() => onSelect(r.id)}
                    className={cx("block w-full rounded-xl border bg-white p-2.5 text-left shadow-card transition hover:-translate-y-px hover:border-harbor-300",
                      selected === r.id ? "border-signal-500 ring-2 ring-signal-100" : "border-line")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-harbor-700">{r.ref}</span>
                      {r.priority && <span className={cx("rounded px-1 text-[10px] font-bold", r.priority === "HIGH" ? "bg-madder-50 text-madder-700" : r.priority === "MEDIUM" ? "bg-saffron-50 text-saffron-700" : "bg-mist text-muted")}>{humanize(r.priority)}</span>}
                    </span>
                    <span className="mt-1 block truncate text-[13px] font-semibold leading-snug">{r.patient?.name ?? r.title}</span>
                    {r.patient && r.title && <span className="block truncate text-[11.5px] text-muted">{r.title}</span>}
                    <span className="mt-2 flex items-center gap-2">
                      {has("assignee") && <Avatar user={user(r.assignee)} size="xs" />}
                      {has("amount") && <span className="text-[12px] font-semibold tabular-nums">{fmt.money(has("balance") && r.balance ? r.balance : r.amount, r.currency, { compact: true })}</span>}
                      <span className="flex-1" />
                      {due && !done && <span className={cx("rounded-md px-1.5 py-px text-[10.5px] font-semibold", TONE[due.tone === "muted" ? "muted" : due.tone].pill)}>{due.text}</span>}
                    </span>
                  </SourceButton>
                );
              })}
              {items.length === 0 && <p className="px-2 py-6 text-center text-[11.5px] text-muted"><LocalizedText message="Empty" /></p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
