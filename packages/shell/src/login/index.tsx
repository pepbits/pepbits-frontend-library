"use client";
import { Card } from "@pepbits/components";
import { LocalizedText } from "@pepbits/i18n/react";


import type {ShellBrand} from "../shell-context";
import {useSession} from "@pepbits/platform";
import React, { useState } from "react";
import { Skeleton } from "@pepbits/ui";
import { TableSkeleton } from "@pepbits/ui";
import { Command, LockKeyhole, LogIn, ShieldCheck, UserRound } from "@pepbits/icons";
import { Badge, Button, Input, cn } from "@pepbits/ui";


/* Built only from shared UI controls and the existing theme tokens, so it themes
   with the rest of the app and introduces no new visual vocabulary. */
export function LoginScreen({brand: product, description, notice, onSubmit}: {brand: ShellBrand; description?: string; notice?: string; onSubmit?: (username: string, password: string) => Promise<string | null>}) {
  const {login} = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await (onSubmit ?? login)(username.trim(), password);
    /* Only clear the busy flag on failure: on success this component unmounts, and
       setting state on the way out logs a warning for nothing. */
    if (message) {
      setError(message);
      setBusy(false);
    }
  };


  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)] p-4">
      <Card shadow="lg" className="grid w-full max-w-4xl overflow-hidden lg:grid-cols-2">

        <div className="relative hidden flex-col justify-between overflow-hidden bg-[var(--primary-fill)] p-8 text-white lg:flex">
          <span className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,.28),transparent_46%)]" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[13px] bg-white/15"><Command className="size-5" /></span>
              <div>
                <div className="text-[length:calc(15px*var(--fs-scale))] font-black tracking-[-.04em]">{product.name} {product.accentName}</div>
                <div className="text-[length:calc(9px*var(--fs-scale))] font-bold uppercase tracking-[.15em] opacity-70"><LocalizedText message={product.tagline} /></div>
              </div>
            </div>
            <h1 className="mt-8 text-[length:calc(26px*var(--fs-scale))] font-black leading-tight tracking-[-.04em]"><LocalizedText message="ui.sign.in.to.your.workspace.a49b670e" /></h1>
            <p className="mt-3 max-w-sm text-[length:calc(11px*var(--fs-scale))] leading-relaxed opacity-80">{description ? <LocalizedText message={description}/> : null}</p>
          </div>
          <div className="relative flex items-center gap-2 text-[length:calc(9.5px*var(--fs-scale))] font-semibold opacity-75">
            <ShieldCheck className="size-3.5" />{notice ? <LocalizedText message={notice}/> : null}</div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--primary-fill)] text-white"><Command className="size-4" /></span>
              <div className="text-[length:calc(13px*var(--fs-scale))] font-black tracking-[-.04em]">{product.name} <span className="text-[var(--primary)]">{product.accentName}</span></div>
            </div>
            <div className="my-5 h-px bg-[var(--border)]" />
          </div>

          <h2 className="text-[length:calc(15px*var(--fs-scale))] font-black tracking-[-.02em]"><LocalizedText message="ui.welcome.back.66212495" /></h2>
          <p className="mt-1 text-[length:calc(10px*var(--fs-scale))] text-[var(--text-muted)]"><LocalizedText message="ui.enter.your.credentials.to.continue.ff9eee04" /></p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Input
              label="ui.username.e3b89e9d"
              required
              autoFocus
              autoComplete="username"
              value={username}
              placeholder="user1"
              prefix={<UserRound className="size-3.5" />}
              onChange={(event) => setUsername(event.target.value)}
            />
            <Input
              label="ui.password.e7cf3ef4"
              required
              type="password"
              autoComplete="current-password"
              value={password}
              placeholder="••••••"
              prefix={<LockKeyhole className="size-3.5" />}
              onChange={(event) => setPassword(event.target.value)}
            />

            {error ? (
              <div role="alert" className="rounded-xl border border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2 text-[length:calc(10px*var(--fs-scale))] font-semibold text-[var(--danger-ink)]">
                <LocalizedText message={error} />
              </div>
            ) : null}

            <Button type="submit" variant="primary" className="w-full" loading={busy} leftIcon={<LogIn className="size-3.5" />}><LocalizedText message="ui.sign.in.bfd402b2" /></Button>
          </form>


        </div>
      </Card>
    </div>
  );
}

/** Shown while a stored token is being re-validated, so the shell never flashes the
    login screen at a user who is already signed in. */
export function SessionSplash() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-3">
        <span className="flex size-12 animate-pulse items-center justify-center rounded-[15px] bg-[var(--primary-fill)] text-white shadow-[var(--shadow-md)]">
          <Command className="size-6" />
        </span>
        <span className="text-[length:calc(10px*var(--fs-scale))] font-bold text-[var(--text-muted)]"><LocalizedText message="ui.restoring.your.session.62e28512" /></span>
      </div>
    </div>
  );
}

/**
 * The shell, as shapes, while its preferences are being fetched.
 *
 * Shown instead of the splash when the remembered setting says so. It draws the
 * chrome that is about to appear — rail, header bar, a table — so the first
 * paint is the right shape rather than a logo that then rearranges into an
 * application.
 */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh w-full bg-[var(--bg)]">
      <div className="hidden w-[68px] shrink-0 flex-col gap-2 border-e border-[var(--border)] bg-[var(--surface)] p-3 sm:flex">
        <Skeleton className="h-9 w-9" /><Skeleton className="mt-2 h-6 w-9" />
        {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-7 w-9" />)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
          <Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-48" />
          <span className="flex-1" /><Skeleton className="h-7 w-40" /><Skeleton className="h-8 w-8" rounded="full" />
        </div>
        <TableSkeleton rows={9} />
      </div>
    </div>
  );
}
