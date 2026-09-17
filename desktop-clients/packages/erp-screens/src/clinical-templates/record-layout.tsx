"use client";
import React, { useEffect, useRef, useId, type ReactNode } from "react";
import { Button, Card, useLocalization } from "@pepbits/ops-ui";
import type { UserPreferences } from "@pepbits/erp-config";
import styles from "./record-layout.module.css";

/** The same numbered card used by the patient reference, with host-owned fields. */
export function RecordSectionCard({id, title, subtitle, index, icon, reading, onRead, children}: {
  id: string; title: string; subtitle: string; index: number; icon: ReactNode;
  reading?: boolean; onRead?: () => void; children: ReactNode;
}) {
  const {t} = useLocalization();
  return <Card className={styles.card} data-clinical-section={id}>
    <div className={styles.cardHead}>
      <span className={styles.cardIcon}>{icon}</span>
      <div className="min-w-0 flex-1"><h3>{t(title)}</h3><p>{t(subtitle)}</p></div>
      <span className="text-xs font-mono text-[var(--text-muted)]">{t('template.clinical.sectionNumber', {number: String(index + 1).padStart(2, '0')})}</span>
      {onRead && <Button size="sm" variant="ghost" onClick={onRead}>{t(reading ? 'template.clinical.reading' : 'template.clinical.read')}</Button>}
    </div>
    <div className={styles.cardBody}>{children}</div>
  </Card>;
}

