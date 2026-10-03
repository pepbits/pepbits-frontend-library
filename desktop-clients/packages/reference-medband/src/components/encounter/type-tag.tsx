import {
  BedDouble,
  Building2,
  FlaskConical,
  HeartPulse,
  House,
  RotateCcw,
  Siren,
  Stethoscope,
  Sunrise,
  Video,
  type LucideIcon,
} from "lucide-react";
import { LocalizedText } from "@pepbits/ops-ui";
import { encounterType, STATUS_TONE } from "../../lib/encounter-config";
import type { EncounterStatus, EncounterType } from "../../lib/types";
import { cx } from "../../lib/utils";

export const TYPE_ICON: Record<EncounterType, LucideIcon> = {
  OP: Stethoscope,
  FOLLOW_UP: RotateCcw,
  IP: BedDouble,
  EMERGENCY: Siren,
  DAY_CARE: Sunrise,
  TELE: Video,
  HOME_VISIT: House,
  OUTSIDE: Building2,
  NO_CONSULT: FlaskConical,
  HEALTH_CHECK: HeartPulse,
};

export function TypeTag({ type, className, withLabel = true }: { type: EncounterType; className?: string; withLabel?: boolean }) {
  const t = encounterType(type);
  const Icon = TYPE_ICON[type];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-md py-0.5 pr-2 pl-0.5 text-[12px] font-semibold", t.tone.soft, t.tone.text, className)}>
      <span className={cx("grid size-5 place-items-center rounded text-white", t.tone.band)}>
        <Icon className="size-3" strokeWidth={2.5} />
      </span>
      <LocalizedText message={withLabel ? t.label : t.short} />
    </span>
  );
}

export function StatusPill({ status }: { status: EncounterStatus }) {
  return <span className={cx("inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold", STATUS_TONE[status])}><LocalizedText message={status} /></span>;
}
