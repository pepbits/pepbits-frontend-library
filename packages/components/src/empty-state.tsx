
import { LocalizedText } from "@pepbits/i18n/react";
import React from "react";
import { FileQuestion, GitCompareArrows, Inbox, LogIn, Loader2, ShieldOff, TriangleAlert } from "@pepbits/icons";
import { Button } from "@pepbits/ui";
import { cn } from "@pepbits/ui";

/**
 * The three things a screen can have instead of content.
 *
 * One shell, three meanings, so a user can tell which they are looking at
 * without reading the words: nothing here yet, something broke, you are not
 * allowed. Before this, a failed page looked different depending on which page
 * failed, because every screen handled its own.
 */
function StatePanel({ icon, tone, title, description, detail, reference, action, alert, status }: {
  icon: React.ReactNode;
  tone: "neutral" | "danger" | "warning";
  title: string;
  description: string;
  detail?: React.ReactNode;
  reference?: string;
  action?: React.ReactNode;
  alert?: boolean;
  status?: boolean;
}) {
  const badge = tone === "danger"
    ? "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger-ink)]"
    : tone === "warning"
      ? "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning-ink)]"
      : "bg-[var(--surface-3)] text-[var(--text-muted)]";
  return (
    /* role=alert on the two that report a problem: a failure a screen reader
       never hears is a screen that looks like it is still loading. An empty
       result is not an event and does not interrupt. */
    <div role={alert ? "alert" : status ? "status" : undefined} className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <div className={cn("mb-3 flex size-12 items-center justify-center rounded-2xl", badge)}>{icon}</div>
      <h3 className="text-[length:calc(13px*var(--fs-scale))] font-extrabold"><LocalizedText message={title} /></h3>
      <p className="mt-1 max-w-sm text-[length:calc(11px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message={description} /></p>
      {/* The slot the whole component turns on. A shared panel that swallows the
          specific message is worse than the twenty bespoke ones it replaced,
          because it takes away the only line that said what actually broke. */}
      {detail ? (
        <p className="mt-3 max-w-md break-words rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left font-mono text-[length:calc(9.5px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]">{detail}</p>
      ) : null}
      {/* Selectable, and monospaced, because the whole job of this line is
          being read aloud on the phone or pasted into a ticket. */}
      {reference ? (
        <p className="mt-3 select-all font-mono text-[length:calc(9.5px*var(--fs-scale))] font-semibold text-[var(--text-subtle)]"><LocalizedText message="ui.reference.66d13194" />{reference}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title = "No records found", description = "Try changing the search or filters.", action }: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <StatePanel icon={<Inbox className="size-5" />} tone="neutral" title={title} description={description} action={action} />;
}

/**
 * Something failed and trying again might work.
 *
 * `onRetry` is why this beats a sentence: without one, reloading the whole page
 * is the user's only move, and they lose everything else on screen doing it.
 */
export function ErrorState({ title = "Something went wrong", description = "The page could not finish loading. This is usually temporary.", detail, referenceId, severity = "error", retrying, onRetry, action }: {
  title?: string;
  description?: string;
  /** The specific message. Shown verbatim, monospaced, and never summarised. */
  detail?: React.ReactNode;
  /**
   * A correlation id the user can quote.
   *
   * The half of §6 that makes the other half bearable: internals never reach
   * the screen, so without an id there is nothing for support to trace and
   * "something went wrong" becomes the whole report.
   */
  referenceId?: string;
  severity?: "warning" | "error" | "critical";
  /** Retry in progress. The button says so rather than looking unpressed. */
  retrying?: boolean;
  onRetry?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <StatePanel
      alert
      icon={<TriangleAlert className="size-5" />}
      tone={severity === "warning" ? "warning" : "danger"}
      title={title}
      description={description}
      detail={detail}
      reference={referenceId}
      action={<>{action}{onRetry ? <Button variant="secondary" disabled={retrying} onClick={onRetry}>{retrying ? <LocalizedText message="ui.trying.3ff51b0b" /> : <LocalizedText message="ui.try.again.d8b8392e" />}</Button> : null}</>}
    />
  );
}

/**
 * A record that is not there.
 *
 * Separate from ErrorState because nothing failed: the system worked and the
 * answer is that this does not exist. Offering "try again" would be a lie.
 */
export function NotFoundState({ title = "Not found", description = "This record does not exist, or it has been removed.", detail, referenceId, action }: {
  title?: string;
  description?: string;
  detail?: React.ReactNode;
  referenceId?: string;
  action?: React.ReactNode;
}) {
  return <StatePanel alert icon={<FileQuestion className="size-5" />} tone="neutral" title={title} description={description} detail={detail} reference={referenceId} action={action} />;
}

/**
 * Someone else changed it first.
 *
 * The 409 the inline editor and every optimistic write can produce. It offers
 * to RELOAD rather than to retry: retrying sends the same stale version again
 * and gets the same refusal.
 */
export function ConflictState({ title = "Changed by someone else", description = "Someone updated this while you were working. Reload to see their version before saving yours.", detail, referenceId, onReload, action }: {
  title?: string;
  description?: string;
  detail?: React.ReactNode;
  referenceId?: string;
  onReload?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <StatePanel
      alert
      icon={<GitCompareArrows className="size-5" />}
      tone="warning"
      title={title}
      description={description}
      detail={detail}
      reference={referenceId}
      action={<>{action}{onReload ? <Button variant="secondary" onClick={onReload}><LocalizedText message="ui.reload.bdc090ec" /></Button> : null}</>}
    />
  );
}

/**
 * The session ended.
 *
 * Not an error and not a denial — the credential expired. The action is to sign
 * in, and the copy says what happens to unsaved work because that is the first
 * thing anyone wants to know.
 */
export function SessionExpiredState({ title = "Your session has ended", description = "Sign in again to continue. Anything unsaved is still on this screen.", onSignIn, action }: {
  title?: string;
  description?: string;
  onSignIn?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <StatePanel
      alert
      icon={<LogIn className="size-5" />}
      tone="warning"
      title={title}
      description={description}
      action={<>{action}{onSignIn ? <Button variant="primary" onClick={onSignIn}><LocalizedText message="ui.sign.in.bfd402b2" /></Button> : null}</>}
    />
  );
}

/**
 * Waiting.
 *
 * The skeletons are better wherever the shape of what is coming is known — they
 * hold the layout still. This is for the cases where it is not: a report being
 * built, an export being prepared.
 */
export function LoadingState({ title = "Loading…", description = "This should only take a moment." }: {
  title?: string;
  description?: string;
}) {
  return (
    <StatePanel
      /* role=status, not alert: this is progress, and an assertive interruption
         for "still working" is the announcement people turn off. */
      status
      icon={<Loader2 className="size-5 animate-spin" />}
      tone="neutral"
      title={title}
      description={description}
    />
  );
}

/**
 * The user is not allowed to see this.
 *
 * Deliberately without a retry: pressing it again changes nothing, and offering
 * it suggests the refusal was a glitch. What helps is knowing WHAT was refused,
 * which is what `detail` carries — "ask someone" is only actionable if it says
 * what to ask for.
 */
export function AccessDenied({ title = "Access not permitted", description = "This is not available to your account. Someone with the right permission can open it for you.", detail, action }: {
  title?: string;
  description?: string;
  detail?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return <StatePanel alert icon={<ShieldOff className="size-5" />} tone="warning" title={title} description={description} detail={detail} action={action} />;
}
