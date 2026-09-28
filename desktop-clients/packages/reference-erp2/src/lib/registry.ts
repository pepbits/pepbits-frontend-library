/**
 * Keystone ERP2 page registry: all 57 source PageDefs with their titles, sections,
 * groups, icons, templates, entities, field labels/types/layout and workflow config.
 * Sanitized from the read-only source (TypeScript AST transform): fixture seeds, counts,
 * tree/resource/balance data, generator ranges and every pool/options value list were
 * removed. Fields that had them carry `lookupKind` and are hydrated at runtime from
 * GET /api/lookups; business values never ship in the client bundle.
 */
import type { Field, FieldType, PageDef, Section } from '@pepbits/reference-keystone-core';
export { pagePath, recordPath, newPath, nounOf, usesDialog, primaryField, listFields, defaultHidden } from '@pepbits/reference-keystone-core';
const f = (key: string, label: string, type: FieldType = 'text', extra: Partial<Field> = {}): Field => ({ key, label, type, ...extra });
const code = (label = 'Code') => f('code', label, 'code', { readOnly: true });
const status = (options = ['Active', 'Inactive']) => f('status', 'Status', 'status', { options, filter: true });

const itemLines: Field[] = [
  f('item', 'Item', 'text', { lookupKind: 'pool' }),
  f('qty', 'Qty', 'number'),
  f('rate', 'Rate', 'currency'),
  f('tax', 'Tax %', 'percent', { lookupKind: 'options' }),
  f('amount', 'Amount', 'currency', { readOnly: true }),
];

