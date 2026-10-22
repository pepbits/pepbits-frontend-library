'use client';

import { Suspense, useCallback, useState, type ReactNode } from 'react';
import { RefreshCw, ServerCrash } from 'lucide-react';
import { useApp } from '@/lib/app-context';
import { useHotkey } from '@/lib/hooks';
import { Button } from '@/components/ui/Button';
import { CommandPalette } from './CommandPalette';
import { Footer } from './Footer';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

function StartupError() {
  const { error, retry } = useApp();
  if (!error) return null;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <ServerCrash className="size-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold">The patient service isn’t responding</h1>
      <p className="max-w-md text-ink-2">
        {error.message} Make sure the API is running (<code className="rounded bg-sunken px-1">npm run dev</code> starts both apps).
      </p>
      <Button variant="primary" icon={<RefreshCw className="size-4" />} onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { error } = useApp();
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const closeMobile = useCallback(() => setMobileNav(false), []);
  const closePalette = useCallback(() => setPalette(false), []);

  useHotkey('mod+k', (e) => {
    e.preventDefault();
    setPalette((p) => !p);
  });

  return (
    <div className="min-h-dvh lg:pl-[var(--rail-w)]">
      <a href="#main" className="sr-only z-[100] rounded bg-brand px-3 py-2 text-brand-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-[var(--rail-w)] bg-rail lg:block" />}>
        <Sidebar mobileOpen={mobileNav} onMobileClose={closeMobile} />
      </Suspense>
      <div className="flex min-h-dvh min-w-0 flex-col">
        <Suspense fallback={<div className="h-[var(--header-h)] border-b border-line bg-surface" />}>
          <Header onOpenMenu={() => setMobileNav(true)} onOpenSearch={() => setPalette(true)} />
        </Suspense>
        <main id="main" className="flex min-h-0 w-full flex-1 flex-col">
          {error ? <StartupError /> : children}
        </main>
        <Footer />
      </div>
      <CommandPalette open={palette} onClose={closePalette} />
    </div>
  );
}
