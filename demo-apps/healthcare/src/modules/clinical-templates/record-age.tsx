import React from "react";
import {Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
export function ageParts(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const birth = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(birth.getTime()) ||
    birth.toISOString().slice(0, 10) !== value ||
    birth > now
  )
    return null;
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const anniversary = (months: number) => {
    const month = birth.getUTCMonth() + months,
      year = birth.getUTCFullYear();
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return Date.UTC(year, month, Math.min(birth.getUTCDate(), last));
  };
  let totalMonths =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    birth.getUTCMonth();
  if (anniversary(totalMonths) > today) totalMonths--;
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: Math.floor((today - anniversary(totalMonths)) / 86400000),
  };
}
export function PatientAge({ birthDate }: { birthDate: string }) {
  const { t } = useLocalization(),
    age = ageParts(birthDate);
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">
        {t("template.clinical.age")}
      </p>
      <div className="flex min-h-9 items-center gap-2">
        {age ? (
          Object.entries(age).map(([unit, value]) => (
            <Badge key={unit}>
              {value} {t(`template.clinical.${unit}`)}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-[var(--text-muted)]">
            {t("template.clinical.enterBirthDate")}
          </span>
        )}
      </div>
    </div>
  );
}
