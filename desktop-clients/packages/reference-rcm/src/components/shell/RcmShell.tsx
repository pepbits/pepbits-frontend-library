"use client";
import { Check, ChevronDown, Inbox, Loader2, MapPin, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink, useReferenceHost } from "@pepbits/reference-host";
import { useApi, useRefreshAll, useScopeFilter } from "../../lib/api";
import { cx } from "../../lib/cx";
import { defaultScope, scopeInfo, useRcmFormat, validScope } from "../../lib/format";
import { useKeyHandler, useShortcutsEnabled } from "../../lib/hooks";
import { Icon } from "../../lib/icons";
import {localizeRcmMetadata} from "../../lib/metadata-localization";
import type { Meta } from "../../lib/types";
import { rcmPaths, type RcmMatch } from "../../routes";
import { Avatar } from "../ui/Avatar";
import { SourceButton } from "../ui/controls";
import { CommandPalette } from "./CommandPalette";
import { RcmContext, useApp as useAppState, type RcmState } from "./context";

/**
 * The source AppShell without its chrome. Identity and reference data come from GET /meta through the host transport: the
 * signed-in user is `currentUser`, and `users` is only the directory that history rows point at. There is no sign-in, no
 * "demo sign-in" menu and no actor switch. The host owns the enterprise header and sidebar; what remains of the source top
 * bar (page icon and title, "Jump anywhere", the scope filter, Approvals with its count, the signed-in user) sits in a compact
 * toolbar, and the source footer becomes the status strip. The scope filter only narrows what the API returns inside the
 * branches the host authorized; it is never an authorization input.
 */
export function RcmShell({ match, path, children }: { match: RcmMatch | null; path: string; children: ReactNode }) {
  const meta = useApi<Meta>("/meta", { unscoped: true });
  const { scope, setScope } = useScopeFilter();
  const { t } = useLocalization();
  const m = useMemo(()=>meta.data?localizeRcmMetadata(meta.data,t):undefined,[meta.data,t]);
  const branches = useMemo(() => m?.branches ?? [], [m]);
  useEffect(() => { if (m && !validScope(branches, scope)) setScope(defaultScope(branches)); }, [m, branches, scope, setScope]);
  const ready = !!m && validScope(branches, scope);

  const pending = useApi<Record<string, number>>(ready ? "/pending" : null, { refreshInterval: 20000 });
  const refreshAll = useRefreshAll();
  const [palette, setPalette] = useState(false);
  useKeyHandler((e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopImmediatePropagation(); setPalette((p) => !p); } }, true, true);

  const state = useMemo<RcmState | null>(() => {
    if (!m?.currentUser || m.hostManagedIdentity === false || !validScope(branches, scope)) return null;
    const resMap = new Map(m.resources.map((r) => [r.key, r]));
    const catMap = new Map(m.categories.map((c) => [c.key, c]));
    const userMap = new Map(m.users.map((u) => [u.id, u]));
    userMap.set(m.currentUser.id, userMap.get(m.currentUser.id) ?? m.currentUser);
    const pages = m.categories.flatMap((c) => c.pages.map((p) => ({ page: p, category: c })));
    return {
      meta: m, actor: m.currentUser, scope, setScope, scopeInfo: scopeInfo(branches, scope, t), branches,
      pending: pending.data ?? {}, refreshPending: () => { void refreshAll(); }, online: !pending.error,
      resource: (k) => resMap.get(k), category: (k) => catMap.get(k), user: (id) => (id ? userMap.get(id) : undefined),
      pageFor: (p) => pages.find((x) => (x.page.href === "/" ? p === "/" : p === x.page.href || p.startsWith(x.page.href + "/"))),
      paletteOpen: palette, setPaletteOpen: setPalette,
    };
  }, [m, branches, scope, setScope, t, pending.data, pending.error, refreshAll, palette]);

  if (!m) {
    return meta.error ? (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-[14px] border border-line bg-white p-8 text-center">
        <h1 className="text-[20px] font-semibold"><LocalizedText message="The Workspace service isn’t answering" /></h1>
        <p className="mt-2 text-muted"><LocalizedText message={meta.error.message} /></p>
        <SourceButton className="btn-primary mt-5" onClick={() => void meta.mutate()}><RefreshCw className="h-4 w-4" /> <LocalizedText message="Try again" /></SourceButton>
      </div>
    ) : (
      <div className="grid min-h-[40vh] place-items-center text-muted" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /><span className="sr-only"><LocalizedText message="Loading" /></span></div>
    );
  }
  if (!m.currentUser || m.hostManagedIdentity === false) {
    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-[14px] border border-line bg-white p-8 text-center">
        <h1 className="text-[20px] font-semibold"><LocalizedText message="Workspace could not confirm who you are." /></h1>
        <p className="mt-2 text-muted"><LocalizedText message="The service did not return a signed-in user for this session, so nothing is shown. Sign in again through the host." /></p>
        <SourceButton className="btn-primary mt-5" onClick={() => void meta.mutate()}><RefreshCw className="h-4 w-4" /> <LocalizedText message="Try again" /></SourceButton>
      </div>
    );
  }
  if (!state) return <div className="grid min-h-[40vh] place-items-center text-muted" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;

  return (
    <RcmContext.Provider value={state}>
      <div className="flex flex-col" style={{ height: "max(36rem, calc(100dvh - var(--rcm-chrome, 7.5rem)))" }} data-rcm-stage="true">
        <Toolbar path={path} />
        <main id="main" className="min-h-0 flex-1 overflow-hidden px-4 py-3">{children}</main>
        <StatusStrip />
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <span hidden data-rcm-route={match?.kind ?? "none"} />
    </RcmContext.Provider>
  );
}

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [ref, close]);
}

