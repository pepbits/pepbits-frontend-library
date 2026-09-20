"use client";
import {useShellHost} from "./shell-host";
import {DocumentationLauncher} from "./documentation";
import { useLocalization } from "@pepbits/ops-ui";

import { LocalizedText } from "@pepbits/ops-ui";

import { useProduct } from "./product-context";

import React, { useState } from "react";
import { ArrowRight, Bell, BookOpen, CircleHelp, Building2, ChevronDown, CircleUserRound, LogOut, Mail, MessageSquareText, Search, Settings, SlidersHorizontal, UserRound } from "lucide-react";
import { BRANCHES, MESSAGES, NOTIFICATIONS } from "@pepbits/erp-config";
import { useNavigation } from "@pepbits/platform-ports";
import { useSession } from "@pepbits/auth";
import { chromePalette } from "./chrome-palette";
import { dashboardPageId, useERP } from "./erp-context";
import { HeaderClock } from "./header-clock";
import type { ModuleKey, NotificationKind } from "@pepbits/erp-config";
import { ActionMenu, DropdownSelect, MenuButton, cn } from "@pepbits/ops-ui";
import { Badge } from "@pepbits/ops-ui";

/** Semantic token per kind, so the dot means something rather than matching a
    palette. Tailwind cannot see a class built by string concatenation, so these
    are written out in full. */
const KIND_DOT: Record<NotificationKind, string> = {
  warning: "bg-[var(--warning)]",
  danger: "bg-[var(--danger)]",
  success: "bg-[var(--success)]",
  info: "bg-[var(--info)]",
};

/* Vantage's inbox trigger: a bordered box whose border picks up the accent on
   hover, with the count overflowing the top corner. Nexora's IconButton is
   borderless by design, so this is its own control rather than a variant --
   the header's other icon buttons should stay borderless.

   The corner is min(--radius, 10px), not --radius: at the default 14px on a
   36px box the "rounded square" reads as a circle, and at cornerRadius 0 it
   still squares off exactly as Vantage's does.

   -end-1.5, not -right-1.5: the badge has to sit on the outer corner in Arabic
   too, and the shell flips to RTL. */
function InboxTrigger({ label, count, tone, children }: { label: string; count: number; tone: "danger" | "primary"; children: React.ReactNode }) {
  const {t}=useLocalization();
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={count ? t("{label} ({count} unread)",{label:t(label),count}) : t(label)}
        title={label}
        className="focus-ring grid size-[30px] place-items-center rounded-[min(var(--radius),9px)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[var(--primary)] hover:text-[var(--text)]"
      >
        {children}
      </button>
      {count ? (
        <span
          className="pointer-events-none absolute -top-1.5 -end-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[length:calc(9px*var(--fs-scale))] font-black tabular-nums text-white"
          style={{ background: `var(--${tone === "danger" ? "danger" : "primary"})` }}
        >
          {count}
        </span>
      ) : null}
    </div>
  );
}

