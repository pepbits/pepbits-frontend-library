"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LocalizedText } from "@pepbits/ops-ui";
import { Loader2 } from "lucide-react";
import { SourceButton } from "../components/controls";
import { useQualityApi } from "./api";
import type { Meta, User } from "./types";

interface AuthState {
  /** The authenticated host user as the Quality server maps them (role is one of the six source roles). */
  user: User;
  /** Alias of `user`, as returned by GET /auth/me. */
  me: User;
  permissions: string[];
  meta: Meta;
  can: (permission: string) => boolean;
  refreshMeta: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

type Boot = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; user: User; permissions: string[]; meta: Meta };

/**
 * Identity comes from the host session only: GET /auth/me (user, role, permissions) and GET /meta (reference data).
 * There is no login, token storage or role switching in the browser; the server maps the host role onto the source
 * role and decides every permission. `can()` merely reflects what the server granted.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { api } = useQualityApi();
  const [state, setState] = useState<Boot>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    (async () => {
      try {
        const me = await api<{ user: User; permissions: string[] }>("/auth/me");
        const meta = await api<Meta>("/meta");
        if (live) setState({ status: "ready", user: me.user, permissions: me.permissions, meta });
      } catch (e) {
        if (live) setState({ status: "error", message: e instanceof Error ? e.message : "AllyVora Quality could not be loaded." });
      }
    })();
    return () => { live = false; };
  }, [api, attempt]);

  const refreshMeta = useCallback(async () => {
    const meta = await api<Meta>("/meta");
    setState((s) => (s.status === "ready" ? { ...s, meta } : s));
  }, [api]);

  const value = useMemo<AuthState | null>(() => state.status !== "ready" ? null : ({
    user: state.user, me: state.user, permissions: state.permissions, meta: state.meta,
    can: (p) => state.permissions.includes(p), refreshMeta,
  }), [state, refreshMeta]);

  if (state.status === "loading") {
    return (
      <div className="grid min-h-[40vh] place-items-center text-ink-3" role="status">
        <Loader2 className="size-5 animate-spin" aria-label="Loading" />
      </div>
    );
  }
  if (state.status === "error" || !value) {
    return (
      <div role="alert" className="mx-auto max-w-lg rounded-lg border border-bad/30 bg-bad-soft/60 p-5 text-sm">
        <p className="font-medium text-ink"><LocalizedText message="AllyVora Quality is not available for this account." /></p>
        <p className="mt-1 text-ink-2">{state.status === "error" ? state.message : ""}</p>
        <SourceButton className="mt-3 rounded-md border border-line-strong bg-panel px-3 py-1.5 text-sm text-ink hover:bg-surface" onClick={() => setAttempt((n) => n + 1)}><LocalizedText message="Try again" /></SourceButton>
      </div>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Meta is guaranteed inside the authenticated workspace. */
export function useMeta(): Meta {
  return useAuth().meta;
}

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  quality_manager: "Quality manager",
  verifier: "Verifier",
  approver: "Approver",
  data_steward: "Data steward",
  viewer: "Viewer",
};
