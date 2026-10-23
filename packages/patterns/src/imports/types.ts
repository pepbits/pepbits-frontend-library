/** Minimal structural input. Full entity schemas are owned by page engines or the host. */
export interface ImportField {
  id: string;
  label: string;
  required?: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: Array<{value: string; label: string}>;
}
export interface ImportDefinition {
  id: string;
  label: string;
  schema: {sections: Array<{fields: ImportField[]}>};
  uniqueField: string;
}
export interface ImportPage {id: string; title: string}
