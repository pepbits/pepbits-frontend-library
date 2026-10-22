'use client';

import { Printer } from 'lucide-react';
import { useSession } from '@/lib/session';
import { Mark } from './shell/Sidebar';
import { Button } from './ui/primitives';

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const two = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`);
const three = (n: number) => (n >= 100 ? `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${two(n % 100)}` : ''}` : two(n));

/** Indian numbering: crore, lakh, thousand. */
export function rupeesInWords(amount: number) {
  const a = Math.abs(amount);
  let n = Math.floor(a);
  const paise = Math.round((a - n) * 100);
  if (n === 0 && paise === 0) return 'Zero rupees only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${three(crore)} crore`);
  if (lakh) parts.push(`${two(lakh)} lakh`);
  if (thousand) parts.push(`${two(thousand)} thousand`);
  if (n) parts.push(three(n));
  let s = parts.join(' ');
  s = s ? `${s} rupees` : '';
  if (paise) s += `${s ? ' and ' : ''}${two(paise)} paise`;
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} only`;
}

export function PrintSheet({ title, size = 'a4', children }: { title: string; size?: 'a4' | 'a5'; children: React.ReactNode }) {
  const { meta } = useSession();
  const p = meta?.prefs || {};
  return (
    <>
      <style>{`@page { size: ${size === 'a4' ? 'A4' : 'A5'}; margin: 12mm; }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-3">
        <p className="text-[13px] text-ink-soft">Print preview</p>
        <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print</Button>
      </div>
      <article className={`mx-auto bg-white p-[12mm] text-[12.5px] text-ink shadow-rail print:p-0 print:shadow-none ${size === 'a4' ? 'max-w-[210mm]' : 'max-w-[148mm]'}`}>
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-3">
          <div className="flex items-start gap-3">
            <Mark className="h-10 w-10" />
            <div>
              <p className="text-[17px] font-semibold leading-tight">{String(p.hospital_name || meta?.hospital.name || '')}</p>
              <p className="text-ink-soft">{String(p.hospital_address || '')}</p>
              {p.hospital_gstin ? <p className="text-ink-soft">GSTIN {String(p.hospital_gstin)}</p> : null}
            </div>
          </div>
          <p className="text-right text-[15px] font-semibold">{title}</p>
        </header>
        {children}
        {p.receipt_footer ? <footer className="mt-8 border-t border-line pt-2 text-center text-[11.5px] text-ink-mute">{String(p.receipt_footer)}</footer> : null}
      </article>
    </>
  );
}
