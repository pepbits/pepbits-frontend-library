"use client";
import React, {useEffect, useRef, useState} from "react";
import {Button} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import {consultSectionId} from "../layout/ConsultSection";
import type {ConsultWorkspaceSection} from "./sections";
import type {ConsultSectionProps} from "../models/consult-workflow";

export function SectionRail({instanceId, sections, context, stickyOffset = "0px"}: {
  instanceId: string; sections: readonly ConsultWorkspaceSection[]; context: ConsultSectionProps; stickyOffset?: string;
}) {
  const {t} = useLocalization(), format = useFormatters();
  const rail = useRef<HTMLElement>(null);
  const [active, setActive] = useState<string>(sections[0]?.id ?? "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const offset = rail.current ? parseFloat(getComputedStyle(rail.current).top) || 0 : 0;
    const observer = new IntersectionObserver(entries => {
      const first = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (first) setActive(sections.find(section => consultSectionId(instanceId, section.id) === first.target.id)?.id ?? "");
    }, {rootMargin: `-${offset}px 0px -60% 0px`});
    sections.forEach(section => { const node = document.getElementById(consultSectionId(instanceId, section.id)); if (node) {node.style.scrollMarginTop = stickyOffset; observer.observe(node);} });
    return () => observer.disconnect();
  }, [instanceId, sections, stickyOffset]);
  const complete = sections.filter(section => section.state?.(context) === "done").length;
  return <aside ref={rail} style={{position: "sticky", top: stickyOffset, alignSelf: "start"}}>
    <p>{t("Note progress")}: {format.number(sections.length ? Math.round(complete / sections.length * 100) : 0)}%</p>
    <nav aria-label={t("Note sections")} className="flex flex-wrap gap-1 xl:grid">
      {sections.map(section => <Button key={section.id} variant="ghost" aria-current={active === section.id ? "location" : undefined}
        onClick={() => { setActive(section.id); const node = document.getElementById(consultSectionId(instanceId, section.id)); if (node) {node.style.scrollMarginTop = stickyOffset; node.scrollIntoView({block: "start", behavior: "instant"});} }}>
        {t(section.title)}{section.state ? ` · ${t(({done: "Complete", partial: "Started", empty: "Not started", blocked: "Needed to sign"})[section.state(context)])}` : ""}
      </Button>)}
    </nav>
  </aside>;
}