export const PAGES: PageDef[] = [
  /* ───────────────────────── Workspace ───────────────────────── */
  {
    slug: 'dashboard', section: 'workspace', group: 'Overview', title: 'Dashboard',
    description: 'Sales, cash and approvals at a glance', icon: 'LayoutDashboard',
    template: 'dashboard', entity: 'dashboard', fields: [],
  },
  {
    slug: 'approvals', section: 'workspace', group: 'Overview', title: 'Approvals inbox',
    description: 'Everything waiting on your decision', icon: 'Inbox',
    template: 'inbox', entity: 'approvals', quickFilter: 'type',
    fields: [
      code('Reference'),
      f('type', 'Type', 'select', { lookupKind: 'options', filter: true }),
      f('requester', 'Requested by', 'person', { primary: true }),
      f('department', 'Department', 'select', { lookupKind: 'options', filter: true }),
      f('amount', 'Amount', 'currency'),
      f('submitted', 'Submitted', 'date'),
      f('due', 'Due by', 'date'),
      f('priority', 'Priority', 'select', { lookupKind: 'options', filter: true }),
      status(['Pending', 'Approved', 'Rejected']),
      f('summary', 'Summary', 'textarea'),
    ],
  },

  /* ───────────────────────── Masters: common ───────────────────────── */
  {
    slug: 'countries', section: 'masters', group: 'Common', title: 'Country master',
    description: 'Countries, dialing codes and default currency', icon: 'Globe',
    template: 'grid', entity: 'countries', quickFilter: 'region',
    fields: [
      f('code', 'ISO code', 'text', { required: true }),
      f('name', 'Country', 'text', { primary: true, required: true }),
      f('dialCode', 'Dial code'),
      f('currency', 'Currency'),
      f('region', 'Region', 'select', { lookupKind: 'options', filter: true }),
      status(),
    ],
  },
  {
    slug: 'states', section: 'masters', group: 'Common', title: 'State master',
    description: 'States and provinces, grouped by country', icon: 'Map',
    template: 'dependent', entity: 'states', parent: { key: 'country', entity: 'countries', label: 'Country' }, quickFilter: 'type',
    fields: [
      f('code', 'Code', 'text', { required: true }),
      f('name', 'State / province', 'text', { primary: true, required: true }),
      f('country', 'Country', 'ref', { ref: 'countries', filter: true }),
      f('type', 'Type', 'select', { lookupKind: 'options', filter: true }),
      f('gstCode', 'Tax region code'),
      status(),
    ],
  },
  {
    slug: 'currencies', section: 'masters', group: 'Common', title: 'Currency master',
    description: 'Currencies and exchange rates to base', icon: 'Coins',
    template: 'grid', entity: 'currencies',
    fields: [
      f('code', 'Code', 'text', { required: true }), f('name', 'Currency', 'text', { primary: true }), f('symbol', 'Symbol'),
      f('decimals', 'Decimals', 'number'), f('rate', 'Rate to USD', 'number'), status(),
    ],
  },
  {
    slug: 'units', section: 'masters', group: 'Common', title: 'Unit of measure',
    description: 'Units used on items, orders and stock', icon: 'Ruler',
    template: 'grid', entity: 'units', quickFilter: 'category',
    fields: [
      f('code', 'Code', 'text', { required: true }), f('name', 'Unit', 'text', { primary: true }),
      f('category', 'Category', 'select', { lookupKind: 'options', filter: true }),
      f('decimals', 'Decimals', 'number'), status(),
    ],
  },
  {
    slug: 'holidays', section: 'masters', group: 'Common', title: 'Holiday calendar',
    description: 'Public, optional and company holidays', icon: 'CalendarDays',
    template: 'grid', entity: 'holidays', quickFilter: 'type',
    fields: [
      f('name', 'Holiday', 'text', { lookupKind: 'pool', primary: true }),
      f('date', 'Date', 'date'),
      f('type', 'Type', 'select', { lookupKind: 'options', filter: true }),
      f('location', 'Applies to', 'select', { lookupKind: 'options', filter: true }),
      status(),
    ],
  },

  /* ───────────────────────── Masters: organisation & finance ───────────────────────── */
  {
    slug: 'org-structure', section: 'masters', group: 'Organisation', title: 'Organisation structure',
    description: 'Company, divisions, departments and teams', icon: 'Network',
    template: 'tree', entity: 'org-structure',
    fields: [f('name', 'Name', 'text', { primary: true, required: true }), f('code', 'Code'), f('type', 'Type', 'select', { lookupKind: 'options' }), f('head', 'Head', 'person'), f('headcount', 'Headcount', 'number'), f('costCenter', 'Cost center'), status()],
  },
  {
    slug: 'departments', section: 'masters', group: 'Organisation', title: 'Department master',
    description: 'Departments, heads and cost centers', icon: 'Building2',
    template: 'grid', entity: 'departments',
    fields: [code(), f('name', 'Department', 'text', { lookupKind: 'pool', primary: true }), f('head', 'Head', 'person'), f('costCenter', 'Cost center', 'select', { lookupKind: 'options' }), f('headcount', 'Headcount', 'number'), status()],
  },
  {
    slug: 'chart-of-accounts', section: 'masters', group: 'Finance', title: 'Chart of accounts',
    description: 'Account groups and ledgers', icon: 'BookOpen',
    template: 'tree', entity: 'chart-of-accounts',
    fields: [f('name', 'Account', 'text', { primary: true, required: true }), f('code', 'Account no.'), f('type', 'Type', 'select', { lookupKind: 'options' }), f('nature', 'Nature', 'select', { lookupKind: 'options' }), f('balance', 'Balance', 'currency'), f('currency', 'Currency', 'select', { lookupKind: 'options' }), status()],
  },
  {
    slug: 'tax-rates', section: 'masters', group: 'Finance', title: 'Tax rates',
    description: 'Tax codes with effective dates', icon: 'Percent',
    template: 'rate', entity: 'tax-rates', quickFilter: 'category',
    fields: [code(), f('name', 'Tax', 'text', { lookupKind: 'pool', primary: true }), f('rate', 'Rate', 'percent'), f('category', 'Category', 'select', { lookupKind: 'options', filter: true }), f('effectiveFrom', 'Effective from', 'date'), f('effectiveTo', 'Effective to', 'date')],
  },

  /* ───────────────────────── Masters: parties ───────────────────────── */
  {
    slug: 'customers', section: 'masters', group: 'Sales & purchase', title: 'Customer master',
    description: 'Customers, contacts, credit and terms', icon: 'Users',
    template: 'profile', entity: 'customers', quickFilter: 'status',
    fields: [
      code('Customer no.'), f('name', 'Customer', 'company', { primary: true, required: true, group: 'General' }),
      f('group', 'Customer group', 'select', { lookupKind: 'options', filter: true, group: 'General', secondary: true }),
      f('salesperson', 'Account manager', 'person', { group: 'General' }), f('since', 'Customer since', 'date', { group: 'General' }),
      f('contact', 'Primary contact', 'person', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }), f('phone', 'Phone', 'phone', { group: 'Contact' }),
      f('city', 'City', 'city', { filter: true, group: 'Address' }), f('country', 'Country', 'country', { filter: true, group: 'Address' }), f('address', 'Street address', 'textarea', { group: 'Address', list: false }),
      f('creditLimit', 'Credit limit', 'currency', { group: 'Commercial' }), f('outstanding', 'Outstanding', 'currency', { group: 'Commercial' }),
      f('paymentTerms', 'Payment terms', 'select', { lookupKind: 'options', filter: true, group: 'Commercial' }), f('taxId', 'Tax ID', 'text', { group: 'Commercial', list: false }),
      status(['Active', 'On hold', 'Inactive']),
    ],
  },
  {
    slug: 'suppliers', section: 'masters', group: 'Sales & purchase', title: 'Supplier master',
    description: 'Vendors, ratings, lead times and bank details', icon: 'Truck',
    template: 'profile', entity: 'suppliers',
    fields: [
      code('Supplier no.'), f('name', 'Supplier', 'company', { primary: true, required: true, group: 'General' }),
      f('category', 'Category', 'select', { lookupKind: 'options', filter: true, group: 'General', secondary: true }),
      f('rating', 'Rating (1–5)', 'number', { group: 'General' }), f('leadTime', 'Lead time (days)', 'number', { group: 'General' }),
      f('contact', 'Contact person', 'person', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }), f('phone', 'Phone', 'phone', { group: 'Contact' }),
      f('city', 'City', 'city', { filter: true, group: 'Address' }), f('country', 'Country', 'country', { filter: true, group: 'Address' }),
      f('payable', 'Payable', 'currency', { group: 'Banking' }), f('paymentTerms', 'Payment terms', 'select', { lookupKind: 'options', group: 'Banking' }),
      f('bank', 'Bank', 'select', { lookupKind: 'options', group: 'Banking', list: false }), f('iban', 'Account / IBAN', 'text', { group: 'Banking', list: false }),
      status(['Active', 'Blocked', 'Inactive']),
    ],
  },

  /* ───────────────────────── Masters: inventory ───────────────────────── */
  {
    slug: 'items', section: 'masters', group: 'Inventory', title: 'Item master',
    description: 'Products, pricing, stock levels and tracking', icon: 'Package',
    template: 'profile', entity: 'items', quickFilter: 'category',
    fields: [
      code('Item code'), f('name', 'Item', 'text', { lookupKind: 'pool', primary: true, group: 'General' }),
      f('category', 'Category', 'select', { lookupKind: 'options', filter: true, group: 'General', secondary: true }),
      f('brand', 'Brand', 'select', { lookupKind: 'options', filter: true, group: 'General' }),
      f('uom', 'Unit', 'select', { lookupKind: 'options', group: 'General' }), f('hsn', 'HS code', 'text', { group: 'General', list: false }),
      f('purchasePrice', 'Purchase price', 'currency', { group: 'Pricing' }), f('salePrice', 'Sale price', 'currency', { group: 'Pricing' }),
      f('stock', 'In stock', 'number', { group: 'Stock' }), f('reorder', 'Reorder level', 'number', { group: 'Stock' }),
      f('warehouse', 'Default warehouse', 'select', { lookupKind: 'options', filter: true, group: 'Stock' }), f('batchTracked', 'Batch tracked', 'boolean', { group: 'Stock' }),
      status(['Active', 'Inactive']),
    ],
  },
  {
    slug: 'product-categories', section: 'masters', group: 'Inventory', title: 'Product categories',
    description: 'Category hierarchy used for reporting and pricing', icon: 'FolderTree',
    template: 'tree', entity: 'product-categories',
    fields: [f('name', 'Category', 'text', { primary: true, required: true }), f('code', 'Code'), f('items', 'Items', 'number'), f('margin', 'Target margin', 'percent'), f('taxCode', 'Default tax', 'select', { lookupKind: 'options' }), status()],
  },
  {
    slug: 'price-lists', section: 'masters', group: 'Inventory', title: 'Price lists',
    description: 'Item prices per list with validity periods', icon: 'Tags',
    template: 'rate', entity: 'price-lists', quickFilter: 'list',
    fields: [code(), f('item', 'Item', 'text', { lookupKind: 'pool', primary: true }), f('list', 'Price list', 'select', { lookupKind: 'options', filter: true }), f('price', 'Price', 'currency'), f('minQty', 'Min qty', 'number'), f('effectiveFrom', 'Effective from', 'date'), f('effectiveTo', 'Effective to', 'date')],
  },
  {
    slug: 'bill-of-materials', section: 'masters', group: 'Inventory', title: 'Bill of materials',
    description: 'Components and quantities to build a product', icon: 'Layers',
    template: 'structure', entity: 'bill-of-materials', quickFilter: 'status',
    fields: [code('BOM no.'), f('name', 'Product', 'text', { lookupKind: 'pool', primary: true }), f('version', 'Version', 'select', { lookupKind: 'options' }), f('outputQty', 'Output qty', 'number'), f('owner', 'Owner', 'person'), f('total', 'Material cost', 'currency', { readOnly: true }), status(['Active', 'Draft', 'Obsolete'])],
    lines: { label: 'Components', fields: [f('item', 'Component', 'text', { lookupKind: 'pool' }), f('qty', 'Qty', 'number'), f('uom', 'Unit', 'select', { lookupKind: 'options' }), f('rate', 'Unit cost', 'currency'), f('amount', 'Amount', 'currency', { readOnly: true })], min: 3, max: 8 },
  },

  /* ───────────────────────── Masters: HR ───────────────────────── */
  {
    slug: 'employees', section: 'masters', group: 'People', title: 'Employee master',
    description: 'Employees, roles, reporting and payroll details', icon: 'UserSquare',
    template: 'profile', entity: 'employees', quickFilter: 'department',
    fields: [
      code('Employee ID'), f('name', 'Employee', 'person', { primary: true, required: true, group: 'General' }),
      f('designation', 'Designation', 'select', { lookupKind: 'options', group: 'General', secondary: true }),
      f('department', 'Department', 'select', { lookupKind: 'options', filter: true, group: 'General' }),
      f('manager', 'Reports to', 'person', { group: 'General' }), f('joined', 'Date of joining', 'date', { group: 'General' }),
      f('type', 'Employment type', 'select', { lookupKind: 'options', filter: true, group: 'General' }),
      f('email', 'Work email', 'email', { group: 'Contact' }), f('phone', 'Mobile', 'phone', { group: 'Contact' }), f('location', 'Location', 'city', { filter: true, group: 'Contact' }),
      f('salary', 'Monthly CTC', 'currency', { group: 'Payroll' }), f('bank', 'Salary bank', 'select', { lookupKind: 'options', group: 'Payroll', list: false }),
      f('account', 'Account no.', 'text', { group: 'Payroll', list: false }),
      status(['Active', 'On leave', 'Probation', 'Exited']),
    ],
  },
  {
    slug: 'leave-types', section: 'masters', group: 'People', title: 'Leave types',
    description: 'Leave categories, entitlements and rules', icon: 'CalendarCheck',
    template: 'grid', entity: 'leave-types',
    fields: [code(), f('name', 'Leave type', 'text', { lookupKind: 'pool', primary: true }), f('days', 'Days / year', 'number'), f('carryForward', 'Carry forward', 'boolean'), f('paid', 'Paid', 'boolean'), status()],
  },
  {
    slug: 'shifts', section: 'masters', group: 'People', title: 'Shift master',
    description: 'Working shifts and grace periods', icon: 'Clock',
    template: 'grid', entity: 'shifts',
    fields: [code(), f('name', 'Shift', 'text', { lookupKind: 'pool', primary: true }), f('start', 'Starts', 'time'), f('end', 'Ends', 'time'), f('grace', 'Grace (min)', 'number'), status()],
  },
  {
    slug: 'salary-structures', section: 'masters', group: 'People', title: 'Salary structures',
    description: 'Earnings and deductions by grade', icon: 'Wallet',
    template: 'structure', entity: 'salary-structures',
    fields: [code(), f('name', 'Structure', 'text', { lookupKind: 'pool', primary: true }), f('grade', 'Grade', 'select', { lookupKind: 'options' }), f('currency', 'Currency', 'select', { lookupKind: 'options' }), f('total', 'Monthly gross', 'currency', { readOnly: true }), status(['Active', 'Draft'])],
    lines: { label: 'Components', fields: [f('item', 'Component', 'text', { lookupKind: 'pool' }), f('kind', 'Type', 'select', { lookupKind: 'options' }), f('qty', 'Factor', 'number'), f('rate', 'Monthly', 'currency'), f('amount', 'Amount', 'currency', { readOnly: true })], min: 4, max: 7 },
  },

  /* ───────────────────────── Masters: healthcare ───────────────────────── */
  {
    slug: 'patients', section: 'masters', group: 'Healthcare', title: 'Patient master',
    description: 'Patient demographics, insurance and clinical flags', icon: 'HeartPulse',
    template: 'profile', entity: 'patients', quickFilter: 'status',
    fields: [
      code('MRN'), f('name', 'Patient', 'person', { primary: true, required: true, group: 'General' }),
      f('gender', 'Gender', 'select', { lookupKind: 'options', filter: true, group: 'General', secondary: true }),
      f('age', 'Age', 'number', { group: 'General' }), f('bloodGroup', 'Blood group', 'select', { lookupKind: 'options', filter: true, group: 'General' }),
      f('doctor', 'Primary doctor', 'select', { lookupKind: 'options', filter: true, group: 'General' }), f('lastVisit', 'Last visit', 'date', { group: 'General' }),
      f('phone', 'Phone', 'phone', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }), f('city', 'City', 'city', { group: 'Contact' }),
      f('emergencyContact', 'Emergency contact', 'person', { group: 'Contact', list: false }),
      f('insurer', 'Insurer', 'select', { lookupKind: 'options', filter: true, group: 'Insurance' }),
      f('policyNo', 'Policy no.', 'text', { group: 'Insurance', list: false }), f('balance', 'Balance due', 'currency', { group: 'Insurance' }),
      f('allergies', 'Allergies / alerts', 'textarea', { group: 'Clinical', list: false }),
      status(['Active', 'Admitted', 'Discharged', 'Inactive']),
    ],
  },
  {
    slug: 'doctors', section: 'masters', group: 'Healthcare', title: 'Doctor master',
    description: 'Practitioners, specialities and consultation fees', icon: 'Stethoscope',
    template: 'profile', entity: 'doctors', quickFilter: 'speciality',
    fields: [
      code('Doctor ID'), f('name', 'Doctor', 'person', { primary: true, group: 'General' }),
      f('speciality', 'Speciality', 'select', { lookupKind: 'options', filter: true, group: 'General', secondary: true }),
      f('qualification', 'Qualification', 'select', { lookupKind: 'options', group: 'General' }), f('experience', 'Experience (yrs)', 'number', { group: 'General' }),
      f('phone', 'Phone', 'phone', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }),
      f('fee', 'Consultation fee', 'currency', { group: 'Schedule' }), f('days', 'OPD days', 'select', { lookupKind: 'options', group: 'Schedule' }),
      status(['Active', 'On leave', 'Inactive']),
    ],
  },
  {
    slug: 'lab-tests', section: 'masters', group: 'Healthcare', title: 'Lab test master',
    description: 'Tests, samples, turnaround and pricing', icon: 'FlaskConical',
    template: 'grid', entity: 'lab-tests', quickFilter: 'sample',
    fields: [code(), f('name', 'Test', 'text', { lookupKind: 'pool', primary: true }), f('sample', 'Sample', 'select', { lookupKind: 'options', filter: true }), f('tat', 'Turnaround (hrs)', 'number'), f('price', 'Price', 'currency'), status()],
  },
  {
    slug: 'consultation-fees', section: 'masters', group: 'Healthcare', title: 'Consultation fees',
    description: 'Fee schedule by doctor and visit type', icon: 'Receipt',
    template: 'rate', entity: 'consultation-fees', quickFilter: 'visitType',
    fields: [code(), f('doctor', 'Doctor', 'select', { lookupKind: 'options', primary: true, filter: true }), f('visitType', 'Visit type', 'select', { lookupKind: 'options', filter: true }), f('fee', 'Fee', 'currency'), f('effectiveFrom', 'Effective from', 'date'), f('effectiveTo', 'Effective to', 'date')],
  },

  /* ───────────────────────── Masters: education & fleet ───────────────────────── */
  {
    slug: 'students', section: 'masters', group: 'Education', title: 'Student master',
    description: 'Students, guardians, fees and attendance', icon: 'GraduationCap',
    template: 'profile', entity: 'students', quickFilter: 'grade',
    fields: [
      code('Admission no.'), f('name', 'Student', 'person', { primary: true, group: 'General' }),
      f('program', 'Program', 'select', { lookupKind: 'options', filter: true, group: 'General', secondary: true }),
      f('grade', 'Grade', 'select', { lookupKind: 'options', filter: true, group: 'General' }), f('section', 'Section', 'select', { lookupKind: 'options', group: 'General' }),
      f('guardian', 'Guardian', 'person', { group: 'Guardian' }), f('phone', 'Guardian phone', 'phone', { group: 'Guardian' }), f('email', 'Guardian email', 'email', { group: 'Guardian' }),
      f('feeDue', 'Fee due', 'currency', { group: 'Academics' }), f('attendance', 'Attendance', 'percent', { group: 'Academics' }),
      status(['Active', 'On leave', 'Inactive']),
    ],
  },
  {
    slug: 'fee-structures', section: 'masters', group: 'Education', title: 'Fee structures',
    description: 'Fee heads per program and term', icon: 'School',
    template: 'structure', entity: 'fee-structures',
    fields: [code(), f('name', 'Structure', 'text', { lookupKind: 'pool', primary: true }), f('term', 'Term', 'select', { lookupKind: 'options' }), f('total', 'Total fee', 'currency', { readOnly: true }), status(['Active', 'Draft'])],
    lines: { label: 'Fee heads', fields: [f('item', 'Fee head', 'text', { lookupKind: 'pool' }), f('frequency', 'Frequency', 'select', { lookupKind: 'options' }), f('qty', 'Instalments', 'number'), f('rate', 'Amount', 'currency'), f('amount', 'Total', 'currency', { readOnly: true })], min: 4, max: 7 },
  },
  {
    slug: 'vehicles', section: 'masters', group: 'Fleet & assets', title: 'Vehicle master',
    description: 'Fleet vehicles, drivers and compliance dates', icon: 'Car',
    template: 'profile', entity: 'vehicles', quickFilter: 'type',
    fields: [
      code('Asset no.'), f('name', 'Vehicle', 'text', { lookupKind: 'pool', primary: true, group: 'General' }),
      f('type', 'Type', 'select', { lookupKind: 'options', filter: true, group: 'General', secondary: true }),
      f('regNo', 'Registration', 'text', { group: 'General' }), f('fuel', 'Fuel', 'select', { lookupKind: 'options', filter: true, group: 'General' }),
      f('driver', 'Assigned driver', 'person', { group: 'Operations' }), f('capacity', 'Capacity (kg)', 'number', { group: 'Operations' }), f('odometer', 'Odometer (km)', 'number', { group: 'Operations' }),
      f('insuranceExpiry', 'Insurance expiry', 'date', { group: 'Compliance' }), f('permitExpiry', 'Permit expiry', 'date', { group: 'Compliance' }),
      status(['Active', 'In service', 'Inactive']),
    ],
  },

  /* ───────────────────────── Transactions ───────────────────────── */
  {
    slug: 'sales-orders', section: 'transactions', group: 'Sales', title: 'Sales orders',
    description: 'Customer orders from draft to delivery', icon: 'ShoppingCart',
    template: 'document', entity: 'sales-orders',
    statusFlow: ['Draft', 'Submitted', 'Approved', 'Delivered'],
    fields: [code('Order no.'), f('customer', 'Customer', 'ref', { ref: 'customers', primary: true, filter: true, required: true }), f('date', 'Order date', 'date'), f('deliveryDate', 'Delivery date', 'date'), f('salesperson', 'Salesperson', 'person', { filter: true }), f('warehouse', 'Warehouse', 'select', { lookupKind: 'options', filter: true }), f('paymentTerms', 'Payment terms', 'select', { lookupKind: 'options', list: false }), f('total', 'Total', 'currency', { readOnly: true }), status(['Draft', 'Submitted', 'Approved', 'Delivered', 'Cancelled'])],
    lines: { fields: itemLines, min: 1, max: 6 },
  },
  {
    slug: 'sales-invoices', section: 'transactions', group: 'Sales', title: 'Sales invoices',
    description: 'Billing, dues and collections', icon: 'FileText',
    template: 'document', entity: 'sales-invoices',
    statusFlow: ['Draft', 'Unpaid', 'Paid'],
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', primary: true, filter: true, required: true }), f('date', 'Invoice date', 'date'), f('dueDate', 'Due date', 'date'), f('orderRef', 'Order ref.', 'text', { list: false }), f('salesperson', 'Salesperson', 'person', { filter: true }), f('total', 'Total', 'currency', { readOnly: true }), status(['Draft', 'Unpaid', 'Partially paid', 'Paid', 'Overdue'])],
    lines: { fields: itemLines, min: 1, max: 6 },
  },
  {
    slug: 'purchase-orders', section: 'transactions', group: 'Purchase', title: 'Purchase orders',
    description: 'Orders placed with suppliers', icon: 'ShoppingBag',
    template: 'document', entity: 'purchase-orders',
    statusFlow: ['Draft', 'Submitted', 'Approved', 'Received'],
    fields: [code('PO no.'), f('supplier', 'Supplier', 'ref', { ref: 'suppliers', primary: true, filter: true, required: true }), f('date', 'PO date', 'date'), f('expected', 'Expected by', 'date'), f('buyer', 'Buyer', 'person', { filter: true }), f('warehouse', 'Ship to', 'select', { lookupKind: 'options', filter: true }), f('total', 'Total', 'currency', { readOnly: true }), status(['Draft', 'Submitted', 'Approved', 'Received', 'Cancelled'])],
    lines: { fields: itemLines, min: 1, max: 7 },
  },
  {
    slug: 'goods-receipts', section: 'transactions', group: 'Purchase', title: 'Goods receipts',
    description: 'Material received against purchase orders', icon: 'PackageCheck',
    template: 'document', entity: 'goods-receipts',
    statusFlow: ['Draft', 'Inspected', 'Received'],
    fields: [code('GRN no.'), f('supplier', 'Supplier', 'ref', { ref: 'suppliers', primary: true, filter: true }), f('date', 'Received on', 'date'), f('poRef', 'PO ref.', 'text'), f('warehouse', 'Warehouse', 'select', { lookupKind: 'options', filter: true }), f('receivedBy', 'Received by', 'person'), f('total', 'Value', 'currency', { readOnly: true }), status(['Draft', 'Inspected', 'Received', 'Rejected'])],
    lines: { fields: itemLines, min: 1, max: 5 },
  },
  {
    slug: 'journal-vouchers', section: 'transactions', group: 'Finance', title: 'Journal vouchers',
    description: 'General journal entries that must balance', icon: 'BookText',
    template: 'voucher', entity: 'journal-vouchers',
    statusFlow: ['Draft', 'Posted'],
    fields: [code('Voucher no.'), f('date', 'Date', 'date'), f('reference', 'Reference', 'text', { lookupKind: 'pool', primary: true }), f('branch', 'Branch', 'select', { lookupKind: 'options', filter: true }), f('preparedBy', 'Prepared by', 'person'), f('total', 'Amount', 'currency', { readOnly: true }), f('narration', 'Narration', 'textarea', { list: false }), status(['Draft', 'Posted', 'Reversed'])],
    lines: { fields: [f('account', 'Account', 'text', { lookupKind: 'pool' }), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency'), f('note', 'Line note')] },
  },
  {
    slug: 'payment-vouchers', section: 'transactions', group: 'Finance', title: 'Payment vouchers',
    description: 'Payments to suppliers and parties', icon: 'Banknote',
    template: 'voucher', entity: 'payment-vouchers',
    statusFlow: ['Draft', 'Approved', 'Posted'],
    fields: [code('Voucher no.'), f('date', 'Date', 'date'), f('payee', 'Payee', 'company', { primary: true }), f('mode', 'Mode', 'select', { lookupKind: 'options', filter: true }), f('bank', 'Paid from', 'select', { lookupKind: 'options', filter: true }), f('total', 'Amount', 'currency', { readOnly: true }), f('narration', 'Narration', 'textarea', { list: false }), status(['Draft', 'Approved', 'Posted', 'Reversed'])],
    lines: { fields: [f('account', 'Account', 'text', { lookupKind: 'pool' }), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency'), f('note', 'Line note')] },
  },
  {
    slug: 'petty-cash', section: 'transactions', group: 'Finance', title: 'Petty cash vouchers',
    description: 'Small office expenses paid in cash', icon: 'PiggyBank',
    template: 'voucher', entity: 'petty-cash',
    statusFlow: ['Draft', 'Posted'],
    fields: [code('Voucher no.'), f('date', 'Date', 'date'), f('custodian', 'Custodian', 'person', { primary: true }), f('branch', 'Branch', 'select', { lookupKind: 'options', filter: true }), f('total', 'Amount', 'currency', { readOnly: true }), f('narration', 'Narration', 'textarea', { list: false }), status(['Draft', 'Posted'])],
    lines: { fields: [f('account', 'Account', 'text', { lookupKind: 'pool' }), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency'), f('note', 'Line note')] },
  },
  {
    slug: 'leave-requests', section: 'transactions', group: 'People', title: 'Leave requests',
    description: 'Apply, track and approve leave', icon: 'Plane',
    template: 'request', entity: 'leave-requests',
    steps: ['Submitted', 'Reporting manager', 'HR review'],
    fields: [code('Request no.'), f('employee', 'Employee', 'person', { primary: true }), f('leaveType', 'Leave type', 'select', { lookupKind: 'options', filter: true, required: true }), f('from', 'From', 'date', { required: true }), f('to', 'To', 'date', { required: true }), f('days', 'Days', 'number', { readOnly: true }), f('reason', 'Reason', 'textarea', { list: false }), status(['Pending', 'Approved', 'Rejected', 'Withdrawn'])],
  },
  {
    slug: 'expense-claims', section: 'transactions', group: 'People', title: 'Expense claims',
    description: 'Reimbursement requests with approvals', icon: 'Receipt',
    template: 'request', entity: 'expense-claims',
    steps: ['Submitted', 'Manager', 'Finance', 'Paid'],
    fields: [code('Claim no.'), f('employee', 'Employee', 'person', { primary: true }), f('category', 'Category', 'select', { lookupKind: 'options', filter: true, required: true }), f('date', 'Expense date', 'date', { required: true }), f('amount', 'Amount', 'currency', { required: true }), f('project', 'Project', 'select', { lookupKind: 'options', filter: true }), f('reason', 'Description', 'textarea', { list: false }), status(['Pending', 'Approved', 'Rejected', 'Paid'])],
  },
  {
    slug: 'attendance', section: 'transactions', group: 'People', title: 'Attendance register',
    description: 'Daily attendance for the month', icon: 'CalendarClock',
    template: 'matrix', entity: 'attendance', matrix: { kind: 'attendance', values: ['P', 'A', 'L', 'H', 'WO'] },
    fields: [code('Emp ID'), f('name', 'Employee', 'person', { primary: true }), f('department', 'Department', 'select', { lookupKind: 'options' })],
  },
  {
    slug: 'timesheets', section: 'transactions', group: 'People', title: 'Timesheets',
    description: 'Hours logged per person for the week', icon: 'Timer',
    template: 'matrix', entity: 'timesheets', matrix: { kind: 'hours' },
    fields: [code('Emp ID'), f('name', 'Employee', 'person', { primary: true }), f('project', 'Project', 'select', { lookupKind: 'options' })],
  },
  {
    slug: 'payroll-run', section: 'transactions', group: 'People', title: 'Payroll run',
    description: 'Calculate and post monthly payroll', icon: 'Calculator',
    template: 'process', entity: 'payroll-run',
    steps: ['Validate attendance', 'Calculate earnings', 'Apply deductions', 'Generate payslips', 'Post to accounts'],
    params: [f('period', 'Pay period', 'select', { lookupKind: 'options' }), f('branch', 'Branch', 'select', { lookupKind: 'options' }), f('payDate', 'Pay date', 'date'), f('arrears', 'Include arrears', 'boolean')],
    fields: [code('Run no.'), f('period', 'Period', 'select', { lookupKind: 'options', primary: true }), f('branch', 'Branch', 'select', { lookupKind: 'options', filter: true }), f('employees', 'Employees', 'number'), f('gross', 'Gross', 'currency'), f('net', 'Net pay', 'currency'), f('runAt', 'Run on', 'date'), f('runBy', 'Run by', 'person'), status(['Completed', 'Failed'])],
  },
  {
    slug: 'depreciation-run', section: 'transactions', group: 'Finance', title: 'Depreciation run',
    description: 'Monthly depreciation across asset classes', icon: 'Hourglass',
    template: 'process', entity: 'depreciation-run',
    steps: ['Load asset register', 'Compute depreciation', 'Review exceptions', 'Post journal'],
    params: [f('period', 'Period', 'select', { lookupKind: 'options' }), f('method', 'Method', 'select', { lookupKind: 'options' }), f('assetClass', 'Asset class', 'select', { lookupKind: 'options' }), f('postJournal', 'Post journal automatically', 'boolean')],
    fields: [code('Run no.'), f('period', 'Period', 'select', { lookupKind: 'options', primary: true }), f('assetClass', 'Asset class', 'select', { lookupKind: 'options', filter: true }), f('employees', 'Assets', 'number'), f('gross', 'Depreciation', 'currency'), f('runAt', 'Run on', 'date'), f('runBy', 'Run by', 'person'), status(['Completed', 'Failed'])],
  },
  {
    slug: 'appointments', section: 'transactions', group: 'Healthcare', title: 'Appointments',
    description: 'Doctor schedules and patient bookings', icon: 'CalendarCheck',
    template: 'booking', entity: 'appointments',
    fields: [code('Token'), f('person', 'Patient', 'person', { primary: true, required: true }), f('resource', 'Doctor', 'select', { lookupKind: 'options', filter: true, required: true }), f('date', 'Date', 'date', { required: true }), f('start', 'Time', 'time', { required: true }), f('duration', 'Minutes', 'number', { lookupKind: 'options' }), f('type', 'Visit type', 'select', { lookupKind: 'options', filter: true }), f('phone', 'Phone', 'phone'), status(['Booked', 'Checked in', 'Completed', 'No show', 'Cancelled'])],
  },
  {
    slug: 'room-bookings', section: 'transactions', group: 'Admin', title: 'Meeting rooms',
    description: 'Book meeting rooms and training halls', icon: 'DoorOpen',
    template: 'booking', entity: 'room-bookings',
    fields: [code('Booking'), f('person', 'Booked by', 'person', { primary: true }), f('resource', 'Room', 'select', { lookupKind: 'options', filter: true, required: true }), f('date', 'Date', 'date', { required: true }), f('start', 'Time', 'time', { required: true }), f('duration', 'Minutes', 'number'), f('type', 'Purpose', 'select', { lookupKind: 'options', filter: true }), f('phone', 'Extension', 'phone', { list: false }), status(['Booked', 'Checked in', 'Completed', 'Cancelled'])],
  },
  {
    slug: 'quality-inspections', section: 'transactions', group: 'Operations', title: 'Quality inspections',
    description: 'Incoming, in-process and final QC checks', icon: 'ClipboardCheck',
    template: 'checklist', entity: 'quality-inspections', quickFilter: 'status',
    checks: [{ parameter: 'Visual appearance', spec: 'No dents, scratches or rust' }, { parameter: 'Dimensions', spec: 'Within ±0.5 mm of drawing' }, { parameter: 'Weight', spec: 'Nominal ±2%' }, { parameter: 'Surface finish', spec: 'Ra ≤ 3.2 µm' }, { parameter: 'Packaging integrity', spec: 'Seals intact, labels legible' }, { parameter: 'Functional test', spec: 'Runs 10 min without fault' }, { parameter: 'Documentation', spec: 'CoC and batch report attached' }],
    fields: [code('Inspection no.'), f('item', 'Item', 'text', { lookupKind: 'pool', primary: true }), f('batch', 'Batch'), f('stage', 'Stage', 'select', { lookupKind: 'options', filter: true }), f('date', 'Date', 'date'), f('inspector', 'Inspector', 'person', { filter: true }), status(['Pending', 'Passed', 'Failed', 'On hold'])],
  },
  {
    slug: 'support-tickets', section: 'transactions', group: 'Service', title: 'Support tickets',
    description: 'Customer issues from new to resolved', icon: 'LifeBuoy',
    template: 'case', entity: 'support-tickets',
    statusFlow: ['New', 'Open', 'In progress', 'Waiting', 'Resolved'],
    fields: [code('Ticket'), f('subject', 'Subject', 'text', { lookupKind: 'pool', primary: true }), f('customer', 'Customer', 'ref', { ref: 'customers', filter: true }), f('category', 'Category', 'select', { lookupKind: 'options', filter: true }), f('priority', 'Priority', 'select', { lookupKind: 'options', filter: true }), f('assignee', 'Assignee', 'person', { filter: true }), f('created', 'Created', 'date'), status(['New', 'Open', 'In progress', 'Waiting', 'Resolved'])],
  },
  {
    slug: 'maintenance-requests', section: 'transactions', group: 'Operations', title: 'Maintenance requests',
    description: 'Breakdowns and planned maintenance jobs', icon: 'Wrench',
    template: 'case', entity: 'maintenance-requests',
    statusFlow: ['New', 'Scheduled', 'In progress', 'Done'],
    fields: [code('Request'), f('subject', 'Issue', 'text', { lookupKind: 'pool', primary: true }), f('location', 'Location', 'select', { lookupKind: 'options', filter: true }), f('category', 'Category', 'select', { lookupKind: 'options', filter: true }), f('priority', 'Priority', 'select', { lookupKind: 'options', filter: true }), f('assignee', 'Technician', 'person', { filter: true }), f('created', 'Reported', 'date'), status(['New', 'Scheduled', 'In progress', 'Done'])],
  },
  {
    slug: 'marks-entry', section: 'transactions', group: 'Education', title: 'Marks entry',
    description: 'Term scores by subject', icon: 'BookOpenCheck',
    template: 'matrix', entity: 'marks-entry', matrix: { kind: 'marks', columns: ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Sc.'] },
    fields: [code('Roll no.'), f('name', 'Student', 'person', { primary: true }), f('section', 'Section', 'select', { lookupKind: 'options' })],
  },

  /* ───────────────────────── Reports ───────────────────────── */
  {
    slug: 'sales-register', section: 'reports', group: 'Sales', title: 'Sales register',
    description: 'Invoices with totals, grouping and export', icon: 'ChartColumn',
    template: 'report', entity: 'sales-invoices', view: true,
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', filter: true }), f('date', 'Invoice date', 'date', { filter: true }), f('dueDate', 'Due date', 'date'), f('salesperson', 'Salesperson', 'person', { filter: true }), f('total', 'Total', 'currency', { filter: true }), status(['Draft', 'Unpaid', 'Partially paid', 'Paid', 'Overdue'])],
  },
  {
    slug: 'purchase-register', section: 'reports', group: 'Purchase', title: 'Purchase register',
    description: 'Purchase orders by supplier and status', icon: 'ShoppingBag',
    template: 'report', entity: 'purchase-orders', view: true,
    fields: [code('PO no.'), f('supplier', 'Supplier', 'ref', { ref: 'suppliers', filter: true }), f('date', 'PO date', 'date', { filter: true }), f('buyer', 'Buyer', 'person', { filter: true }), f('warehouse', 'Ship to', 'select', { lookupKind: 'options', filter: true }), f('total', 'Total', 'currency', { filter: true }), status(['Draft', 'Submitted', 'Approved', 'Received', 'Cancelled'])],
  },
  {
    slug: 'stock-summary', section: 'reports', group: 'Inventory', title: 'Stock summary',
    description: 'Opening, movement and closing stock by item', icon: 'Boxes',
    template: 'report', entity: 'stock-summary', quickFilter: 'warehouse',
    fields: [f('item', 'Item', 'text', { lookupKind: 'pool', primary: true }), f('category', 'Category', 'select', { lookupKind: 'options', filter: true }), f('warehouse', 'Warehouse', 'select', { lookupKind: 'options', filter: true }), f('opening', 'Opening', 'number'), f('inward', 'Inward', 'number'), f('outward', 'Outward', 'number'), f('closing', 'Closing', 'number'), f('value', 'Stock value', 'currency')],
  },
  {
    slug: 'receivables-aging', section: 'reports', group: 'Finance', title: 'Receivables aging',
    description: 'Outstanding invoices by age bucket', icon: 'Hourglass',
    template: 'report', entity: 'receivables-aging', quickFilter: 'bucket',
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', filter: true }), f('date', 'Invoice date', 'date'), f('bucket', 'Age bucket', 'select', { lookupKind: 'options', filter: true }), f('current', '0–30', 'currency'), f('d60', '31–60', 'currency'), f('d90', '61–90', 'currency'), f('d90p', '90+', 'currency'), f('total', 'Outstanding', 'currency')],
  },
  {
    slug: 'customer-ledger', section: 'reports', group: 'Finance', title: 'Customer ledger',
    description: 'Running balance statement for a customer', icon: 'ScrollText',
    template: 'ledger', entity: 'ledger-entries',
    fields: [code('Voucher'), f('date', 'Date', 'date'), f('party', 'Customer', 'ref', { ref: 'customers', filter: true }), f('type', 'Type', 'select', { lookupKind: 'options' }), f('narration', 'Narration', 'textarea'), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency')],
  },
  {
    slug: 'invoice-print', section: 'reports', group: 'Documents', title: 'Invoice print',
    description: 'Print-ready invoice preview', icon: 'Printer',
    template: 'print', entity: 'sales-invoices', view: true,
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', primary: true }), f('date', 'Invoice date', 'date'), f('total', 'Total', 'currency'), status(['Draft', 'Unpaid', 'Partially paid', 'Paid', 'Overdue'])],
  },

  /* ───────────────────────── Setup ───────────────────────── */
  {
    slug: 'company-settings', section: 'setup', group: 'Company', title: 'Company settings',
    description: 'Legal details, defaults and preferences', icon: 'Settings',
    template: 'settings', entity: 'company-settings', fields: [],
    sections: [
      { title: 'Company profile', description: 'Shown on invoices, letters and the login page.', fields: [f('legalName', 'Legal name', 'text', { lookupKind: 'pool' }), f('tradeName', 'Trade name', 'text', { lookupKind: 'pool' }), f('taxId', 'Tax registration no.', 'text', { lookupKind: 'pool' }), f('email', 'Billing email', 'email'), f('phone', 'Phone', 'phone'), f('website', 'Website', 'text', { lookupKind: 'pool' })] },
      { title: 'Address', description: 'Registered office address.', fields: [f('address', 'Street', 'textarea', { lookupKind: 'pool' }), f('city', 'City', 'city'), f('country', 'Country', 'country'), f('postcode', 'Postcode', 'text', { lookupKind: 'pool' })] },
      { title: 'Regional defaults', description: 'Used when a document does not specify its own.', fields: [f('currency', 'Base currency', 'select', { lookupKind: 'options' }), f('timezone', 'Time zone', 'select', { lookupKind: 'options' }), f('dateFormat', 'Date format', 'select', { lookupKind: 'options' }), f('fiscalStart', 'Financial year starts', 'select', { lookupKind: 'options' })] },
      { title: 'Documents', description: 'Defaults for sales and purchase documents.', fields: [f('paymentTerms', 'Default payment terms', 'select', { lookupKind: 'options' }), f('roundOff', 'Round off totals', 'boolean'), f('allowNegativeStock', 'Allow negative stock', 'boolean'), f('requireApproval', 'Require approval above', 'currency')] },
    ],
  },
  {
    slug: 'users', section: 'setup', group: 'Access', title: 'Users',
    description: 'Who can sign in and what they can do', icon: 'UserCog',
    template: 'grid', entity: 'users', quickFilter: 'role',
    fields: [f('name', 'Name', 'person', { primary: true }), f('email', 'Email', 'email'), f('role', 'Role', 'select', { lookupKind: 'options', filter: true }), f('branch', 'Branch', 'select', { lookupKind: 'options', filter: true }), f('lastLogin', 'Last sign-in', 'date'), f('mfa', '2-step', 'boolean'), status(['Active', 'Disabled'])],
  },
  {
    slug: 'number-series', section: 'setup', group: 'Documents', title: 'Number series',
    description: 'Prefixes and counters for document numbers', icon: 'Hash',
    template: 'grid', entity: 'number-series',
    fields: [f('document', 'Document', 'text', { primary: true }), f('prefix', 'Prefix'), f('next', 'Next number', 'number'), f('padding', 'Digits', 'number'), f('reset', 'Resets', 'select', { lookupKind: 'options' }), status()],
  },
  {
    slug: 'notifications', section: 'setup', group: 'Company', title: 'Notification settings',
    description: 'Email and in-app alerts', icon: 'Bell',
    template: 'settings', entity: 'notification-settings', fields: [],
    sections: [
      { title: 'Approvals', description: 'Tell approvers when something needs them.', fields: [f('approvalEmail', 'Email approvers', 'boolean'), f('approvalReminder', 'Reminder after (hours)', 'number'), f('escalateTo', 'Escalate to', 'select', { lookupKind: 'options' })] },
      { title: 'Finance', description: 'Collections and payables.', fields: [f('overdueDigest', 'Daily overdue digest', 'boolean'), f('paymentReceived', 'Payment received alert', 'boolean'), f('largePayment', 'Flag payments above', 'currency')] },
      { title: 'Inventory', description: 'Stock health alerts.', fields: [f('reorderAlert', 'Reorder level alert', 'boolean'), f('expiryDays', 'Batch expiry warning (days)', 'number'), f('stockDigest', 'Weekly stock digest', 'select', { lookupKind: 'options' })] },
    ],
  },
];

export const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'workspace', label: 'Workspace', icon: 'LayoutDashboard' },
  { key: 'masters', label: 'Masters', icon: 'Database' },
  { key: 'transactions', label: 'Transactions', icon: 'ArrowLeftRight' },
  { key: 'reports', label: 'Reports', icon: 'ChartColumn' },
  { key: 'setup', label: 'Setup', icon: 'Settings' },
];

export const findPage = (section?: string, slug?: string) => PAGES.find((p) => p.section === section && p.slug === slug);
export const findPageByPath = (path: string) => {
  const [, section, slug] = path.split('/');
  return findPage(section, slug);
};
export const ownerDef = (entity: string) => PAGES.find((p) => p.entity === entity && !p.view);