function Toolbar({ path }: { path: string }) {
  const { actor, meta, branches, scope, setScope, scopeInfo: info, pending, pageFor, setPaletteOpen } = useAppState();
  const { t } = useLocalization();
  const shortcuts = useShortcutsEnabled();
  const [menu, setMenu] = useState(false);
  const branchRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenu(false), []);
  useOutside(branchRef, closeMenu);

  const current = pageFor(path.split("?")[0]);
  const pendingTotal = Object.values(pending).reduce((a, b) => a + b, 0);
  const currencies = [...new Set(branches.map((b) => b.currency))];
  const options = currencies.flatMap((c) => [
    { value: `ALL:${c}`, label: t("All {value0} branches", { value0: c }), sub: branches.filter((b) => b.currency === c).map((b) => b.short).join(", "), all: true },
    ...branches.filter((b) => b.currency === c).map((b) => ({ value: b.value, label: b.label, sub: `${b.value} · ${b.currency}`, all: false })),
  ]);

  return (
    <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-line bg-white px-5" data-rcm-toolbar="true">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {current && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-harbor-50 text-harbor-700">
            <Icon name={current.page.icon} className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-medium leading-none text-muted">{current ? current.category.label : <LocalizedText message="Workspace" />}</p>
          <h1 className="mt-1 truncate font-display text-[18px] font-semibold leading-tight">{current?.page.label ?? <LocalizedText message="Not found" />}</h1>
        </div>
      </div>

      <SourceButton
        onClick={() => setPaletteOpen(true)}
        className="hidden h-9 w-[230px] shrink-0 items-center gap-2 rounded-lg border border-line bg-mist px-3 text-left text-[13px] text-muted transition-colors hover:border-harbor-200 hover:bg-white md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate whitespace-nowrap"><LocalizedText message="Jump anywhere" /></span>
        {shortcuts && <><span className="kbd"><LocalizedText message="Ctrl" /></span><span className="kbd">{"K"}</span></>}
      </SourceButton>

      <div className="relative" ref={branchRef}>
        <SourceButton onClick={() => setMenu((o) => !o)} aria-haspopup="menu" aria-expanded={menu} aria-label={t("Scope: {value0}", { value0: info.label })}
          className={cx("flex h-9 items-center gap-2 rounded-lg border px-3 text-[12.5px] font-semibold transition-colors", !scope.startsWith("ALL:") ? "border-signal-500/40 bg-signal-50 text-signal-700" : "border-line text-harbor-900 hover:bg-mist")}>
          <MapPin className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden max-w-[170px] truncate lg:inline">{info.label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </SourceButton>
        {menu && (
          <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-[60] w-[290px] animate-fade-in rounded-xl border border-line bg-white p-2 shadow-pop">
            <p className="px-2 pb-2 pt-1 text-[12px] leading-snug text-muted"><LocalizedText message="Scope for every queue, KPI and dashboard. Totals never mix currencies, so network views are per currency." /></p>
            {options.map((b) => (
              <SourceButton key={b.value} role="menuitemradio" aria-checked={scope === b.value} onClick={() => { setScope(b.value); setMenu(false); }}
                className={cx("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-mist", !b.all && "pl-5", b.all && b.value !== options[0].value && "mt-1 border-t border-line pt-2.5")}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{b.label}</span>
                  <span className="block truncate text-[11.5px] text-muted">{b.sub}</span>
                </span>
                {scope === b.value && <Check className="h-4 w-4 text-jade-600" />}
              </SourceButton>
            ))}
          </div>
        )}
      </div>

      <ReferenceLink href={rcmPaths.approvals()} className="relative flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[12.5px] font-semibold text-harbor-900 hover:bg-mist" aria-label={t("{value0} items awaiting a second person", { value0: pendingTotal })}>
        <Inbox className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden xl:inline"><LocalizedText message="Approvals" /></span>
        {pendingTotal > 0 && <span className="rounded-full bg-saffron-500 px-1.5 text-[11px] font-bold text-harbor-950">{pendingTotal}</span>}
      </ReferenceLink>

      <div className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2" title={meta.tenant.name} data-rcm-user="true">
        <Avatar user={actor} />
        <div className="hidden text-left leading-tight sm:block">
          <p className="text-[12.5px] font-semibold">{actor.name}</p>
          <p className="text-[11px] text-muted">{actor.title}</p>
        </div>
      </div>
    </header>
  );
}

