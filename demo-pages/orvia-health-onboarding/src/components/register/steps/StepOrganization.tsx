"use client";

import { CatalogIcon } from "@/components/brand/CatalogIcon";
import { SelectTile } from "@/components/ui/Choice";
import { FACILITY_TYPES } from "@/lib/catalog";
import { Section } from "../Section";
import { toggle, type StepProps } from "../types";

export function StepOrganization({ data, errors, setData }: StepProps) {
  return (
    <div className="space-y-10">
      <Section title="How is your organization set up?" error={errors.structure} errorId="structure">
        <div
          id="structure"
          tabIndex={-1}
          data-invalid={errors.structure ? "true" : undefined}
          className="grid gap-3 focus:outline-none sm:grid-cols-2"
        >
          <SelectTile
            kind="single"
            selected={data.structure === "single"}
            onToggle={() => setData((d) => ({ ...d, structure: "single" }))}
            icon={<CatalogIcon name="single" />}
            title="Single facility"
            description="One hospital, clinic, pharmacy, lab or imaging center at one location."
            invalid={!!errors.structure}
          />
          <SelectTile
            kind="single"
            selected={data.structure === "network"}
            onToggle={() => setData((d) => ({ ...d, structure: "network" }))}
            icon={<CatalogIcon name="network" />}
            title="Multi-facility network"
            description="A group running several hospitals, clinics, pharmacies or labs under one organization."
            invalid={!!errors.structure}
          />
        </div>
      </Section>

      <Section
        title="What do you operate?"
        description="Select everything that applies. We use this to suggest care settings and modules."
        error={errors.facilityTypes}
        errorId="facilityTypes"
        aside={
          data.facilityTypes.length > 0 ? (
            <span className="text-sm tabular-nums text-ink-500">{data.facilityTypes.length} selected</span>
          ) : null
        }
      >
        <div
          id="facilityTypes"
          tabIndex={-1}
          data-invalid={errors.facilityTypes ? "true" : undefined}
          className="grid gap-3 focus:outline-none sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {FACILITY_TYPES.map((t) => (
            <SelectTile
              key={t.id}
              selected={data.facilityTypes.includes(t.id)}
              onToggle={() => setData((d) => ({ ...d, facilityTypes: toggle(d.facilityTypes, t.id) }))}
              icon={<CatalogIcon name={t.icon} />}
              title={t.label}
              description={t.summary}
              invalid={!!errors.facilityTypes}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
