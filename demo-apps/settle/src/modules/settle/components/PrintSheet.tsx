'use client';

import {Printer} from '@pepbits/icons';
import {englishNumberWords, indianNumberWords} from '@pepbits/i18n';
import {PrintDocument} from '@pepbits/components';
import {useSession} from '../lib/session';
import {useFormat} from '../lib/format';
import {Mark} from './shell/Mark';
import {Button} from './ui/primitives';

/** English amount in words for the effective currency. INR keeps the source's Indian numbering
 * (crore, lakh) with rupees and paise; other currencies spell the integer and name the currency code. */
export function amountInWords(amount: number, currencyCode: string) {
  const a = Math.round(Math.abs(amount) * 100) / 100;
  const whole = Math.floor(a), cents = Math.round((a - whole) * 100);
  if (currencyCode === 'INR') {
    if (!whole && !cents) return 'Zero rupees only';
    const parts = [whole ? indianNumberWords(whole) + ' rupees' : '', cents ? englishNumberWords(cents) + ' paise' : ''].filter(Boolean);
    return parts.join(' and ') + ' only';
  }
  return englishNumberWords(whole) + ' ' + currencyCode + (cents ? ' and ' + englishNumberWords(cents) + ' cents' : '') + ' only';
}
export function useAmountInWords() {
  const {currencyCode} = useFormat();
  return (amount: number) => amountInWords(amount, currencyCode);
}

/** Source print geometry (A4/A5 article). The on-screen preview keeps the host theme around a white
 * paper surface; Print renders only the document through the shared PrintDocument surface. */
export function PrintSheet({title, size = 'a4', children}: {title: string; size?: 'a4' | 'a5'; children: React.ReactNode}) {
  const {meta} = useSession();
  const p = meta?.prefs || {};
  const article = (
    <article data-print-sheet={size} className={`settle-print-sheet mx-auto p-[12mm] text-[length:calc(12.5px*var(--fs-result,1))] shadow-rail print:p-0 print:shadow-none ${size === 'a4' ? 'max-w-[210mm]' : 'max-w-[148mm]'}`}>
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#111] pb-3">
        <div className="flex items-start gap-3">
          <Mark className="h-10 w-10" />
          <div>
            <p className="text-[length:calc(17px*var(--fs-result,1))] font-semibold leading-tight">{String(p.hospital_name || meta?.hospital.name || '')}</p>
            <p className="text-[#444]">{String(p.hospital_address || '')}</p>
            {p.hospital_gstin ? <p className="text-[#444]">GSTIN {String(p.hospital_gstin)}</p> : null}
          </div>
        </div>
        <p className="text-end text-[length:calc(15px*var(--fs-result,1))] font-semibold">{title}</p>
      </header>
      {children}
      {p.receipt_footer ? <footer className="mt-8 border-t border-[#ccc] pt-2 text-center text-[length:calc(11.5px*var(--fs-result,1))] text-[#555]">{String(p.receipt_footer)}</footer> : null}
    </article>
  );
  return (
    <div className="rounded-panel bg-mist-2 py-6">
      <style>{`@page { size: ${size === 'a4' ? 'A4' : 'A5'}; margin: 12mm; }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-3">
        <h1 className="text-[length:calc(13px*var(--fs-scale,1))] font-normal text-ink-soft">Print preview: {title}</h1>
        <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
      </div>
      {article}
      <PrintDocument className="settle-print-document">{article}</PrintDocument>
    </div>
  );
}
