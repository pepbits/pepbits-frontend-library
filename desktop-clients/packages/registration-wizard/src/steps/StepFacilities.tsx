import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "../cn";
import { HOSPITAL_CODE, MAX_BEDS, MAX_NETWORK_FACILITIES, newId } from "../registration";
import { Section } from "../Section";
import type { StepProps } from "../step-types";
import type { FacilityEntry } from "../types";
import { Field, Input, Select } from "../ui/Field";
import { ListStatus } from "../ui/ListStatus";

export function StepFacilities({ data, errors, setData, lists }: StepProps) {
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const types = lists.facilityTypes.items;
  const atLimit = data.facilities.length >= MAX_NETWORK_FACILITIES;

  useEffect(() => {
    if (lastAdded) nameRefs.current[lastAdded]?.focus();
  }, [lastAdded]);

  const update = (id: string, patch: Partial<FacilityEntry>) =>
    setData((d) => ({ ...d, facilities: d.facilities.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));

  const remove = (id: string) => setData((d) => ({ ...d, facilities: d.facilities.filter((f) => f.id !== id) }));

  function add() {
    if (atLimit) return;
    const id = newId();
    setData((d) => ({
      ...d,
      facilities: [...d.facilities, { id, name: "", type: d.facilityTypes[0] ?? "", city: d.profile.city, beds: "" }],
    }));
    setLastAdded(id);
  }

  const counts = new Map<string, number>();
  data.facilities.forEach((f) => f.type && counts.set(f.type, (counts.get(f.type) ?? 0) + 1));
  const mix = Array.from(counts.entries())
    .map(([code, n]) => `${types.find((t) => t.code === code)?.name ?? code} (${n})`)
    .join(", ");

  // Types the organisation said it runs come first in each picker
  const orderedTypes = [
    ...types.filter((t) => data.facilityTypes.includes(t.code)),
    ...types.filter((t) => !data.facilityTypes.includes(t.code)),
  ];

  return (
    <Section
      title={`${data.facilities.length} ${data.facilities.length === 1 ? "facility" : "facilities"}`}
      description={mix || "Add each site that will use the workspace."}
      error={errors.facilities}
      errorId="facilities"
    >
      <ListStatus list={lists.facilityTypes} what="facility types" />
      <div
        id="facilities"
        tabIndex={-1}
        data-invalid={errors.facilities ? "true" : undefined}
        aria-describedby={errors.facilities ? "facilities-error" : undefined}
        className="focus:outline-none"
      >
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
            const isHospital = f.type === HOSPITAL_CODE;
            return (
              <li
                key={f.id}
                className={cn(
                  "grid animate-fade-up gap-3 rounded-2xl border bg-white p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_6.5rem_2.5rem] md:items-start md:p-3",
                  Object.keys(errors).some((k) => k.startsWith(`facilities.${i}.`)) ? "border-signal/40" : "border-ink-200",
                )}
              >
                <Field label={`Facility ${i + 1} name`} labelClassName="md:sr-only" htmlFor={`facilities.${i}.name`} error={e("name")}>
                  <Input
                    ref={(el) => {
                      nameRefs.current[f.id] = el;
                    }}
                    id={`facilities.${i}.name`}
                    value={f.name}
                    onChange={(ev) => update(f.id, { name: ev.target.value })}
                    invalid={!!e("name")}
                  />
                </Field>
                <Field label={`Facility ${i + 1} type`} labelClassName="md:sr-only" htmlFor={`facilities.${i}.type`} error={e("type")}>
                  <Select
                    id={`facilities.${i}.type`}
                    value={f.type}
                    onChange={(ev) => update(f.id, { type: ev.target.value, beds: ev.target.value === HOSPITAL_CODE ? f.beds : "" })}
                    invalid={!!e("type")}
                    placeholder="Choose type"
                  >
                    {orderedTypes.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={`Facility ${i + 1} city`} labelClassName="md:sr-only" htmlFor={`facilities.${i}.city`} error={e("city")}>
                  <Input
                    id={`facilities.${i}.city`}
                    value={f.city}
                    onChange={(ev) => update(f.id, { city: ev.target.value })}
                    invalid={!!e("city")}
                  />
                </Field>
                <Field label={`Facility ${i + 1} beds`} labelClassName="md:sr-only" htmlFor={`facilities.${i}.beds`} error={e("beds")}>
                  <Input
                    id={`facilities.${i}.beds`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_BEDS}
                    step={1}
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
          disabled={atLimit}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-300 text-sm font-semibold text-scrub-700 transition-colors hover:border-scrub-500 hover:bg-scrub-50/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add facility
        </button>
        <p className="mt-3 text-sm text-ink-500">
          {atLimit
            ? `You can register up to ${MAX_NETWORK_FACILITIES} facilities here. Add more after your workspace goes live.`
            : "Departments, wards and price lists are set up per facility after your workspace goes live."}
        </p>
      </div>
    </Section>
  );
}
