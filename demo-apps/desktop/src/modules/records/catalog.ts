import type {DataColumn, EntitySchema, FormOption, FormValues, WorklistConfig} from '@pepbits/page-engines/types';

type Row = Record<string, string | number | boolean>;
/** One record destination: shared worklist configuration plus either an editable schema or read-only summary fields. */
export interface RecordDestination {
  pageId: string;
  singular: string;
  config: WorklistConfig;
  /** Editable records: the record-store form schema and how a worklist row seeds it. */
  form?: {schema: EntitySchema; fromRow(row: Row): FormValues};
  /** Read-only records: the summary sections built from the worklist row. */
  summary?: Array<{id: string; title: string; fields: string[]}>;
}

const column = (key: string, label: string, extra: Partial<DataColumn> = {}): DataColumn => ({key, label, sortable: true, defaultVisible: true, classification: 'operational', ...extra});
const statusFilter = {key: 'status', label: 'Status', type: 'select' as const, classification: 'operational' as const, options: ['Active', 'Pending', 'On Hold', 'Inactive']};
const worklist = (id: string, entity: string, title: string, description: string, displayKey: string, columns: DataColumn[], extraFilters: WorklistConfig['basicFilters'] = []): WorklistConfig =>
  ({id, entity, title, description, rows: [], primaryKey: 'id', displayKey, columns, basicFilters: [statusFilter, ...extraFilters], advancedFilters: []});

/* Column keys match the demo API's generated rows for these entities. Rows are fictional. */
const customerColumns = [
  column('id', 'Customer ID'), column('name', 'Customer', {classification: 'pii'}), column('type', 'Type'), column('segment', 'Segment'),
  column('city', 'City', {defaultVisible: false}), column('contact', 'Primary contact', {defaultVisible: false, classification: 'pii'}),
  column('creditLimit', 'Credit limit', {type: 'money', editable: true}), column('outstanding', 'Outstanding', {type: 'money'}),
  column('lastInvoice', 'Last invoice', {type: 'date', defaultVisible: false}), column('owner', 'Owner'),
  column('risk', 'Risk', {type: 'status', defaultVisible: false}), column('status', 'Status', {type: 'status'}),
];
const employeeColumns = [
  column('id', 'Employee ID'), column('name', 'Employee', {classification: 'pii'}), column('department', 'Department'), column('position', 'Position'),
  column('branch', 'Branch', {defaultVisible: false}), column('joinDate', 'Joined', {type: 'date', defaultVisible: false}), column('manager', 'Manager'),
  column('leaveBalance', 'Leave balance', {type: 'number', defaultVisible: false}), column('performance', 'Performance', {type: 'percent'}), column('status', 'Status', {type: 'status'}),
];

const statusOptions: FormOption[] = [{label: 'Active', value: 'Active'}, {label: 'Inactive', value: 'Inactive'}, {label: 'Draft', value: 'Draft'}, {label: 'On hold', value: 'On Hold'}];
const options = (...values: string[]) => values.map(value => ({label: value, value}));
/**
 * The customer record form. Field ids, required fields and options match the unchanged demo
 * API's server-side validation for `form:customer-master:*` records, so client and server agree.
 */
export const customerSchema: EntitySchema = {
  id: 'customer', singular: 'Customer', plural: 'Customers', description: 'Fictional party identity, contacts, address, tax and credit controls.',
  sections: [
    {id: 'profile', title: 'Customer profile', description: 'Primary commercial identity and classification.', fields: [
      {id: 'customerCode', label: 'Customer code', type: 'text', required: true},
      {id: 'legalName', label: 'Legal name', type: 'text', required: true},
      {id: 'tradeName', label: 'Trade name', type: 'text'},
      {id: 'customerType', label: 'Customer type', type: 'select', required: true, options: options('Corporate', 'Retail', 'Government', 'Distributor')},
      {id: 'segment', label: 'Segment', type: 'select', options: options('Enterprise', 'Mid-market', 'SMB', 'Strategic')},
      {id: 'status', label: 'Status', type: 'select', options: statusOptions, defaultValue: 'Active'},
    ]},
    {id: 'contact', title: 'Contacts', description: 'Communication and account ownership.', fields: [
      {id: 'contactName', label: 'Primary contact', type: 'text', required: true},
      {id: 'email', label: 'Email', type: 'email', required: true},
      {id: 'phone', label: 'Phone', type: 'phone'},
    ]},
    {id: 'address', title: 'Address', description: 'Billing and registered location.', fields: [
      {id: 'address1', label: 'Address line 1', type: 'text', required: true, colSpan: 2},
      {id: 'city', label: 'City', type: 'text', required: true},
      {id: 'country', label: 'Country', type: 'select', required: true, defaultValue: 'AE', options: [{label: 'United Arab Emirates', value: 'AE'}, {label: 'India', value: 'IN'}, {label: 'Saudi Arabia', value: 'SA'}, {label: 'Qatar', value: 'QA'}, {label: 'United Kingdom', value: 'GB'}]},
      {id: 'postalCode', label: 'Postal code', type: 'text'},
    ]},
    {id: 'credit', title: 'Credit controls', description: 'Terms, limits and collection risk.', fields: [
      {id: 'creditLimit', label: 'Credit limit', type: 'number', min: 0, defaultValue: 100000},
      {id: 'paymentTerms', label: 'Payment terms', type: 'select', defaultValue: '30', options: [{label: 'Due immediately', value: '0'}, {label: 'Net 15', value: '15'}, {label: 'Net 30', value: '30'}, {label: 'Net 60', value: '60'}]},
      {id: 'creditHold', label: 'Place on credit hold', type: 'toggle'},
      {id: 'riskRating', label: 'Risk rating', type: 'select', defaultValue: 'Low', options: options('Low', 'Medium', 'High')},
      {id: 'collectionNotes', label: 'Collection notes', type: 'textarea', colSpan: 2, visibleWhen: {field: 'creditHold', equals: true}, requiredWhen: {field: 'creditHold', equals: true}},
    ]},
  ],
};

export const RECORDS: Record<string, RecordDestination> = {
  'customer-master': {pageId: 'customer-master', singular: 'Customer',
    config: worklist('customer-master', 'customer', 'Customer Master', 'Fictional customers. Open a row in its own tab, compare two in split view, or detach one in the desktop runtime.', 'name', customerColumns),
    form: {schema: customerSchema, fromRow: row => ({customerCode: String(row.id ?? ''), legalName: String(row.name ?? ''), tradeName: String(row.name ?? ''), customerType: String(row.type ?? ''),
      segment: String(row.segment ?? ''), status: String(row.status ?? 'Active'), contactName: String(row.contact ?? ''), city: String(row.city ?? ''),
      creditLimit: Number(row.creditLimit ?? 0), riskRating: String(row.risk ?? 'Low')})}},
  'employee-worklist': {pageId: 'employee-worklist', singular: 'Employee',
    config: worklist('employee-worklist', 'employee', 'Employee Worklist', 'Fictional employees. Records open read only beside the list.', 'name', employeeColumns),
    summary: [{id: 'role', title: 'Role', fields: ['id', 'name', 'department', 'position', 'manager']}, {id: 'status', title: 'Status', fields: ['branch', 'joinDate', 'leaveBalance', 'performance', 'status']}]},
};
