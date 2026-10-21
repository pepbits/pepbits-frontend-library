import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toggle } from "../registration";
import { Section } from "../Section";
import type { StepProps } from "../step-types";
import { CatalogIcon } from "../ui/CatalogIcon";
import { SelectTile, ToggleChip } from "../ui/Choice";
import { Input } from "../ui/Field";
import { ListStatus } from "../ui/ListStatus";

export function StepScope({ data, errors, setData, lists, host }: StepProps) {
  const [query, setQuery] = useState("");
  const careSettings = lists.careSettings.items;
  const specialties = lists.specialties.items;
  const suggested = useMemo(
    () => new Set(host.recommendedCareSettings ? host.recommendedCareSettings(data.facilityTypes) : []),
    [host, data.facilityTypes],
  );

  // Suggested settings first, then the rest
  const settings = useMemo(
    () => [...careSettings.filter((c) => suggested.has(c.code)), ...careSettings.filter((c) => !suggested.has(c.code))],
    [careSettings, suggested],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? specialties.filter((s) => s.name.toLocaleLowerCase().includes(q)) : specialties;
  }, [query, specialties]);
  const filteredCodes = filtered.map((s) => s.code);
  const allShownSelected = filtered.length > 0 && filteredCodes.every((c) => data.specialties.includes(c));

  return (
    <div className="space-y-10">
      <Section
        title="Care settings"
        description="Optional. Where you deliver care. Each setting gets its own workflows and worklists."
        error={errors.careSettings}
        errorId="careSettings"
        aside={<span className="text-sm tabular-nums text-ink-500">{data.careSettings.length} selected</span>}
      >
        <ListStatus list={lists.careSettings} what="care settings" />
        <div
          id="careSettings"
          role="group"
          aria-label="Care settings"
          tabIndex={-1}
          className="grid gap-2.5 focus:outline-none sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {settings.map((c) => (
            <SelectTile
              key={c.code}
              size="sm"
              selected={data.careSettings.includes(c.code)}
              onToggle={() => setData((d) => ({ ...d, careSettings: toggle(d.careSettings, c.code) }))}
              icon={<CatalogIcon code={c.code} className="h-[18px] w-[18px]" />}
              title={c.name}
              description={c.description}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Specialties"
        description="Optional. Each specialty brings its own note templates and order sets. You can add more later."
        aside={
          <div className="flex items-center gap-3 text-sm">
            <span className="tabular-nums text-ink-500">{data.specialties.length} selected</span>
            {data.specialties.length > 0 && (
              <button
                type="button"
                onClick={() => setData((d) => ({ ...d, specialties: [] }))}
                className="font-semibold text-scrub-700 underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        }
      >
        <ListStatus list={lists.specialties} what="specialties" />
        {lists.specialties.status === "ready" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="sm:w-80">
                <Input
                  id="specialty-search"
                  aria-label="Search specialties"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${specialties.length} specialties`}
                  leading={<Search className="h-4 w-4" aria-hidden="true" />}
                  trailing={
                    query ? (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null
                  }
                />
              </div>
              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      specialties: allShownSelected
                        ? d.specialties.filter((s) => !filteredCodes.includes(s))
                        : Array.from(new Set([...d.specialties, ...filteredCodes])),
                    }))
                  }
                  className="self-start rounded-lg px-2 py-1 text-sm font-semibold text-scrub-700 hover:bg-scrub-50 sm:self-auto"
                >
                  {allShownSelected ? "Deselect" : "Select"} {query ? `${filtered.length} shown` : "all"}
                </button>
              )}
            </div>
            <div className="scrollbar-thin mt-4 max-h-[17rem] overflow-y-auto rounded-2xl border border-ink-100 bg-white p-3 sm:p-4">
              {filtered.length > 0 ? (
                <div role="group" aria-label="Specialties" className="flex flex-wrap gap-2">
                  {filtered.map((s) => (
                    <ToggleChip
                      key={s.code}
                      selected={data.specialties.includes(s.code)}
                      onToggle={() => setData((d) => ({ ...d, specialties: toggle(d.specialties, s.code) }))}
                    >
                      {s.name}
                    </ToggleChip>
                  ))}
                </div>
              ) : (
                <p className="px-1 py-6 text-center text-sm text-ink-500">
                  {specialties.length === 0 ? "No specialties are offered yet." : <>No specialty matches &ldquo;{query}&rdquo;.</>}
                </p>
              )}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
