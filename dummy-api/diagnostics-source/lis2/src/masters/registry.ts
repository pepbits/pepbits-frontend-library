/**
 * Master data registry.
 * Every master is described once here. The registry is used to:
 *  - create the SQLite tables (db/schema.ts)
 *  - serve the generic, validated CRUD API (/api/masters/:key)
 *  - drive the generic master pages in the frontend (/masters/[key])
 */
export type FieldType =
  | 'text' | 'textarea' | 'html' | 'number' | 'bool' | 'select' | 'ref' | 'date' | 'color' | 'password';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  ref?: string; // registry key of referenced master
  list?: boolean; // show as column in list view
  default?: string | number;
  help?: string;
}

export interface EntityDef {
  key: string;
  table: string;
  label: string;
  group: string;
  description: string;
  display: string; // SQL expression used as label when referenced
  unique?: string[];
  fields: FieldDef[];
  children?: { key: string; fk: string; label: string }[];
}

const f = (name: string, label: string, type: FieldType = 'text', extra: Partial<FieldDef> = {}): FieldDef => ({
  name, label, type, ...extra,
});
const code = (lbl = 'Code') => f('code', lbl, 'text', { required: true, list: true });
const name = (lbl = 'Name') => f('name', lbl, 'text', { required: true, list: true });
const active = () => f('active', 'Active', 'bool', { default: 1, list: true });

export const PROTOCOLS = ['HL7V2', 'ASTM', 'FHIR_R4', 'JSON'];
export const TRANSPORTS = ['TCP_MLLP', 'TCP_ASTM', 'HTTPS', 'FILE', 'POLLING_API'];

