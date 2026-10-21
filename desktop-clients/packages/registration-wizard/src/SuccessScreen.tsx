import { useEffect, useRef, useState } from "react";
import { Check, Copy, LockKeyhole } from "lucide-react";
import { ButtonLink } from "./ui/Button";

export function SuccessScreen({
  slug,
  domain,
  reference,
  message,
  homeHref,
}: {
  slug: string;
  domain: string;
  reference: string;
  message?: string;
  homeHref?: string;
}) {
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const url = `https://${slug}.${domain}`;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: ignore */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10">
      <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
        <circle cx="32" cy="32" r="30" className="origin-fill-center animate-pop fill-scrub-700" />
        <path
          d="M20 33l8 8 16-17"
          fill="none"
          className="animate-trace stroke-mint"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ animationDuration: "600ms", animationDelay: "300ms" }}
        />
      </svg>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 font-display text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 focus:outline-none sm:text-5xl"
      >
        Registration submitted
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-600">
        Your reference is <span className="font-semibold tabular-nums text-ink-900">{reference}</span>. Keep it handy if you
        contact us.
      </p>

      <div className="mt-7 flex items-center gap-2 rounded-2xl border border-ink-200 bg-white p-2 pl-4">
        <LockKeyhole className="h-4 w-4 shrink-0 text-scrub-600" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[0.95rem]">
          <span className="text-ink-400">https://</span>
          <span className="font-semibold text-ink-900">{slug}</span>
          <span className="text-ink-500">.{domain}</span>
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-scrub-700 transition-colors hover:bg-scrub-50"
        >
          {copied ? <Check className="h-4 w-4 animate-pop" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy address"}</span>
        </button>
      </div>

      {message && (
        <div className="mt-8 rounded-2xl border border-scrub-200 bg-scrub-50 px-5 py-4">
          <p className="font-semibold text-scrub-900">What happens next</p>
          <p className="mt-1 whitespace-pre-line text-[0.95rem] leading-relaxed text-ink-700">{message}</p>
        </div>
      )}

      {homeHref && (
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={homeHref} variant="secondary" size="lg">
            Back to home
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
