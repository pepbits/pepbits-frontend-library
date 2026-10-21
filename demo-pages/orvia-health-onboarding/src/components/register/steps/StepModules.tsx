"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { CheckRow, Segmented, ToggleChip } from "@/components/ui/Choice";
import {
  EMRAM_TARGETS,
  INTEGRATIONS,
  MODULE_GROUPS,
  STANDARD_GROUPS,
  country,
  recommendedModules,
} from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { Section } from "../Section";
import { toggle, type StepProps } from "../types";

type Tab = "modules" | "standards" | "integrations";

export function StepModules({ data, errors, setData }: StepProps) {
  const [tab, setTab] = useState<Tab>("modules");
  const recommended = useMemo(
    () => recommendedModules(data.facilityTypes, data.structure === "network"),
    [data.facilityTypes, data.structure],
  );
  const recSet = useMemo(() => new Set(recommended), [recommended]);
  const totalModules = MODULE_GROUPS.reduce((n, g) => n + g.modules.length, 0);
  const c = country(data.org.country);

  useEffect(() => {
    if (errors.modules) setTab("modules");
  }, [errors.modules]);

  const isRecommendedState =
    recommended.length === data.modules.length && recommended.every((m) => data.modules.includes(m));

  const localIntegrations = INTEGRATIONS.filter((i) => c && i.countries.includes(c.code));
  const globalIntegrations = INTEGRATIONS.filter((i) => i.countries.length === 0);
  const otherIntegrations = INTEGRATIONS.filter((i) => i.countries.length > 0 && !(c && i.countries.includes(c.code)));

  return (
    <div>
      <div
        className="sticky top-0 z-10 -mx-4 bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
        data-invalid={errors.modules ? "true" : undefined}
        tabIndex={-1}
        id="modules"
      >
        <Segmented<Tab>
          label="Setup section"
          value={tab}
          onChange={setTab}
          className="w-full sm:w-auto sm:max-w-xl"
          options={[
            { value: "modules", label: <TabLabel text="Modules" count={data.modules.length} error={!!errors.modules} /> },
            { value: "standards", label: <TabLabel text="Standards" count={data.standards.length} /> },
            { value: "integrations", label: <TabLabel text="Integrations" count={data.integrations.length} /> },
          ]}
        />
      </div>

      <div key={tab} className="mt-7 animate-fade-in">
        {tab === "modules" && (
          <Section
            title={`${data.modules.length} of ${totalModules} modules selected`}
            description={`${recommended.length} modules are suggested for the facility types you chose. Unselected suggestions are tagged.`}
            error={errors.modules}
            aside={
              !isRecommendedState && (
                <button
                  type="button"
                  onClick={() => setData((d) => ({ ...d, modules: recommended }))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-scrub-700 hover:bg-scrub-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Reset to suggested
                </button>
              )
            }
          >
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {MODULE_GROUPS.map((g) => {
                const ids = g.modules.map((m) => m.id);
                const count = ids.filter((id) => data.modules.includes(id)).length;
                const all = count === ids.length;
                return (
                  <div key={g.id} className="rounded-2xl border border-ink-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
                      <p className="font-semibold text-ink-900">
                        {g.label}
                        <span className="ml-2 text-sm font-normal tabular-nums text-ink-400">
                          {count}/{ids.length}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setData((d) => ({
                            ...d,
                            modules: all
                              ? d.modules.filter((m) => !ids.includes(m))
                              : Array.from(new Set([...d.modules, ...ids])),
                          }))
                        }
                        className="rounded-md px-1.5 py-0.5 text-[0.8rem] font-semibold text-scrub-700 hover:bg-scrub-50"
                      >
                        {all ? "Clear" : "Select all"}
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {g.modules.map((m) => (
                        <CheckRow
                          key={m.id}
                          id={`module-${m.id}`}
                          checked={data.modules.includes(m.id)}
                          onChange={() => setData((d) => ({ ...d, modules: toggle(d.modules, m.id) }))}
                          label={m.label}
                          description={m.description}
                          tag={recSet.has(m.id) && !data.modules.includes(m.id) ? "Suggested" : undefined}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {tab === "standards" && (
          <div className="space-y-10">
            <Section
              title="Standards you follow"
              description="We switch on the matching controls, code sets and audit reports. Pre-selected items are recommended for every organization."
            >
              <dl className="divide-y divide-ink-100 rounded-2xl border border-ink-200 bg-white">
                {STANDARD_GROUPS.map((g) => (
                  <div key={g.id} className="grid gap-3 p-4 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6 sm:p-5">
                    <dt>
                      <p className="font-semibold text-ink-900">{g.label}</p>
                      <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-500">{g.description}</p>
                    </dt>
                    <dd className="flex flex-wrap content-start gap-2">
                      {g.items.map((i) => (
                        <ToggleChip
                          key={i.id}
                          selected={data.standards.includes(i.id)}
                          onToggle={() => setData((d) => ({ ...d, standards: toggle(d.standards, i.id) }))}
                        >
                          {i.label}
                        </ToggleChip>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>
            <Section
              title="HIMSS EMRAM target"
              description="If you are working toward an EMRAM stage, we'll track the criteria on your quality dashboard."
            >
              <Segmented
                label="HIMSS EMRAM target stage"
                value={data.emramTarget}
                onChange={(v) => setData((d) => ({ ...d, emramTarget: v }))}
                options={EMRAM_TARGETS.map((t) => ({ value: t.value, label: t.label }))}
                className="w-full max-w-lg"
              />
            </Section>
          </div>
        )}

        {tab === "integrations" && (
          <div className="space-y-9">
            {localIntegrations.length > 0 && (
              <IntegrationGroup
                title={`Health authority and payer links for ${c!.name}`}
                description="Required or common for licensed providers in your country."
                items={localIntegrations}
                selected={data.integrations}
                onToggle={(id) => setData((d) => ({ ...d, integrations: toggle(d.integrations, id) }))}
                highlight
              />
            )}
            <IntegrationGroup
              title="Available everywhere"
              items={globalIntegrations}
              selected={data.integrations}
              onToggle={(id) => setData((d) => ({ ...d, integrations: toggle(d.integrations, id) }))}
            />
            <IntegrationGroup
              title={c ? "Other regions" : "Health authority and payer links"}
              description={c ? undefined : "Choose your country in step 2 to see the ones that apply to you first."}
              items={otherIntegrations}
              selected={data.integrations}
              onToggle={(id) => setData((d) => ({ ...d, integrations: toggle(d.integrations, id) }))}
              withRegion
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TabLabel({ text, count, error }: { text: string; count: number; error?: boolean }) {
  return (
    <>
      <span className="truncate">{text}</span>
      <span
        className={cn(
          "rounded-full px-1.5 text-[0.7rem] font-semibold tabular-nums",
          error ? "bg-signal text-white" : "bg-ink-200/70 text-ink-600",
        )}
      >
        {count}
      </span>
    </>
  );
}

function IntegrationGroup({
  title,
  description,
  items,
  selected,
  onToggle,
  highlight,
  withRegion,
}: {
  title: string;
  description?: string;
  items: typeof INTEGRATIONS;
  selected: string[];
  onToggle: (id: string) => void;
  highlight?: boolean;
  withRegion?: boolean;
}) {
  return (
    <Section title={title} description={description}>
      <div className={cn("flex flex-wrap gap-2", highlight && "rounded-2xl border border-scrub-200 bg-scrub-50/50 p-4")}>
        {items.map((i) => (
          <ToggleChip
            key={i.id}
            selected={selected.includes(i.id)}
            onToggle={() => onToggle(i.id)}
            tag={withRegion ? i.countries.join(", ") : undefined}
          >
            {i.label}
          </ToggleChip>
        ))}
      </div>
    </Section>
  );
}
