"use client";

import { ReferenceLink as Link } from "@pepbits/reference-host";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { cx } from "../../lib/utils";
import { Card, SourceButton } from "../controls";
import { Copy } from "../copy";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "band";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-scrub-700 text-white hover:bg-scrub-800 active:bg-scrub-900 disabled:bg-scrub-200 disabled:text-white",
  secondary: "bg-paper text-ink border border-line hover:border-scrub-400 hover:text-scrub-700 disabled:text-ink-faint",
  ghost: "text-ink-soft hover:bg-scrub-50 hover:text-scrub-700 disabled:text-ink-faint",
  danger: "bg-paper text-rose-700 border border-rose-200 hover:bg-rose-50",
  band: "bg-band text-ink hover:brightness-95 font-semibold",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cx(
    "inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed select-none",
    variants[variant],
    sizes[size],
    extra,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "primary", size = "md", className, type = "button", ...rest }, ref) {
    return <SourceButton ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />;
  },
);

export function LinkButton({ variant = "primary", size = "md", className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

export function Badge({ children, className, tone = "bg-scrub-50 text-scrub-700" }: { children: ReactNode; className?: string; tone?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold leading-4", tone, className)}>
      <Copy>{children}</Copy>
    </span>
  );
}

/** Key caps (Ctrl, K, Esc) name physical keys and are not translated. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-paper px-1 text-[11px] font-semibold text-ink-faint">
      {children}
    </kbd>
  );
}

/** A surface. Panels are the only bordered containers; nested content uses rules, not more boxes. */
export function Panel({ children, className, ...rest }: Omit<ComponentProps<"section">, "ref">) {
  return (
    <Card as="section" tone="transparent" shadow="none" radius="2xl" className={cx("border-0 bg-paper shadow-lift", className)} {...rest}>
      {children}
    </Card>
  );
}

export function PanelHeader({ title, sub, action, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cx("flex items-center justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[15px] font-semibold text-ink"><Copy>{title}</Copy></h2>
        {sub && <p className="truncate text-[13px] text-ink-faint"><Copy>{sub}</Copy></p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      {icon && <div className="mb-1 grid size-11 place-items-center rounded-full bg-scrub-50 text-scrub-600">{icon}</div>}
      <p className="text-[15px] font-semibold"><Copy>{title}</Copy></p>
      {body && <p className="max-w-xs text-[13px] text-ink-faint"><Copy>{body}</Copy></p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Avatar({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cx("grid size-9 shrink-0 place-items-center rounded-full bg-scrub-100 text-[13px] font-bold text-scrub-800", className)}>
      {text}
    </span>
  );
}
