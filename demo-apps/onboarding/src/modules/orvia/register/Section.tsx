'use client';
import React, {type ReactNode} from 'react';
import {CircleAlert} from '@pepbits/icons';
import {useLocalization} from '@pepbits/i18n/react';
import {cn} from '@pepbits/ui';

/** A titled group of fields inside a step, using fieldset/legend for screen readers. */
export function Section({title, description, aside, error, errorId, children, className}: {title: string; description?: ReactNode; aside?: ReactNode; error?: string; errorId?: string; children: ReactNode; className?: string}) {
  const {t} = useLocalization();
  return <fieldset className={cn('min-w-0', className)}>
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <legend className="text-[length:calc(1.05rem*var(--fs-scale))] font-semibold text-ink-900">{t(title)}</legend>
        {description && <p className="mt-0.5 max-w-[68ch] text-sm leading-snug text-ink-500">{typeof description === 'string' ? t(description) : description}</p>}
      </div>
      {aside}
    </div>
    {error && <p id={errorId ? `${errorId}-error` : undefined} className="mb-3 flex animate-fade-in items-center gap-1.5 text-[length:calc(0.85rem*var(--fs-scale))] font-medium text-signal"><CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true"/>{t(error)}</p>}
    {children}
  </fieldset>;
}
