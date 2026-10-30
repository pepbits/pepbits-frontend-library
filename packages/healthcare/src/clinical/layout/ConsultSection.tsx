"use client";
import React, {useId, useState, type ReactNode} from "react";
import {Button, cn} from "@pepbits/ui";
import {Card} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";
import {TEXT} from "./panel";

export interface ConsultSectionLayoutProps {
  /** Workspace supplies an instance-scoped anchor (use consultSectionId). */
  id: string; title: string; subtitle?: string; actions?: ReactNode; status?: ReactNode; children: ReactNode;
  collapsed?: boolean; defaultCollapsed?: boolean; onCollapsedChange?: (collapsed: boolean) => void;
  collapsible?: boolean; className?: string; bodyClassName?: string; stickyOffset?: string;
}
export const consultSectionId = (instanceId: string, section: string) => `${instanceId}-${section}`;
/** Collapsing hides rather than unmounts fields, retaining unsaved values and accessible anchors. */
export function ConsultSection({id, title, subtitle, actions, status, children, collapsed, defaultCollapsed = false,
  onCollapsedChange, collapsible = collapsed !== undefined || onCollapsedChange !== undefined || defaultCollapsed, className, bodyClassName = "p-4", stickyOffset = "0px"}: ConsultSectionLayoutProps) {
  const {t} = useLocalization(), uid = useId();
  const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed);
  const closed = collapsed ?? localCollapsed;
  const bodyId = `${uid}-body`, titleId = `${uid}-title`;
  return <Card as="section" id={id} aria-labelledby={titleId} style={{scrollMarginTop: stickyOffset}} className={cn("min-w-0", className)}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
      <div><h2 id={titleId} className={TEXT.heading}>{t(title)}</h2>{subtitle && <p className={TEXT.muted}>{t(subtitle)}</p>}</div>
      <div className="flex flex-wrap items-center gap-2">{status}{actions}{collapsible && <Button variant="ghost" size="sm"
        aria-expanded={!closed} aria-controls={bodyId} aria-label={`${t(closed ? "Expand" : "Collapse")} ${t(title)}`}
        onClick={() => {if (collapsed === undefined) setLocalCollapsed(!closed); onCollapsedChange?.(!closed);}}>
        {t(closed ? "Expand" : "Collapse")}
      </Button>}</div>
    </header>
    <div id={bodyId} hidden={closed} className={bodyClassName}>{children}</div>
  </Card>;
}
