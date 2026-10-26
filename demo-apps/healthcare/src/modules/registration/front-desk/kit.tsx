"use client";
// Copied from the AllyVora clinical workspace (components/frontdesk/kit.tsx) at commit 1ede87f; see provenance.json.

import { Check, Copy } from "@pepbits/icons";
import { type ReactNode, useState } from "react";
import { initials } from "./lib";
import { cn } from "./ui";

// Building blocks shared by the front desk pages (Start a visit, Register patient).

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span data-phi className={cn("grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--c-lapis),var(--c-ai))] font-display font-semibold text-white", large ? "size-11 text-[15px]" : "size-8 text-[12px]")}>
      {initials(name.replace(/^Dr\s/, "")) || "?"}
    </span>
  );
}

export function MrnChip({ mrn }: { mrn: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(mrn).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
      className="num inline-flex items-center gap-1.5 rounded-full bg-sunken px-2 py-px text-[12px] font-medium text-ink hover:bg-line" title="Copy MRN" aria-label={`MRN ${mrn}, copy`}>
      <span data-phi>{mrn}</span>{copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5 text-ink-3" />}
    </button>
  );
}

export function Tip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <p className="flex items-start gap-2 text-ink-2"><span className="mt-0.5 text-ink-3">{icon}</span><span>{children}</span></p>;
}

export function Notice({ tone, icon, title, action, children }: { tone: "lapis" | "ai" | "warn" | "crit"; icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  const t = { lapis: "border-lapis/25 bg-lapis-soft/50 text-lapis-ink", ai: "border-ai/25 bg-ai-soft/50 text-ai", warn: "border-warn/30 bg-warn-soft text-warn", crit: "border-crit/30 bg-crit-soft text-crit" }[tone];
  return (
    <div className={cn("flex items-start gap-2 rounded-[10px] border px-2.5 py-2 text-[12px]", t)}>
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="opacity-90">{children}</p></div>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

export function ChoiceCard({ selected, onSelect, icon, title, text, tone }: { selected: boolean; onSelect: () => void; icon: ReactNode; title: string; text: string; tone?: "crit" }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={cn("flex items-start gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition",
        selected ? (tone === "crit" ? "border-crit bg-crit-soft/40 ring-2 ring-crit/10" : "border-lapis bg-lapis-soft/40 ring-2 ring-lapis/10") : "border-line hover:border-line-strong hover:bg-raised")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-[8px]", selected ? (tone === "crit" ? "bg-crit text-white" : "bg-lapis text-white dark:text-canvas") : "bg-sunken text-ink-2")}>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{title}</span><span className="block text-[12px] text-ink-3">{text}</span></span>
      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2", selected ? (tone === "crit" ? "border-crit bg-crit" : "border-lapis bg-lapis") : "border-line-strong")}>{selected && <Check className="size-2.5 text-white" />}</span>
    </button>
  );
}

export function Pills({ value, onChange, options, warnValue }: { value: string; onChange: (v: string) => void; options: [string, string][]; warnValue?: string }) {
  return (
    <div className="inline-flex rounded-full bg-sunken p-0.5" role="radiogroup">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("h-7 rounded-full px-3 text-[12.5px] font-medium transition", value === v ? (v === warnValue ? "bg-warn text-white shadow-sm" : "bg-surface text-ink shadow-sm") : "text-ink-3 hover:text-ink")}>{l}</button>
      ))}
    </div>
  );
}

export function Check2({ done, label, children }: { done: boolean; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full", done ? "bg-ok text-white" : "border-2 border-warn")}>{done && <Check className="size-2.5" />}</span>
      <span className="min-w-0"><span className="block text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{label}</span><span className={cn("block", done ? "font-medium" : "text-warn")}>{children}</span></span>
    </li>
  );
}
