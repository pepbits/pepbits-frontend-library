"use client";

import { useState } from "react";
import { Check, Copy, LockKeyhole } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { BRAND } from "@/lib/brand";

export function SuccessScreen({ slug, email, reference }: { slug: string; email: string; reference: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://${slug}.${BRAND.domain}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: ignore */
    }
  }

  const next = [
    { title: "Confirm your email", text: `Open the link we sent to ${email}. It expires in 24 hours.`, when: "Now" },
    { title: "License review", text: "Our compliance team checks your license and may call your main number.", when: "Within 1 business day" },
    { title: "Workspace goes live", text: "We email you when it's ready. Sign in to invite staff and set up facilities.", when: "Right after review" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-10">
      <svg viewBox="0 0 64 64" className="h-16 w-16" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#0A5751" className="origin-fill-center animate-pop" />
        <path
          d="M20 33l8 8 16-17"
          fill="none"
          stroke="#7FE0C6"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1"
          style={{ animation: "trace 600ms cubic-bezier(.65,0,.35,1) 300ms both" }}
        />
      </svg>
      <h1 className="mt-6 font-display text-[2.3rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-5xl">
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
          <span className="text-ink-500">.{BRAND.domain}</span>
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

      <ol className="mt-8 space-y-0">
        {next.map((n, i) => (
          <li key={n.title} className="relative flex gap-4 pb-6 last:pb-0">
            {i < next.length - 1 && <span className="absolute bottom-0 left-[15.5px] top-9 w-px bg-ink-200" aria-hidden="true" />}
            <span
              className={
                i === 0
                  ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-scrub-700 text-sm font-semibold text-white"
                  : "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-200 bg-white text-sm font-semibold text-ink-500"
              }
            >
              {i + 1}
            </span>
            <div className="pt-1">
              <p className="font-semibold text-ink-900">
                {n.title}
                <span className="ml-2 text-sm font-normal text-ink-500">{n.when}</span>
              </p>
              <p className="mt-0.5 text-[0.95rem] leading-relaxed text-ink-600">{n.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/login?ws=${encodeURIComponent(slug)}`} size="lg">
          Go to workspace sign-in
        </ButtonLink>
        <ButtonLink href="/" variant="secondary" size="lg">
          Back to home
        </ButtonLink>
      </div>
    </div>
  );
}
