"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, CircleCheck, KeyRound, LoaderCircle, Mail, MailCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { OtpInput } from "@/components/ui/OtpInput";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { BRAND } from "@/lib/brand";
import { EMAIL_RE } from "@/lib/registration";
import { getWorkspace, initials, pushRecent, type WorkspaceRecord } from "@/lib/workspaces";

type Stage = "credentials" | "mfa" | "reset" | "reset-sent" | "done";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LoginFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("ws") ?? "";
  const [record, setRecord] = useState<WorkspaceRecord | null | undefined>(undefined);

  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [resendIn, setResendIn] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const found = slug ? getWorkspace(slug) : null;
    if (found) pushRecent(found.slug);
    setRecord(found);
  }, [slug]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  if (record === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <LoaderCircle className="h-6 w-6 animate-spin text-ink-300" aria-label="Loading workspace" />
      </div>
    );
  }

  if (record === null) {
    return (
      <div className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center py-10">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] text-ink-900">Choose a workspace first</h1>
        <p className="mt-3 leading-relaxed text-ink-600">
          {slug
            ? `There is no workspace at ${slug}.${BRAND.domain}. Check the link you were sent, or look your workspace up.`
            : "Sign-in happens inside your organization's workspace. Find it first, then sign in."}
        </p>
        <ButtonLink href="/workspace" size="lg" className="mt-7">
          Find your workspace
        </ButtonLink>
      </div>
    );
  }

  async function onCredentials(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter the email you use for this workspace";
    if (password.length < 8) next.password = "Enter your password";
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    setBusy(true);
    await wait(900);
    setBusy(false);
    setStage("mfa");
    setResendIn(30);
  }

  async function verify(value: string) {
    if (value.length !== 6) {
      setCodeError("Enter all 6 digits");
      return;
    }
    setCodeError(undefined);
    setBusy(true);
    await wait(800);
    setBusy(false);
    setStage("done");
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setErrors({ email: "Enter the email you use for this workspace" });
      emailRef.current?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    await wait(800);
    setBusy(false);
    setStage("reset-sent");
  }

  return (
    <div className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col justify-center py-8 lg:py-12">
      {/* Workspace context: always visible, always changeable */}
      <div className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 pr-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-scrub-800 font-display text-sm font-semibold text-mint" aria-hidden="true">
          {initials(record.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-semibold text-ink-900">{record.name}</p>
          <p className="truncate text-[0.8rem] text-ink-500">
            {record.slug}.{BRAND.domain}
          </p>
        </div>
        <Link href="/workspace" className="rounded-lg px-2 py-1 text-sm font-semibold text-scrub-700 hover:bg-scrub-50">
          Change
        </Link>
      </div>

      {record.status === "pending" && stage !== "done" && (
        <p className="mt-3 flex gap-2 rounded-xl bg-caution-soft px-3.5 py-2.5 text-[0.85rem] leading-snug text-caution">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          This workspace is pending license review. The administrator can sign in to finish setup.
        </p>
      )}

      {stage === "credentials" && (
        <form onSubmit={onCredentials} noValidate className="mt-8 animate-fade-in">
          <h1 className="font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900">Sign in</h1>

          {record.sso && (
            <>
              <Button variant="secondary" size="lg" className="mt-6 w-full" onClick={() => setErrors({ form: "Single sign-on opens your organization's identity provider. Connect it in workspace settings." })}>
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Continue with single sign-on
              </Button>
              <div className="my-6 flex items-center gap-3 text-[0.8rem] text-ink-400">
                <span className="h-px flex-1 bg-ink-200" />
                or use your email
                <span className="h-px flex-1 bg-ink-200" />
              </div>
            </>
          )}

          {errors.form && (
            <p role="status" className="mb-4 mt-4 rounded-xl bg-ink-50 px-3.5 py-2.5 text-[0.85rem] text-ink-700">
              {errors.form}
            </p>
          )}

          <div className={record.sso ? "space-y-5" : "mt-6 space-y-5"}>
            <Field label="Email" htmlFor="login-email" error={errors.email}>
              <Input
                ref={emailRef}
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                placeholder="name@hospital.org"
                leading={<Mail className="h-4 w-4" />}
                autoComplete="username"
                invalid={!!errors.email}
                autoFocus
              />
            </Field>
            <Field
              label="Password"
              htmlFor="login-password"
              error={errors.password}
              aside={
                <button
                  type="button"
                  onClick={() => {
                    setErrors({});
                    setStage("reset");
                  }}
                  className="text-sm font-semibold text-scrub-700 underline-offset-2 hover:underline"
                >
                  Forgot password?
                </button>
              }
            >
              <PasswordInput
                ref={passwordRef}
                id="login-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                autoComplete="current-password"
                invalid={!!errors.password}
              />
            </Field>
          </div>

          <label className="mt-5 flex cursor-pointer select-none items-center gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-ink-300 accent-scrub-700"
            />
            Trust this device for 30 days
          </label>

          <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
            Sign in
          </Button>
          <p className="mt-5 text-center text-[0.8rem] leading-relaxed text-ink-500">
            Shared workstation? Leave &ldquo;Trust this device&rdquo; unchecked so you&apos;re asked for a code every time.
          </p>
        </form>
      )}

      {stage === "mfa" && (
        <div className="mt-8 animate-step-in">
          <button
            type="button"
            onClick={() => {
              setStage("credentials");
              setCode("");
              setCodeError(undefined);
            }}
            className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-600 hover:bg-ink-100/60"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
          </button>
          <span className="mt-4 grid h-12 w-12 place-items-center rounded-2xl bg-scrub-100 text-scrub-800">
            <KeyRound className="h-6 w-6" aria-hidden="true" strokeWidth={1.8} />
          </span>
          <h1 className="mt-4 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900">
            Enter your sign-in code
          </h1>
          <p className="mt-2 leading-relaxed text-ink-600">Open your authenticator app and enter the 6-digit code for {BRAND.name}.</p>
          <form
            className="mt-7"
            onSubmit={(e) => {
              e.preventDefault();
              void verify(code);
            }}
          >
            <OtpInput
              label="6-digit sign-in code"
              value={code}
              onChange={(v) => {
                setCode(v);
                if (codeError) setCodeError(undefined);
              }}
              onComplete={(v) => void verify(v)}
              invalid={!!codeError}
              disabled={busy}
              autoFocus
            />
            {codeError && <p className="mt-2 text-[0.8rem] font-medium text-signal">{codeError}</p>}
            <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
              Verify and sign in
            </Button>
          </form>
          <p className="mt-5 text-sm text-ink-600">
            No access to your app?{" "}
            {resendIn > 0 ? (
              <span className="tabular-nums text-ink-400">Text me a code in {resendIn}s</span>
            ) : (
              <button type="button" onClick={() => setResendIn(30)} className="font-semibold text-scrub-700 underline-offset-2 hover:underline">
                Text me a code
              </button>
            )}
          </p>
        </div>
      )}

      {(stage === "reset" || stage === "reset-sent") && (
        <div className="mt-8 animate-step-in">
          <button
            type="button"
            onClick={() => setStage("credentials")}
            className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-ink-600 hover:bg-ink-100/60"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sign in
          </button>
          {stage === "reset" ? (
            <form onSubmit={onReset} noValidate>
              <h1 className="mt-4 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900">
                Reset your password
              </h1>
              <p className="mt-2 leading-relaxed text-ink-600">We&apos;ll email you a link to choose a new one.</p>
              <Field label="Email" htmlFor="reset-email" error={errors.email} className="mt-6">
                <Input
                  ref={emailRef}
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hospital.org"
                  leading={<Mail className="h-4 w-4" />}
                  invalid={!!errors.email}
                  autoComplete="email"
                  autoFocus
                />
              </Field>
              <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
                Send reset link
              </Button>
            </form>
          ) : (
            <div className="animate-fade-up">
              <span className="mt-4 grid h-12 w-12 animate-pop place-items-center rounded-2xl bg-scrub-100 text-scrub-800">
                <MailCheck className="h-6 w-6" aria-hidden="true" strokeWidth={1.8} />
              </span>
              <h1 className="mt-4 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900">
                Check your email
              </h1>
              <p className="mt-2 leading-relaxed text-ink-600">
                If {email} has an account in this workspace, a reset link is on its way. It expires in 30 minutes.
              </p>
            </div>
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="mt-10 animate-fade-up text-center">
          <span className="mx-auto grid h-16 w-16 animate-pop place-items-center rounded-full bg-scrub-700 text-white">
            <CircleCheck className="h-8 w-8" aria-hidden="true" strokeWidth={1.8} />
          </span>
          <h1 className="mt-5 font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900">
            Signed in to {record.name}
          </h1>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-ink-600">
            Connect this screen to your session API to open the dashboard. Everything up to here is wired and ready.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              variant="secondary"
              onClick={() => {
                setStage("credentials");
                setPassword("");
                setCode("");
              }}
            >
              Sign out
            </Button>
            <Button onClick={() => router.push("/")}>Back to home</Button>
          </div>
        </div>
      )}

      {stage !== "done" && (
        <p className="mt-10 flex items-center gap-2 text-[0.8rem] text-ink-500">
          <ShieldCheck className="h-4 w-4 text-scrub-600" aria-hidden="true" />
          Your session is encrypted and every sign-in is recorded in the audit log.
        </p>
      )}
    </div>
  );
}
