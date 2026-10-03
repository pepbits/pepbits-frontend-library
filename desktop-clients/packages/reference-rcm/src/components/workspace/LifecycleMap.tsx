"use client";
import { ArrowRight, MousePointerClick, ShieldCheck } from "lucide-react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { cx } from "../../lib/cx";
import { TONE, article, useRcmFormat } from "../../lib/format";
import type { ResourceDef } from "../../lib/types";
import { useShortcutsEnabled } from "../../lib/hooks";
import { SourceButton } from "../ui/controls";
import { statusOf } from "../ui/StatusPill";

/** Shown when nothing is selected: how work moves through this page and which steps need a second person. */
export function LifecycleMap({ res, counts, onPick }: { res: ResourceDef; counts: Record<string, number>; onPick: (status: string) => void }) {
  const { t } = useLocalization();
  const fmt = useRcmFormat();
  const shortcuts = useShortcutsEnabled();
  const off = res.statuses.filter((s) => !res.path.includes(s.key));
  const a = article(res.singular);
  return (
    <div className="flex h-full flex-col overflow-y-auto p-5">
      <p className="mb-4 rounded-xl bg-harbor-50 px-3.5 py-3 text-[13px] leading-snug text-harbor-900">{res.summary}</p>
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-muted"><MousePointerClick className="h-4 w-4" /> {t(a === "an" ? "Select an {value0} to work on it" : "Select a {value0} to work on it", { value0: res.singular })}</div>
      {shortcuts && (
        <p className="mt-1 text-[12.5px] text-muted"><LocalizedText message="Use" /> <span className="kbd">↑</span> <span className="kbd">↓</span> <LocalizedText message="to move through the list." /> {res.create && <><LocalizedText message="Press" /> <span className="kbd">{"N"}</span> {t("to create a new {value0}.", { value0: res.singular })}</>}</p>
      )}

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted">{t(a === "an" ? "How an {value0} moves" : "How a {value0} moves", { value0: res.singular })}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {res.path.map((k, i) => {
          const s = statusOf(res, k);
          return (
            <span key={k} className="flex items-center gap-1.5">
              <SourceButton onClick={() => onPick(k)} className={cx("rounded-lg px-2.5 py-1.5 text-left ring-1 ring-inset transition hover:brightness-95", TONE[s.tone].pill)}>
                <span className="block text-[12px] font-semibold">{s.label}</span>
                <span className="block text-[10.5px] opacity-80">{t("{value0} now", { value0: fmt.num(counts[k] ?? 0) })}</span>
              </SourceButton>
              {i < res.path.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-soft" />}
            </span>
          );
        })}
      </div>
      {off.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {off.map((s) => (
            <SourceButton key={s.key} onClick={() => onPick(s.key)} className={cx("rounded-lg px-2 py-1 text-[11.5px] font-semibold ring-1 ring-inset hover:brightness-95", TONE[s.tone].pill)}>
              {s.label} · {fmt.num(counts[s.key] ?? 0)}
            </SourceButton>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted"><LocalizedText message="Actions on this page" /></p>
      <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
        {res.actions.map((act) => (
          <li key={act.key} className="flex items-start gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                {act.label}
                {act.independent && <ShieldCheck className="h-3.5 w-3.5 text-jade-600" aria-label={t("Needs a second person")} />}
              </span>
              <span className="block text-[11.5px] text-muted">
                {act.to !== "*"
                  ? t("From {value0} to {value1}.", { value0: act.from.map((f) => statusOf(res, f).label.toLowerCase()).join(t(" or ")), value1: statusOf(res, act.to).label.toLowerCase() })
                  : t("From {value0}, outcome decided by the result.", { value0: act.from.map((f) => statusOf(res, f).label.toLowerCase()).join(t(" or ")) })}
                {act.reason === "required" ? ` ${t("Reason required.")}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {res.actions.some((act) => act.independent) && <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-muted"><ShieldCheck className="h-3.5 w-3.5 text-jade-600" /> <LocalizedText message="needs someone other than the person who created or requested it." /></p>}
    </div>
  );
}
