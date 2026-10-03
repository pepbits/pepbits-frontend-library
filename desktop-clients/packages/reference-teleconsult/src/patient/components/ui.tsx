"use client";
import { useLocalization } from "@pepbits/ops-ui";
import { SourceButton, SourceDateField, SourceInput } from "../../shared/controls";
import { ReferenceLink as Link } from "@pepbits/reference-host";
import { useReferencePathname as usePathname, useReferenceRouter as useRouter } from "@pepbits/reference-host";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ChevronLeft, FolderHeart, Home, Loader2, PlusCircle } from "lucide-react";
import { initials } from "../lib/format";
import { usePatient } from "../lib/session";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "sun" | "soft" | "ghost" | "danger";
const V: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-forest-900",
  sun: "bg-sun text-forest-900 hover:brightness-95",
  soft: "bg-white text-forest border border-forest-100 hover:border-forest-200",
  ghost: "text-forest hover:bg-forest/5",
  danger: "bg-rose-500 text-white hover:bg-rose-600",
};

export function Button({ variant = "primary", loading, className, children, disabled, block, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; block?: boolean }) {
  return (
    <SourceButton
      disabled={disabled || loading}
      className={cx(
        "inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2 disabled:opacity-40",
        block && "w-full",
        V[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </SourceButton>
  );
}

export function Avatar({ name, color, size = 44 }: { name: string; color?: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: color ?? "#2F8A82", fontSize: size * 0.36 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <SourceButton
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx("rounded-full border px-3.5 py-2 text-sm font-medium transition", selected ? "border-forest bg-forest text-white" : "border-forest-100 bg-white text-ink hover:border-forest-200")}
    >
      {children}
    </SourceButton>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(19,78,74,0.06)]", className)}>{children}</div>;
}

const fieldCls = "h-12 w-full rounded-2xl border border-forest-100 bg-white px-4 text-[15px] text-ink placeholder:text-ink-400 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-500/20";

export function TextField({ label, hint, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { t } = useLocalization();
  const { type, ...rest } = p;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-600">{t(label)}</span>
      {type === "date"
        ? <SourceDateField {...rest} className={cx(fieldCls, p.className)} />
        : <SourceInput {...p} className={cx(fieldCls, p.className)} />}
      {hint && <span className="mt-1 block text-xs text-ink-400">{t(hint)}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  const { t } = useLocalization();
  return (
    <SourceButton type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{t(label)}</span>
        {sub && <span className="block text-xs text-ink-400">{t(sub)}</span>}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-forest" : "bg-ink-200")}>
        <span className={cx("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </span>
    </SourceButton>
  );
}

export function Header({ title, back, right }: { title?: string; back?: string | true; right?: ReactNode }) {
  const router = useRouter();
  const { t } = useLocalization();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-mint/90 px-4 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {back && (
        <SourceButton onClick={() => (back === true ? router.back() : router.push(back))} className="-ml-2 rounded-full p-2 text-forest hover:bg-forest/5" aria-label={t("Back")}>
          <ChevronLeft className="h-5 w-5" />
        </SourceButton>
      )}
      {title && <h1 className="text-[17px] font-semibold text-forest">{t(title)}</h1>}
      <div className="ml-auto">{right}</div>
    </header>
  );
}

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/book", label: "Book", icon: PlusCircle },
  { href: "/records", label: "My health", icon: FolderHeart },
];

export function BottomNav() {
  const pathname = usePathname();
  const { settings } = usePatient();
  const { t } = useLocalization();
  // Patients only see Book when the branch lets them book for themselves.
  const items = NAV.filter(({ href }) => href !== "/book" || settings?.allowPatientBooking === true);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-forest-100 bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label={t("Main")}>
      <ul className={items.length === 2 ? "grid grid-cols-2" : "grid grid-cols-3"}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cx("flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium", active ? "text-forest" : "text-ink-400")}>
                <Icon className={cx("h-6 w-6", active && "fill-forest-100")} />
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Wraps signed-in screens: redirects to sign-in when there is no session. */
export function Screen({ children, nav = true, className }: { children: ReactNode; nav?: boolean; className?: string }) {
  const { patient, ready, error } = usePatient();
  const router = useRouter();
  useEffect(() => {
    if (ready && !patient) router.replace("/");
  }, [ready, patient, router]);
  if (error && !patient) return <div className="p-4"><Notice tone="error">{error}</Notice></div>;
  if (!ready || !patient) {
    return (
      <div role="status" className="flex min-h-full flex-1 items-center justify-center text-ink-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return (
    <div className={cx("flex min-h-full flex-1 flex-col", nav && "pb-24", className)}>
      {children}
      {nav && <BottomNav />}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-2xl p-3 text-sm", tone === "error" ? "bg-rose-50 text-rose-600" : "bg-forest-100/60 text-forest")}>{children}</div>;
}
