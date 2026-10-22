"use client";

import { useLocalization } from "@pepbits/i18n/react";
import React from "react";
import { LoaderCircle } from "@pepbits/icons";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-[var(--primary-fill)] text-white shadow-sm hover:bg-[var(--primary-strong)]",
  secondary: "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]",
  ghost: "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)]",
  danger: "border-transparent bg-[var(--danger-fill)] text-white hover:brightness-95",
  success: "border-transparent bg-[var(--success-fill)] text-white hover:brightness-95",
  outline: "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "h-7 gap-1.5 rounded-lg px-2.5 text-[length:calc(11px*var(--fs-scale))]",
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-9 gap-2 rounded-[10px] px-3.5 text-[length:calc(13px*var(--fs-scale))]",
  lg: "h-10 gap-2 rounded-xl px-4 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: React.Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const {t}=useLocalization();
  return (
    <button
      type="button"
      className={cn(
        "focus-ring inline-flex shrink-0 items-center justify-center border font-semibold transition-[background,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : leftIcon}
      {typeof children === "string" ? t(children) : children}
      {rightIcon}
    </button>
  );
}

export function IconButton({ label, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const {t}=useLocalization();
  return (
    <button
      type="button"
      aria-label={t(label)}
      title={t(label)}
      className={cn("focus-ring inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-transparent text-[var(--text-muted)] transition hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] disabled:pointer-events-none disabled:opacity-50", className)}
      {...props}
    >
      {children}
    </button>
  );
}
