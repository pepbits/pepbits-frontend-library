"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { CatalogIcon } from "@/components/brand/CatalogIcon";
import { ButtonLink } from "@/components/ui/Button";
import { CARE_SETTINGS, FACILITY_TYPES, MODULE_GROUPS, NETWORK_PROFILE, type IconName } from "@/lib/catalog";
import { cn } from "@/lib/cn";

interface Profile {
  id: string;
  label: string;
  noun: string;
  icon: IconName;
  summary: string;
  description: string;
  careSettings: string[];
  modules: string[];
}

const PROFILES: Profile[] = [...FACILITY_TYPES, NETWORK_PROFILE];

export function FacilityExplorer() {
  const [activeId, setActiveId] = useState<string>(PROFILES[0]!.id);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = PROFILES.find((p) => p.id === activeId)!;
  const activeIndex = PROFILES.indexOf(active);

  const groups = MODULE_GROUPS.map((g) => ({
    ...g,
    modules: g.modules.filter((m) => active.modules.includes(m.id)),
  })).filter((g) => g.modules.length > 0);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
    const back = e.key === "ArrowUp" || e.key === "ArrowLeft";
    if (!forward && !back) return;
    e.preventDefault();
    const next = (activeIndex + (forward ? 1 : -1) + PROFILES.length) % PROFILES.length;
    setActiveId(PROFILES[next]!.id);
    tabs.current[next]?.focus();
  }

  const registerHref = active.id === "network" ? "/register?structure=network" : `/register?type=${active.id}`;

  return (
    <section id="platform" className="scroll-mt-16 border-t border-ink-100 bg-white">
      <div className="grid w-full grid-cols-1 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(16rem,0.75fr)_minmax(0,2.25fr)] lg:gap-12 lg:px-10 lg:py-20 2xl:px-16">
        <div className="min-w-0">
          <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 sm:text-[2.6rem]">
            Set up for the way you deliver care
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-ink-600">
            Pick the kind of organization you run to see what it starts with. Every module shares one patient record, so
            you can switch more on as you grow.
          </p>
          <div
            role="tablist"
            aria-label="Organization types"
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
            className="scrollbar-none -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0"
          >
            {PROFILES.map((p, i) => {
              const selected = p.id === activeId;
              return (
                <button
                  key={p.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  id={`tab-${p.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls="facility-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(p.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 lg:w-full",
                    selected
                      ? "border-scrub-700 bg-scrub-700 text-white"
                      : "border-ink-100 bg-white text-ink-700 hover:border-ink-200 hover:bg-ink-50 lg:border-transparent",
                  )}
                >
                  <CatalogIcon name={p.icon} className="h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0">
                    <span className="block whitespace-nowrap text-sm font-semibold">{p.label}</span>
                    <span
                      className={cn(
                        "hidden text-[0.8rem] leading-snug lg:block",
                        selected ? "text-scrub-100" : "text-ink-500",
                      )}
                    >
                      {p.summary}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="facility-panel"
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          className="min-w-0 rounded-[28px] border border-ink-100 bg-paper p-5 sm:p-8 xl:p-10"
        >
          <div key={active.id} className="animate-fade-up">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink-900 sm:text-3xl">
                  {active.label}
                </h3>
                <p className="mt-3 leading-relaxed text-ink-600">{active.description}</p>
              </div>
              <ButtonLink href={registerHref} variant="secondary" className="self-start">
                Register as {/^[aeiou]/i.test(active.noun) ? "an" : "a"} {active.noun}
              </ButtonLink>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-ink-700">Care settings</span>
              {active.careSettings.map((id) => {
                const c = CARE_SETTINGS.find((s) => s.id === id);
                if (!c) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1 text-sm text-ink-700"
                  >
                    <CatalogIcon name={c.icon} className="h-3.5 w-3.5 text-scrub-600" />
                    {c.label}
                  </span>
                );
              })}
            </div>

            <div className="mt-8 grid gap-x-8 gap-y-7 border-t border-ink-100 pt-7 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((g) => (
                <div key={g.id}>
                  <p className="text-sm font-semibold text-ink-900">
                    {g.label}
                    <span className="ml-2 font-normal tabular-nums text-ink-400">{g.modules.length}</span>
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {g.modules.map((m) => (
                      <li key={m.id} className="flex items-start gap-2 text-[0.92rem] leading-snug text-ink-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-scrub-600" strokeWidth={2.5} aria-hidden="true" />
                        {m.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
