'use client';
import type { Role } from './api';

export type FieldType = 'text' | 'number' | 'textarea' | 'html' | 'checkbox' | 'select' | 'relation' | 'multirelation' | 'color' | 'secret';
export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** relation: master slug and the property shown */
  rel?: string;
  relLabel?: (r: any) => string;
  /** property stored in the field (default id) */
  relValue?: string;
  extraOptions?: { value: string; label: string }[];
  hint?: string;
  span?: 1 | 2 | 3;
  default?: any;
  step?: string;
  /** show only when the predicate on the current form holds */
  when?: (f: any) => boolean;
  section?: string;
}
export interface ColumnDef { key: string; label: string; render?: 'bool' | 'color' | 'rel' | 'money' | 'mono' | 'range'; rel?: string; relLabel?: (r: any) => string; relValue?: string }
export interface MasterDef {
  slug: string;
  title: string;
  group: string;
  description: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  writeRoles?: Role[];
  /** a relation used as a filter above the table, e.g. reference ranges by parameter */
  filter?: { key: string; label: string; rel: string; relLabel?: (r: any) => string };
  links?: { label: string; href: (row: any) => string }[];
  hasActive?: boolean;
  width?: string;
}

const codeName = (r: any) => (r ? `${r.code} · ${r.name}` : '');
const name = (r: any) => r?.name ?? '';
const opts = (...v: string[]) => v.map((x) => ({ value: x, label: x.charAt(0) + x.slice(1).toLowerCase().replace(/_/g, ' ') }));
const CODE: FieldDef = { key: 'code', label: 'Code', required: true };
const NAME: FieldDef = { key: 'name', label: 'Name', required: true, span: 2 };
const ACTIVE = { hasActive: true };