export function Header(props: {branches?: Array<{value:string;label:string}>; showInbox?:boolean} = {}) {
  const host=useShellHost();const branches=props.branches??host?.branches??BRANCHES;const showInbox=props.showInbox??host?.showInbox??!host;
  const {t: translateCopy} = useLocalization();
  const product = useProduct();
  const { currentModule, branch, setBranch, setCommandOpen, setHelpOpen, setDocumentationOpen, preferences, toast, t } = useERP();
  /* Component state, not a preference: "I have read these" is per session in a
     mock with no server-side read state, and persisting it to the account would
     imply the notifications themselves are per-account, which they are not. */
  /* Counts the UNREAD ones, not every one. It counted the length, which was
     the same number only while every fixture happened to be unread. The moment
     notifications gained a read flag the bell said 10 and the page said 5 --
     the badge is a promise about what you will find, and it was breaking it. */
  const [unreadNotifications, setUnreadNotifications] = useState(NOTIFICATIONS.filter((item) => item.unread).length);
  const [unreadMessages, setUnreadMessages] = useState(MESSAGES.filter((item) => item.unread).length);
  const markNotificationsRead = () => setUnreadNotifications(0);
  const markMessagesRead = () => setUnreadMessages(0);
  const navigation = useNavigation();
  const { user, logout } = useSession();
  const activePageId = navigation.current.pageId;
  const openPage = (pageId: string, options?: { mode?: "view" | "edit" | "new"; recordId?: string; title?: string }) =>
    navigation.open({ pageId, ...options });
  /* The module switcher navigates to that module's dashboard and each shell applies
     its own semantics: web pushes the URL, desktop rebuilds its tab set. */
  const setModule = (value: ModuleKey) => navigation.open({ pageId: dashboardPageId(value) });
  /* Same mechanism the sidebar uses: a theme id scopes the whole palette to
     this element, and the tone re-points the generic tokens onto that theme's
     chrome seeds. The bar is translucent with a backdrop blur, so
     --surface-translucent is part of what the helper overrides. */
  const headerPalette = chromePalette(preferences.headerTone);
  const page = product.pages[activePageId];
  const moduleOptions = Object.values(product.modules).map((item) => ({
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
    <header data-theme={preferences.headerTheme === "match" ? undefined : preferences.headerTheme} style={headerPalette} className={"no-print relative z-40 flex min-h-[var(--header-height)] shrink-0 items-center gap-1.5 border-b border-[var(--border)] bg-[var(--surface-translucent)] px-3 backdrop-blur-xl "+(host?"flex-wrap py-1 sm:h-[var(--header-height)] sm:flex-nowrap sm:py-0":"h-[var(--header-height)]")}>
      <div data-tour="module" className="shrink-0">
      <DropdownSelect
        value={currentModule}
        options={moduleOptions}
        onChange={(value) => setModule(value as ModuleKey)}
        menuClassName="w-64"
        className="shrink-0"
        compact={!!host}
        triggerClassName={host?"max-sm:w-[76px] max-sm:max-w-[76px] max-sm:min-w-0":""}
      />
      </div>

      <div className="mx-1 h-7 w-px shrink-0 bg-[var(--border)]" />

      {/* Preserve the page title; secondary text gives up space first. */}
      <div className={"flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden px-1.5 "+(host?"max-sm:order-last max-sm:w-full max-sm:flex-none":"")}>
        <h1 className="min-w-0 shrink-0 max-w-full truncate text-[length:calc(15px*var(--fs-scale))] font-black tracking-[-.025em] text-[var(--text)]">{t(page?.titleKey ?? page?.title ?? "Workspace")}</h1>
        {page?.subtitle ? <span className="hidden min-w-0 truncate text-[length:calc(11px*var(--fs-scale))] text-[var(--text-muted)] lg:inline">{t(page.subtitleKey ?? page.subtitle)}</span> : null}
        {page?.kind ? <Badge tone="neutral" className="hidden shrink-0 self-center xl:inline-flex">{t(page.kind)}</Badge> : null}
      </div>

      <button type="button" onClick={() => setCommandOpen(true)} className="focus-ring hidden h-[30px] w-36 items-center gap-2 rounded-[9px] border border-[var(--border)] bg-[var(--surface-2)] px-2.5 text-left text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--text-subtle)] transition hover:border-[var(--border-strong)] xl:flex"><Search className="size-3.5" /><span className="flex-1"><LocalizedText message="ui.search.49c266ba" /></span>{preferences.showKeyboardHints ? <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[length:calc(8px*var(--fs-scale))]">⌘K</kbd> : null}</button>

      {/* Vantage's inbox popovers: a count badge on the trigger, a titled head
          with a "Mark all read" action, then rows of coloured dot + title +
          body + age. The dot is a semantic token, so a notification is coloured
          by what it MEANS rather than by a hex picked at the call site. */}
      <span className={host?"hidden sm:contents":"contents"}>{host?(preferences.documentationEnabled?<button type="button" aria-label={translateCopy("Documentation Center")} onClick={()=>setDocumentationOpen(true)} className="focus-ring grid size-[30px] place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)]"><BookOpen className="size-4"/></button>:null):<DocumentationLauncher />}</span>
      {preferences.helperEnabled ? <button type="button" aria-label={translateCopy("ui.open.page.helper.b4639461")} title={translateCopy("ui.help.b22e5e67")} onClick={() => setHelpOpen(true)} className={"focus-ring size-[30px] shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-2)] "+(host?"hidden sm:grid":"grid")}><CircleHelp className="size-4" /></button> : null}
      {showInbox ? <>
      <ActionMenu trigger={<InboxTrigger label={t("notifications")} count={unreadNotifications} tone="danger"><Bell className="size-3.5" /></InboxTrigger>}>
        {(close) => (
          <div className="-m-1.5 w-[340px] overflow-hidden rounded-xl">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5">
              <span className="text-[length:calc(12px*var(--fs-scale))] font-extrabold">{t("notifications")}</span>
              <button type="button" onClick={() => { markNotificationsRead(); close(); toast({ title: "All notifications marked as read", type: "info" }); }} className="focus-ring rounded-md px-1 text-[length:calc(9.5px*var(--fs-scale))] font-bold text-[var(--primary)] hover:underline"><LocalizedText message="ui.mark.all.read.3bc62a9e" /></button>
            </div>
            <div className="nex-scrollbar max-h-[min(60vh,380px)] overflow-y-auto">
              {NOTIFICATIONS.map((item) => (
                <button key={item.id} type="button"
                  /* Was `close` alone: the row looked clickable and did nothing.
                     It now opens the record where there is one, and the full
                     list otherwise, so no row is a dead end. */
                  onClick={() => { close(); navigation.open(item.target && product.pages[item.target.pageId] ? item.target : { pageId: "notifications" }); }}
                  className="flex w-full gap-2.5 border-b border-[var(--border)] px-3 py-2.5 text-left transition last:border-0 hover:bg-[var(--surface-2)]">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT[item.kind])} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[length:calc(10.5px*var(--fs-scale))] font-bold">{item.title}</span>
                    <span className="text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{item.body}</span>
                  </span>
                  <span className="ms-auto shrink-0 text-[length:calc(9px*var(--fs-scale))] text-[var(--text-subtle)]">{item.time}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { close(); navigation.open({ pageId: "notifications" }); }}
              className="focus-ring flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--primary)] transition hover:bg-[var(--surface-3)]"><LocalizedText message="ui.see.all.notifications.00f66a6a" />{" "}<ArrowRight className="size-3.5" />
            </button>
          </div>
        )}
      </ActionMenu>

      <ActionMenu trigger={<InboxTrigger label={t("messages")} count={unreadMessages} tone="primary"><MessageSquareText className="size-3.5" /></InboxTrigger>}>
        {(close) => (
          <div className="-m-1.5 w-[340px] overflow-hidden rounded-xl">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5">
              <span className="text-[length:calc(12px*var(--fs-scale))] font-extrabold">{t("messages")}</span>
              <button type="button" onClick={() => { markMessagesRead(); close(); toast({ title: "All messages marked as read", type: "info" }); }} className="focus-ring rounded-md px-1 text-[length:calc(9.5px*var(--fs-scale))] font-bold text-[var(--primary)] hover:underline"><LocalizedText message="ui.mark.all.read.3bc62a9e" /></button>
            </div>
            <div className="nex-scrollbar max-h-[min(60vh,380px)] overflow-y-auto">
              {MESSAGES.map((item) => (
                <button key={item.id} type="button"
                  onClick={() => { close(); navigation.open(item.target && product.pages[item.target.pageId] ? item.target : { pageId: "messages" }); }}
                  className="flex w-full gap-2.5 border-b border-[var(--border)] px-3 py-2.5 text-left transition last:border-0 hover:bg-[var(--surface-2)]">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[length:calc(9.5px*var(--fs-scale))] font-black text-[var(--primary-strong)]">{item.initials}</span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[length:calc(10.5px*var(--fs-scale))] font-bold">{item.from}</span>
                    <span className="truncate text-[length:calc(9.5px*var(--fs-scale))] text-[var(--text-muted)]">{item.body}</span>
                  </span>
                  <span className="ms-auto shrink-0 text-[length:calc(9px*var(--fs-scale))] text-[var(--text-subtle)]">{item.time}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { close(); navigation.open({ pageId: "messages" }); }}
              className="focus-ring flex w-full items-center justify-center gap-1.5 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--primary)] transition hover:bg-[var(--surface-3)]"><LocalizedText message="ui.see.all.messages.082f7c89" />{" "}<ArrowRight className="size-3.5" />
            </button>
          </div>
        )}
      </ActionMenu>
      </> : null}


      {/* The width goes on triggerClassName, not className: className lands on
          the positioning wrapper, while the BUTTON carries compact's
          max-w-40 (160px) -- which silently capped an earlier attempt to set
          this on the wrapper. lg:max-w-none lifts that cap; the media query
          also makes it win over the unprefixed max-w-40.
          Definite rather than content width, because content-sized it changed
          with the selected branch -- "Sharjah • Operations Hub" is wider than
          "Kochi • Delivery Center" -- so the header shifted on every switch. */}
      {host?.branchReadOnly ? <span role="status" aria-label="Branch" title={branches.find(b=>b.value===branch)?.label} className="flex min-w-0 max-w-[180px] items-center gap-2 truncate text-[var(--text)] text-[length:calc(12px*var(--fs-scale))] sm:max-w-[220px] lg:max-w-[296px]"><Building2 className="size-3.5 shrink-0 text-[var(--text-muted)]"/><span className="truncate">{branches.find(b=>b.value===branch)?.label ?? "—"}</span></span> : <DropdownSelect value={branch} options={host&&!branch?[{value:"",label:"—",disabled:true},...branches]:branches} onChange={setBranch} label="Branch" hideLabel compact align={host?"right":"left"} className={host?"min-w-0 max-sm:flex-1 sm:max-w-[220px] lg:max-w-none":"hidden lg:block"} triggerClassName="w-full lg:w-[296px] lg:max-w-none" leading={<Building2 className="size-3.5 shrink-0 text-[var(--text-muted)]" />} menuClassName="w-64" />}

      {/* Vantage's identity block: 13px semibold name over a 10.5px muted
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

      <ActionMenu trigger={<button type="button" data-tour="profile" aria-label={translateCopy("ui.open.profile.menu.4a239d3d")} className="focus-ring flex h-8 items-center gap-1 rounded-[10px] p-0.5 transition hover:bg-[var(--surface-2)]"><span className="relative flex size-7 items-center justify-center rounded-[9px] bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-[length:calc(9.5px*var(--fs-scale))] font-black text-white shadow-sm">{user?.initials ?? "--"}<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--surface)] bg-[var(--success)]" /></span><ChevronDown className="size-3 text-[var(--text-subtle)]" /></button>}>
        {(close) => <div className="w-64"><div className="flex items-center gap-3 rounded-lg bg-[var(--surface-2)] p-3"><span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] text-[length:calc(12px*var(--fs-scale))] font-black text-white">{user?.initials ?? "--"}</span><span className="min-w-0"><span className="block truncate text-[length:calc(11px*var(--fs-scale))] font-extrabold">{user?.name ?? "Signed out"}</span><span className="block truncate text-[length:calc(9px*var(--fs-scale))] text-[var(--text-muted)]">{user?.email ?? ""}</span></span></div><div className="my-1.5 h-px bg-[var(--border)]" />
          {product.pages["theme-studio"] ? <MenuButton icon={<Settings className="size-3.5" />} label="Settings" hint="Workspace and organization" onClick={() => { openPage("theme-studio"); close(); }} /> : null}
          {product.pages["user-master"] ? <MenuButton icon={<UserRound className="size-3.5" />} label="My Profile" hint="Identity and contact details" onClick={() => { openPage("user-master", { mode: "view", recordId: user?.id ?? "USR-00301", title: "My Profile" }); close(); }} /> : null}
          {product.pages["preferences"] ? <MenuButton icon={<SlidersHorizontal className="size-3.5" />} label="My Preferences" hint="Layout, theme and behavior" onClick={() => { openPage("preferences"); close(); }} /> : null}
          <div className="my-1.5 h-px bg-[var(--border)]" />
          <MenuButton icon={<LogOut className="size-3.5" />} label="Sign out" hint="End this secure session" tone="danger" onClick={() => { close(); void logout(); }} />
          <div className="my-1.5 h-px bg-[var(--border)]" />
          <button type="button" onClick={() => { setDocumentationOpen(true); close(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text-muted)] hover:bg-[var(--surface-2)]"><BookOpen className="size-3.5" /><LocalizedText message="ui.product.documentation.2e646170" /></button>
          {!host ? <button type="button" onClick={close} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text-muted)] hover:bg-[var(--surface-2)]"><Mail className="size-3.5" /><LocalizedText message="ui.contact.support.814f4ed2" /></button> : null}
        </div>}
      </ActionMenu>
    </header>
  );
}
