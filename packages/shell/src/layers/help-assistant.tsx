"use client";
import { LocalizedText, useLocalization } from "@pepbits/i18n/react";


import {DocumentationArticle, useDocumentationRequest} from "../documentation";

import { useShell } from "../shell-context";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CircleHelp, Keyboard, Pause, Play, Route, X } from "@pepbits/icons";
import { Button, IconButton, cn } from "@pepbits/ui";
import { SHORTCUTS, SHORTCUT_GROUPS, displayFor, shortcutAvailable } from "../shortcuts";
import { useOptionalWorkspace } from "../workspace";
import type { TourStep } from "../tours";
import { useNavigation } from "@pepbits/platform";
import { useERP } from "../shell-context";

/** Fired before a step is measured. A page whose anchors sit behind tabs (the
    preferences page) listens and reveals the one named, so the tour can reach
    every section rather than only the tab that happens to be open. */
export const TOUR_REVEAL_EVENT = "pepbits:tour-reveal";

type Spot = { x: number; y: number; w: number; h: number };
type Tab = "tour" | "docs" | "keys";

/* Steps whose anchor is not on the page are dropped up front, so "1 / 3" is
   honest and Play never parks on a blank spotlight. */
function presentSteps(steps: TourStep[]): TourStep[] {
  if (typeof document === "undefined") return steps;
  return steps.filter((step) => Array.from(document.querySelectorAll<HTMLElement>("[data-tour]")).some(el=>el.dataset.tour===step.target));
}

function Spotlight({ spot, title }: { spot: Spot; title: string }) {
  return (
    <>
      {/* The dim is the shadow: one element with a 9999px box-shadow darkens
          everything except its own box, with no second overlay to z-order. */}
      <div aria-hidden className="pointer-events-none fixed z-[65] rounded-xl border-2 border-[var(--primary)] transition-all duration-300"
        style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h, boxShadow: "0 0 0 9999px rgba(0,0,0,.38)" }} />
      <div aria-hidden className="pointer-events-none fixed z-[66] rounded-lg bg-[var(--primary-fill)] px-2 py-0.5 text-[length:calc(10.5px*var(--fs-scale))] font-bold text-white shadow-[var(--shadow-md)] transition-all duration-300"
        style={{ left: spot.x, top: spot.y + spot.h + 8 }}>{title}</div>
    </>
  );
}

