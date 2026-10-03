"use client";
import { Building2, Inbox, Loader2, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ReferenceLink, useReferenceHost } from "@pepbits/reference-host";
import { useApi } from "../../lib/api";
import { cx } from "../../lib/cx";
import { useTenantFormat } from "../../lib/format";
import { useHotkeys } from "../../lib/hooks";
import type { Meta, Option } from "../../lib/types";
import { tenantAdminPaths, type TenantAdminMatch } from "../../routes";
import { SourceButton } from "../ui/controls";
import { CommandPalette } from "./CommandPalette";
import { TenantAdminContext, useApp as useAppState, type TenantAdminState } from "./context";

/**
 * The source AppShell without its chrome. Identity and reference data come from GET /meta through the host transport: the
 * signed-in user is `currentUser`, and `users` is only the directory that history rows point at. There is no sign-in, no
 * "demo sign-in" menu and no actor switch. The host owns the enterprise header and sidebar; what remains of the source top
 * bar (page title, "Jump to a page", tenant block, Approvals with its count) and footer sits in a compact toolbar and status strip.
 */
export function TenantAdminShell({ match, children }: { match: TenantAdminMatch | null; children: ReactNode }) {
  const meta = useApi<Meta>("/meta", { revalidateOnFocus: false });
  const pendingKey = meta.data ? "/pending" : null;
  const pending = useApi<Record<string, number>>(pendingKey, { refreshInterval: 20000, revalidateOnFocus: false });
  const [palette, setPalette] = useState(false);
  const openPalette = useCallback(() => setPalette(true), []);
  useHotkeys({ "mod+k": () => setPalette((p) => !p) });

  const m = meta.data;
  const refreshPending = pending.mutate;
  const state = useMemo<TenantAdminState | null>(() => {
    if (!m?.currentUser || m.hostManagedIdentity === false) return null;
    const resMap = new Map(m.resources.map((r) => [r.key, r]));
    const catMap = new Map(m.categories.map((c) => [c.key, c]));
    const userMap = new Map(m.users.map((u) => [u.id, u]));
    userMap.set(m.currentUser.id, userMap.get(m.currentUser.id) ?? m.currentUser);
    return {
      meta: m, actor: m.currentUser, pending: pending.data ?? {}, pendingReady: pending.data !== undefined, refreshPending: () => { void refreshPending(); }, openPalette, online: !pending.error,
      resource: (k) => resMap.get(k), category: (k) => catMap.get(k), user: (id) => (id ? userMap.get(id) : undefined),
    };
  }, [m, pending.data, pending.error, refreshPending, openPalette]);

  if (!m) {
    return meta.error ? (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-[14px] border border-line bg-white p-8 text-center">
        <h1 className="text-[20px] font-semibold"><LocalizedText message="Tenant Admin is not available for this account." /></h1>
        <p className="mt-2 text-muted"><LocalizedText message={meta.error.message} /></p>
        <SourceButton className="btn-primary mt-5" onClick={() => void meta.mutate()}><RefreshCw className="h-4 w-4" /> <LocalizedText message="Try again" /></SourceButton>
      </div>
    ) : (
      <div className="grid min-h-[40vh] place-items-center text-muted" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /><span className="sr-only"><LocalizedText message="Loading" /></span></div>
    );
  }
  if (!state) {
    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-[14px] border border-line bg-white p-8 text-center">
        <h1 className="text-[20px] font-semibold"><LocalizedText message="Tenant Admin could not confirm who you are." /></h1>
        <p className="mt-2 text-muted"><LocalizedText message="The service did not return a signed-in user for this session, so nothing is shown. Sign in again through the host." /></p>
        <SourceButton className="btn-primary mt-5" onClick={() => void meta.mutate()}><RefreshCw className="h-4 w-4" /> <LocalizedText message="Try again" /></SourceButton>
      </div>
    );
  }

  return (
    <TenantAdminContext.Provider value={state}>
      <div className="flex flex-col" style={{ height: "max(36rem, calc(100dvh - var(--tenant-admin-chrome, 7.5rem)))" }} data-tenant-admin-stage="true">
        <Toolbar match={match} />
        <main id="main" className="min-h-0 flex-1 overflow-hidden px-5 py-4">{children}</main>
        <StatusStrip />
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </TenantAdminContext.Provider>
  );
}

