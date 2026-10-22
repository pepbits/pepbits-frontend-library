import { useLocalization } from "@pepbits/i18n/react";
import React from "react";
import { cn } from "@pepbits/ui";

export function Card({ as: Component = "div", className, children, shadow = "sm", tone = "surface", radius = "default", ...props }: React.ComponentProps<"div"> & {
  as?: "div" | "section" | "article";
  shadow?: "none" | "sm" | "lg";
  tone?: "surface" | "muted" | "transparent";
  radius?: "default" | "lg" | "xl" | "2xl";
}) {
  return <Component className={cn("border border-[var(--border)]",
    radius === "default" ? "rounded-[var(--radius)]" : radius === "lg" ? "rounded-lg" : radius === "xl" ? "rounded-xl" : "rounded-2xl",
    tone === "surface" ? "bg-[var(--surface)]" : tone === "muted" ? "bg-[var(--surface-2)]" : undefined,
    shadow === "sm" && "shadow-[var(--shadow-sm)]", shadow === "lg" && "shadow-[var(--shadow-lg)]", className)} {...props}>{children}</Component>;
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-12 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3", className)} {...props}>{children}</div>;
}

export function CardTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const { t } = useLocalization();
  return (
    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[length:calc(13px*var(--fs-scale))] font-bold tracking-[-.01em] text-[var(--text)]">{t(title)}</h2>
        {subtitle ? <p className="mt-0.5 truncate text-[length:calc(11px*var(--fs-scale))] text-[var(--text-muted)]">{t(subtitle)}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props}>{children}</div>;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div {...props} className={cn("flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3", className)} />;
}

/** Desktop-first grid. Explicit className allows an existing page's breakpoints. */
export function CardGrid({ columns, minCardWidth = 240, gap, style, className, ...props }: React.ComponentProps<"div"> & {
  columns?: 1 | 2 | 3 | 4 | "auto"; minCardWidth?: number; gap?: number;
}) {
  return <div {...props} className={cn("grid", !/(?:^|\s|:)gap(?:-[xy])?-/.test(className ?? "") && "gap-3", className)} style={{
    gridTemplateColumns: columns === "auto" ? `repeat(auto-fit, minmax(min(100%, ${minCardWidth}px), 1fr))` : columns ? `repeat(${columns}, minmax(0, 1fr))` : undefined, gap, ...style,
  }} />;
}
