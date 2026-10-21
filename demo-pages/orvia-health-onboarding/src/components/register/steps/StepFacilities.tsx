"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/Field";
import { FACILITY_TYPES } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { describeFacilityMix, newId, type FacilityEntry } from "@/lib/registration";
import { Section } from "../Section";
import type { StepProps } from "../types";

export function StepFacilities({ data, errors, setData }: StepProps) {
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (lastAdded) nameRefs.current[lastAdded]?.focus();
  }, [lastAdded]);

  const update = (id: string, patch: Partial<FacilityEntry>) =>
    setData((d) => ({ ...d, facilities: d.facilities.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));

  const remove = (id: string) => setData((d) => ({ ...d, facilities: d.facilities.filter((f) => f.id !== id) }));

  function add() {
    const id = newId();
    setData((d) => ({
      ...d,
      facilities: [...d.facilities, { id, name: "", type: d.facilityTypes[0] ?? "", city: d.org.city, beds: "" }],
    }));
    setLastAdded(id);
  }

  const mix = describeFacilityMix(data.facilities);
  // Types the organization said it runs come first in each picker
  const orderedTypes = [
    ...FACILITY_TYPES.filter((t) => data.facilityTypes.includes(t.id)),
    ...FACILITY_TYPES.filter((t) => !data.facilityTypes.includes(t.id)),
  ];

  return (
    <Section
      title={`${data.facilities.length} ${data.facilities.length === 1 ? "facility" : "facilities"}`}
      description={mix || "Add each site that will use the workspace."}
      error={errors.facilities}
      errorId="facilities"
    >
      <div id="facilities" tabIndex={-1} data-invalid={errors.facilities ? "true" : undefined} className="focus:outline-none">
        <div
          className="hidden gap-3 px-4 pb-2 text-sm font-medium text-ink-600 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_6.5rem_2.5rem]"
          aria-hidden="true"
        >
          <span>Facility name</span>
          <span>Type</span>
          <span>City</span>
          <span>Beds</span>
          <span />
        </div>
        <ul className="space-y-2.5">
          {data.facilities.map((f, i) => {
            const e = (k: string) => errors[`facilities.${i}.${k}`];
            const isHospital = f.type === "hospital";
            return (
              <li
                key={f.id}
                className={cn(
                  "grid animate-fade-up gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_6.5rem_2.5rem] md:items-start md:p-3",
                  Object.keys(errors).some((k) => k.startsWith(`facilities.${i}.`)) ? "border-signal/40" : "border-ink-200",
                )}
              >
                <Field label="Facility name" labelClassName="md:sr-only" htmlFor={`facilities.${i}.name`} error={e("name")}>
                  <Input
                    ref={(el) => {
                      nameRefs.current[f.id] = el;
                    }}
                    id={`facilities.${i}.name`}
                    value={f.name}
                    onChange={(ev) => update(f.id, { name: ev.target.value })}
                    invalid={!!e("name")}
                    placeholder={i === 0 ? "e.g. Main Hospital" : "e.g. Northside Clinic"}
                  />
                </Field>
                <Field label="Type" labelClassName="md:sr-only" htmlFor={`facilities.${i}.type`} error={e("type")}>
                  <Select
                    id={`facilities.${i}.type`}
                    value={f.type}
                    onChange={(ev) => update(f.id, { type: ev.target.value as FacilityEntry["type"] })}
                    invalid={!!e("type")}
                    placeholder="Choose type"
                  >
                    {orderedTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="City" labelClassName="md:sr-only" htmlFor={`facilities.${i}.city`} error={e("city")}>
                  <Input
                    id={`facilities.${i}.city`}
                    value={f.city}
                    onChange={(ev) => update(f.id, { city: ev.target.value })}
                    invalid={!!e("city")}
                  />
                </Field>
                <Field label="Beds" labelClassName="md:sr-only" htmlFor={`facilities.${i}.beds`} error={e("beds")}>
                  <Input
                    id={`facilities.${i}.beds`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={isHospital ? f.beds : ""}
                    onChange={(ev) => update(f.id, { beds: ev.target.value })}
                    disabled={!isHospital}
                    placeholder={isHospital ? "Beds" : "n/a"}
                    invalid={!!e("beds")}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  disabled={data.facilities.length <= 1}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium text-ink-500 transition-colors hover:bg-[#FFF1F1] hover:text-signal disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-500 md:w-10"
                  aria-label={`Remove ${f.name || `facility ${i + 1}`}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="md:hidden">Remove</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={add}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-300 text-sm font-semibold text-scrub-700 transition-colors hover:border-scrub-500 hover:bg-scrub-50/50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add facility
        </button>
        <p className="mt-3 text-sm text-ink-500">
          Departments, wards, pharmacies-in-hospital and price lists are set up per facility after your workspace goes live.
        </p>
      </div>
    </Section>
  );
}