export const MASTERS: MasterDef[] = [
  /* ---------- Test catalogue ---------- */
  {
    slug: 'tests', title: 'Lab tests', group: 'Test catalogue', ...ACTIVE, width: 'max-w-4xl',
    description: 'Orderable tests: department, specimen, container, price, TAT targets, outsourcing and report template.',
    links: [{ label: 'Parameters', href: (r) => `/masters/test-parameters?testId=${r.id}` }, { label: 'Analyzer routes', href: (r) => `/masters/analyzer-test-mappings?testId=${r.id}` }],
    fields: [
      CODE, NAME, { key: 'shortName', label: 'Short name' },
      { key: 'departmentId', label: 'Department', type: 'relation', rel: 'departments', relLabel: name, required: true },
      { key: 'subDepartmentId', label: 'Sub-department', type: 'relation', rel: 'sub-departments', relLabel: name },
      { key: 'methodologyId', label: 'Methodology', type: 'relation', rel: 'methodologies', relLabel: name },
      { key: 'sampleTypeId', label: 'Sample type', type: 'relation', rel: 'sample-types', relLabel: name, required: true, section: 'Specimen' },
      { key: 'containerId', label: 'Container', type: 'relation', rel: 'containers', relLabel: name, required: true },
      { key: 'sampleVolumeMl', label: 'Volume (mL)', type: 'number', step: '0.1' },
      { key: 'requiresBodySite', label: 'Body site must be chosen when ordering', type: 'checkbox', span: 2 },
      { key: 'bodySiteId', label: 'Default body site', type: 'relation', rel: 'body-sites', relLabel: name },
      { key: 'loincCode', label: 'LOINC (order code)', type: 'relation', rel: 'loinc-codes', relValue: 'code', relLabel: (r) => `${r.code} · ${r.component}`, section: 'Coding & pricing' },
      { key: 'price', label: 'Price', type: 'number', step: '0.01', required: true },
      { key: 'sequence', label: 'Display order', type: 'number' },
      { key: 'tatRoutineMinutes', label: 'TAT routine (min)', type: 'number', hint: 'Order → signature target', section: 'Turnaround time' },
      { key: 'tatStatMinutes', label: 'TAT STAT (min)', type: 'number' },
      { key: 'reportTemplateId', label: 'Report template', type: 'relation', rel: 'report-templates', relLabel: name },
      { key: 'isOutsourced', label: 'Performed by a reference lab (outsourced)', type: 'checkbox', span: 2, section: 'Outsourcing' },
      { key: 'externalLabId', label: 'Reference lab', type: 'relation', rel: 'external-labs', relLabel: name, when: (f) => f.isOutsourced },
      { key: 'outsourceCost', label: 'Reference-lab cost', type: 'number', step: '0.01', when: (f) => f.isOutsourced },
      { key: 'patientPreparation', label: 'Patient preparation', type: 'textarea', span: 3, section: 'Notes' },
      { key: 'interpretation', label: 'Interpretation printed on report', type: 'textarea', span: 3 },
    ],
    columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'departmentId', label: 'Department', render: 'rel', rel: 'departments', relLabel: name }, { key: 'containerId', label: 'Container', render: 'rel', rel: 'containers', relLabel: name }, { key: 'price', label: 'Price', render: 'money' }, { key: 'tatRoutineMinutes', label: 'TAT (min)' }, { key: 'isOutsourced', label: 'Outsourced', render: 'bool' }],
  },
  {
    slug: 'parameters', title: 'Parameters (analytes)', group: 'Test catalogue', ...ACTIVE, width: 'max-w-4xl',
    description: 'Reportable analytes with result type, units, decimals, LOINC, abnormal/critical text values and calculation formulas.',
    links: [{ label: 'Reference ranges', href: (r) => `/masters/reference-ranges?parameterId=${r.id}` }],
    fields: [
      CODE, NAME, { key: 'shortName', label: 'Short name' },
      { key: 'resultType', label: 'Result type', type: 'select', options: opts('NUMERIC', 'TEXT', 'OPTION', 'MEMO', 'CALCULATED'), default: 'NUMERIC', required: true },
      { key: 'unitId', label: 'Unit', type: 'relation', rel: 'units', relLabel: (r) => r.symbol },
      { key: 'decimals', label: 'Decimals', type: 'number', default: 2 },
      { key: 'loincCode', label: 'LOINC', type: 'relation', rel: 'loinc-codes', relValue: 'code', relLabel: (r) => `${r.code} · ${r.component}` },
      { key: 'methodologyId', label: 'Methodology', type: 'relation', rel: 'methodologies', relLabel: name },
      { key: 'deltaCheckPercent', label: 'Delta check %', type: 'number', hint: 'Flag change vs previous result' },
      { key: 'formula', label: 'Formula', span: 3, hint: 'Use parameter codes in braces, e.g. {CHOL}-{HDL}-({TG}/5)', when: (f) => f.resultType === 'CALCULATED' },
      { key: 'options', label: 'Allowed values (comma separated)', span: 3, when: (f) => f.resultType === 'OPTION', section: 'Text results' },
      { key: 'abnormalValues', label: 'Abnormal values (comma separated)', span: 3, hint: 'Text/option values flagged A', when: (f) => ['OPTION', 'TEXT'].includes(f.resultType) },
      { key: 'criticalValues', label: 'Critical values (comma separated)', span: 3, hint: 'Text/option values flagged AA and raising a critical alert', when: (f) => ['OPTION', 'TEXT'].includes(f.resultType) },
      { key: 'defaultValue', label: 'Default value', when: (f) => f.resultType !== 'CALCULATED' },
      { key: 'interpretation', label: 'Interpretation', type: 'textarea', span: 3 },
    ],
    columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'resultType', label: 'Type' }, { key: 'unitId', label: 'Unit', render: 'rel', rel: 'units', relLabel: (r) => r.symbol }, { key: 'loincCode', label: 'LOINC', render: 'mono' }, { key: 'formula', label: 'Formula', render: 'mono' }],
  },
  {
    slug: 'test-parameters', title: 'Test ↔ parameter composition', group: 'Test catalogue', ...ACTIVE,
    description: 'Which parameters make up each test, their order, section headings and whether they are mandatory or reportable.',
    filter: { key: 'testId', label: 'Test', rel: 'tests', relLabel: codeName },
    fields: [
      { key: 'testId', label: 'Test', type: 'relation', rel: 'tests', relLabel: codeName, required: true, span: 2 },
      { key: 'parameterId', label: 'Parameter', type: 'relation', rel: 'parameters', relLabel: codeName, required: true, span: 2 },
      { key: 'sequence', label: 'Order', type: 'number', default: 0 },
      { key: 'sectionHeading', label: 'Section heading', span: 2, hint: 'e.g. Physical examination' },
      { key: 'isMandatory', label: 'Mandatory before validation', type: 'checkbox', default: true },
      { key: 'isReportable', label: 'Printed on report', type: 'checkbox', default: true },
    ],
    columns: [{ key: 'testId', label: 'Test', render: 'rel', rel: 'tests', relLabel: codeName }, { key: 'sequence', label: '#' }, { key: 'parameterId', label: 'Parameter', render: 'rel', rel: 'parameters', relLabel: codeName }, { key: 'sectionHeading', label: 'Section' }, { key: 'isMandatory', label: 'Mandatory', render: 'bool' }, { key: 'isReportable', label: 'Reportable', render: 'bool' }],
  },
  {
    slug: 'reference-ranges', title: 'Reference ranges & critical limits', group: 'Test catalogue', ...ACTIVE, writeRoles: ['PATHOLOGIST'], width: 'max-w-4xl',
    description: 'Normal and critical limits by sex, age band, ethnicity, specimen and condition (e.g. pregnancy). The most specific matching row is used.',
    filter: { key: 'parameterId', label: 'Parameter', rel: 'parameters', relLabel: codeName },
    fields: [
      { key: 'parameterId', label: 'Parameter', type: 'relation', rel: 'parameters', relLabel: codeName, required: true, span: 3 },
      { key: 'gender', label: 'Sex', type: 'select', options: [{ value: 'ANY', label: 'Any' }, { value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' }], default: 'ANY', section: 'Applies to' },
      { key: 'ethnicity', label: 'Ethnicity', type: 'relation', rel: 'ethnicities', relValue: 'code', relLabel: name, extraOptions: [{ value: 'ANY', label: 'Any' }], default: 'ANY' },
      { key: 'condition', label: 'Condition', hint: 'e.g. PREGNANCY, or blank' },
      { key: 'ageMin', label: 'Age from', type: 'number', default: 0, step: 'any' },
      { key: 'ageMax', label: 'Age to (exclusive)', type: 'number', default: 150, step: 'any' },
      { key: 'ageUnit', label: 'Age unit', type: 'select', options: opts('DAYS', 'MONTHS', 'YEARS'), default: 'YEARS' },
      { key: 'sampleTypeId', label: 'Sample type (optional)', type: 'relation', rel: 'sample-types', relLabel: name },
      { key: 'lowNormal', label: 'Normal low', type: 'number', step: 'any', section: 'Limits' },
      { key: 'highNormal', label: 'Normal high', type: 'number', step: 'any' },
      { key: 'criticalLow', label: 'Critical low', type: 'number', step: 'any', hint: 'Below → LL + critical alert' },
      { key: 'criticalHigh', label: 'Critical high', type: 'number', step: 'any', hint: 'Above → HH + critical alert' },
      { key: 'normalText', label: 'Normal text value', hint: 'For text results, e.g. Negative' },
      { key: 'displayText', label: 'Printed reference text', span: 3, hint: 'Overrides the generated "low – high" text' },
    ],
    columns: [{ key: 'parameterId', label: 'Parameter', render: 'rel', rel: 'parameters', relLabel: codeName }, { key: 'gender', label: 'Sex' }, { key: 'ageMin', label: 'Age', render: 'range' }, { key: 'condition', label: 'Condition' }, { key: 'lowNormal', label: 'Low' }, { key: 'highNormal', label: 'High' }, { key: 'criticalLow', label: 'Crit low' }, { key: 'criticalHigh', label: 'Crit high' }, { key: 'displayText', label: 'Printed as' }],
  },
  {
    slug: 'profiles', title: 'Profiles & panels', group: 'Test catalogue', ...ACTIVE,
    description: 'Bundles of tests sold at a package price; the price is split across the tests when ordered.',
    fields: [CODE, NAME, { key: 'price', label: 'Package price', type: 'number', step: '0.01', required: true }, { key: 'departmentId', label: 'Department', type: 'relation', rel: 'departments', relLabel: name }, { key: 'testIds', label: 'Tests', type: 'multirelation', rel: 'tests', relLabel: codeName, span: 3, required: true }, { key: 'description', label: 'Description', type: 'textarea', span: 3 }],
    columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'testIds', label: 'Tests', render: 'rel', rel: 'tests', relLabel: (r) => r.code }, { key: 'price', label: 'Price', render: 'money' }],
  },
  /* ---------- Organisation & specimen ---------- */
  { slug: 'departments', title: 'Departments', group: 'Organisation', ...ACTIVE, description: 'Lab sections; reports are grouped by department.', fields: [CODE, NAME, { key: 'sequence', label: 'Report order', type: 'number', default: 0 }, { key: 'description', label: 'Description', type: 'textarea', span: 3 }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'sequence', label: 'Order' }] },
  { slug: 'sub-departments', title: 'Sub-departments', group: 'Organisation', ...ACTIVE, description: 'Benches or units within a department.', fields: [CODE, NAME, { key: 'departmentId', label: 'Department', type: 'relation', rel: 'departments', relLabel: name, required: true }, { key: 'sequence', label: 'Order', type: 'number', default: 0 }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'departmentId', label: 'Department', render: 'rel', rel: 'departments', relLabel: name }] },
  { slug: 'sample-types', title: 'Sample types', group: 'Specimen', ...ACTIVE, description: 'Specimen types with SNOMED CT codes, storage and stability.', fields: [CODE, NAME, { key: 'snomedCode', label: 'SNOMED CT' }, { key: 'storageTemperature', label: 'Storage' }, { key: 'stabilityHours', label: 'Stability (h)', type: 'number' }, { key: 'description', label: 'Description', type: 'textarea', span: 3 }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'snomedCode', label: 'SNOMED', render: 'mono' }, { key: 'storageTemperature', label: 'Storage' }, { key: 'stabilityHours', label: 'Stability (h)' }] },
  { slug: 'containers', title: 'Containers & tubes', group: 'Specimen', ...ACTIVE, description: 'Tube types with cap colour and additive. Tests sharing sample type and container are collected in one tube.', fields: [CODE, NAME, { key: 'capColor', label: 'Cap colour', type: 'color', default: '#9ca3af' }, { key: 'additive', label: 'Additive' }, { key: 'volumeMl', label: 'Volume (mL)', type: 'number', step: '0.1' }], columns: [{ key: 'capColor', label: 'Cap', render: 'color' }, { key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'additive', label: 'Additive' }, { key: 'volumeMl', label: 'mL' }] },
  { slug: 'body-sites', title: 'Body sites', group: 'Specimen', ...ACTIVE, description: 'Anatomical sites for swabs, biopsies and cultures.', fields: [CODE, NAME, { key: 'snomedCode', label: 'SNOMED CT' }, { key: 'laterality', label: 'Laterality', type: 'select', options: opts('LEFT', 'RIGHT', 'BILATERAL') }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'snomedCode', label: 'SNOMED', render: 'mono' }, { key: 'laterality', label: 'Laterality' }] },
  { slug: 'rejection-reasons', title: 'Rejection reasons', group: 'Specimen', ...ACTIVE, description: 'Reasons offered when rejecting a sample.', fields: [CODE, NAME], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }] },
  /* ---------- Coding ---------- */
  { slug: 'loinc-codes', title: 'LOINC codes', group: 'Coding', ...ACTIVE, description: 'Local copy of the LOINC codes used by tests and parameters.', fields: [CODE, { key: 'component', label: 'Component', required: true, span: 2 }, { key: 'property', label: 'Property' }, { key: 'timeAspect', label: 'Time' }, { key: 'system', label: 'System' }, { key: 'scale', label: 'Scale' }, { key: 'method', label: 'Method' }, { key: 'longName', label: 'Long common name', span: 3 }], columns: [{ key: 'code', label: 'LOINC', render: 'mono' }, { key: 'component', label: 'Component' }, { key: 'system', label: 'System' }, { key: 'scale', label: 'Scale' }, { key: 'longName', label: 'Long name' }] },
  { slug: 'units', title: 'Units', group: 'Coding', ...ACTIVE, description: 'Units of measure with UCUM codes.', fields: [CODE, { key: 'symbol', label: 'Symbol', required: true }, { key: 'ucumCode', label: 'UCUM' }, { key: 'description', label: 'Description', span: 3 }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'symbol', label: 'Symbol' }, { key: 'ucumCode', label: 'UCUM', render: 'mono' }] },
  { slug: 'methodologies', title: 'Methodologies', group: 'Coding', ...ACTIVE, description: 'Analytical methods printed on reports.', fields: [CODE, NAME, { key: 'description', label: 'Description', type: 'textarea', span: 3 }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }] },
  { slug: 'ethnicities', title: 'Ethnicities', group: 'Coding', ...ACTIVE, description: 'Used for ethnicity-specific reference ranges.', fields: [CODE, NAME], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }] },
  /* ---------- Parties ---------- */
  { slug: 'doctors', title: 'Referring doctors', group: 'Parties', ...ACTIVE, writeRoles: ['RECEPTION'], description: 'Clinicians who order tests and receive critical-value calls.', fields: [CODE, NAME, { key: 'specialty', label: 'Specialty' }, { key: 'registrationNo', label: 'Registration no.' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'specialty', label: 'Specialty' }, { key: 'phone', label: 'Phone' }] },
  { slug: 'external-labs', title: 'Reference labs', group: 'Parties', ...ACTIVE, width: 'max-w-3xl', description: 'Labs that perform outsourced tests: manifest endpoint and the key they use to return results.', fields: [CODE, NAME, { key: 'contactPerson', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'accreditation', label: 'Accreditation' }, { key: 'address', label: 'Address', type: 'textarea', span: 3 }, { key: 'defaultTatHours', label: 'Default TAT (h)', type: 'number', default: 48 }, { key: 'manifestEndpointUrl', label: 'Manifest endpoint URL', span: 2, section: 'Integration', hint: 'Shipment manifests are POSTed here on dispatch' }, { key: 'outboundAuthToken', label: 'Outbound bearer token', type: 'secret' }, { key: 'inboundApiKey', label: 'Inbound API key', type: 'secret', span: 2, hint: 'The lab sends this as x-api-key to POST /api/outsource/results' }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'manifestEndpointUrl', label: 'Manifest endpoint', render: 'mono' }, { key: 'defaultTatHours', label: 'TAT (h)' }] },
  { slug: 'external-systems', title: 'External systems (HIS/EMR)', group: 'Parties', ...ACTIVE, width: 'max-w-3xl', description: 'Systems that send orders in and receive results back (JSON, FHIR R4 or HL7).', fields: [CODE, NAME, { key: 'systemType', label: 'Type', type: 'select', options: opts('HIS', 'EMR', 'LIS', 'PORTAL', 'OTHER'), default: 'HIS' }, { key: 'apiKey', label: 'API key', type: 'secret', required: true, span: 2, hint: 'Sent as x-api-key when posting orders or pulling results' }, { key: 'resultFormat', label: 'Result format', type: 'select', options: [{ value: 'JSON', label: 'JSON' }, { value: 'FHIR', label: 'FHIR R4 Bundle' }, { value: 'HL7', label: 'HL7 v2 ORU' }], default: 'JSON' }, { key: 'resultCallbackUrl', label: 'Result callback URL', span: 3 }, { key: 'callbackAuthToken', label: 'Callback bearer token', type: 'secret', span: 2 }, { key: 'autoPublish', label: 'Publish automatically on sign', type: 'checkbox', default: true }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'resultFormat', label: 'Format' }, { key: 'resultCallbackUrl', label: 'Callback', render: 'mono' }, { key: 'autoPublish', label: 'Auto publish', render: 'bool' }] },
  /* ---------- Automation ---------- */
  { slug: 'middlewares', title: 'Middleware', group: 'Automation', ...ACTIVE, width: 'max-w-3xl', description: 'Instrument middleware: how orders are delivered (push/pull) and how results come back.', fields: [CODE, NAME, { key: 'vendor', label: 'Vendor' }, { key: 'orderMode', label: 'Order delivery', type: 'select', options: [{ value: 'PUSH', label: 'Push – LIS POSTs orders' }, { value: 'PULL', label: 'Pull – middleware polls LIS' }], default: 'PUSH' }, { key: 'messageFormat', label: 'Order format', type: 'select', options: [{ value: 'JSON', label: 'JSON' }, { value: 'HL7', label: 'HL7 ORM^O01' }], default: 'JSON' }, { key: 'orderEndpointUrl', label: 'Order endpoint URL', span: 3, when: (f) => f.orderMode === 'PUSH' }, { key: 'authType', label: 'Outbound auth', type: 'select', options: opts('NONE', 'BEARER', 'API_KEY'), default: 'NONE', when: (f) => f.orderMode === 'PUSH' }, { key: 'outboundAuthToken', label: 'Outbound token', type: 'secret', span: 2, when: (f) => f.orderMode === 'PUSH' && f.authType !== 'NONE' }, { key: 'inboundApiKey', label: 'Inbound API key', type: 'secret', span: 2, hint: 'Used by the middleware to pull orders and post results' }, { key: 'maxRetries', label: 'Max retries', type: 'number', default: 3 }, { key: 'autoSendOnAccession', label: 'Send orders automatically on accession', type: 'checkbox', default: true, span: 2 }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'orderMode', label: 'Mode' }, { key: 'messageFormat', label: 'Format' }, { key: 'autoSendOnAccession', label: 'Auto send', render: 'bool' }] },
  { slug: 'analyzers', title: 'Analyzers', group: 'Automation', ...ACTIVE, width: 'max-w-3xl', description: 'Instruments, their protocol and middleware. Auto-validation of normal results can be enabled per analyzer.', links: [{ label: 'Test mappings', href: (r) => `/masters/analyzer-test-mappings?analyzerId=${r.id}` }, { label: 'Parameter mappings', href: (r) => `/masters/analyzer-parameter-mappings?analyzerId=${r.id}` }], fields: [CODE, NAME, { key: 'manufacturer', label: 'Manufacturer' }, { key: 'model', label: 'Model' }, { key: 'serialNo', label: 'Serial no.' }, { key: 'departmentId', label: 'Department', type: 'relation', rel: 'departments', relLabel: name }, { key: 'middlewareId', label: 'Middleware', type: 'relation', rel: 'middlewares', relLabel: name, section: 'Connection' }, { key: 'protocol', label: 'Protocol', type: 'select', options: [{ value: 'ASTM', label: 'ASTM' }, { value: 'HL7', label: 'HL7' }, { value: 'JSON', label: 'JSON' }, { value: 'CSV', label: 'CSV' }], default: 'ASTM' }, { key: 'connectionType', label: 'Connection', type: 'select', options: [{ value: 'TCP', label: 'TCP/IP' }, { value: 'SERIAL', label: 'Serial' }, { value: 'FILE', label: 'File' }, { value: 'HTTP', label: 'HTTP' }], default: 'TCP' }, { key: 'host', label: 'Host' }, { key: 'port', label: 'Port', type: 'number' }, { key: 'bidirectional', label: 'Bidirectional (host query)', type: 'checkbox', default: true }, { key: 'autoValidateNormals', label: 'Auto-validate all-normal results', type: 'checkbox', span: 2 }], columns: [{ key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'manufacturer', label: 'Make' }, { key: 'protocol', label: 'Protocol' }, { key: 'middlewareId', label: 'Middleware', render: 'rel', rel: 'middlewares', relLabel: name }, { key: 'autoValidateNormals', label: 'Auto-validate', render: 'bool' }] },
  { slug: 'analyzer-test-mappings', title: 'Analyzer test mappings', group: 'Automation', ...ACTIVE, description: 'Which analyzer runs each test (lowest priority number wins) and the analyzer’s own test code.', filter: { key: 'analyzerId', label: 'Analyzer', rel: 'analyzers', relLabel: codeName }, fields: [{ key: 'analyzerId', label: 'Analyzer', type: 'relation', rel: 'analyzers', relLabel: codeName, required: true }, { key: 'testId', label: 'Test', type: 'relation', rel: 'tests', relLabel: codeName, required: true, span: 2 }, { key: 'analyzerTestCode', label: 'Analyzer test code', required: true }, { key: 'priority', label: 'Priority', type: 'number', default: 1, hint: '1 = first choice' }], columns: [{ key: 'analyzerId', label: 'Analyzer', render: 'rel', rel: 'analyzers', relLabel: codeName }, { key: 'testId', label: 'Test', render: 'rel', rel: 'tests', relLabel: codeName }, { key: 'analyzerTestCode', label: 'Analyzer code', render: 'mono' }, { key: 'priority', label: 'Priority' }] },
  { slug: 'analyzer-parameter-mappings', title: 'Analyzer parameter mappings', group: 'Automation', ...ACTIVE, description: 'Translate analyzer result codes to LIS parameters, with a unit conversion factor.', filter: { key: 'analyzerId', label: 'Analyzer', rel: 'analyzers', relLabel: codeName }, fields: [{ key: 'analyzerId', label: 'Analyzer', type: 'relation', rel: 'analyzers', relLabel: codeName, required: true }, { key: 'parameterId', label: 'Parameter', type: 'relation', rel: 'parameters', relLabel: codeName, required: true, span: 2 }, { key: 'analyzerCode', label: 'Analyzer result code', required: true }, { key: 'analyzerUnit', label: 'Analyzer unit' }, { key: 'conversionFactor', label: 'Conversion factor', type: 'number', step: 'any', default: 1, hint: 'LIS value = analyzer value × factor' }], columns: [{ key: 'analyzerId', label: 'Analyzer', render: 'rel', rel: 'analyzers', relLabel: codeName }, { key: 'analyzerCode', label: 'Analyzer code', render: 'mono' }, { key: 'parameterId', label: 'Parameter', render: 'rel', rel: 'parameters', relLabel: codeName }, { key: 'analyzerUnit', label: 'Unit' }, { key: 'conversionFactor', label: 'Factor' }] },
  /* ---------- Reporting & system ---------- */
  { slug: 'report-templates', title: 'Report templates', group: 'Reporting', ...ACTIVE, writeRoles: ['PATHOLOGIST'], width: 'max-w-4xl', description: 'Print layouts: paper, fonts, colours, header/footer HTML and visible columns. Header/footer support {{lab.name}}, {{patient.fullName}}, {{order.orderNo}} and similar tokens.', fields: [CODE, NAME, { key: 'departmentId', label: 'Department (optional)', type: 'relation', rel: 'departments', relLabel: name }, { key: 'paperSize', label: 'Paper', type: 'select', options: [{ value: 'A4', label: 'A4' }, { value: 'A5', label: 'A5' }, { value: 'LETTER', label: 'Letter' }, { value: 'LEGAL', label: 'Legal' }], default: 'A4', section: 'Layout' }, { key: 'orientation', label: 'Orientation', type: 'select', options: [{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }], default: 'portrait' }, { key: 'isDefault', label: 'Default template', type: 'checkbox' }, { key: 'fontFamily', label: 'Font family', default: 'Georgia, serif' }, { key: 'fontSizePx', label: 'Font size (px)', type: 'number', default: 12 }, { key: 'accentColor', label: 'Accent colour', type: 'color', default: '#0e5e6f' }, { key: 'logoUrl', label: 'Logo URL or data URI', span: 3 }, { key: 'headerHtml', label: 'Header HTML (replaces default header)', type: 'html', span: 3 }, { key: 'footerHtml', label: 'Footer HTML', type: 'html', span: 3 }, { key: 'showUnits', label: 'Units', type: 'checkbox', default: true, section: 'Columns & content' }, { key: 'showReferenceRange', label: 'Reference ranges', type: 'checkbox', default: true }, { key: 'showFlags', label: 'Flags', type: 'checkbox', default: true }, { key: 'showMethod', label: 'Method', type: 'checkbox', default: true }, { key: 'showLoinc', label: 'LOINC codes', type: 'checkbox' }, { key: 'showBarcode', label: 'Order barcode', type: 'checkbox', default: true }, { key: 'showInterpretation', label: 'Interpretations', type: 'checkbox', default: true }, { key: 'pageBreakPerDepartment', label: 'New page per department', type: 'checkbox', default: true }, { key: 'signatureLabel', label: 'Signature caption', default: 'Pathologist' }, { key: 'disclaimer', label: 'Disclaimer', type: 'textarea', span: 3 }], columns: [{ key: 'accentColor', label: '', render: 'color' }, { key: 'code', label: 'Code', render: 'mono' }, { key: 'name', label: 'Name' }, { key: 'paperSize', label: 'Paper' }, { key: 'orientation', label: 'Orientation' }, { key: 'isDefault', label: 'Default', render: 'bool' }] },
  { slug: 'settings', title: 'Settings', group: 'System', description: 'Laboratory identity and behaviour: lab.name, lab.address, billing.currency, billing.taxPercent, billing.requiredBeforeCollection…', fields: [{ key: 'key', label: 'Key', required: true, span: 3 }, { key: 'value', label: 'Value', type: 'textarea', span: 3 }, { key: 'description', label: 'Description', span: 3 }], columns: [{ key: 'key', label: 'Key', render: 'mono' }, { key: 'value', label: 'Value' }, { key: 'description', label: 'Description' }] },
];

export const masterBySlug = (slug: string) => MASTERS.find((m) => m.slug === slug);