export function HelpAssistant() {
  const {t: translateCopy} = useLocalization();
  const {product,tours,documentation} = useShell();
  const documentationRequest=useDocumentationRequest();
  const hasWorkspace = useOptionalWorkspace() !== null;
  const { preferences, helpOpen, setHelpOpen, setDocumentationOpen } = useERP();
  const navigation = useNavigation();
  const panelRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!helpOpen||!preferences.helperEnabled)return;
    const trigger=document.activeElement as HTMLElement|null;
    panelRef.current?.focus();
    return()=>{if(trigger?.isConnected)trigger.focus();};
  },[helpOpen,preferences.helperEnabled]);
  const page = product.pages[navigation.current.pageId];
  const kind = page?.kind ?? "dashboard";

  const [tab, setTab] = useState<Tab>("docs");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  /* Whether the tour is RUNNING, as distinct from whether the panel is open.
     Opening the panel used to start it: the tour tab is the default, so the
     spotlight measured, dimmed the page and scrolled it out from under the
     user before they had asked for anything. Nothing spotlights until this is
     true, and only an explicit tour action sets it. */
  const [touring, setTouring] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [steps, setSteps] = useState<TourStep[]>([]);

  /* Resolved when the panel opens or the page changes, never during render:
     the filter reads the DOM, and the anchors it looks for are painted by the
     same commit this component is part of. */
  useEffect(() => {
    if (!helpOpen || !preferences.helperEnabled) return;
    const controller=new AbortController();
    const apply=(all:TourStep[])=>setSteps(presentSteps(all));
    apply([...(tours?.[navigation.current.pageId] ?? tours?.[kind] ?? [])]);
    if(documentation && preferences.documentationEnabled && !tours?.[navigation.current.pageId] && !tours?.[kind]) void documentationRequest(`/documentation?releaseId=${encodeURIComponent(documentation.releaseId)}&pageId=${encodeURIComponent(navigation.current.pageId)}&language=${preferences.language}`,{signal:controller.signal}).then((body:{guide:{tour:TourStep[]}})=>{if(!controller.signal.aborted)apply(body.guide.tour);}).catch(()=>{});
    setStep(0);
    setPlaying(false);
    setTouring(false);
    return()=>controller.abort();
  }, [helpOpen, kind, navigation.current.pageId,preferences.language,preferences.helperEnabled,preferences.documentationEnabled,documentationRequest,tours,documentation]);

  const current = steps[Math.min(step, Math.max(0, steps.length - 1))];

  const measure = useCallback(() => {
    if (tab !== "tour" || !current) { setSpot(null); return; }
    const el = Array.from(document.querySelectorAll<HTMLElement>("[data-tour]")).find(el=>el.dataset.tour===current.target);
    if (!el) { setSpot(null); return; }
    const r = el.getBoundingClientRect();
    setSpot({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
  }, [current, tab]);

  /* Reveal, scroll, then measure. The reveal may switch a tab and the scroll
     may animate, so the measurement waits for both; resize and scroll keep it
     pinned to the element afterwards. */
  useEffect(() => {
    if (!helpOpen || !preferences.helperEnabled || tab !== "tour" || !touring || !current) { setSpot(null); return; }
    window.dispatchEvent(new CustomEvent(TOUR_REVEAL_EVENT, { detail: { target: current.target } }));
    const el = Array.from(document.querySelectorAll<HTMLElement>("[data-tour]")).find(el=>el.dataset.tour===current.target);
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: preferences.reducedMotion ? "auto" : "smooth" });
    const timer = window.setTimeout(measure, preferences.reducedMotion ? 80 : 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current, helpOpen, measure, preferences.reducedMotion, preferences.helperEnabled, tab, touring]);

  useEffect(() => {
    if (!playing || !helpOpen || !preferences.helperEnabled || steps.length < 2) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps.length), 4000);
    return () => window.clearInterval(id);
  }, [playing, helpOpen, preferences.helperEnabled, steps.length]);

  useEffect(() => {
    if (!helpOpen || !preferences.helperEnabled) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setHelpOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, preferences.helperEnabled, setHelpOpen]);

  const tabs = useMemo(() => [
    { id: "tour" as Tab, label: "Tour", icon: <Route className="size-3.5" /> },
    { id: "docs" as Tab, label: "Docs", icon: <BookOpen className="size-3.5" /> },
    { id: "keys" as Tab, label: "Shortcuts", icon: <Keyboard className="size-3.5" /> },
  ], []);

  /* ⌘ is a Mac key; showing it to a Windows user names a key they do not have. */
  const apple = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  if (!preferences.helperEnabled) return null;

  return (
    <>


      {helpOpen ? (
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-label={translateCopy("ui.help.b79cac92")} className="animate-slide-up no-print fixed bottom-28 end-5 z-[71] flex max-h-[70vh] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
          <div className="flex border-b border-[var(--border)]">
            {tabs.map((item) => (
              <button key={item.id} type="button" onClick={() => { setTab(item.id); setPlaying(false); setTouring(false); }}
                className={cn("focus-ring flex h-10 flex-1 items-center justify-center gap-1.5 border-b-2 text-[length:calc(11px*var(--fs-scale))] font-bold transition",
                  tab === item.id ? "border-[var(--primary)] text-[var(--text)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]")}>
                {item.icon}{translateCopy(item.label)}
              </button>
            ))}
            <IconButton label="ui.close.help.88f2b692" className="size-10 rounded-none" onClick={() => setHelpOpen(false)}><X className="size-4" /></IconButton>
          </div>

          {tab === "tour" ? (
            <div className="nex-scrollbar flex flex-col gap-3 overflow-auto px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[length:calc(9px*var(--fs-scale))] font-black uppercase tracking-[.12em] text-[var(--text-muted)]"><LocalizedText message="ui.guided.tour.40eb5b9e" />{page?.title ?? "Workspace"}</span>
                <span className="flex-1" />
                <span className="font-mono text-[length:calc(10.5px*var(--fs-scale))] tabular-nums text-[var(--text-muted)]">{steps.length ? step + 1 : 0} / {steps.length}</span>
              </div>
              <div className="h-[3px] overflow-hidden rounded-sm bg-[var(--surface-3)]"><div className="h-full bg-[var(--primary)] transition-[width] duration-300" style={{ width: `${steps.length ? ((step + 1) / steps.length) * 100 : 0}%` }} /></div>
              {current ? (
                <div className="flex min-h-[90px] items-start gap-3 rounded-xl bg-[var(--surface-2)] p-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-fill)] font-mono text-[length:calc(11px*var(--fs-scale))] font-black text-white">{step + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-[length:calc(12px*var(--fs-scale))] font-black">{current.title}</span>
                    <span className="text-[length:calc(10.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{current.text}</span>
                  </span>
                </div>
              ) : <div className="rounded-xl bg-[var(--surface-2)] p-3 text-[length:calc(10.5px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.nothing.to.tour.on.this.page.yet.18d0885f" /></div>}
              <div className="flex gap-1.5">{steps.map((s, i) => <button key={s.target} type="button" title={s.title} onClick={() => { setTouring(true); setStep(i); }} className={cn("h-2 flex-1 rounded-sm transition", i <= step ? "bg-[var(--primary)]" : "bg-[var(--border)]")} />)}</div>
              <div className="flex items-center gap-2">
                {/* Play starts the run. Stepping by hand starts it too -- a Next
                    button that highlights nothing would just look broken -- but
                    merely opening the panel does not. */}
                <Button variant={playing ? "secondary" : "primary"} size="sm" leftIcon={playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} onClick={() => { setTouring(true); setPlaying((p) => !p); }} disabled={!steps.length}>{playing ? <LocalizedText message="ui.pause.858e4ba7" /> : touring ? <LocalizedText message="ui.resume.d640c742" /> : <LocalizedText message="ui.play.tour.6d258106" />}</Button>
                {touring ? <Button variant="ghost" size="sm" onClick={() => { setPlaying(false); setTouring(false); setStep(0); }}><LocalizedText message="ui.stop.cae7d57b" /></Button> : null}
                <span className="flex-1" />
                <IconButton label="ui.previous.step.318c1da8" onClick={() => { setTouring(true); setStep((s) => (s - 1 + steps.length) % steps.length); }} disabled={!steps.length}><ChevronLeft className="size-4" /></IconButton>
                <IconButton label="ui.next.step.298a9207" onClick={() => { setTouring(true); setStep((s) => (s + 1) % steps.length); }} disabled={!steps.length}><ChevronRight className="size-4" /></IconButton>
              </div>
            </div>
          ) : null}

          {tab === "docs" ? (
            <div className="nex-scrollbar flex flex-col gap-2.5 overflow-auto px-4 py-3.5">
              {preferences.documentationEnabled ? <DocumentationArticle pageId={navigation.current.pageId} onTour={() => setTab("tour")} /> : null}
            </div>
          ) : null}

          {tab === "keys" ? (
            <div className="nex-scrollbar flex flex-col overflow-auto px-4 pb-3.5 pt-2">
                            {!preferences.keyboardShortcuts ? (
                <div className="px-1 py-3 text-[length:calc(10px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.keyboard.shortcuts.are.switched.off.in.your.preferences.c0ffe36c" /></div>
              ) : null}
              {/* Rendered FROM the registry. The list used to be written out
                  again here, which is the copy that goes stale: a shortcut that
                  moves keeps working and the help quietly starts lying. */}
              {SHORTCUT_GROUPS.map((group) => {
                /* The same predicate the dispatcher uses. A split key printed in the
                     web shell's help would be a promise it cannot keep. */
                  const items = SHORTCUTS.filter((s) => s.group === group && shortcutAvailable(s, { workspace: hasWorkspace }));
                if (!items.length) return null;
                return (
                  <div key={group} className="mb-1">
                    <div className="pb-1 pt-2 text-[length:calc(8.5px*var(--fs-scale))] font-black uppercase tracking-[.1em] text-[var(--text-subtle)]">{translateCopy(group)}</div>
                    {items.map((item) => (
                      <div key={item.id} className={cn("flex items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-[length:calc(10.5px*var(--fs-scale))]",
                        !preferences.keyboardShortcuts && "opacity-45")}>
                        <span className="font-semibold">{translateCopy(item.label)}</span>
                        <kbd className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[length:calc(9.5px*var(--fs-scale))]">
                          {displayFor(item, apple)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {helpOpen && tab === "tour" && touring && spot && current ? <Spotlight spot={spot} title={current.title} /> : null}
    </>
  );
}
