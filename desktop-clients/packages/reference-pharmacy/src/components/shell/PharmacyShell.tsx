"use client";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { LocalizedText } from "@pepbits/ops-ui";
import { useReferenceHost } from "@pepbits/reference-host";
import { useApi } from "../../lib/api";
import { useHotkeys } from "../../lib/hooks";
import { planThemeToggle } from "../../lib/theme";
import type { Meta } from "../../lib/types";
import { NewRxDialog } from "../rx/NewRxDialog";
import { Button } from "../ui/primitives";
import { CommandPalette } from "./CommandPalette";
import { PharmacyToolbar } from "./PharmacyToolbar";
import { ShellContext, type ShellApi } from "./ShellContext";

/**
 * The source AppShell without its chrome. Identity and reference data come from GET /meta through the host transport
 * (the signed-in user as `currentUser`, plus the trusted actor directory the history rows point at); there is no user
 * switching. The theme is the host's preference: the switch goes through the host preference path and honours tenant locks.
 * The palette (Ctrl/Cmd+K, "/") and New prescription ("N") keep the source composition.
 */
export function PharmacyShell({ children }: { children: ReactNode }) {
  const host = useReferenceHost();
  const hostRef = useRef(host);
  hostRef.current = host;
  const meta = useApi<Meta>("/meta", { revalidateOnFocus: false });
  const [palette, setPalette] = useState(false);
  const [newRx, setNewRx] = useState(false);

  const openPalette = useCallback(() => setPalette(true), []);
  const openNewRx = useCallback(() => setNewRx(true), []);
  const toggleTheme = useCallback(() => {
    const { target } = planThemeToggle(hostRef.current);
    if (target) hostRef.current.preferenceHost?.onPreferenceChange?.("theme", target);
  }, []);
  useHotkeys({ "mod+k": () => setPalette((p) => !p), "/": () => setPalette(true), n: () => setNewRx(true) });

  const plan = planThemeToggle(host);
  const api = useMemo<ShellApi>(() => ({
    meta: meta.data, user: meta.data?.currentUser, setUserId: () => {}, openPalette, openNewRx, theme: plan.theme, toggleTheme, canChangeTheme: plan.canChange,
  }), [meta.data, openPalette, openNewRx, plan.theme, plan.canChange, toggleTheme]);

  if (!meta.data) {
    return meta.error ? (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-xl border border-danger/30 bg-danger-wash p-5 text-[13px]">
        <p className="font-medium text-ink"><LocalizedText message="Pharmacy-1 is not available for this account." /></p>
        <p className="mt-1 text-ink-2"><LocalizedText message={meta.error.message} /></p>
        <Button className="mt-3" onClick={() => void meta.mutate()}><LocalizedText message="Try again" /></Button>
      </div>
    ) : (
      <div className="grid min-h-[40vh] place-items-center text-ink-3" role="status"><Loader2 className="size-5 animate-spin" aria-hidden /><span className="sr-only"><LocalizedText message="Loading" /></span></div>
    );
  }

  return (
    <ShellContext.Provider value={api}>
      <div className="flex flex-col" style={{ height: "max(36rem, calc(100dvh - var(--pharmacy-chrome, 7.5rem)))" }} data-pharmacy-stage="true">
        <PharmacyToolbar />
        <main id="main" className="min-h-0 flex-1">{children}</main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNewRx={openNewRx} />
      <NewRxDialog open={newRx} onClose={() => setNewRx(false)} />
    </ShellContext.Provider>
  );
}