function StatusStrip() {
  const { meta, online, scopeInfo: info } = useAppState();
  const f = useRcmFormat();
  const shortcuts = useShortcutsEnabled();
  const { preferences } = useReferenceHost();
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(f.clock(meta.tenant.timezone));
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [f, meta.tenant.timezone, preferences.timeFormat]);
  return (
    <footer className="flex h-8 shrink-0 items-center gap-5 whitespace-nowrap border-t border-line bg-white px-5 text-[11.5px] text-muted">
      <span className="font-semibold text-harbor-800"><LocalizedText message="Pepbits Allyvora Workspace 1.0" /></span>
      <span className="flex items-center gap-1.5">
        <span className={cx("h-2 w-2 rounded-full", online ? "bg-jade-500" : "animate-pulse-soft bg-madder-500")} />
        <LocalizedText message={online ? "API connected" : "API unreachable, retrying"} />
      </span>
      <span className="hidden md:inline">{meta.tenant.name} · {info.label}</span>
      <span className="flex-1" />
      {shortcuts && (
        <span className="hidden 2xl:inline"><LocalizedText message="Shortcuts:" /> <span className="kbd">↑</span> <span className="kbd">↓</span> <LocalizedText message="move," /> <span className="kbd">{"N"}</span> <LocalizedText message="new," /> <span className="kbd"><LocalizedText message="Esc" /></span> <LocalizedText message="close" /></span>
      )}
      <span className="rounded bg-saffron-50 px-1.5 py-0.5 font-semibold text-saffron-700">
        <LocalizedText message={meta.demo === false ? "{value0} environment" : "{value0} environment, synthetic data"} values={{ value0: meta.tenant.environment }} />
      </span>
      <span className="hidden sm:inline">{clock}</span>
    </footer>
  );
}
