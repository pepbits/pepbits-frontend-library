"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceInput } from "../../../shared/controls";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Command, FlaskConical, Layers, Pill, Stethoscope } from "lucide-react";
import type { SearchHit } from "../../../shared/types";
import { useConsult, type TabKey } from "./context";
import { useApi, useDebounced } from "../../lib/hooks";
import { useTeleconsultClient } from "../../lib/api";
import { cx } from "../ui";

type Item = { key: string; label: string; sub: string; icon: React.ReactNode; run: () => void };

const TAB_NAMES: { tab: TabKey; label: string }[] = [
  { tab: "triage", label: "Triage and vitals" },
  { tab: "notes", label: "Notes (SOAP)" },
  { tab: "diagnoses", label: "Diagnoses" },
  { tab: "orders", label: "Orders" },
  { tab: "rx", label: "Prescriptions" },
  { tab: "scores", label: "Scores" },
  { tab: "allergies", label: "Allergies" },
  { tab: "review", label: "Review and sign" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocalization();
  const { actions, setTab, role, locked } = useConsult();
  const client = useTeleconsultClient();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [pendingEnter, setPendingEnter] = useState(false);
  const dq = useDebounced(q, 120);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = useApi<SearchHit[]>(open && dq.length >= 2 ? `/api/catalog/search?q=${encodeURIComponent(dq)}` : null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setPendingEnter(false);
      const focus = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(focus);
    }
  }, [open]);

  const runHit = (h: SearchHit) => {
    if (h.type === "icd") actions.addDiagnosis(h.id);
    if (h.type === "drug") actions.addDrug(h.id);
    if (h.type === "order") actions.addOrder(h.id);
    if (h.type === "orderset") actions.applyOrderSet(h.id);
  };

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = TAB_NAMES.filter((n) => (role === "doctor" || n.tab !== "review") && (!q || t(n.label).toLowerCase().includes(q.toLowerCase()))).map((n) => ({
      key: `tab-${n.tab}`,
      label: t("Go to {value0}", { value0: t(n.label) }),
      sub: t("Navigate"),
      icon: <ArrowRight className="h-4 w-4" />,
      run: () => setTab(n.tab),
    }));
    if (!q || "capture vitals".includes(q.toLowerCase())) nav.push({ key: "cap", label: t("Capture live vitals to chart"), sub: t("Action"), icon: <Command className="h-4 w-4" />, run: actions.captureLive });
    if (dq.length < 2 || locked) return nav;
    const res: Item[] = (hits.data ?? [])
      .filter((h) => role === "doctor" || h.type === "order")
      .map((h) => ({
        key: `${h.type}-${h.id}`,
        label: h.label,
        sub: h.sub,
        icon: h.type === "icd" ? <Stethoscope className="h-4 w-4" /> : h.type === "drug" ? <Pill className="h-4 w-4" /> : h.type === "orderset" ? <Layers className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />,
        run: () => runHit(h),
      }));
    return [...res, ...nav.slice(0, 3)];
  }, [q, dq, hits.data, actions, setTab, role, locked, t]);

  useEffect(() => setIdx(0), [items.length]);

  const choose = (i: Item) => {
    i.run();
    setPendingEnter(false);
    onClose();
  };

  // Enter pressed before results arrived: fetch now and run the top hit
  useEffect(() => {
    if (!pendingEnter) return;
    const controller = new AbortController();
    client.get<SearchHit[]>(`/api/catalog/search?q=${encodeURIComponent(q)}`, { signal: controller.signal }).then((res) => {
      const h = res.find((x) => role === "doctor" || x.type === "order");
      if (h && !locked) runHit(h);
      setPendingEnter(false);
      onClose();
    }).catch((e) => {
      if ((e as Error).name !== "AbortError") setPendingEnter(false);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEnter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-ink-950/40 p-4 pt-[12vh] animate-fade-in" onMouseDown={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-pop animate-rise" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={t("Quick add")}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Command className="h-4 w-4 text-ink-400" />
          <SourceInput
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter") {
                if (q.length >= 2 && !locked && (dq !== q || hits.loading || !hits.data)) setPendingEnter(true);
                else if (items[idx]) choose(items[idx]);
              }
              if (e.key === "Escape") onClose();
            }}
            placeholder={role === "doctor" ? "Order a test, prescribe, add a diagnosis, or jump to a section" : "Order a nursing task or lab, or jump to a section"}
            className="h-12 flex-1 text-[15px] focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 text-2xs text-ink-400"><LocalizedText message={"Esc"} /></kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1.5 scroll-thin" role="listbox">
          {items.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === idx}>
              <SourceButton onMouseEnter={() => setIdx(i)} onClick={() => choose(it)} className={cx("flex w-full items-center gap-3 px-4 py-2 text-left", i === idx ? "bg-pulse-50" : "")}>
                <span className={cx("text-ink-400", i === idx && "text-pulse-600")}>{it.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{it.label}</span>
                  <span className="block truncate text-2xs text-ink-400">{it.sub}</span>
                </span>
                {i === idx && <span className="text-2xs text-pulse-600"><LocalizedText message={"Enter to add"} /></span>}
              </SourceButton>
            </li>
          ))}
          {!items.length && <li className="px-4 py-6 text-center text-sm text-ink-400">{t("No matches for “{value0}”", { value0: q })}</li>}
        </ul>
      </div>
    </div>
  );
}
