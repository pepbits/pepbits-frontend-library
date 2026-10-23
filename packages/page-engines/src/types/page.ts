import type {PageTemplateDefinition} from "./page-templates";
import type {IconComponent} from "@pepbits/icons";
import type {FilterDefinition,DataClassification} from "./filter-policy";
export type ModuleKey = string;
export type PageKind = "template" | "dashboard" | "worklist" | "form" | "billing" | "reports" | "inbox" | (string & {});
export type FieldType = "text" | "email" | "phone" | "number" | "date" | "select" | "multiselect" | "textarea" | "toggle";
export interface PageAiConfig {
  enabled: boolean;
  /** Opaque extension identifiers validated by the host. */
  useCases: string[];
}

export interface PageDefinition {
  templateId?: string;
  templateDefinition?: PageTemplateDefinition;
  titleKey?: string;
  subtitleKey?: string;
  id: string;
  title: string;
  subtitle: string;
  kind: PageKind;
  module: ModuleKey | "shared";
  entity?: string;
  icon?: IconComponent;
  ai?: PageAiConfig;
}

export interface FormOption {
  label: string;
  value: string;
}

export interface FormFieldSchema {
  labelKey?: string;
  helpKey?: string;
  placeholderKey?: string;
  visibleWhen?: { field: string; equals: string | number | boolean };
  requiredWhen?: { field: string; equals: string | number | boolean };
  optionsByField?: { field: string; values: Record<string, FormOption[]> };
  min?: number;
  max?: number;
  notBefore?: string;
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  options?: FormOption[];
  colSpan?: 1 | 2;
  help?: string;
  prefix?: string;
  suffix?: string;
  defaultValue?: string | number | boolean | string[];
}

export interface FormSectionSchema {
  titleKey?: string;
  descriptionKey?: string;
  id: string;
  title: string;
  description: string;
  fields: FormFieldSchema[];
}

export interface EntitySchema {
  id: string;
  singular: string;
  plural: string;
  description: string;
  sections: FormSectionSchema[];
}

export interface DataColumn {
  /** Unclassified columns are withheld from exports and print. */
  classification?: DataClassification;
  labelKey?: string;
  key: string;
  label: string;
  type?: "text" | "money" | "date" | "status" | "number" | "percent";
  width?: number;
  sortable?: boolean;
  defaultVisible?: boolean;
  /**
   * Whether this value can be corrected in the table.
   *
   * Opt-in per column, because most of them should not be: an id is not a typo
   * to fix in place, and a status usually has a workflow behind it. It is for
   * the small safe changes a form is too much for.
   */
  editable?: boolean;
}

export interface WorklistConfig {
  id: string;
  entity: string;
  title: string;
  description: string;
  basicFilters: FilterDefinition[];
  advancedFilters: FilterDefinition[];
  columns: DataColumn[];
  rows: Array<Record<string, string | number | boolean>>;
  primaryKey: string;
  displayKey: string;
}

