"use client";
import React, { useState } from "react";
import { Button, Select } from "@pepbits/ui";
import { useLocalization } from "@pepbits/i18n/react";
import { useFormatters } from "@pepbits/patterns/screen-host";
const PERMANENT = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
];
const PRIMARY = [
  [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
];
const SURFACES = [
  ["M", "Mesial"],
  ["O", "Occlusal"],
  ["D", "Distal"],
  ["B", "Buccal"],
  ["L", "Lingual"],
  ["I", "Incisal"],
];
/** Anatomical FDI chart keeps patient-right to patient-left ordering in every interface direction. */
export function ToothPicker({
  teeth,
  surfaces,
  onChange,
  disabled,
  child,
}: {
  teeth: string[];
  surfaces: string[];
  onChange: (v: { teeth: string[]; surfaces: string[] }) => void;
  disabled?: boolean;
  child?: boolean;
}) {
  const [primary, setPrimary] = useState(
    !!child && !teeth.some((t) => Number(t) < 50)
  );
  const { t } = useLocalization(),
    format = useFormatters();
  return (
    <div className="grid gap-2">
      <Select
        label="Teeth (FDI)"
        disabled={disabled}
        value={primary ? "primary" : "permanent"}
        options={[
          { value: "primary", label: "Primary teeth" },
          { value: "permanent", label: "Permanent teeth" },
        ]}
        onChange={(e) => {
          if (!disabled) setPrimary(e.target.value === "primary");
        }}
      />
      <div dir="ltr" className="overflow-x-auto">
        {(primary ? PRIMARY : PERMANENT).map((row, i) => (
          <div
            key={i}
            role="group"
            aria-label={t(i ? "Lower teeth" : "Upper teeth")}
            className="flex gap-1"
          >
            {row.map((n) => {
              const code = String(n);
              return (
                <Button
                  key={code}
                  disabled={disabled}
                  aria-label={`${t("Tooth")} ${code}`}
                  aria-pressed={teeth.includes(code)}
                  onClick={() => {
                    if (!disabled)
                      onChange({
                        teeth: teeth.includes(code)
                          ? teeth.filter((x) => x !== code)
                          : [...teeth, code].sort(),
                        surfaces,
                      });
                  }}
                >
                  {format.number(n)}
                </Button>
              );
            })}
          </div>
        ))}
      </div>
      <div role="group" aria-label={t("Surfaces")}>
        {SURFACES.map(([code, name]) => (
          <Button
            key={code}
            disabled={disabled}
            aria-pressed={surfaces.includes(code!)}
            onClick={() => {
              if (!disabled)
                onChange({
                  teeth,
                  surfaces: surfaces.includes(code!)
                    ? surfaces.filter((x) => x !== code)
                    : [...surfaces, code!],
                });
            }}
          >
            {t(name!)}
          </Button>
        ))}
      </div>
    </div>
  );
}
