'use client';

import { useEffect, useState } from 'react';
import { Clock3, Database, LockKeyhole } from 'lucide-react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/app-context';
import { cn } from '@/lib/cn';
import { clock } from '@/lib/format';
import { useNow } from '@/lib/hooks';

export function Footer() {
  const { session, branchId } = useApp();
  const now = useNow(15_000);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    const ping = () =>
      api
        .health()
        .then(() => live && setOnline(true))
        .catch(() => live && setOnline(false));
    ping();
    const t = setInterval(ping, 30_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  const branch = session?.branches.find((b) => b.id === branchId);

  return (
    <footer className="print-hide sticky bottom-0 z-30 flex h-[var(--footer-h)] shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-2xs text-ink-3 sm:px-4 lg:px-6">
      <span className="flex items-center gap-1.5" role="status">
        <span
          className={cn('size-1.5 rounded-full', online === null ? 'bg-ink-3' : online ? 'bg-ok' : 'animate-pulse bg-danger')}
          aria-hidden
        />
        {online === false ? 'Server unreachable' : 'Connected'}
      </span>
      {session && (
        <span className="hidden items-center gap-1.5 sm:flex">
          <Database className="size-3" aria-hidden />
          {session.tenant}
        </span>
      )}
      <span className="hidden min-w-0 flex-1 truncate md:block">
        {session && branch ? `${session.organization.name}, ${branch.name}` : ''}
      </span>
      <span className="ml-auto hidden items-center gap-1.5 sm:flex md:ml-0">
        <LockKeyhole className="size-3" aria-hidden />
        Secure session
      </span>
      <span className="tabular flex items-center gap-1.5">
        <Clock3 className="size-3" aria-hidden />
        <time dateTime={now.toISOString()} suppressHydrationWarning>
          {clock(now)}
        </time>
      </span>
      <span className="hidden lg:inline">AllyVora Healthcare 1.0</span>
    </footer>
  );
}
