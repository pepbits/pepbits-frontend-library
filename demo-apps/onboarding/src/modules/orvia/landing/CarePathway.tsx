'use client';
import React, {useEffect, useRef, useState, type KeyboardEvent} from 'react';
import {useLocalization} from '@pepbits/i18n/react';
import {usePreferences} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
import {cn} from '@pepbits/ui';

const STOPS = [
  {id: 'register', label: 'Registration', time: '09:02', module: 'Patient access', who: 'Front desk', detail: 'The patient is matched in the master index, insurance eligibility is checked in real time and a visit token is issued.'},
  {id: 'triage', label: 'Triage', time: '09:10', module: 'Nursing', who: 'Triage nurse', detail: "Vitals and acuity are recorded on a tablet. High-acuity patients move to the top of the doctor's queue automatically."},
  {id: 'consult', label: 'Consultation', time: '09:24', module: 'EHR and CPOE', who: 'Physician', detail: 'Notes, diagnoses and orders go into one chart. Drug, allergy and duplicate-order alerts appear as the prescription is written.'},
  {id: 'diagnostics', label: 'Lab and imaging', time: '09:41', module: 'LIS and RIS', who: 'Lab and radiology', detail: 'Orders reach the lab and imaging worklists with barcoded samples. Results return to the chart coded in LOINC, images over DICOM.'},
  {id: 'pharmacy', label: 'Pharmacy', time: '10:05', module: 'Dispensing', who: 'Pharmacist', detail: 'The prescription lands in the pharmacy queue for verification. Stock is deducted by batch and expiry as it is dispensed.'},
  {id: 'claim', label: 'Claim', time: '10:06', module: 'Revenue cycle', who: 'Billing team', detail: 'Every charge was captured along the way. The claim is scrubbed, sent to the payer or health authority and reconciled into AR.'},
] as const;

// Trace geometry is fixed domain illustration (CMP-04): a heartbeat-like complex between six stops.
const W = 600, H = 120, BASE = 74;
const xAt = (i: number) => 50 + i * 100;
function beat(mid: number) {
  return [`L${mid - 24},${BASE}`, `Q${mid - 19},${BASE - 7} ${mid - 14},${BASE}`, `L${mid - 6},${BASE}`, `L${mid - 3},${BASE + 8}`, `L${mid + 1},${BASE - 46}`, `L${mid + 5},${BASE + 16}`, `L${mid + 8},${BASE}`, `Q${mid + 16},${BASE - 10} ${mid + 24},${BASE}`].join(' ');
}
const SEGMENTS = STOPS.slice(0, -1).map((_, i) => `${beat(xAt(i) + 50)} L${xAt(i + 1)},${BASE}`).join(' ');
const FULL_PATH = `M0,${BASE} L${xAt(0)},${BASE} ${SEGMENTS} L${W},${BASE}`;
const JOURNEY_PATH = `M${xAt(0)},${BASE} ${SEGMENTS}`;