export const REGISTRY: EntityDef[] = [
  // ───────────── Organisation ─────────────
  {
    key: 'departments', table: 'm_departments', label: 'Departments', group: 'Organisation',
    description: 'Laboratory departments such as Haematology, Biochemistry, Microbiology.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('description', 'Description', 'textarea'), f('sort_order', 'Sort order', 'number', { default: 0 }), active()],
    children: [{ key: 'sub_departments', fk: 'department_id', label: 'Sub-departments' }],
  },
  {
    key: 'sub_departments', table: 'm_sub_departments', label: 'Sub-departments', group: 'Organisation',
    description: 'Sections within a department (e.g. Coagulation within Haematology).',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('department_id', 'Department', 'ref', { ref: 'departments', required: true, list: true }), f('bench', 'Bench / workstation'), active()],
  },
  {
    key: 'locations', table: 'm_locations', label: 'Locations & wards', group: 'Organisation',
    description: 'Wards, OPD clinics, collection centres and lab benches.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('type', 'Type', 'select', { options: ['WARD', 'OPD', 'ER', 'COLLECTION_CENTRE', 'LAB'], list: true, required: true }), active()],
  },
  {
    key: 'doctors', table: 'm_doctors', label: 'Referring doctors', group: 'Organisation',
    description: 'Ordering / referring physicians.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('specialty', 'Specialty', 'text', { list: true }), f('license_no', 'License no.'), f('phone', 'Phone'), f('email', 'Email'), active()],
  },
  {
    key: 'users', table: 'users', label: 'Users & signatories', group: 'Organisation',
    description: 'System users. Pathologists sign reports; the signature text prints on reports.',
    display: 'full_name', unique: ['username'],
    fields: [
      f('username', 'Username', 'text', { required: true, list: true }),
      f('full_name', 'Full name', 'text', { required: true, list: true }),
      f('role', 'Role', 'select', { options: ['ADMIN', 'PATHOLOGIST', 'TECHNOLOGIST', 'PHLEBOTOMIST', 'FRONT_DESK', 'INTEGRATION'], required: true, list: true }),
      f('department_id', 'Department', 'ref', { ref: 'departments' }),
      f('qualification', 'Qualification'),
      f('signature_text', 'Signature line', 'textarea', { help: 'Printed under the signature on reports' }),
      f('password', 'Password', 'password', { help: 'Leave blank to keep the current password' }),
      active(),
    ],
  },

  // ───────────── Specimen ─────────────
  {
    key: 'containers', table: 'm_containers', label: 'Containers / tubes', group: 'Specimen',
    description: 'Collection tubes and containers with cap colour and additive.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('cap_color', 'Cap colour', 'color', { list: true }), f('additive', 'Additive', 'text', { list: true }), f('volume_ml', 'Volume (mL)', 'number'), active()],
  },
  {
    key: 'sample_types', table: 'm_sample_types', label: 'Sample types', group: 'Specimen',
    description: 'Specimen types (whole blood, serum, urine…) with stability and storage.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [
      code(), name(), f('snomed_code', 'SNOMED CT code', 'text', { list: true }), f('hl7_code', 'HL7 table 0487 code'),
      f('container_id', 'Default container', 'ref', { ref: 'containers', list: true }),
      f('min_volume_ml', 'Minimum volume (mL)', 'number'), f('storage_temp', 'Storage', 'select', { options: ['ROOM', 'REFRIGERATED', 'FROZEN'] }),
      f('stability_hours', 'Stability (hours)', 'number'), active(),
    ],
  },
  {
    key: 'body_sites', table: 'm_body_sites', label: 'Body sites', group: 'Specimen',
    description: 'Anatomical collection sites for swabs, fluids and tissue.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('snomed_code', 'SNOMED CT code', 'text', { list: true }), f('laterality_required', 'Laterality required', 'bool', { default: 0 }), active()],
  },
  {
    key: 'rejection_reasons', table: 'm_rejection_reasons', label: 'Rejection reasons', group: 'Specimen',
    description: 'Reasons used when a sample is rejected at accession.',
    display: 'name', unique: ['code'],
    fields: [code(), name(), f('requires_recollection', 'Requires recollection', 'bool', { default: 1, list: true }), active()],
  },

  // ───────────── Test catalogue ─────────────
  {
    key: 'methodologies', table: 'm_methodologies', label: 'Methodologies', group: 'Test catalogue',
    description: 'Analytical methods (e.g. ISE, Photometry, Flow cytometry).',
    display: 'name', unique: ['code'],
    fields: [code(), name(), f('description', 'Description', 'textarea'), active()],
  },
  {
    key: 'units', table: 'm_units', label: 'Units of measure', group: 'Test catalogue',
    description: 'Result units with UCUM codes.',
    display: 'name', unique: ['code'],
    fields: [code(), name('Display'), f('ucum_code', 'UCUM code', 'text', { list: true }), active()],
  },
  {
    key: 'loinc_codes', table: 'm_loinc', label: 'LOINC codes', group: 'Test catalogue',
    description: 'LOINC terms used for tests and parameters (interoperability).',
    display: "loinc_num || ' ' || component", unique: ['loinc_num'],
    fields: [
      f('loinc_num', 'LOINC number', 'text', { required: true, list: true }), f('component', 'Component', 'text', { required: true, list: true }),
      f('property', 'Property'), f('time_aspect', 'Time'), f('system', 'System', 'text', { list: true }), f('scale_type', 'Scale'),
      f('method_type', 'Method'), f('long_common_name', 'Long common name', 'textarea', { list: true }),
    ],
  },
  {
    key: 'ethnicities', table: 'm_ethnicities', label: 'Ethnicities', group: 'Test catalogue',
    description: 'Used for ethnicity-specific reference ranges.',
    display: 'name', unique: ['code'], fields: [code(), name(), active()],
  },
  {
    key: 'parameters', table: 'm_parameters', label: 'Parameters (analytes)', group: 'Test catalogue',
    description: 'Individual reportable analytes. Tests are composed of one or more parameters.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [
      code(), name(), f('short_name', 'Short name'),
      f('result_type', 'Result type', 'select', { options: ['NUMERIC', 'OPTION', 'TEXT', 'MEMO', 'CALCULATED'], required: true, list: true }),
      f('unit_id', 'Unit', 'ref', { ref: 'units', list: true }), f('decimals', 'Decimals', 'number', { default: 2 }),
      f('loinc_id', 'LOINC', 'ref', { ref: 'loinc_codes', list: true }), f('method_id', 'Method', 'ref', { ref: 'methodologies' }),
      f('formula', 'Formula', 'text', { help: 'For CALCULATED: use parameter codes, e.g. CHOL - HDL - TG/5' }),
      f('delta_percent', 'Delta check %', 'number', { help: 'Flag if change vs previous exceeds this %' }),
      f('delta_hours', 'Delta window (hours)', 'number', { default: 720 }),
      f('autoverify', 'Eligible for auto-verification', 'bool', { default: 1 }),
      active(),
    ],
    children: [
      { key: 'reference_ranges', fk: 'parameter_id', label: 'Reference ranges' },
      { key: 'parameter_options', fk: 'parameter_id', label: 'Result options' },
    ],
  },
  {
    key: 'parameter_options', table: 'm_parameter_options', label: 'Result options', group: 'Test catalogue',
    description: 'Coded answers for OPTION parameters (e.g. Positive / Negative).',
    display: 'value',
    fields: [
      f('parameter_id', 'Parameter', 'ref', { ref: 'parameters', required: true, list: true }), code(),
      f('value', 'Display value', 'text', { required: true, list: true }), f('is_abnormal', 'Abnormal', 'bool', { default: 0, list: true }),
      f('sort_order', 'Sort', 'number', { default: 0, list: true }),
    ],
  },
  {
    key: 'reference_ranges', table: 'm_reference_ranges', label: 'Reference ranges', group: 'Test catalogue',
    description: 'Normal, critical and absurd limits by gender, age, ethnicity, pregnancy and method. The most specific matching range wins.',
    display: "COALESCE(display_text, low || ' - ' || high)",
    fields: [
      f('parameter_id', 'Parameter', 'ref', { ref: 'parameters', required: true, list: true }),
      f('gender', 'Gender', 'select', { options: ['ANY', 'M', 'F', 'O'], default: 'ANY', list: true }),
      f('age_from', 'Age from', 'number', { default: 0, list: true }), f('age_to', 'Age to', 'number', { default: 150, list: true }),
      f('age_unit', 'Age unit', 'select', { options: ['YEARS', 'MONTHS', 'DAYS'], default: 'YEARS', list: true }),
      f('ethnicity_id', 'Ethnicity', 'ref', { ref: 'ethnicities', list: true }),
      f('pregnancy', 'Pregnancy', 'select', { options: ['ANY', 'YES', 'NO'], default: 'ANY', list: true }),
      f('method_id', 'Method', 'ref', { ref: 'methodologies' }),
      f('low', 'Normal low', 'number', { list: true }), f('high', 'Normal high', 'number', { list: true }),
      f('critical_low', 'Critical low', 'number', { list: true }), f('critical_high', 'Critical high', 'number', { list: true }),
      f('absurd_low', 'Absurd low', 'number'), f('absurd_high', 'Absurd high', 'number'),
      f('normal_text', 'Normal text value', 'text', { help: 'For text results, the expected normal value' }),
      f('display_text', 'Printed range text', 'text'),
    ],
  },
  {
    key: 'tests', table: 'm_tests', label: 'Lab tests', group: 'Test catalogue',
    description: 'Orderable tests and panels with specimen, TAT, price and outsourcing.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [
      code(), name(), f('short_name', 'Short name'),
      f('test_type', 'Type', 'select', { options: ['SINGLE', 'PANEL', 'CULTURE', 'HISTOPATHOLOGY'], default: 'SINGLE', list: true }),
      f('department_id', 'Department', 'ref', { ref: 'departments', required: true, list: true }),
      f('sub_department_id', 'Sub-department', 'ref', { ref: 'sub_departments', list: true }),
      f('sample_type_id', 'Sample type', 'ref', { ref: 'sample_types', required: true, list: true }),
      f('container_id', 'Container', 'ref', { ref: 'containers' }),
      f('method_id', 'Method', 'ref', { ref: 'methodologies' }), f('loinc_id', 'LOINC', 'ref', { ref: 'loinc_codes' }),
      f('body_site_required', 'Body site required', 'bool', { default: 0 }),
      f('price', 'Price', 'number', { default: 0, list: true }),
      f('tat_routine_min', 'TAT routine (min)', 'number', { default: 240, list: true }),
      f('tat_urgent_min', 'TAT urgent (min)', 'number', { default: 120 }), f('tat_stat_min', 'TAT STAT (min)', 'number', { default: 60 }),
      f('is_outsourced', 'Outsourced', 'bool', { default: 0, list: true }),
      f('outsource_lab_id', 'Reference lab', 'ref', { ref: 'outsource_labs' }),
      f('report_template_id', 'Report template', 'ref', { ref: 'report_templates' }),
      f('autoverify', 'Auto-verify normal instrument results', 'bool', { default: 0 }),
      f('patient_preparation', 'Patient preparation', 'textarea'), f('sort_order', 'Sort order', 'number', { default: 0 }), active(),
    ],
    children: [
      { key: 'test_parameters', fk: 'test_id', label: 'Parameters' },
      { key: 'analyzer_test_mappings', fk: 'test_id', label: 'Analyzer mappings' },
      { key: 'reagent_test_mappings', fk: 'test_id', label: 'Reagent consumption' },
    ],
  },
  {
    key: 'test_parameters', table: 'm_test_parameters', label: 'Test ↔ parameter mapping', group: 'Test catalogue',
    description: 'Defines which parameters are reported for each test and in which order.',
    display: 'id', unique: ['test_id', 'parameter_id'],
    fields: [
      f('test_id', 'Test', 'ref', { ref: 'tests', required: true, list: true }),
      f('parameter_id', 'Parameter', 'ref', { ref: 'parameters', required: true, list: true }),
      f('sort_order', 'Sort', 'number', { default: 0, list: true }), f('section_title', 'Section heading', 'text', { list: true }),
      f('mandatory', 'Mandatory', 'bool', { default: 1, list: true }), f('printable', 'Print on report', 'bool', { default: 1, list: true }),
    ],
  },
  {
    key: 'comment_templates', table: 'm_comment_templates', label: 'Canned comments', group: 'Test catalogue',
    description: 'Reusable interpretive comments for result entry and signing.',
    display: 'code', unique: ['code'],
    fields: [code(), f('department_id', 'Department', 'ref', { ref: 'departments', list: true }), f('text', 'Comment', 'textarea', { required: true, list: true })],
  },

  // ───────────── Automation & integration ─────────────
  {
    key: 'interfaces', table: 'm_interfaces', label: 'Interface engines', group: 'Integration',
    description: 'Every connection: analyzers, middleware, HIS, HIE, external hospitals and reference labs.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [
      code(), name(),
      f('category', 'Category', 'select', { options: ['ANALYZER', 'MIDDLEWARE', 'HIS', 'HIE', 'EXTERNAL_FACILITY', 'REFERENCE_LAB'], required: true, list: true }),
      f('protocol', 'Protocol', 'select', { options: PROTOCOLS, required: true, list: true }),
      f('transport', 'Transport', 'select', { options: TRANSPORTS, required: true, list: true }),
      f('direction', 'Direction', 'select', { options: ['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'], default: 'BIDIRECTIONAL', list: true }),
      f('host', 'Remote host'), f('port', 'Remote port', 'number'),
      f('endpoint_url', 'Remote HTTPS endpoint', 'text', { help: 'Used when pushing messages over HTTPS' }),
      f('auth_type', 'Auth type', 'select', { options: ['NONE', 'API_KEY', 'BASIC', 'BEARER'], default: 'NONE' }),
      f('auth_secret', 'Auth secret / key', 'text', { help: 'Also used as x-api-key for polling endpoints' }),
      f('sending_app', 'Sending application (MSH-3)'), f('sending_facility', 'Sending facility (MSH-4)'),
      f('receiving_app', 'Receiving application (MSH-5)'), f('receiving_facility', 'Receiving facility (MSH-6)'),
      f('hl7_version', 'HL7 version', 'select', { options: ['2.3.1', '2.4', '2.5.1'], default: '2.5.1' }),
      f('delivery_mode', 'Outbound delivery', 'select', { options: ['PUSH', 'PULL'], default: 'PULL', list: true, help: 'PUSH = LIS sends; PULL = remote polls the LIS API' }),
      f('retry_max', 'Max retries', 'number', { default: 8 }), active(),
    ],
  },
  {
    key: 'middleware', table: 'm_middleware', label: 'Middleware', group: 'Integration',
    description: 'Instrument middleware (e.g. Data Innovations IM) that brokers analyzer traffic.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('vendor', 'Vendor', 'text', { list: true }), f('version', 'Version'), f('interface_id', 'Interface', 'ref', { ref: 'interfaces', list: true, required: true }), f('description', 'Description', 'textarea'), active()],
  },
  {
    key: 'analyzers', table: 'm_analyzers', label: 'Analyzers', group: 'Integration',
    description: 'Instruments. Connect directly (own interface) or through middleware.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [
      code(), name(), f('manufacturer', 'Manufacturer', 'text', { list: true }), f('model', 'Model'), f('serial_no', 'Serial no.'),
      f('department_id', 'Department', 'ref', { ref: 'departments', list: true }), f('sub_department_id', 'Sub-department', 'ref', { ref: 'sub_departments' }),
      f('middleware_id', 'Via middleware', 'ref', { ref: 'middleware', list: true }),
      f('interface_id', 'Direct interface', 'ref', { ref: 'interfaces' }),
      f('protocol', 'Protocol', 'select', { options: PROTOCOLS, default: 'ASTM', list: true }),
      f('bidirectional', 'Bidirectional', 'bool', { default: 1 }),
      f('query_mode', 'Order download', 'select', { options: ['BROADCAST', 'HOST_QUERY'], default: 'BROADCAST' }),
      f('instrument_id', 'Instrument ID in messages', 'text', { help: 'Matches MSH-3 / ASTM H-5 sender' }), active(),
    ],
    children: [{ key: 'analyzer_test_mappings', fk: 'analyzer_id', label: 'Test mappings' }],
  },
  {
    key: 'analyzer_test_mappings', table: 'm_analyzer_mappings', label: 'Analyzer test mapping', group: 'Integration',
    description: 'Maps LIS test/parameter to analyzer order & result codes with unit conversion.',
    display: 'result_code', unique: ['analyzer_id', 'test_id', 'parameter_id'],
    fields: [
      f('analyzer_id', 'Analyzer', 'ref', { ref: 'analyzers', required: true, list: true }),
      f('test_id', 'Test', 'ref', { ref: 'tests', required: true, list: true }),
      f('parameter_id', 'Parameter', 'ref', { ref: 'parameters', required: true, list: true }),
      f('order_code', 'Order code (to analyzer)', 'text', { required: true, list: true }),
      f('result_code', 'Result code (from analyzer)', 'text', { required: true, list: true }),
      f('conversion_factor', 'Conversion factor', 'number', { default: 1, list: true }),
      f('priority', 'Routing priority', 'number', { default: 1, help: 'Lower = preferred analyzer' }), active(),
    ],
  },
  {
    key: 'external_facilities', table: 'm_facilities', label: 'External facilities', group: 'Integration',
    description: 'Client hospitals/clinics/HIE that send orders and receive results.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [
      code(), name(), f('type', 'Type', 'select', { options: ['HOSPITAL', 'CLINIC', 'HIE', 'CORPORATE'], list: true }),
      f('interface_id', 'Interface', 'ref', { ref: 'interfaces', list: true }),
      f('api_key', 'API key', 'text', { help: 'Sent as x-api-key header on inbound/polling calls' }),
      f('result_delivery', 'Result delivery', 'select', { options: ['PUSH', 'PULL', 'BOTH'], default: 'PULL', list: true }),
      f('result_format', 'Result format', 'select', { options: ['HL7V2', 'FHIR_R4', 'JSON'], default: 'HL7V2', list: true }),
      f('discount_percent', 'Discount %', 'number', { default: 0 }), f('contact', 'Contact'), active(),
    ],
    children: [{ key: 'test_code_mappings', fk: 'facility_id', label: 'Test code mapping' }],
  },
  {
    key: 'test_code_mappings', table: 'm_test_code_mappings', label: 'External test codes', group: 'Integration',
    description: 'Maps external order codes from client facilities to LIS tests.',
    display: 'external_code', unique: ['facility_id', 'external_code'],
    fields: [
      f('facility_id', 'Facility', 'ref', { ref: 'external_facilities', required: true, list: true }),
      f('external_code', 'External code', 'text', { required: true, list: true }), f('external_name', 'External name', 'text', { list: true }),
      f('test_id', 'LIS test', 'ref', { ref: 'tests', required: true, list: true }),
    ],
  },
  {
    key: 'outsource_labs', table: 'm_outsource_labs', label: 'Reference labs', group: 'Integration',
    description: 'External reference laboratories for outsourced tests.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [code(), name(), f('address', 'Address', 'textarea'), f('contact', 'Contact', 'text', { list: true }), f('phone', 'Phone'), f('interface_id', 'Interface', 'ref', { ref: 'interfaces', list: true }), f('default_tat_hours', 'Default TAT (hours)', 'number', { default: 72, list: true }), active()],
  },

  // ───────────── Reporting ─────────────
  {
    key: 'report_templates', table: 'm_report_templates', label: 'Report templates', group: 'Reporting',
    description: 'Printable report layouts. Placeholders: {{patient.name}}, {{patient.mrn}}, {{order.order_no}}, {{lab.name}}…',
    display: 'name', unique: ['code'],
    fields: [
      code(), name(), f('paper_size', 'Paper', 'select', { options: ['A4', 'LETTER', 'A5'], default: 'A4', list: true }),
      f('font_family', 'Font family', 'text', { default: 'IBM Plex Sans, Arial, sans-serif' }), f('font_size', 'Base font size (pt)', 'number', { default: 10 }),
      f('accent_color', 'Accent colour', 'color', { default: '#2f3a8f' }),
      f('header_html', 'Header HTML', 'html'), f('footer_html', 'Footer HTML', 'html'),
      f('show_method', 'Show method', 'bool', { default: 1 }), f('show_loinc', 'Show LOINC', 'bool', { default: 0 }),
      f('show_ref_range', 'Show reference range', 'bool', { default: 1 }), f('show_flags', 'Show flags', 'bool', { default: 1 }),
      f('highlight_abnormal', 'Bold abnormal results', 'bool', { default: 1 }), f('show_previous', 'Show previous result', 'bool', { default: 0 }),
      f('group_by_department', 'Page break per department', 'bool', { default: 1 }),
      f('disclaimer', 'Disclaimer', 'textarea'), f('is_default', 'Default template', 'bool', { default: 0, list: true }), active(),
    ],
  },

  // ───────────── Inventory ─────────────
  {
    key: 'reagents', table: 'm_reagents', label: 'Reagents', group: 'Inventory',
    description: 'Reagents linked to the item master (item code) and to analyzers.',
    display: "code || ' - ' || name", unique: ['code'],
    fields: [
      code(), name(), f('item_code', 'Item master code', 'text', { required: true, list: true }), f('manufacturer', 'Manufacturer'),
      f('catalog_no', 'Catalogue no.'), f('analyzer_id', 'Analyzer', 'ref', { ref: 'analyzers', list: true }),
      f('uom', 'Unit (tests/mL)', 'text', { default: 'tests' }), f('pack_size', 'Pack size', 'number'),
      f('stock_qty', 'Stock on hand', 'number', { default: 0, list: true }), f('reorder_level', 'Reorder level', 'number', { default: 0, list: true }),
      f('storage', 'Storage', 'select', { options: ['ROOM', 'REFRIGERATED', 'FROZEN'] }), active(),
    ],
    children: [
      { key: 'reagent_lots', fk: 'reagent_id', label: 'Lots' },
      { key: 'reagent_test_mappings', fk: 'reagent_id', label: 'Test consumption' },
    ],
  },
  {
    key: 'reagent_lots', table: 'm_reagent_lots', label: 'Reagent lots', group: 'Inventory',
    description: 'Received lots with expiry for traceability.',
    display: 'lot_no', unique: ['reagent_id', 'lot_no'],
    fields: [
      f('reagent_id', 'Reagent', 'ref', { ref: 'reagents', required: true, list: true }), f('lot_no', 'Lot no.', 'text', { required: true, list: true }),
      f('expiry_date', 'Expiry', 'date', { required: true, list: true }), f('qty', 'Quantity', 'number', { list: true }),
      f('received_date', 'Received', 'date'), f('status', 'Status', 'select', { options: ['IN_USE', 'QUARANTINE', 'EXPIRED', 'EXHAUSTED'], default: 'IN_USE', list: true }),
    ],
  },
  {
    key: 'reagent_test_mappings', table: 'm_reagent_test_mappings', label: 'Reagent ↔ test', group: 'Inventory',
    description: 'Reagent quantity consumed per test result; stock is decremented automatically on validation.',
    display: 'id', unique: ['reagent_id', 'test_id'],
    fields: [
      f('reagent_id', 'Reagent', 'ref', { ref: 'reagents', required: true, list: true }),
      f('test_id', 'Test', 'ref', { ref: 'tests', required: true, list: true }),
      f('qty_per_test', 'Qty per test', 'number', { default: 1, list: true }),
    ],
  },
];

export const registryByKey = new Map(REGISTRY.map((e) => [e.key, e]));
