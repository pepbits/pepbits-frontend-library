"use client";

import { LocalizedText } from "@pepbits/i18n/react";

import { CircleCheck, Clock3, Cloud, Database, LockKeyhole } from "@pepbits/icons";

import { useERP } from "./shell-context";
import { useClock } from "./use-clock";

export function Footer({statusLabel,tenantLabel,regionLabel,versionLabel}: {statusLabel?: string;tenantLabel?: string;regionLabel?: string;versionLabel?: string} = {}) {
  const { module, branch, role, format, t, branches, roles } = useERP();

  /* 15s, not 1s: this one shows no seconds, so a per-second timer would be 59
     wasted renders a minute. The header clock does show them and ticks at 1s. */
  const now = useClock(15_000);
  /* Labels are supplied by the host. Preserve the entire branch label; neither
     its separator nor a regional naming convention is library configuration. */
  const branchLabel = branches.find(item => item.value === branch)?.label ?? branch;
  const roleLabel = roles.find(item => item.value === role)?.label ?? role;
  return (
    <footer className="no-print flex h-[var(--footer-height)] shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-3 text-[length:calc(8.5px*var(--fs-scale))] font-semibold text-[var(--text-muted)]">
      <div className="flex items-center gap-3">{statusLabel ? <span className="flex items-center gap-1 text-[var(--success-ink)]"><CircleCheck className="size-3" />{statusLabel}</span> : null}{tenantLabel ? <span className="hidden items-center gap-1 md:flex"><Database className="size-3" />{tenantLabel}</span> : null}{regionLabel ? <span className="hidden items-center gap-1 lg:flex"><Cloud className="size-3" />{regionLabel}</span> : null}</div>
      <div className="flex items-center gap-3"><span className="hidden lg:inline">{t(module.shortLabelKey ?? module.shortLabel)} • {branchLabel} • {t(roleLabel)}</span><span className="flex items-center gap-1"><LockKeyhole className="size-3" /><LocalizedText message="ui.secure.session.54818e0a" /></span><span className="flex items-center gap-1 tabular-nums"><Clock3 className="size-3" />{now ? format.time(now) : "--:--"}</span><span>{versionLabel}</span></div>
    </footer>
  );
}
