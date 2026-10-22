/**
 * One place that decides what a failure means.
 *
 * Twenty screens each deciding what a 403 is produces twenty different answers,
 * and the one that matters — a refusal is not a system failure — is the one most
 * likely to be got wrong. A user can act on "you are not allowed"; they cannot
 * act on "something went wrong", and being told the second when the first is
 * true sends them to support instead of to their administrator.
 */

export type FailureKind =
  | "error"
  | "denied"
  | "not-found"
  | "conflict"
  | "validation"
  | "session-expired";

export interface FailureInput {
  status?: number;
  /** True when the request never reached a server at all. */
  networkError?: boolean;
  /** Whatever the server said. Shown only if it is safe to show — see below. */
  detail?: string;
  /** A correlation id from the server, if it supplied one. */
  reference?: string;
}

export interface Failure {
  kind: FailureKind;
  title: string;
  description: string;
  /** The server's message, if it was written for a human. */
  detail?: string;
  retryable: boolean;
  severity: "warning" | "error" | "critical";
  reference?: string;
}

/**
 * Retry where it can work, and nowhere else.
 *
 * A retry button on a 403 suggests the refusal was a glitch and invites the
 * user to press it until they conclude the system is broken. A 409 needs the
 * conflict looked at; a 400 needs the input fixed.
 */
export function isRetryable(input: FailureInput): boolean {
  if (input.networkError) return true;
  const status = input.status ?? 0;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

/* Shapes that mean the message was written by a program, not for a person. If
   any of them matches, the detail is dropped: §6 keeps stack traces, SQL,
   hostnames and connection strings away from users, and the reference id is
   what lets support find them instead. */
const INTERNAL = [
  /\.(java|ts|js|kt|py):\d+/,
  /\b(Exception|Error)\b.*\bat\b/,
  /^\s*at\s+\S+\s*\(/m,
  /\b(SELECT|INSERT|UPDATE|DELETE)\s+.*\bFROM\b/i,
  /\b[a-z]+:\/\/[^\s]*(db|database|internal|localhost|127\.0\.0\.1)/i,
  /\/(srv|usr|home|var)\//,
];

function safeDetail(detail?: string): string | undefined {
  if (!detail) return undefined;
  return INTERNAL.some((shape) => shape.test(detail)) ? undefined : detail;
}

/**
 * A correlation id, so a user can quote something and support can find it.
 *
 * The server's own id is preferred. Inventing one is still worth doing: the
 * user has something to say on the phone, and the timestamp in the logs does
 * the rest.
 */
export function referenceFor(input: FailureInput): string {
  if (input.reference) return input.reference;
  const random = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, "0");
  return `ERR-${random}`;
}

export function classifyFailure(input: FailureInput): Failure {
  const detail = safeDetail(input.detail);
  const reference = referenceFor(input);
  const retryable = isRetryable(input);

  if (input.networkError) {
    return {
      kind: "error", retryable: true, severity: "warning", reference, detail,
      title: "Could not reach the service",
      description: "recovery.network",
    };
  }

  switch (input.status) {
    case 401:
      return {
        kind: "session-expired", retryable: false, severity: "warning", reference, detail,
        title: "Your session has ended",
        /* No "try again": the fix is to sign in, and a retry button here loops. */
        description: "recovery.session",
      };
    case 403:
      return {
        kind: "denied", retryable: false, severity: "warning", reference,
        /* The detail is dropped entirely, not filtered. §4: a denial must not
           describe what was denied — "you cannot access this patient's HIV
           record" is a disclosure made by the refusal itself. */
        title: "Access not permitted",
        description: "Your current role does not allow access to this resource.",
      };
    case 404:
      return {
        kind: "not-found", retryable: false, severity: "warning", reference, detail,
        title: "Not found",
        description: "This record does not exist, or it has been removed.",
      };
    case 409:
      return {
        kind: "conflict", retryable: false, severity: "warning", reference, detail,
        title: "Changed by someone else",
        description: "Someone updated this while you were working. Review their change before saving yours.",
      };
    case 400:
    case 413:
    case 422:
      return {
        kind: "validation", retryable: false, severity: "warning", reference, detail,
        title: "Some values need attention",
        description: "Correct the highlighted fields and try again.",
      };
    case 429:
      return {kind:"error",retryable:true,severity:"warning",reference,title:"recovery.rateTitle",description:"recovery.rate"};
    case 408:
      return {
        kind: "error", retryable: true, severity: "warning", reference, detail,
        title: "That took too long",
        description: "recovery.timeout",
      };
    default:
      return {
        kind: "error", retryable, severity: (input.status ?? 500) >= 500 ? "error" : "warning", reference, detail,
        title: "The service is temporarily unavailable",
        description: "This is usually brief. Try again in a moment.",
      };
  }
}
