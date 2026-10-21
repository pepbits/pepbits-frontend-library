"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, CircleAlert, Clock3, LoaderCircle, Mail, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Choice";
import { AffixInput, Field, Input } from "@/components/ui/Field";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { EMAIL_RE } from "@/lib/registration";
import {
  DIRECTORY,
  SLUG_RE,
  getRecent,
  getWorkspace,
  initials,
  lookupByEmail,
  lookupWorkspace,
  normalizeSlug,
  pushRecent,
  type WorkspaceRecord,
} from "@/lib/workspaces";

type Mode = "address" | "email";
type Lookup =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "found"; record: WorkspaceRecord }
  | { state: "missing" }
  | { state: "invalid" };

export function WorkspaceFinder() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("address");
  const [slug, setSlug] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [continuing, setContinuing] = useState(false);
  const [recent, setRecent] = useState<WorkspaceRecord[]>([]);
  const slugRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<WorkspaceRecord[] | null>(null);

  useEffect(() => {
    setRecent(getRecent().map(getWorkspace).filter((w): w is WorkspaceRecord => !!w));
  }, []);

  // Live lookup as the person types, debounced
  useEffect(() => {
    const s = normalizeSlug(slug);
    if (!s) {
      setLookup({ state: "idle" });
      return;
    }
    if (!SLUG_RE.test(s)) {
      setLookup(s.length < 3 ? { state: "idle" } : { state: "invalid" });
      return;
    }
    setLookup({ state: "checking" });
    let cancelled = false;
    const t = setTimeout(async () => {
      const record = await lookupWorkspace(s);
      if (!cancelled) setLookup(record ? { state: "found", record } : { state: "missing" });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug]);

  function go(record: WorkspaceRecord) {
    setContinuing(true);
    pushRecent(record.slug);
    router.push(`/login?ws=${encodeURIComponent(record.slug)}`);
  }

  function onAddressSubmit(e: FormEvent) {
    e.preventDefault();
    if (lookup.state === "found") go(lookup.record);
    else slugRef.current?.focus();
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Enter your work email, like name@hospital.org");
      return;
    }
    setEmailError(undefined);
    setSearching(true);
    setResults(await lookupByEmail(email));
    setSearching(false);
  }

  const status =
    lookup.state === "checking" ? (
      <LoaderCircle className="h-4 w-4 animate-spin text-ink-400" aria-hidden="true" />
    ) : lookup.state === "found" ? (
      <span className="grid h-5 w-5 animate-pop place-items-center rounded-full bg-scrub-600 text-white">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
    ) : lookup.state === "missing" || lookup.state === "invalid" ? (
      <CircleAlert className="h-4 w-4 text-signal" aria-hidden="true" />
    ) : null;

  return (
    <div className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col justify-center py-8 lg:py-12">
      <h1 className="font-display text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[2.6rem]">
        Find your workspace
      </h1>
      <p className="mt-3 leading-relaxed text-ink-600">
        Your organization has its own address on {BRAND.name}. Enter it below, or look it up with your work email.
      </p>

      <Segmented<Mode>
        className="mt-7"
        label="How to find your workspace"
        value={mode}
        onChange={setMode}
        options={[
          { value: "address", label: "Workspace address" },
          { value: "email", label: "Work email" },
        ]}
      />

      {mode === "address" ? (
        <form onSubmit={onAddressSubmit} className="mt-6 animate-fade-in" noValidate>
          <Field
            label="Workspace address"
            htmlFor="ws-slug"
            hint="This is in your invite email or the sign-in link your IT team shared."
            error={lookup.state === "invalid" ? "Use letters, numbers and hyphens only" : undefined}
          >
            <AffixInput
              ref={slugRef}
              id="ws-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="your-organization"
              suffix={`.${BRAND.domain}`}
              status={status}
              invalid={lookup.state === "invalid"}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </Field>

          <div aria-live="polite" className="mt-4 min-h-[4.75rem]">
            {lookup.state === "found" && <WorkspaceCard record={lookup.record} />}
            {lookup.state === "missing" && (
              <div className="flex animate-fade-up gap-3 rounded-2xl border border-ink-200 bg-white p-4">
                <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
                <div className="text-sm leading-relaxed text-ink-600">
                  <p className="font-semibold text-ink-900">
                    No workspace at {normalizeSlug(slug)}.{BRAND.domain}
                  </p>
                  <p className="mt-0.5">
                    Check the spelling, or{" "}
                    <button type="button" onClick={() => setMode("email")} className="font-semibold text-scrub-700 underline-offset-2 hover:underline">
                      find it with your email
                    </button>
                    .
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="mt-2 w-full"
            disabled={lookup.state !== "found"}
            loading={continuing}
          >
            Continue to sign in
          </Button>
        </form>
      ) : (
        <form onSubmit={onEmailSubmit} className="mt-6 animate-fade-in" noValidate>
          <Field label="Work email" htmlFor="ws-email" error={emailError} hint="We'll list every workspace this email belongs to.">
            <Input
              id="ws-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setResults(null);
              }}
              placeholder="name@hospital.org"
              leading={<Mail className="h-4 w-4" aria-hidden="true" />}
              invalid={!!emailError}
              autoComplete="email"
              autoFocus
            />
          </Field>
          <Button type="submit" variant={results ? "secondary" : "primary"} size="lg" className="mt-5 w-full" loading={searching}>
            Find workspaces
          </Button>

          <div aria-live="polite" className="mt-5">
            {results && results.length > 0 && (
              <div className="animate-fade-up">
                <p className="mb-2 text-sm font-medium text-ink-700">
                  {results.length === 1 ? "1 workspace" : `${results.length} workspaces`} for {email.split("@")[1]}
                </p>
                <ul className="space-y-2">
                  {results.map((r) => (
                    <li key={r.slug}>
                      <WorkspaceRow record={r} onSelect={() => go(r)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {results && results.length === 0 && (
              <div className="animate-fade-up rounded-2xl border border-ink-200 bg-white p-4 text-sm leading-relaxed text-ink-600">
                <p className="font-semibold text-ink-900">No workspaces use {email.split("@")[1]}</p>
                <p className="mt-0.5">
                  Ask your administrator for an invite, or{" "}
                  <Link href="/register" className="font-semibold text-scrub-700 underline-offset-2 hover:underline">
                    register your organization
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        </form>
      )}

      <div className="mt-8 border-t border-ink-100 pt-6">
        <p className="mb-2.5 flex items-center gap-1.5 text-sm font-medium text-ink-700">
          {recent.length > 0 ? (
            <>
              <Clock3 className="h-4 w-4 text-ink-400" aria-hidden="true" /> Recently used on this device
            </>
          ) : (
            "Try a sample workspace"
          )}
        </p>
        <ul className="space-y-2">
          {(recent.length > 0 ? recent : DIRECTORY.slice(0, 3)).map((r) => (
            <li key={r.slug}>
              <WorkspaceRow record={r} onSelect={() => go(r)} compact />
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-sm text-ink-600">
        New to {BRAND.name}?{" "}
        <Link href="/register" className="font-semibold text-scrub-700 underline-offset-2 hover:underline">
          Register your organization
        </Link>
      </p>
    </div>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-scrub-800 font-display font-semibold text-mint",
        size === "md" ? "h-11 w-11 text-base" : "h-9 w-9 text-sm",
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function WorkspaceCard({ record }: { record: WorkspaceRecord }) {
  return (
    <div className="flex animate-fade-up items-center gap-3.5 rounded-2xl border border-scrub-200 bg-scrub-50/60 p-4">
      <Avatar name={record.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink-900">{record.name}</p>
        <p className="truncate text-sm text-ink-600">
          {record.kind}, {record.facilities === 1 ? "1 facility" : `${record.facilities} facilities`}
        </p>
      </div>
      {record.status === "pending" && (
        <span className="rounded-full bg-caution-soft px-2 py-0.5 text-xs font-semibold text-caution">Pending review</span>
      )}
    </div>
  );
}

function WorkspaceRow({ record, onSelect, compact }: { record: WorkspaceRecord; onSelect: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-white p-3 text-left transition-[border-color,background-color] duration-150 hover:border-scrub-300 hover:bg-scrub-50/40"
    >
      <Avatar name={record.name} size={compact ? "sm" : "md"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-semibold text-ink-900">{record.name}</span>
        <span className="block truncate text-[0.8rem] text-ink-500">
          {record.slug}.{BRAND.domain}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-scrub-600" aria-hidden="true" />
    </button>
  );
}
