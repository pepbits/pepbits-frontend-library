import type { ReactNode } from "react";
import { Globe, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * Split layout for workspace and sign-in screens: a quiet brand rail on large
 * screens, full-bleed form area everywhere. Fits a 13" laptop without scrolling.
 */
export function AuthShell({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col lg:h-dvh lg:flex-row">
      <aside className="relative hidden w-[38%] max-w-[600px] shrink-0 overflow-hidden bg-scrub-900 text-white lg:flex">
        <div className="bg-chart-grid absolute inset-0" aria-hidden="true" />
        <div className="relative flex h-full w-full flex-col p-10 xl:p-12">
          <Logo tone="light" />
          <div className="my-auto py-10">{aside}</div>
          <ul className="space-y-2.5 text-sm text-scrub-200">
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true" />
              HIPAA and GDPR controls, audited every year
            </li>
            <li className="flex items-center gap-2.5">
              <LockKeyhole className="h-4 w-4 text-mint" aria-hidden="true" />
              Each organization&apos;s data isolated in its own tenant
            </li>
            <li className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-mint" aria-hidden="true" />
              Hosted in 8 regions with local data residency
            </li>
          </ul>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
        <header className="pt-safe flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 lg:hidden">
          <Logo />
        </header>
        <main className="pb-safe flex w-full flex-1 flex-col px-4 sm:px-6 lg:px-12 xl:px-16">{children}</main>
      </div>
    </div>
  );
}
