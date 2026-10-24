'use client';
import React, {useEffect, useRef, useState} from 'react';
import {Menu, X} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {cn} from '@pepbits/ui';
import {BRAND} from '../brand';
import {Logo} from '../ui/Logo';
import {ButtonLink} from '../ui/Button';

const LINKS = [{href: '#platform', label: 'Platform'}, {href: '#compliance', label: 'Compliance'}, {href: '#workspaces', label: 'How workspaces work'}];
/** Sticky landing header. Inside the shell the scroll container is the shell content area, not the window. */
export function SiteHeader() {
  const {t} = useLocalization();
  const [open, setOpen] = useState(false), [scrolled, setScrolled] = useState(false);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const scroller: HTMLElement | Window = header.current?.closest('main') ?? window;
    const onScroll = () => setScrolled((scroller instanceof Window ? scroller.scrollY : scroller.scrollTop) > 8);
    onScroll();
    scroller.addEventListener('scroll', onScroll, {passive: true});
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!open) return;
    // Escape dismisses the open menu (standard disclosure behaviour, not a custom shortcut).
    const onKey = (event: KeyboardEvent) => {if (event.key === 'Escape') setOpen(false);};
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return <header ref={header} className={cn('sticky top-0 z-40 w-full transition-[background-color,border-color,backdrop-filter] duration-200', scrolled || open ? 'border-b border-ink-100 bg-paper/90 backdrop-blur-md' : 'border-b border-transparent')}>
    <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 2xl:px-16">
      <Logo/>
      <nav aria-label={t('Main')} className="hidden items-center gap-1 md:flex">
        {LINKS.map(link => <a key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100/60 hover:text-ink-900">{t(link.label)}</a>)}
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        <ButtonLink to="orvia-workspace" variant="ghost" size="sm">{t('Sign in')}</ButtonLink>
        <ButtonLink to="orvia-register" size="sm">{t('Register organization')}</ButtonLink>
      </div>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-xl text-ink-800 hover:bg-ink-100 md:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={t(open ? 'Close menu' : 'Open menu')} onClick={() => setOpen(value => !value)}>
        {open ? <X className="h-5 w-5" aria-hidden="true"/> : <Menu className="h-5 w-5" aria-hidden="true"/>}
      </button>
    </div>
    {open && <div id="mobile-menu" className="animate-fade-up border-t border-ink-100 px-4 pb-5 pt-2 sm:px-6 md:hidden">
      <nav aria-label={t('Mobile')} className="flex flex-col">
        {LINKS.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-base font-medium text-ink-700 hover:bg-ink-100/60">{t(link.label)}</a>)}
      </nav>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ButtonLink to="orvia-workspace" variant="secondary">{t('Sign in')}</ButtonLink>
        <ButtonLink to="orvia-register">{t('Register')}</ButtonLink>
      </div>
    </div>}
  </header>;
}

export function SiteFooter() {
  const {t} = useLocalization();
  return <footer className="border-t border-ink-100 bg-paper">
    <div className="flex w-full flex-col gap-4 px-4 py-8 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10 2xl:px-16">
      <div className="flex items-center gap-3"><Logo/><span>&copy; {new Date().getFullYear()} Orvia Health</span></div>
      <nav aria-label={t('Footer')} className="flex flex-wrap gap-x-5 gap-y-2">
        <a href="#compliance" className="hover:text-ink-900">{t('Security')}</a>
        {/* The source links to legal pages it does not provide; they remain demonstrations of missing content. */}
        <a href="/legal/privacy" className="hover:text-ink-900">{t('Privacy')}</a>
        <a href="/legal/terms" className="hover:text-ink-900">{t('Terms')}</a>
        <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-ink-900">{t('Contact')}</a>
      </nav>
    </div>
  </footer>;
}
