"use client";
import clsx from "clsx";
import { SourceButton } from "../ui/controls";
import { statusOf, usePharmacyFormat, type Tone } from "../../lib/format";

export interface ChainNode { key: string; label: string; ref: string | null; status: string; detail: string; count: number }

const MARK: Record<Tone, string> = {
  ok: "bg-ok border-ok", info: "bg-cobalt border-cobalt", warn: "bg-amber-mark border-amber-mark", danger: "bg-danger border-danger",
  violet: "bg-violet border-violet", neutral: "bg-ink-3 border-ink-3", muted: "bg-surface border-line-strong",
};
const TEXT: Record<Tone, string> = { ok: "text-ok", info: "text-cobalt", warn: "text-amber", danger: "text-danger", violet: "text-violet", neutral: "text-ink-2", muted: "text-ink-3" };

/**
 * Seven linked records, each with its own status. They advance independently:
 * a claim can be rejected while the dispensing is already handed over.
 */
export function RxChain({ nodes, onSelect, compact }: { nodes: ChainNode[]; onSelect?: (key: string) => void; compact?: boolean }) {
  const { t, statusLabel, int } = usePharmacyFormat();
  return (
    <ol className="scroll-x grid min-w-0 grid-cols-7 rounded-xl border border-line bg-surface-2" aria-label={t("Record chain")}>
      {nodes.map((n, i) => {
        const s = statusOf(n.status);
        const live = !["none", "not_required"].includes(n.status);
        const nextLive = nodes[i + 1] && !["none", "not_required"].includes(nodes[i + 1].status);
        return (
          <li key={n.key} className="relative min-w-[118px]">
            <SourceButton disabled={!onSelect} onClick={() => onSelect?.(n.key)}
              className={clsx("group flex h-full w-full flex-col items-start px-3 text-left transition-colors enabled:hover:bg-surface-3", compact ? "py-2" : "py-2.5", i === 0 && "rounded-l-xl", i === 6 && "rounded-r-xl")}>
              <div className="relative flex w-full items-center">
                <span className={clsx("relative z-10 size-2.5 shrink-0 rounded-full border-2", MARK[live ? s.tone : "muted"])} aria-hidden />
                {i < nodes.length - 1 && (
                  <span className={clsx("absolute left-2.5 right-[-12px] top-1/2 -translate-y-1/2", live && nextLive ? "h-[2px] bg-line-strong" : "chain-rule")} aria-hidden />
                )}
              </div>
              <span className="mt-1.5 text-[11.5px] text-ink-3">{t(n.label)}{n.count > 1 && <span className="num"> ({int(n.count)})</span>}</span>
              <span className={clsx("text-[13px] font-semibold leading-snug", live ? TEXT[s.tone] : "text-ink-3")}>{statusLabel(n.status)}</span>
              {!compact && (
                <>
                  <span className="num mt-0.5 truncate text-[11.5px] text-ink-2">{n.ref ?? " "}</span>
                  <span className="num w-full truncate text-[11.5px] text-ink-3" title={n.detail}>{n.detail}</span>
                </>
              )}
            </SourceButton>
          </li>
        );
      })}
    </ol>
  );
}
