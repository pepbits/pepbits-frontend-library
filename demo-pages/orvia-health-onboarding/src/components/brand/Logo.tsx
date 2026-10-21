import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-8 w-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" className="fill-scrub-700" />
      <path
        d="M5 17.5h5.5l2.6-6.5 4.2 12 2.7-5.5H27"
        fill="none"
        stroke="#7FE0C6"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  tone = "dark",
  href = "/",
  className,
}: {
  tone?: "dark" | "light";
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-lg", className)}
      aria-label={`${BRAND.product} home`}
    >
      <LogoMark />
      <span
        className={cn(
          "font-display text-[1.4rem] font-semibold tracking-[-0.02em]",
          tone === "light" ? "text-white" : "text-ink-900",
        )}
      >
        {BRAND.name}
      </span>
    </Link>
  );
}
