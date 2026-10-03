export type KpiStatus = "on_target" | "warning" | "breach" | "no_data";
export type ResultStatus = "draft" | "submitted" | "verified" | "approved" | "rejected";
export type Unit = "percent" | "minutes" | "per_1000" | "count";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  title: string | null;
  facility_id: number | null;
}

export interface Facility {
  id: number;
  code: string;
  name: string;
  type: string;
  city: string;
  jurisdiction: string;
}

export interface TatDefinition {
  id: number;
  code: string;
  name: string;
  domain: string;
  start_event: string;
  end_event: string;
  target_minutes: number;
  filter: string | Record<string, unknown>;
  description: string | null;
}

export interface Meta {
  facilities: Facility[];
  periods: string[];
  latestPeriod: string | null;
  roles: { id: string; label: string; description: string }[];
  domains: string[];
  programs: string[];
  eventDomains: { id: string; label: string; stages: string[]; cancel: string; source: string }[];
  tatDefinitions: TatDefinition[];
  authorities: { id: number; code: string; name: string; channel: string; active: number }[];
  users: { id: number; name: string; role: string; status: string }[];
}

export interface IndicatorMeta {
  id: number;
  code: string;
  name: string;
  unit: Unit;
  direction: "higher" | "lower";
  target: number;
  warning: number;
  domain?: string;
  program?: string;
}

export interface Indicator extends IndicatorMeta {
  domain: string;
  program: string;
  category: string;
  numerator_def: string;
  denominator_def: string;
  exclusions: string | null;
  frequency: string;
  facility_types: string[];
  source: "manual" | "events";
  tat_definition_id: number | null;
  tat_code?: string | null;
  min_sample: number;
  owner_id: number | null;
  owner_name?: string;
  version: number;
  status: string;
}

export interface ReportSection {
  id: string;
  type:
    | "scorecard"
    | "kpi_table"
    | "kpi_trend"
    | "facility_comparison"
    | "tat_summary"
    | "validation_summary"
    | "verification_status"
    | "text";
  title: string;
  indicatorIds?: number[];
  program?: string;
  domain?: string;
  indicatorId?: number;
  tatDefinitionIds?: number[];
  breakdown?: "none" | "facility";
  months?: number;
  body?: string;
}

export interface ReportConfig {
  sections: ReportSection[];
}
