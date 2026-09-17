"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Command, PanelLeftClose, PanelLeftOpen, Pin, PinOff, Search, SlidersHorizontal, X } from "lucide-react";
import { NavLink, cn } from "@pepbits/ops-ui";
import { useNavigation } from "@pepbits/platform-ports";
import { chromePalette } from "./chrome-palette";
import { useProduct } from "./product-context";
import { useERP } from "./erp-context";
import { SIDEBAR_SEARCH_EVENT } from "@pepbits/erp-config";
import type { MenuItem, MenuSection } from "@pepbits/erp-config";

const matchText = (item: MenuItem, term: string, t: (key: string) => string) => `${item.label} ${t(item.labelKey ?? item.label)}`.toLowerCase().includes(term);

/**
 * The navigation tree, narrowed to what matches.
 *
 * A parent that matches keeps ALL of its children -- searching "billing" should
 * show the whole Billing group, not an empty one. A parent that does not match
 * keeps only the children that do. Sections and groups left with nothing are
 * dropped, so no empty headings survive.
 */
function filterNavigation(navigation: MenuSection[], query: string, t: (key: string) => string): MenuSection[] {
  const term = query.trim().toLowerCase();
  if (!term) return navigation;
  const sections: MenuSection[] = [];
  for (const section of navigation) {
    const items: MenuItem[] = [];
    for (const item of section.items) {
      if (matchText(item, term, t)) { items.push(item); continue; }
      const children = item.children?.filter((child) => matchText(child, term, t)) ?? [];
      if (children.length) items.push({ ...item, children });
    }
    if (items.length) sections.push({ ...section, items });
  }
  return sections;
}

/** Every leaf page a filtered tree still offers, for the result count. */
function countPages(sections: MenuSection[]): number {
  return sections.reduce((total, section) => total + section.items.reduce(
    (sum, item) => sum + (item.children?.length ?? (item.pageId ? 1 : 0)), 0), 0);
}

function SidebarLeaf({ item, expanded, active, href, onSelect }: { item: MenuItem; expanded: boolean; active: boolean; href: string; onSelect: () => void }) {
  const {t}=useLocalization();
  const Icon = item.icon;
  return (
    <NavLink
      href={href}
      title={!expanded ? t(item.labelKey ?? item.label) : undefined}
      onClick={(event) => { event.preventDefault(); onSelect(); }}
      className={cn(
        "focus-ring group relative flex h-9 w-full items-center rounded-[10px] border text-start transition",
        expanded ? "gap-2.5 px-2.5" : "justify-center px-1",
        active
          ? "border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-[var(--primary-soft)] text-[var(--primary-strong)]"
          : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
      )}
    >
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-lg transition", active ? "bg-[var(--surface)] shadow-sm" : "group-hover:bg-[var(--surface)]")}>{Icon ? <Icon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current opacity-55" />}</span>
      {expanded ? <span className="min-w-0 flex-1 truncate text-[length:calc(11px*var(--fs-scale))] font-bold">{<LocalizedText message={item.labelKey ?? item.label} />}</span> : null}
      {expanded && item.badge ? <span className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[length:calc(9px*var(--fs-scale))] font-extrabold text-[var(--text-muted)]">{item.badge}</span> : null}
      {active ? <span className={cn("absolute inset-y-2 w-0.5 rounded-full bg-[var(--primary)]", "left-0")} /> : null}
    </NavLink>
  );
}

