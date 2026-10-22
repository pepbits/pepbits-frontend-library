'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BookOpen, Keyboard, Layers, Search } from 'lucide-react';
import { HELP } from '@/components/shell/helpContent';
import { NAV } from '@/components/shell/AppShell';
import { KindIcon } from '@/components/ui/primitives';
import { KIND_LABEL, PATTERN_HINT, SLOT_MODEL_LABEL } from '@/lib/meta';

const CONCEPTS = [
  {
    id: 'layers', title: 'How free time is calculated',
    body: [
      'CareGrid never stores empty slots. It works out free time the moment you ask, so it is always current.',
      'It starts from each resource’s weekly working hours, removes facility holidays (24x7 resources keep running), removes blocks such as leave or maintenance, then removes time already held by bookings, including cleaning, reprocessing and travel buffers.',
      'A time is offered only when every resource the service needs is free for its own minutes, the patient has no clash, and the service’s own rules allow it: notice period, earliest and latest start, and how far ahead it can be booked.',
    ],
  },
  {
    id: 'segments', title: 'Multi-resource appointments',
    body: [
      'Each service lists the resources it needs and for which minutes. A CT with contrast holds the prep bay and a nurse for the first 15 minutes, then the scanner, radiographer and radiologist. The scanner is free for someone else during prep.',
      'Segments can start before the patient arrives (chemotherapy drug preparation) or continue after they leave (a Holter recorder is out with the patient for 24 hours).',
      'When the same role appears twice, two different people or rooms are reserved, for example two surgical teams for a transplant.',
    ],
  },
  {
    id: 'exceptions', title: 'Exceptions without daily checking',
    body: [
      'Record leave, training, maintenance or a breakdown once, either by hand or automatically from HR rosters and the maintenance system.',
      'Before saving, you see exactly which booked patients would be affected. On saving, they move to the reschedule queue with the closest alternatives, preferring the same team.',
      'Use “Fix all automatically” to move everyone to their best alternative in one step, or decide case by case.',
    ],
  },
  {
    id: 'reserved', title: 'Reserved urgent and walk-in time',
    body: [
      'Part of a working window can be held back for urgent cases or walk-ins. Routine bookings cannot use it until a set number of hours before, after which it opens to everyone so it is not wasted.',
      'Urgent bookings can always use reserved time.',
    ],
  },
  {
    id: 'tuning', title: 'Choosing the right slot length',
    body: [
      'Every check-in, start and finish is time-stamped at the front desk. Insights compares planned length with the median and 75th percentile of what actually happens.',
      'The 75th percentile is used because averages are pulled up by a few long cases and down by quick ones. A slot sized at the 75th percentile fits three visits out of four without running late.',
      'Apply a suggestion with one click. Existing bookings keep their times; new bookings use the new length.',
    ],
  },
  {
    id: 'courses', title: 'Courses, waitlist and reminders',
    body: [
      'Repeat bookings create a whole course (dialysis three times a week, ten physiotherapy sessions). If the preferred time is taken on a day, the nearest free time is used and the same team is kept where possible.',
      'When nothing fits, add the patient to the waitlist. When a matching slot is cancelled, the first waitlisted patient is offered it and you are alerted.',
      'Reminders go out by the patient’s preferred channel 24 hours and 2 hours before, including preparation instructions such as fasting.',
    ],
  },
];

export default function HelpPage() {
  const [q, setQ] = useState('');
  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const concepts = useMemo(() => CONCEPTS.filter(c => match(c.title + c.body.join(' '))), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = NAV.filter(n => HELP[n.href] && n.href !== '/help' && match(HELP[n.href].title + HELP[n.href].intro + HELP[n.href].steps.join(' ')));
  return (
    <div className="mx-auto max-w-[90rem] space-y-3">
      <div className="panel flex flex-wrap items-center gap-4 p-5">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-ink">Help center</h1>
          <p className="text-sm text-muted">How CareGrid finds time across people, machines, rooms, chairs, beds and vehicles, and how to use each screen.</p>
        </div>
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input autoFocus className="field h-10 pl-9" placeholder="Search help, for example “breakdown” or “waitlist”" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <section className="panel p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold text-ink"><Layers className="h-4 w-4 text-teal-600" /> Concepts</div>
            <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
              {concepts.map(c => (
                <article key={c.id} id={c.id}>
                  <h2 className="font-semibold text-ink">{c.title}</h2>
                  {c.body.map((p, i) => <p key={i} className="mt-1.5 text-sm leading-relaxed text-muted">{p}</p>)}
                </article>
              ))}
              {!concepts.length && <div className="text-sm text-muted">No concept matches “{q}”.</div>}
            </div>
          </section>
          <section className="panel p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold text-ink"><BookOpen className="h-4 w-4 text-teal-600" /> Screen guides</div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {pages.map(n => {
                const h = HELP[n.href];
                return (
                  <Link key={n.href} href={n.href} className="rounded-xl border border-line p-4 transition hover:border-teal-500">
                    <div className="flex items-center gap-2 font-semibold text-ink"><n.icon className="h-4 w-4 text-teal-600" />{h.title}</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted">{h.intro}</p>
                    <ol className="mt-2 space-y-1 text-xs text-text">
                      {h.steps.map((s, i) => <li key={i} className="flex gap-2"><span className="font-semibold text-teal-700">{i + 1}.</span><span>{s}</span></li>)}
                    </ol>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
        <div className="space-y-3">
          <section className="panel p-5">
            <div className="mb-3 flex items-center gap-2 font-semibold text-ink"><Keyboard className="h-4 w-4 text-teal-600" /> Keyboard shortcuts</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <span><span className="kbd">Ctrl</span> <span className="kbd">K</span></span><span>Search patients, services, resources, pages</span>
              <span className="kbd">/</span><span>Search</span>
              <span className="kbd">B</span><span>Book an appointment</span>
              <span className="kbd">?</span><span>Help for the current page</span>
              <span className="kbd">Esc</span><span>Close any panel</span>
            </div>
          </section>
          <section className="panel p-5">
            <div className="mb-3 font-semibold text-ink">Resource types</div>
            <div className="space-y-2 text-sm">
              {Object.keys(KIND_LABEL).map(k => <div key={k} className="flex items-center gap-2"><KindIcon kind={k} /><span>{KIND_LABEL[k]}</span></div>)}
            </div>
          </section>
          <section className="panel p-5">
            <div className="mb-2 font-semibold text-ink">Resource patterns</div>
            <dl className="space-y-2 text-sm">
              {Object.entries(PATTERN_HINT).map(([k, v]) => <div key={k}><dt className="font-medium text-ink">{k}</dt><dd className="text-xs text-muted">{v}</dd></div>)}
            </dl>
          </section>
          <section className="panel p-5">
            <div className="mb-2 font-semibold text-ink">Slot models</div>
            <dl className="space-y-2 text-sm">
              {[['fixed', 'Set start times for one practitioner, such as consultations.'], ['capacity', 'Several identical chairs or beds; any free one is used, such as sample collection.'], ['block', 'Long cases of varying length in a theatre or suite.'], ['open', 'Queue-based or variable length, such as walk-ins and admissions.']].map(([k, v]) => (
                <div key={k} className={clsx()}><dt className="font-medium text-ink">{SLOT_MODEL_LABEL[k]}</dt><dd className="text-xs text-muted">{v}</dd></div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