/** Presentation slots keep this long-record layout reusable outside patient registration. */
export function RecordSectionLayout<T extends { id: string; title: string }>({
  sections,
  activeOnly = false,
  keepMounted = false,
  showCompletion = true,
  railAlignment = "spread",
  active,
  onActive,
  preferences,
  isDone,
  identity,
  railHeader,
  footer,
  renderSection,
}: {
  sections: T[];
  /** Reuse the record rail with a focused pane instead of stacked sections. */
  activeOnly?: boolean;
  /** Keep host-owned section drafts mounted when switching tabs/wizard steps. */
  keepMounted?: boolean;
  /** Hide completion when the host has no authoritative completion calculation. */
  showCompletion?: boolean;
  /** Compact top-aligned navigation for operational workspaces. */
  railAlignment?: "spread" | "start";
  active: string;
  onActive: (id: string) => void;
  preferences: UserPreferences;
  isDone: (id: string) => boolean;
  identity?: ReactNode;
  railHeader: ReactNode;
  footer: ReactNode;
  renderSection: (section: T) => ReactNode;
}) {
  const instance = useId();
  const { t, direction } = useLocalization(),
    surface = useRef<HTMLDivElement>(null),
    content = useRef<HTMLDivElement>(null),
    observed = useRef(active);
  const layout = preferences.formNavigation,
    count = sections.filter((s) => isDone(s.id)).length;
  const go = (id: string) => {
    observed.current = id;
    onActive(id);
    if (layout === "rail" && !activeOnly) {
      const scroller = content.current;
      const target = scroller?.querySelector<HTMLElement>(`[data-record-section="${id}"]`);
      // Scroll only this form; scrollIntoView also moves the application shell on small screens.
      if (scroller && target) scroller.scrollTo?.({
        top: target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 10,
        behavior: preferences.reducedMotion ? "instant" : "smooth",
      });
    }
  };
  useEffect(() => {
    if (activeOnly && content.current) content.current.scrollTop = 0;
  }, [active, activeOnly]);
  useEffect(() => {
    if (layout === "rail" && !activeOnly && observed.current !== active)
      go(active);
  }, [active, layout]);
  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!element.getClientRects().length) return;
        // Account for shell chrome and page notices, preserving the status-bar gutter.
        const height = Math.max(
          520,
          window.innerHeight -
            Math.max(0, element.getBoundingClientRect().top) -
            48,
        );
        element.style.height = `${height}px`;
      });
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    for (
      let ancestor = element.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    )
      observer?.observe(ancestor);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const step = (s: T, i: number) => (
    <Button
      key={s.id}
      role="tab"
      aria-label={t(s.title)}
      aria-selected={active === s.id}
      id={`${instance}-tab-${s.id}`}
      tabIndex={active === s.id ? 0 : -1}
      aria-controls={
        (layout === "rail" && !activeOnly) || active === s.id
          ? `${instance}-section-${s.id}`
          : undefined
      }
      onKeyDown={(e) => {
        let next = i;
        if (e.key === "Home") next = 0;
        else if (e.key === "End") next = sections.length - 1;
        else if (
          e.key === "ArrowDown" ||
          e.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight")
        )
          next = (i + 1) % sections.length;
        else if (
          e.key === "ArrowUp" ||
          e.key === (direction === "rtl" ? "ArrowRight" : "ArrowLeft")
        )
          next = (i - 1 + sections.length) % sections.length;
        else return;
        e.preventDefault();
        go(sections[next].id);
        document
          .getElementById(`${instance}-tab-${sections[next].id}`)
          ?.focus();
      }}
      variant="ghost"
      className={styles.step}
      data-active={active === s.id}
      onClick={() => go(s.id)}
    >
      <span className={styles.number} data-done={isDone(s.id)}>
        {isDone(s.id) && (layout !== "wizard" || active !== s.id)
          ? "✓"
          : layout === "wizard"
            ? i + 1
            : String(i + 1).padStart(2, "0")}
      </span>
      {layout !== "wizard" || active === s.id ? (
        <span>{t(s.title)}</span>
      ) : null}
    </Button>
  );
  return (
    <div
      ref={surface}
      className={styles.surface}
      data-layout={layout}
      data-rail-alignment={railAlignment}
      data-density={preferences.density}
      data-motion={preferences.reducedMotion ? "reduced" : "full"}
    >
      {identity ? <div className={styles.identity}>{identity}</div> : null}
      <div className={styles.body}>
        {layout === "rail" ? (
          <nav
            className={styles.rail}
            aria-label={t("template.clinical.sections")}
          >
            <div className={styles.railHead}>{railHeader}</div>
            <div
              role="tablist"
              aria-orientation="vertical"
              className={styles.steps}
            >
              {sections.map(step)}
            </div>
            {showCompletion ? <div className={styles.meter}>
              <div>
                {t("template.clinical.completion")}{" "}
                <b>{Math.round((count / sections.length) * 100)}%</b>
              </div>
              <progress
                max={sections.length}
                value={count}
                aria-label={t("template.clinical.completion")}
              />
              <small>
                {t("template.clinical.completeCount", {
                  count,
                  total: sections.length,
                })}
              </small>
            </div> : null}
          </nav>
        ) : null}
        <div className={styles.main}>
          {layout !== "rail" ? (
            <div
              className={`${styles.tabs} ${layout === "wizard" ? styles.wizard : ""}`}
              role="tablist"
            >
              {sections.map(step)}
            </div>
          ) : null}
          <div
            ref={content}
            className={styles.content}
            onScroll={() => {
              if (activeOnly || layout !== "rail" || !content.current) return;
              const top = content.current.getBoundingClientRect().top;
              const nodes = Array.from(
                content.current.querySelectorAll<HTMLElement>(
                  "[data-record-section]",
                ),
              );
              const nearest =
                nodes
                  .filter((n) => n.getBoundingClientRect().top <= top + 90)
                  .at(-1) ?? nodes[0];
              const id = nearest?.dataset.recordSection;
              if (id && id !== active) {
                observed.current = id;
                onActive(id);
              }
            }}
          >
            {sections
              .filter(
                (s) => keepMounted || (layout === "rail" && !activeOnly) || s.id === active,
              )
              .map((s) => (
                <section
                  key={s.id}
                  hidden={((layout !== "rail" || activeOnly) && s.id !== active)}
                  id={`${instance}-section-${s.id}`}
                  aria-labelledby={`${instance}-tab-${s.id}`}
                  data-record-section={s.id}
                  className={styles.section}
                >
                  {renderSection(s)}
                </section>
              ))}
          </div>
        </div>
      </div>
      <footer className={styles.footer}>{footer}</footer>
    </div>
  );
}
