"use client";

import {DocumentationLauncher} from "./documentation";
import { useLocalization } from "@pepbits/i18n/react";

import { LocalizedText } from "@pepbits/i18n/react";


import React from "react";
import { BookOpen, CircleHelp, Building2, ChevronDown, LogOut, Search, SlidersHorizontal } from "@pepbits/icons";
import { moduleLandingPage, productNavigationTarget } from "./products";
import { useNavigation } from "@pepbits/platform";
import { useSession } from "@pepbits/platform";
import { chromePalette } from "./chrome-palette";
import { useERP } from "./shell-context";
import { HeaderClock } from "./header-clock";
import type { ModuleDefinition, ModuleKey } from "./navigation";
import { ActionMenu, DropdownSelect, MenuButton } from "@pepbits/components";
import { Badge } from "@pepbits/ui";

export function Header({inbox}: {inbox?: React.ReactNode} = {}) {
  const {t: translateCopy} = useLocalization();
  const {product, branches, onBranchChange, currentModule, branch, setBranch, setCommandOpen, setHelpOpen, setDocumentationOpen, preferences, preferencesPageId, quickPages, documentation, t} = useERP();
  const navigation = useNavigation();
  const { user, logout } = useSession();
  const activePageId = navigation.current.pageId;
  const openPage = (pageId: string, options?: { mode?: "view" | "edit" | "new"; recordId?: string; title?: string }) =>
    navigation.open({ pageId, ...options });
  /* The module switcher navigates to that module's dashboard and each shell applies
     its own semantics: web pushes the URL, desktop rebuilds its tab set. */
  const setModule = (value: ModuleKey) => {
    const landing = moduleLandingPage(product,value);
    if (landing) navigation.open(productNavigationTarget(product,landing,value));
  };
  /* Same mechanism the sidebar uses: a theme id scopes the whole palette to
     this element, and the tone re-points the generic tokens onto that theme's
     chrome seeds. The bar is translucent with a backdrop blur, so
     --surface-translucent is part of what the helper overrides. */
  const headerPalette = chromePalette(preferences.headerTone);
  const page = product.pages[activePageId];
  const moduleOptions = Object.values(product.modules).filter((item): item is ModuleDefinition => Boolean(item)).map((item) => ({
    value: item.id,
    label: t(item.shortLabelKey ?? item.shortLabel),
    description: t(item.labelKey ?? item.label),
    /* size-5, not size-7. The button is 30px with a 1px border, so its content
       box is 28px -- a 28px tile filled it edge to edge and made the module
       control read as taller than the 30px branch control beside it, even
       though both are the same height. 20px leaves 4px of air top and bottom,
       matching the optical weight of branch's bare 14px glyph. */
    icon: <span className="flex size-5 shrink-0 items-center justify-center rounded-md text-white" style={{ background: item.accent }}>{React.createElement(item.icon, { className: "size-3" })}</span>,
  }));

  return (
    <header data-theme={preferences.headerTheme === "match" ? undefined : preferences.headerTheme} style={headerPalette} className={"no-print relative z-40 flex min-h-[var(--header-height)] shrink-0 items-center gap-1.5 border-b border-[var(--border)] bg-[var(--surface-translucent)] px-3 backdrop-blur-xl "+"flex-wrap py-1 sm:h-[var(--header-height)] sm:flex-nowrap sm:py-0"}>
      <div data-tour="module" className="shrink-0">
      {moduleOptions.length === 1 ? <span className="flex h-[30px] items-center gap-2 rounded-[min(var(--radius),9px)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-semibold" aria-label={t("Module")}>{moduleOptions[0]!.icon}{moduleOptions[0]!.label}</span> : <DropdownSelect
        value={currentModule}
        options={moduleOptions}
        onChange={(value) => setModule(value as ModuleKey)}
        menuClassName="w-64"
        className="shrink-0"
        compact
        triggerClassName={"max-sm:w-[76px] max-sm:max-w-[76px] max-sm:min-w-0"}
      />}
      </div>

      <div className="mx-1 h-7 w-px shrink-0 bg-[var(--border)]" />

      {/* Preserve the page title; secondary text gives up space first. */}
      <div className={"flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden px-1.5 "+"max-sm:order-last max-sm:w-full max-sm:flex-none"}>
        <h1 className="min-w-0 shrink-0 max-w-full truncate text-[length:calc(15px*var(--fs-scale))] font-black tracking-[-.025em] text-[var(--text)]">{t(page?.titleKey ?? page?.title ?? "Workspace")}</h1>
        {page?.subtitle ? <span className="hidden min-w-0 truncate text-[length:calc(11px*var(--fs-scale))] text-[var(--text-muted)] lg:inline">{t(page.subtitleKey ?? page.subtitle)}</span> : null}
        {page?.kind ? <Badge tone="neutral" className="hidden shrink-0 self-center xl:inline-flex">{t(page.kind)}</Badge> : null}
      </div>

      <button type="button" onClick={() => setCommandOpen(true)} className="focus-ring hidden h-[30px] w-36 items-center gap-2 rounded-[9px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-left text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--text-subtle)] transition hover:border-[var(--border-strong)] xl:flex"><Search className="size-3.5" /><span className="flex-1"><LocalizedText message="ui.search.49c266ba" /></span>{preferences.showKeyboardHints ? <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[length:calc(8px*var(--fs-scale))]">⌘K</kbd> : null}</button>

      <HeaderClock />
      {quickPages?.filter(item => product.pages[item.id]).map(item => <button key={item.id} type="button" onClick={() => openPage(item.id)} className="focus-ring rounded-lg px-2 py-1 text-xs">{t(item.label)}</button>)}
      {preferences.documentationEnabled ? <DocumentationLauncher /> : null}
      {preferences.helperEnabled ? <button type="button" aria-label={translateCopy("ui.open.page.helper.b4639461")} title={translateCopy("ui.help.b22e5e67")} onClick={() => setHelpOpen(true)} className="focus-ring grid size-[30px] shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)]"><CircleHelp className="size-4" /></button> : null}
      {inbox}

      {/* The width goes on triggerClassName, not className: className lands on
          the positioning wrapper, while the BUTTON carries compact's
          max-w-40 (160px) -- which silently capped an earlier attempt to set
          this on the wrapper. lg:max-w-none lifts that cap; the media query
          also makes it win over the unprefixed max-w-40.
          Definite rather than content width, because content-sized it changed
          with the selected branch -- "North • Operations Hub" is wider than
          "East • Delivery Center" -- so the header shifted on every switch. */}
      {!onBranchChange ? <span role="status" aria-label="Branch" title={branches.find(b=>b.value===branch)?.label} className="flex min-w-0 max-w-[180px] items-center gap-2 truncate text-[var(--text)] text-[length:calc(12px*var(--fs-scale))] sm:max-w-[220px] lg:max-w-[296px]"><Building2 className="size-3.5 shrink-0 text-[var(--text-muted)]"/><span className="truncate">{branches.find(b=>b.value===branch)?.label ?? "—"}</span></span> : <DropdownSelect value={branch} options={!branch?[{value:"",label:"—",disabled:true},...branches]:[...branches]} onChange={setBranch} label="Branch" hideLabel compact align="right" className="min-w-0 max-sm:flex-1 sm:max-w-[220px] lg:max-w-none" triggerClassName="w-full lg:w-[296px] lg:max-w-none" leading={<Building2 className="size-3.5 shrink-0 text-[var(--text-muted)]" />} menuClassName="w-64" />}

      {/* The original identity block: 13px semibold name over a 10.5px muted
          designation in uppercase with .6px of tracking. The tracking is what
          makes the caps read as a label rather than as shouting -- uppercase
          without it sets too tight, because the letterforms lose the lowercase
          x-height rhythm the spacing was designed around.
          leading-tight, so two lines at 13 + 10.5px take ~29px of the 48px bar
          instead of the ~35px normal leading would. */}
      <div className="hidden min-w-0 shrink-0 flex-col items-end justify-center leading-tight ps-1 2xl:flex">
        <span className="max-w-44 truncate text-[length:calc(13px*var(--fs-scale))] font-semibold text-[var(--text)]">{user?.name ?? "Signed out"}</span>
        <span className="max-w-44 truncate text-[length:calc(10.5px*var(--fs-scale))] uppercase tracking-[.6px] text-[var(--text-muted)]">{user?.title ?? ""}</span>
      </div>

      <ActionMenu trigger={<button type="button" data-tour="profile" aria-label={[translateCopy("ui.open.profile.menu.4a239d3d"),user?.name,user?.initials ?? "--"].filter(Boolean).join(" — ")} className="focus-ring flex h-8 items-center gap-1 rounded-[10px] p-0.5 transition hover:bg-[var(--surface-2)]"><span className="relative flex size-7 items-center justify-center rounded-[9px] bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-[length:calc(9.5px*var(--fs-scale))] font-black text-white shadow-sm">{user?.initials ?? "--"}<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--success)]" /></span><ChevronDown className="size-3 text-[var(--text-subtle)]" /></button>}>
        {(close) => <div className="w-64"><div className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] p-3"><span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-[length:calc(12px*var(--fs-scale))] font-black text-white">{user?.initials ?? "--"}</span><span className="min-w-0"><span className="block truncate text-[length:calc(11px*var(--fs-scale))] font-extrabold">{user?.name ?? "Signed out"}</span><span className="block truncate text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">{user?.email ?? ""}</span></span></div><div className="my-1.5 h-px bg-[var(--border)]" />
          {preferencesPageId && product.pages[preferencesPageId] ? <MenuButton icon={<SlidersHorizontal className="size-3.5" />} label="My Preferences" hint="Layout, theme and behavior" onClick={() => { openPage(preferencesPageId!); close(); }} /> : null}
          <div className="my-1.5 h-px bg-[var(--border)]" />
          <MenuButton icon={<LogOut className="size-3.5" />} label="Sign out" hint="End this secure session" tone="danger" onClick={() => { close(); void logout(); }} />
          <div className="my-1.5 h-px bg-[var(--border)]" />
          {preferences.documentationEnabled && documentation ? <button type="button" onClick={() => { setDocumentationOpen(true); close(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text-muted)] hover:bg-[var(--surface-2)]"><BookOpen className="size-3.5" /><LocalizedText message="ui.product.documentation.2e646170" /></button> : null}
        </div>}
      </ActionMenu>
    </header>
  );
}
