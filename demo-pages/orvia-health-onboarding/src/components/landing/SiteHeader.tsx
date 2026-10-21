"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#compliance", label: "Compliance" },
  { href: "#workspaces", label: "How workspaces work" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={cn(
        "pt-safe sticky top-0 z-40 w-full transition-[background-color,border-color,backdrop-filter] duration-200",
        scrolled || open ? "border-b border-ink-100 bg-paper/90 backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 2xl:px-16">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100/60 hover:text-ink-900"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href="/workspace" variant="ghost" size="sm">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Register organization
          </ButtonLink>
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl text-ink-800 hover:bg-ink-100 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="animate-fade-up border-t border-ink-100 px-4 pb-5 pt-2 sm:px-6 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 text-base font-medium text-ink-700 hover:bg-ink-100/60"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ButtonLink href="/workspace" variant="secondary">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register">Register</ButtonLink>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="pb-safe border-t border-ink-100 bg-paper">
      <div className="flex w-full flex-col gap-4 px-4 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10 2xl:px-16">
        <div className="flex items-center gap-3">
          <Logo />
          <span>&copy; {new Date().getFullYear()} Orvia Health</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="#compliance" className="hover:text-ink-900">Security</Link>
          <Link href="/legal/privacy" className="hover:text-ink-900">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-ink-900">Terms</Link>
          <a href="mailto:onboarding@orvia.health" className="hover:text-ink-900">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