function pageTitle(match: TenantAdminMatch | null, state: TenantAdminState): { title: string; parent?: string } {
  if (!match) return { title: "Not found" };
  if (match.kind !== "resource") return match.kind === "overview" ? { title: "Overview" } : { title: match.kind === "approvals" ? "Approvals" : "Activity", parent: "Workspace" };
  const r = state.resource(match.resource);
  return r ? { title: r.label, parent: state.category(r.category)?.label } : { title: "Not found" };
}

function Toolbar({ match }: { match: TenantAdminMatch | null }) {
  const state = useAppState();
  const { t } = useLocalization();
  const { title, parent } = pageTitle(match, state);
  const { meta, pending, openPalette } = state;
  const pendingTotal = Object.values(pending).reduce((a, b) => a + b, 0);
  const entities = meta.legalEntities as Option[];
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-line bg-white px-5" data-tenant-admin-toolbar="true">
      <div className="min-w-0 flex-1">
        {parent && <p className="truncate text-[11.5px] font-medium leading-none text-muted"><LocalizedText message={parent} /></p>}
        <h1 className={cx("truncate font-display text-[18px] font-semibold leading-tight", parent && "mt-1")}><LocalizedText message={title} /></h1>
      </div>

      <SourceButton
        onClick={openPalette}
        className="hidden h-9 w-[300px] items-center gap-2 rounded-lg border border-line bg-mist px-3 text-left text-[13px] text-muted transition-colors hover:border-spruce-200 hover:bg-white md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1"><LocalizedText message="Jump to a page" /></span>
        <span className="kbd"><LocalizedText message="Ctrl" /></span><span className="kbd">{"K"}</span>
      </SourceButton>

      <div className="hidden items-center gap-2 rounded-lg px-2 py-1 lg:flex" title={t("{value0} legal entities, {value1} branches", { value0: entities.length, value1: meta.branches.length })}>
        <Building2 className="h-4 w-4 text-spruce-500" strokeWidth={1.75} />
        <div className="leading-tight">
          <p className="text-[12.5px] font-semibold">{meta.tenant.name}</p>
          <p className="text-[11px] text-muted"><LocalizedText message="{value0} branches in {value1} legal entities" values={{ value0: meta.branches.length, value1: entities.length }} /></p>
        </div>
      </div>

      <ReferenceLink href={tenantAdminPaths.approvals()} className="relative flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[12.5px] font-semibold text-spruce-900 hover:bg-mist" aria-label={t("{value0} changes awaiting approval", { value0: pendingTotal })}>
        <Inbox className="h-4 w-4" strokeWidth={1.75} />
        <span className="hidden sm:inline"><LocalizedText message="Approvals" /></span>
        {pendingTotal > 0 && <span className="rounded-full bg-saffron-500 px-1.5 text-[11px] font-bold text-spruce-950">{pendingTotal}</span>}
      </ReferenceLink>
    </header>
  );
}

function StatusStrip() {
  const { meta, online } = useAppState();
  const f = useTenantFormat();
  const { preferences } = useReferenceHost();
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () => setClock(f.clock(meta.tenant.timezone));
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [f, meta.tenant.timezone, preferences.timeFormat]);
  return (
    <footer className="flex h-9 shrink-0 items-center gap-5 border-t border-line bg-white px-5 text-[11.5px] text-muted">
      <span className="font-semibold text-spruce-800"><LocalizedText message="Pepbits Allyvora Tenant Admin 1.0" /></span>
      <span className="flex items-center gap-1.5">
        <span className={cx("h-2 w-2 rounded-full", online ? "bg-jade-500" : "bg-madder-500")} />
        <LocalizedText message={online ? "API connected" : "API unreachable, retrying"} />
      </span>
      {meta.tenant.sourceBaseline && <span className="hidden md:inline"><LocalizedText message="Source baseline {value0}" values={{ value0: meta.tenant.sourceBaseline.slice(0, 7) }} /></span>}
      <span className="flex-1" />
      <span className="rounded bg-saffron-50 px-1.5 py-0.5 font-semibold text-saffron-700">
        <LocalizedText message={meta.demo ? "{value0} environment, synthetic data" : "{value0} environment"} values={{ value0: meta.tenant.environment }} />
      </span>
      <span className="hidden sm:inline">{clock} {meta.tenant.timezone.split("/")[1]?.replace("_", " ")}</span>
    </footer>
  );
}
