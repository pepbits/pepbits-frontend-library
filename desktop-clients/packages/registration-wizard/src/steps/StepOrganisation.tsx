import { CatalogIcon } from "../ui/CatalogIcon";
import { RadioTileGroup, SelectTile } from "../ui/Choice";
import { ListStatus } from "../ui/ListStatus";
import { toggle } from "../registration";
import { Section } from "../Section";
import type { StepProps } from "../step-types";

export function StepOrganisation({ data, errors, setData, lists }: StepProps) {
  const types = lists.facilityTypes;
  return (
    <div className="space-y-10">
      <Section title="How is your organisation set up?" error={errors.structure} errorId="structure">
        <RadioTileGroup
          id="structure"
          label="How is your organisation set up?"
          invalid={!!errors.structure}
          className="grid gap-3 sm:grid-cols-2"
        >
          <SelectTile
            kind="single"
            selected={data.structure === "SINGLE"}
            onToggle={() => setData((d) => ({ ...d, structure: "SINGLE" }))}
            icon={<CatalogIcon code="SINGLE" />}
            title="Single facility"
            description="One hospital, clinic, pharmacy, laboratory or imaging centre at one location."
            invalid={!!errors.structure}
          />
          <SelectTile
            kind="single"
            selected={data.structure === "NETWORK"}
            onToggle={() => setData((d) => ({ ...d, structure: "NETWORK" }))}
            icon={<CatalogIcon code="NETWORK" />}
            title="Multi-facility network"
            description="A group running several hospitals, clinics, pharmacies or laboratories under one organisation."
            invalid={!!errors.structure}
          />
        </RadioTileGroup>
      </Section>

      <Section
        title="What do you operate?"
        description="Select everything that applies."
        error={errors.facilityTypes}
        errorId="facilityTypes"
        aside={
          data.facilityTypes.length > 0 ? (
            <span className="text-sm tabular-nums text-ink-500">{data.facilityTypes.length} selected</span>
          ) : null
        }
      >
        <ListStatus list={types} what="facility types" />
        <div
          id="facilityTypes"
          role="group"
          aria-label="Facility types"
          tabIndex={-1}
          data-invalid={errors.facilityTypes ? "true" : undefined}
          aria-describedby={errors.facilityTypes ? "facilityTypes-error" : undefined}
          className="grid gap-3 focus:outline-none sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        >
          {types.items.map((t) => (
            <SelectTile
              key={t.code}
              selected={data.facilityTypes.includes(t.code)}
              onToggle={() => setData((d) => ({ ...d, facilityTypes: toggle(d.facilityTypes, t.code) }))}
              icon={<CatalogIcon code={t.code} />}
              title={t.name}
              description={t.description}
              invalid={!!errors.facilityTypes}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