function SidebarGroup({ item, expanded, activePageId, hrefFor, onSelect, forceOpen }: { item: MenuItem; expanded: boolean; activePageId: string; hrefFor: (pageId: string) => string; onSelect: (pageId: string) => void; forceOpen?: boolean }) {
  const childActive = item.children?.some((child) => child.pageId === activePageId) ?? false;
  const [selfOpen, setSelfOpen] = useState(childActive || item.id === "billing" || item.id === "fin-parties");
  /* While filtering, a collapsed group would hide the very children the search
     surfaced. forceOpen overrides without touching the user's own toggle, so
     clearing the box restores exactly the groups they had open. */
  const open = forceOpen || selfOpen;
  const setOpen = setSelfOpen;
  const {t}=useLocalization();
  const Icon = item.icon;

  if (!item.children?.length && item.pageId) return <SidebarLeaf item={item} expanded={expanded} active={item.pageId === activePageId} href={hrefFor(item.pageId)} onSelect={() => onSelect(item.pageId!)} />;
  return (
    <div>
      <button
        type="button"
        title={!expanded ? t(item.labelKey ?? item.label) : undefined}
        onClick={() => setOpen((previous) => !previous)}
        className={cn("focus-ring group flex h-9 w-full items-center rounded-[10px] border border-transparent text-start text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]", expanded ? "gap-2.5 px-2.5" : "justify-center px-1", childActive && "text-[var(--primary-strong)]")}
      >
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-lg", childActive && "bg-[var(--primary-soft)]")}>{Icon ? <Icon className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}</span>
        {expanded ? <><span className="min-w-0 flex-1 truncate text-[length:calc(11px*var(--fs-scale))] font-bold">{<LocalizedText message={item.labelKey ?? item.label} />}</span>{open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}</> : null}
      </button>
      {expanded && open ? (
        <div className="relative ms-[21px] mt-0.5 space-y-0.5 border-s border-[var(--border)] ps-3">
          {item.children?.map((child) => {
            const active = child.pageId === activePageId;
            return (
              <NavLink key={child.id} href={child.pageId ? hrefFor(child.pageId) : "#"} onClick={(event) => { event.preventDefault(); if (child.pageId) onSelect(child.pageId); }} className={cn("focus-ring group relative flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[length:calc(10.5px*var(--fs-scale))] font-semibold transition", active ? "bg-[var(--primary-soft)] text-[var(--primary-strong)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]")}>
                <span className={cn("absolute -start-[14px] top-1/2 h-px w-3 bg-[var(--border)]", active && "bg-[var(--primary)]")} />
                {child.icon ? React.createElement(child.icon, { className: "size-3.5 shrink-0" }) : <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" />}
                <span className="min-w-0 flex-1 truncate">{<LocalizedText message={child.labelKey ?? child.label} />}</span>
                {child.badge ? <span className="rounded-full bg-[var(--surface-3)] px-1.5 py-0.5 text-[length:calc(8px*var(--fs-scale))]">{child.badge}</span> : null}
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const {t: translateCopy} = useLocalization();
  const product = useProduct();
  const { t } = useLocalization();
  const { module, preferences, updatePreference } = useERP();
  const navigation = useNavigation();
  const activePageId = navigation.current.pageId;
  const openPage = (pageId: string) => navigation.open({ pageId });
  const hrefForPage = (pageId: string) => navigation.hrefFor({ pageId });
  const [hovered, setHovered] = useState(false);
  /* Click mode keeps its own latch. It is NOT sidebarPinned: pinning also makes
     the rail part of the layout and pushes the page, whereas a clicked-open
     sidebar still floats over it and still closes when you click away. */
  const [latched, setLatched] = useState(false);
  const byHover = preferences.sidebarExpandOn === "hover";
  /* Keyboard focus opens the rail on the same terms hover does, when the
     preference allows it. Without this the rail is mouse-only: tabbing into it
     moves the caret through labels that are not rendered, so a keyboard user
     navigates a menu they cannot read.

     `focusWithin` is tracked separately from `hovered` rather than folded into
     it, because they end for different reasons -- a pointer leaves, focus moves
     to a specific element -- and collapsing them makes one clear the other. */
  const [focusWithin, setFocusWithin] = useState(false);

  /* Alt+/ asks for the menu search. The shortcut broadcasts; the sidebar decides
     what "search" means here — expanding itself first, because focusing an input
     nobody can see is not what was asked for. */
  useEffect(() => {
    const onAsk = () => {
      setLatched(true);
      setFocusWithin(true);
      window.setTimeout(() => searchRef.current?.focus(), 0);
    };
    window.addEventListener(SIDEBAR_SEARCH_EVENT, onAsk);
    return () => window.removeEventListener(SIDEBAR_SEARCH_EVENT, onAsk);
  }, []);
  const focusOpens = preferences.sidebarFocusExpand && focusWithin;
  const expanded = preferences.sidebarPinned || focusOpens || (byHover ? hovered : latched);
  const isRight = preferences.sidebarPlacement === "right";

  const railPalette = chromePalette(preferences.sidebarTone);
  const SideIcon = isRight ? ChevronsLeft : ChevronsRight;
  const brandLetters = useMemo(() => module.shortLabel.slice(0, 2).toUpperCase(), [module.shortLabel]);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0;
  const sections = useMemo(() => filterNavigation(module.navigation, query, t), [module.navigation, query, t]);
  const resultCount = useMemo(() => (searching ? countPages(sections) : 0), [searching, sections]);

  /* A query is about one module's tree, so switching module clears it --
     otherwise the new module opens filtered by a word chosen for the old one,
     and usually shows nothing. */
  useEffect(() => { setQuery(""); }, [module.id]);

  /* Collapsing the rail hides the input; a query left behind would keep the
     tree filtered with nothing on screen explaining why. */
  useEffect(() => { if (!expanded) setQuery(""); }, [expanded]);

  return (
    <>
      {/* The spacer is what holds the layout open, and it only ever grows when the
          sidebar is PINNED. Hover expansion floats the panel over the page instead of
          moving it — the same arrangement as pepcare's rail, where .shell-main takes
          margin-left: var(--rail-w) and only gains .pushed while pinned. */}
      <div
        aria-hidden
        className={cn(
          "no-print shrink-0 transition-[width] duration-200",
          preferences.sidebarPinned ? "w-[var(--sidebar-expanded)]" : "w-[var(--sidebar-collapsed)]",
        )}
      />
      <aside
        aria-label={translateCopy("ui.primary.navigation.e1bfe7ec")}
        data-tour="sidebar"
        /* A theme id here re-resolves EVERY palette token inside the rail from
           that theme's block, so the sidebar can run Solarized while the page
           runs Nexora. It works because tokens.css separates the structural
           block (:root only -- radius, font, heights) from the palette block
           (`:root, [data-theme="nexora"]`): scoping a theme to an element
           swaps colours without resetting the sizes the provider set on <html>.
           railPalette then reads THIS theme's --sidebar-* seeds, so the two
           preferences compose rather than fight. */
        data-theme={preferences.sidebarTheme === "match" ? undefined : preferences.sidebarTheme}
        style={railPalette}
        onMouseEnter={() => byHover && setHovered(true)}
        onMouseLeave={() => byHover && setHovered(false)}
        /* onFocus/onBlur bubble in React, so these fire for any descendant --
           which is the whole point: focus anywhere inside the rail counts.
           relatedTarget is where focus is GOING; if that is still inside the
           rail the sidebar must stay open, otherwise tabbing between two of its
           own links would close it under the user. */
        onFocus={() => preferences.sidebarFocusExpand && setFocusWithin(true)}
        onBlur={(event) => {
          if (!preferences.sidebarFocusExpand) return;
          const next = event.relatedTarget as Node | null;
          if (!next || !event.currentTarget.contains(next)) setFocusWithin(false);
        }}
        className={cn(
          "no-print absolute inset-y-0 z-50 flex flex-col bg-[var(--surface)] transition-[width] duration-200",
          isRight ? "right-0 border-s border-[var(--border)]" : "left-0 border-r border-[var(--border)]",
          expanded ? "w-[var(--sidebar-expanded)]" : "w-[var(--sidebar-collapsed)]",
          /* Lifted off the page only while it is actually floating over it. Pinned, it
             is part of the layout again and takes the flat resting shadow. */
          expanded && !preferences.sidebarPinned ? "shadow-[var(--shadow-lg)]" : "shadow-[var(--shadow-sm)]",
        )}
      >
      <div className="flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b border-[var(--border)] px-3">
        {byHover ? (
          <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[var(--primary-fill)] text-white shadow-md">
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,.38),transparent_42%)]" />
            <Command className="relative size-4" />
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            title={expanded ? "Collapse navigation" : "Expand navigation"}
            onClick={() => setLatched((previous) => !previous)}
            className="focus-ring relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[var(--primary-fill)] text-white shadow-md"
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,.38),transparent_42%)]" />
            <Command className="relative size-4" />
          </button>
        )}
        {expanded ? <div className="min-w-0 flex-1"><div className="truncate text-[length:calc(13px*var(--fs-scale))] font-black tracking-[-.04em]">{product.name} {product.accentName ? <span className="text-[var(--primary-strong)]">{product.accentName}</span> : null}</div><div className="truncate text-[length:calc(9px*var(--fs-scale))] font-bold uppercase tracking-[.15em] text-[var(--text-subtle)]">{product.tagline}</div></div> : null}
        {expanded ? <button type="button" title={preferences.sidebarPinned ? "Unpin sidebar" : "Pin sidebar"} onClick={() => updatePreference("sidebarPinned", !preferences.sidebarPinned)} className={cn("focus-ring flex size-8 items-center justify-center rounded-lg border transition", preferences.sidebarPinned ? "border-[color-mix(in_srgb,var(--primary)_25%,transparent)] bg-[var(--primary-soft)] text-[var(--primary)]" : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]")}>{preferences.sidebarPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}</button> : null}
      </div>

      <div className="shrink-0 border-b border-[var(--border)] px-3 py-3">
        <div className={cn("flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]", expanded ? "gap-2 px-2.5 py-2" : "justify-center p-1.5")}>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[length:calc(10px*var(--fs-scale))] font-black text-white" style={{ background: module.accent }}>{brandLetters}</div>
          {expanded ? <div className="min-w-0"><div className="truncate text-[length:calc(11px*var(--fs-scale))] font-extrabold text-[var(--text)]">{<LocalizedText message={module.labelKey ?? module.label} />}</div><div className="truncate text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.module.navigation.62254823" /></div></div> : null}
        </div>
      </div>

      {/* Expanded only. At 68px the rail has no room for an input, and hovering
          expands it anyway -- so collapsed it is a button that expands and
          focuses in one click rather than a cramped box. */}
      <div className={cn("shrink-0 border-b border-[var(--border)]", expanded ? "px-3 py-2.5" : "px-2 py-2")}>
        {expanded ? (
          <div className="group relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-subtle)] transition group-focus-within:text-[var(--primary)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); event.currentTarget.blur(); } }}
              placeholder={t("Search {module} menu…",{module:t(module.shortLabel)})}
              aria-label={t("Search the {module} menu",{module:t(module.labelKey ?? module.label)})}
              className="focus-ring h-8 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] ps-8 pe-7 text-[length:calc(10.5px*var(--fs-scale))] font-semibold text-[var(--text)] transition placeholder:font-normal placeholder:text-[var(--text-subtle)] hover:border-[var(--border-strong)] focus:bg-[var(--surface)]"
            />
            {searching ? (
              <button type="button" aria-label={translateCopy("ui.clear.search.3b7ea517")} onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                className="focus-ring absolute end-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] transition hover:bg-[var(--surface-3)] hover:text-[var(--text)]">
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        ) : (
          <button type="button" aria-label={translateCopy("ui.search.menu.30a52f50")} title={translateCopy("ui.search.menu.30a52f50")}
            onClick={() => window.setTimeout(() => searchRef.current?.focus(), 0)}
            className="focus-ring mx-auto flex size-8 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-subtle)] transition hover:border-[var(--primary)] hover:text-[var(--text)]">
            <Search className="size-3.5" />
          </button>
        )}
        {searching ? (
          <div className="mt-1.5 flex items-center justify-between px-0.5 text-[length:calc(8.5px*var(--fs-scale))] font-bold text-[var(--text-muted)]">
            <span>{resultCount} {resultCount === 1 ? "page" : "pages"}</span>
            <span className="text-[var(--text-subtle)]"><LocalizedText message="ui.esc.to.clear.3bfa5f77" /></span>
          </div>
        ) : null}
      </div>

      <nav className={cn("nex-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3", expanded ? "px-3" : "px-2")}>
        {searching && sections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-3 py-6 text-center">
            <Search className="mx-auto size-4 text-[var(--text-subtle)]" />
            <p className="mt-2 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text)]"><LocalizedText message="ui.no.menu.item.matches.a442b70a" /></p>
            <p className="mt-0.5 text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">“{query.trim()}<LocalizedText message="ui.is.not.in.82f33b7f" />{" "}{<LocalizedText message={module.labelKey ?? module.label} />}<LocalizedText message="ui.try.another.module.0a6adf30" /></p>
          </div>
        ) : null}
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className={cn(sectionIndex > 0 && "mt-4")}>
            {expanded ? <div className="mb-1.5 flex items-center gap-2 px-2 text-[length:calc(8.5px*var(--fs-scale))] font-black uppercase tracking-[.16em] text-[var(--text-subtle)]"><span>{<LocalizedText message={section.labelKey ?? section.label} />}</span><span className="h-px flex-1 bg-[var(--border)]" /></div> : <div className="mx-auto mb-1.5 h-px w-7 bg-[var(--border)]" />}
            <div className="space-y-0.5">
              {section.items.map((item) => <SidebarGroup key={item.id} item={item} expanded={expanded} activePageId={activePageId} hrefFor={hrefForPage} onSelect={openPage} forceOpen={searching} />)}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[var(--border)] p-2">
        {product.pages.preferences && <button type="button" title={translateCopy("ui.my.preferences.164a6ee1")} onClick={() => openPage("preferences")} className={cn("focus-ring flex h-9 w-full items-center rounded-[10px] text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]", expanded ? "gap-2.5 px-2.5" : "justify-center")}><span className="flex size-6 items-center justify-center"><SlidersHorizontal className="size-3.5" /></span>{expanded ? <span className="text-[length:calc(11px*var(--fs-scale))] font-bold"><LocalizedText message="ui.my.preferences.164a6ee1" /></span> : null}</button>}
        <button type="button" title={preferences.sidebarPinned ? "Sidebar is fixed" : "Sidebar expands on hover"} onClick={() => updatePreference("sidebarPinned", !preferences.sidebarPinned)} className={cn("focus-ring mt-0.5 flex h-9 w-full items-center rounded-[10px] text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]", expanded ? "gap-2.5 px-2.5" : "justify-center")}>
          <span className="flex size-6 items-center justify-center">{preferences.sidebarPinned ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}</span>
          {expanded ? <span className="min-w-0 flex-1 text-start text-[length:calc(10px*var(--fs-scale))] font-semibold">{preferences.sidebarPinned ? <LocalizedText message="ui.unfix.sidebar.fcdb31f7" /> : <LocalizedText message="ui.fix.sidebar.open.5cfa2a6b" />}</span> : null}
          {expanded ? <SideIcon className="size-3 text-[var(--text-subtle)]" /> : null}
        </button>
        </div>
      </aside>
    </>
  );
}
