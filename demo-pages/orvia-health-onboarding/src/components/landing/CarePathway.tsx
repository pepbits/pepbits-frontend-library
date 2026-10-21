"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

const STOPS = [
  {
    id: "register",
    label: "Registration",
    time: "09:02",
    module: "Patient access",
    who: "Front desk",
    detail:
      "The patient is matched in the master index, insurance eligibility is checked in real time and a visit token is issued.",
  },
  {
    id: "triage",
    label: "Triage",
    time: "09:10",
    module: "Nursing",
    who: "Triage nurse",
    detail: "Vitals and acuity are recorded on a tablet. High-acuity patients move to the top of the doctor's queue automatically.",
  },
  {
    id: "consult",
    label: "Consultation",
    time: "09:24",
    module: "EHR and CPOE",
    who: "Physician",
    detail:
      "Notes, diagnoses and orders go into one chart. Drug, allergy and duplicate-order alerts appear as the prescription is written.",
  },
  {
    id: "diagnostics",
    label: "Lab and imaging",
    time: "09:41",
    module: "LIS and RIS",
    who: "Lab and radiology",
    detail:
      "Orders reach the lab and imaging worklists with barcoded samples. Results return to the chart coded in LOINC, images over DICOM.",
  },
  {
    id: "pharmacy",
    label: "Pharmacy",
    time: "10:05",
    module: "Dispensing",
    who: "Pharmacist",
    detail: "The prescription lands in the pharmacy queue for verification. Stock is deducted by batch and expiry as it is dispensed.",
  },
  {
    id: "claim",
    label: "Claim",
    time: "10:06",
    module: "Revenue cycle",
    who: "Billing team",
    detail:
      "Every charge was captured along the way. The claim is scrubbed, sent to the payer or health authority and reconciled into AR.",
  },
] as const;

const W = 600;
const H = 120;
const BASE = 74;
const xAt = (i: number) => 50 + i * 100;

/** One heartbeat-like complex between two stops. */
function beat(mid: number) {
  return [
    `L${mid - 24},${BASE}`,
    `Q${mid - 19},${BASE - 7} ${mid - 14},${BASE}`,
    `L${mid - 6},${BASE}`,
    `L${mid - 3},${BASE + 8}`,
    `L${mid + 1},${BASE - 46}`,
    `L${mid + 5},${BASE + 16}`,
    `L${mid + 8},${BASE}`,
    `Q${mid + 16},${BASE - 10} ${mid + 24},${BASE}`,
  ].join(" ");
}

const SEGMENTS = STOPS.slice(0, -1)
  .map((_, i) => `${beat(xAt(i) + 50)} L${xAt(i + 1)},${BASE}`)
  .join(" ");
const FULL_PATH = `M0,${BASE} L${xAt(0)},${BASE} ${SEGMENTS} L${W},${BASE}`;
const JOURNEY_PATH = `M${xAt(0)},${BASE} ${SEGMENTS}`;

export function CarePathway() {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const stop = STOPS[active]!;

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1700);
    return () => clearTimeout(t);
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + STOPS.length) % STOPS.length;
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-scrub-900 text-white shadow-[0_40px_80px_-40px_rgba(6,47,44,0.7)]">
      <div className="bg-chart-grid absolute inset-0" aria-hidden="true" />
      <div className="relative p-5 sm:p-7 xl:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-semibold tracking-[-0.01em] sm:text-xl">One outpatient visit, one record</p>
            <p className="mt-0.5 text-sm text-scrub-200">MRN 24-00813 at Riverside Clinic</p>
          </div>
          <p className="rounded-full bg-white/[0.08] px-3 py-1 text-sm tabular-nums text-mint ring-1 ring-white/10">
            64 min door to claim
          </p>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full overflow-visible" role="img" aria-label="Patient journey trace through six departments">
          <path
            d={FULL_PATH}
            fill="none"
            stroke="rgba(127,224,198,0.28)"
            strokeWidth="2"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1"
            className="animate-trace"
          />
          <path
            d={JOURNEY_PATH}
            fill="none"
            stroke="#7FE0C6"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{
              strokeDasharray: `${active / (STOPS.length - 1)} 1`,
              opacity: ready ? 1 : 0,
              transition: "stroke-dasharray 650ms cubic-bezier(.4,0,.2,1), opacity 400ms ease",
            }}
          />
          {STOPS.map((s, i) => {
            const done = i <= active;
            return (
              <g key={s.id}>
                {i === active && ready && (
                  <circle key={`ring-${active}`} cx={xAt(i)} cy={BASE} r="7" fill="none" stroke="#7FE0C6" strokeWidth="1.5" className="origin-fill-center animate-ring" />
                )}
                <circle
                  cx={xAt(i)}
                  cy={BASE}
                  r={i === active ? 7 : 5}
                  fill={done ? "#7FE0C6" : "#062F2C"}
                  stroke="#7FE0C6"
                  strokeWidth="2"
                  style={{
                    transition: "r 200ms ease, fill 300ms ease",
                    opacity: 0,
                    animation: `fade-in 300ms ease-out ${200 + i * 220}ms both`,
                  }}
                />
              </g>
            );
          })}
        </svg>

        <div
          role="radiogroup"
          aria-label="Choose a step in the visit"
          onKeyDown={onKeyDown}
          className="-mx-1 mt-2 grid grid-cols-3 gap-1 sm:grid-cols-6"
        >
          {STOPS.map((s, i) => {
            const isActive = i === active;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(i)}
                onMouseEnter={() => ready && setActive(i)}
                className={cn(
                  "flex flex-col items-center rounded-xl px-1 py-2 text-center transition-colors duration-150 focus-visible:outline-mint",
                  isActive ? "bg-white/[0.09] text-white" : "text-scrub-200 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <span className="text-[0.7rem] tabular-nums text-scrub-300">{s.time}</span>
                <span className="text-[0.8rem] font-semibold leading-tight sm:text-[0.82rem]">{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 min-h-[9.5rem] rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 sm:min-h-[8.5rem] sm:p-5">
          <div key={stop.id} className="animate-fade-up">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-display text-xl font-semibold tracking-[-0.01em]">{stop.label}</p>
              <span className="rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-semibold text-mint">{stop.module}</span>
              <span className="ml-auto text-sm text-scrub-300">{stop.who}</span>
            </div>
            <p className="mt-2 max-w-[60ch] text-[0.95rem] leading-relaxed text-scrub-100">{stop.detail}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
