import {
  Accessibility,
  Armchair,
  BedDouble,
  Building2,
  CalendarClock,
  FlaskConical,
  HeartPulse,
  Hospital,
  House,
  Network,
  Pill,
  ScanLine,
  Scissors,
  Shapes,
  Siren,
  Stethoscope,
  Store,
  TestTube,
  Video,
  type LucideIcon,
} from "lucide-react";

/*
 * Icons for host-supplied codes. Codes are matched case-insensitively with
 * spaces and hyphens treated as underscores. Anything unknown gets a generic
 * icon, so a new code from the host never breaks the page.
 */
const MAP: Record<string, LucideIcon> = {
  // structure
  SINGLE: Building2,
  NETWORK: Network,
  // facility types
  HOSPITAL: Hospital,
  CLINIC: Stethoscope,
  PHARMACY: Pill,
  LAB: FlaskConical,
  LABORATORY: FlaskConical,
  RADIOLOGY: ScanLine,
  IMAGING: ScanLine,
  IMAGING_CENTRE: ScanLine,
  IMAGING_CENTER: ScanLine,
  HOMECARE: House,
  HOME_CARE: House,
  TELEHEALTH: Video,
  // care settings
  OPD: Stethoscope,
  OUTPATIENT: Stethoscope,
  IPD: BedDouble,
  INPATIENT: BedDouble,
  ER: Siren,
  ED: Siren,
  EMERGENCY: Siren,
  DAYCARE: CalendarClock,
  DAY_CARE: CalendarClock,
  DAY_SURGERY: CalendarClock,
  ICU: HeartPulse,
  CRITICAL_CARE: HeartPulse,
  OT: Scissors,
  OPERATING_THEATRE: Scissors,
  SURGERY: Scissors,
  LTC: Armchair,
  LONG_TERM_CARE: Armchair,
  REHAB: Accessibility,
  REHABILITATION: Accessibility,
  RETAIL: Store,
  PHARMACY_COUNTER: Store,
  COLLECTION: TestTube,
  SAMPLE_COLLECTION: TestTube,
};

export function iconFor(code: string): LucideIcon {
  return MAP[code.trim().toUpperCase().replace(/[\s-]+/g, "_")] ?? Shapes;
}

export function CatalogIcon({ code, className = "h-5 w-5" }: { code: string; className?: string }) {
  const Icon = iconFor(code);
  return <Icon className={className} aria-hidden="true" strokeWidth={1.8} />;
}