/** Interactive outpatient journey. Arrow keys follow reading direction; times use the effective time format. */
export function CarePathway() {
  const {t, direction} = useLocalization(), format = useFormatters(), {preferences} = usePreferences();
  const [active, setActive] = useState(0), [ready, setReady] = useState(preferences.reducedMotion);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const stop = STOPS[active]!;
  useEffect(() => {
    if (preferences.reducedMotion) {setReady(true); return;}
    const timer = setTimeout(() => setReady(true), 1700);
    return () => clearTimeout(timer);
  }, [preferences.reducedMotion]);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight', backward = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const delta = event.key === forward ? 1 : event.key === backward ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + STOPS.length) % STOPS.length;
    setActive(next); refs.current[next]?.focus();
  }
  return <div data-orvia-rail className="relative overflow-hidden rounded-3xl bg-rail text-white shadow-[0_40px_80px_-40px_rgba(6,47,44,0.7)]">
    <div className="bg-chart-grid absolute inset-0" aria-hidden="true"/>
    <div className="relative p-5 sm:p-7 xl:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold tracking-[-0.01em] sm:text-xl">{t('One outpatient visit, one record')}</p>
          <p className="mt-0.5 text-sm text-rail-200">{t('MRN {mrn} at {site}', {mrn: '24-00813', site: 'Riverside Clinic'})}</p>
        </div>
        <p className="rounded-full bg-white/[0.08] px-3 py-1 text-sm tabular-nums text-mint ring-1 ring-white/10">{t('{minutes} min door to claim', {minutes: format.number(64)})}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full overflow-visible" role="img" aria-label={t('Patient journey trace through six departments')} style={direction === 'rtl' ? {transform: 'scaleX(-1)'} : undefined}>
        <path d={FULL_PATH} fill="none" stroke="rgba(127,224,198,0.28)" strokeWidth="2" strokeLinejoin="round" pathLength={1} strokeDasharray="1" className="animate-trace"/>
        <path d={JOURNEY_PATH} fill="none" stroke="var(--color-mint)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength={1}
          style={{strokeDasharray: `${active / (STOPS.length - 1)} 1`, opacity: ready ? 1 : 0, transition: 'stroke-dasharray 650ms cubic-bezier(.4,0,.2,1), opacity 400ms ease'}}/>
        {STOPS.map((item, i) => {
          const done = i <= active;
          return <g key={item.id}>
            {i === active && ready && <circle key={`ring-${active}`} cx={xAt(i)} cy={BASE} r="7" fill="none" stroke="var(--color-mint)" strokeWidth="1.5" className="origin-fill-center animate-ring"/>}
            <circle cx={xAt(i)} cy={BASE} r={i === active ? 7 : 5} fill={done ? 'var(--color-mint)' : 'var(--color-rail)'} stroke="var(--color-mint)" strokeWidth="2"
              style={{transition: 'r 200ms ease, fill 300ms ease', animation: `orvia-dot-in 300ms ease-out ${200 + i * 220}ms both`}}/>
          </g>;
        })}
      </svg>
      <div role="radiogroup" aria-label={t('Choose a step in the visit')} onKeyDown={onKeyDown} className="-mx-1 mt-2 grid grid-cols-3 gap-1 sm:grid-cols-6">
        {STOPS.map((item, i) => {
          const isActive = i === active;
          return <button key={item.id} ref={element => {refs.current[i] = element;}} type="button" role="radio" aria-checked={isActive} tabIndex={isActive ? 0 : -1}
            onClick={() => setActive(i)} onMouseEnter={() => ready && setActive(i)}
            className={cn('flex flex-col items-center rounded-xl px-1 py-2 text-center transition-colors duration-150', isActive ? 'bg-white/[0.09] text-white' : 'text-rail-200 hover:bg-white/[0.05] hover:text-white')}>
            <span className="text-[length:calc(0.7rem*var(--fs-scale))] tabular-nums text-rail-200">{format.time(item.time)}</span>
            <span className="text-[length:calc(0.8rem*var(--fs-scale))] font-semibold leading-tight sm:text-[length:calc(0.82rem*var(--fs-scale))]">{t(item.label)}</span>
          </button>;
        })}
      </div>
      <div className="mt-4 min-h-[9.5rem] rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 sm:min-h-[8.5rem] sm:p-5" aria-live="polite">
        <div key={stop.id} className="animate-fade-up">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-display text-xl font-semibold tracking-[-0.01em]">{t(stop.label)}</p>
            <span className="rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-semibold text-mint">{t(stop.module)}</span>
            <span className="ms-auto text-sm text-rail-200">{t(stop.who)}</span>
          </div>
          <p className="mt-2 max-w-[60ch] text-[length:calc(0.95rem*var(--fs-scale))] leading-relaxed text-rail-100">{t(stop.detail)}</p>
        </div>
      </div>
    </div>
  </div>;
}
