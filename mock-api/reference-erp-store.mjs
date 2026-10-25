/*
 * Reference ERP (Keystone ERP) demo API — fictional, in-memory, synthetic for the process lifetime only.
 *
 * Ports the erp1/erp2 keystone-erp source page registry (src/lib/registry.ts), pools (src/lib/mock/pools.ts)
 * and deterministic mock generator (src/lib/mock/store.ts) to plain JS, plus the two API routes
 * (src/app/api/entities/[entity]/**, src/app/api/dashboard) as store.handle(). erp1 and erp2's registries were
 * read in full and are structurally/content identical (same 57 PageDefs, same pools import shape); this store
 * shares one registry for both variants and documents that assumption rather than guessing. `variant` is kept
 * on the store for future divergence and is folded into nothing that changes output today.
 *
 * Not claimed: no real accounting ledger, no persistence beyond the process, no production authorization.
 */
import { randomUUID } from 'node:crypto';

/* ───────────────────────── pools (src/lib/mock/pools.ts) ───────────────────────── */
const FIRST = ['Aarav', 'Maya', 'Liam', 'Priya', 'Noah', 'Sofia', 'Ethan', 'Aisha', 'Lucas', 'Chloe', 'Arjun', 'Emma', 'Omar', 'Hana', 'Daniel', 'Leila', 'Mateo', 'Grace', 'Ravi', 'Zoe', 'Kenji', 'Isla', 'Samuel', 'Fatima', 'Jonah', 'Meera', 'Tomás', 'Ananya', 'Victor', 'Nora', 'Kabir', 'Elena', 'Yusuf', 'Clara', 'Rohan', 'Amara', 'Felix', 'Ines', 'Dev', 'Julia'];
const LAST = ['Sharma', 'Okafor', 'Nguyen', 'Patel', 'Fischer', 'Silva', 'Haddad', 'Kowalski', 'Mensah', 'Iyer', 'Andersen', 'Moreau', 'Tanaka', 'Rahman', 'Costa', 'Brennan', 'Varga', 'Menon', 'Lindqvist', 'Castillo', 'Rao', 'Dubois', 'Kim', 'Adeyemi', 'Novak', 'Hughes', 'Qureshi', 'Romano', 'Bauer', 'Das'];
const CO_A = ['Apex', 'Blue Harbor', 'Cedar', 'Delta', 'Evergreen', 'Fulcrum', 'Granite', 'Horizon', 'Ironwood', 'Juniper', 'Kestrel', 'Lumen', 'Meridian', 'Northgate', 'Orchard', 'Pinnacle', 'Quarry', 'Redline', 'Summit', 'Tidewater', 'Unity', 'Vantage', 'Westbrook', 'Zenith', 'Brightside', 'Coastal', 'Harbor', 'Oakridge', 'Silverline', 'Trident'];
const CO_B = ['Traders', 'Industries', 'Supplies', 'Logistics', 'Retail', 'Foods', 'Healthcare', 'Engineering', 'Distribution', 'Holdings', 'Systems', 'Pharma', 'Textiles', 'Components', 'Wholesale', 'Motors'];
const CO_SUFFIX = ['Ltd', 'LLC', 'Inc', 'Co.', 'Pvt Ltd', 'GmbH', 'PLC'];
const CITIES = ['Mumbai', 'Bengaluru', 'Chennai', 'Pune', 'Delhi', 'Hyderabad', 'Dubai', 'Abu Dhabi', 'Singapore', 'London', 'Manchester', 'New York', 'Chicago', 'Austin', 'Toronto', 'Sydney', 'Melbourne', 'Berlin', 'Rotterdam', 'Nairobi'];
const COUNTRIES = ['India', 'United Arab Emirates', 'Singapore', 'United Kingdom', 'United States', 'Canada', 'Australia', 'Germany', 'Netherlands', 'Kenya'];
const PRODUCTS = ['Steel Hex Bolt M8', 'Copper Wire 2.5mm', 'LED Panel 40W', 'Hydraulic Pump HP-200', 'Safety Helmet Class E', 'Nitrile Gloves (Box 100)', 'Industrial Adhesive 1L', 'PVC Pipe 50mm', 'Ball Bearing 6204', 'Circuit Breaker 32A', 'Thermal Printer Roll', 'Stainless Sheet 2mm', 'Lithium Battery Pack 48V', 'Air Filter AF-310', 'Conveyor Belt 5m', 'Pressure Gauge 0-10bar', 'Solar Inverter 5kW', 'Welding Rod E6013', 'Laptop 14" Business', 'Office Chair Ergo', 'Printer Toner 26A', 'Barcode Scanner 2D', 'Paracetamol 500mg', 'Surgical Mask 3-ply', 'Hand Sanitizer 500ml', 'Glucose Monitor Kit', 'Packaging Carton L', 'Stretch Film 23mic', 'Pallet Wooden 1200', 'Drill Bit Set HSS', 'Cable Tray 300mm', 'Water Pump 1HP', 'Epoxy Floor Coat 4L', 'Fire Extinguisher 6kg', 'Label Roll 100x50', 'Aluminium Profile 40x40', 'Gear Motor 0.5HP', 'Temperature Sensor PT100', 'Switch Gear Panel', 'Router Dual Band'];
const RAW = ['Mild Steel Rod', 'Aluminium Ingot', 'Copper Cathode', 'Polypropylene Granules', 'Rubber Gasket', 'Fastener Kit', 'Paint Primer', 'PCB Assembly', 'Wiring Harness', 'Plastic Housing', 'Glass Panel', 'Foam Insert', 'Corrugated Box', 'Label Set', 'Lubricant Oil'];
const FINISHED = ['Hydraulic Pump HP-200', 'Solar Inverter 5kW', 'Control Panel CP-9', 'Water Pump 1HP', 'Air Compressor 50L', 'LED Panel 40W', 'Battery Pack 48V', 'Conveyor Module CM-5', 'Industrial Fan 24"', 'Gear Motor 0.5HP', 'Switch Gear Panel', 'Welding Machine 200A'];
const ACCOUNTS = ['Cash in Hand', 'HDFC Current A/c', 'Citi Operating A/c', 'Accounts Receivable', 'Accounts Payable', 'Sales Revenue', 'Purchase Account', 'Office Rent', 'Salaries & Wages', 'Electricity', 'Travel Expense', 'Printing & Stationery', 'Repairs & Maintenance', 'Input Tax Credit', 'Output Tax Payable', 'Freight Inward', 'Advertising', 'Bank Charges', 'Petty Cash', 'Staff Welfare', 'Telephone & Internet', 'Depreciation', 'Professional Fees', 'Insurance Expense'];
const DEPARTMENTS = ['Finance', 'Sales', 'Operations', 'Human Resources', 'Procurement', 'IT', 'Quality', 'Production', 'Warehouse', 'Customer Success', 'Legal', 'Marketing'];
const DESIGNATIONS = ['Executive', 'Senior Executive', 'Team Lead', 'Manager', 'Senior Manager', 'Analyst', 'Engineer', 'Associate', 'Director', 'Specialist'];
const WAREHOUSES = ['Main Warehouse', 'North Depot', 'Port Store', 'Plant 2 Stores', 'Returns Bay'];
const LAB_TESTS = ['Complete Blood Count', 'Lipid Profile', 'HbA1c', 'Liver Function Test', 'Kidney Function Test', 'Thyroid Profile', 'Vitamin D', 'Urine Routine', 'Blood Culture', 'CRP', 'Dengue NS1', 'Serum Electrolytes', 'Fasting Blood Sugar', 'ECG', 'Chest X-Ray', 'Ultrasound Abdomen', 'MRI Brain', 'CT Chest', 'Vitamin B12', 'Iron Studies'];
const DOCTORS = ['Dr. Meera Iyer', 'Dr. Samuel Okafor', 'Dr. Hana Tanaka', 'Dr. Arjun Menon', 'Dr. Clara Moreau', 'Dr. Omar Haddad'];
const ROOMS = ['Boardroom', 'Cedar Room', 'Maple Room', 'Training Hall', 'Huddle 1', 'Huddle 2'];
const TICKET_SUBJECTS = ['Invoice amount mismatch', 'Delivery delayed beyond ETA', 'Unable to log in to portal', 'Damaged goods received', 'Request for credit note', 'Wrong item shipped', 'Warranty claim for pump', 'Update billing address', 'Payment not reflected', 'Bulk order pricing query', 'Installation support needed', 'Return pickup not scheduled', 'Tax invoice required', 'Spare part availability', 'Account statement request'];
const MAINT_SUBJECTS = ['Conveyor belt misalignment', 'HVAC not cooling in Bay 3', 'Forklift battery replacement', 'Leaking hydraulic line', 'Generator service due', 'Loading dock door stuck', 'CNC spindle vibration', 'Compressor pressure drop', 'Lighting failure in aisle 7', 'Boiler inspection'];
const WORDS = ['Quarterly', 'renewal', 'as per agreement', 'urgent', 'follow up', 'revised terms', 'standard', 'priority', 'approved budget', 'annual contract', 'monthly', 'one-time', 'recurring', 'adjusted', 'reconciled'];
const SENTENCES = ['Reviewed against the approved budget; within limits.', 'Customer requested split delivery across two locations.', 'Pricing as per the annual rate contract.', 'Please prioritise, the site team is waiting on this.', 'Documents attached for verification.', 'Revised after discussion with the department head.', 'Recurring monthly arrangement, no change from last period.', 'Adjusted for the credit note issued last week.', 'Follow-up scheduled with the vendor on Monday.', 'Covers travel and accommodation for the client visit.'];
const VEHICLES = ['Tata Ace Gold', 'Ashok Leyland Dost', 'Mahindra Bolero Pik-Up', 'Isuzu D-Max', 'Eicher Pro 2049', 'Toyota Hilux', 'Ford Transit', 'Mercedes Sprinter', 'Volvo FM 420', 'Hino 300', 'BharatBenz 1617', 'Force Traveller'];
const PROGRAMS = ['Science', 'Commerce', 'Humanities', 'Computer Science', 'Engineering Foundation'];

/* ───────────────────────── field/page helpers (src/lib/registry.ts) ───────────────────────── */
const f = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });
const code = (label = 'Code') => f('code', label, 'code', { readOnly: true });
const status = (options = ['Active', 'Inactive']) => f('status', 'Status', 'status', { options, filter: true });
const PAY_TERMS = ['Immediate', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
const UOMS = ['Nos', 'Kg', 'Litre', 'Metre', 'Box', 'Set', 'Roll', 'Pair'];
const itemLines = [
  f('item', 'Item', 'text', { pool: PRODUCTS }),
  f('qty', 'Qty', 'number', { min: 1, max: 40 }),
  f('rate', 'Rate', 'currency', { min: 12, max: 900 }),
  f('tax', 'Tax %', 'percent', { options: ['0', '5', '12', '18'] }),
  f('amount', 'Amount', 'currency', { readOnly: true }),
];

/* ───────────────────────── page registry (57 catalogue pages, 20 templates) ───────────────────────── */
export const PAGES = [
  { slug: 'dashboard', section: 'workspace', group: 'Overview', title: 'Dashboard', template: 'dashboard', entity: 'dashboard', fields: [] },
  { slug: 'approvals', section: 'workspace', group: 'Overview', title: 'Approvals inbox', template: 'inbox', entity: 'approvals', codePrefix: 'REQ', count: 46, quickFilter: 'type',
    fields: [code('Reference'), f('type', 'Type', 'select', { options: ['Leave', 'Expense claim', 'Purchase order', 'Payment voucher', 'Credit note'], filter: true }), f('requester', 'Requested by', 'person', { primary: true }), f('department', 'Department', 'select', { options: DEPARTMENTS, filter: true }), f('amount', 'Amount', 'currency', { min: 80, max: 48000 }), f('submitted', 'Submitted', 'date', { past: 14 }), f('due', 'Due by', 'date', { future: true }), f('priority', 'Priority', 'select', { options: ['Normal', 'High', 'Urgent'], filter: true }), status(['Pending', 'Approved', 'Rejected']), f('summary', 'Summary', 'textarea')] },

  { slug: 'countries', section: 'masters', group: 'Common', title: 'Country master', template: 'grid', entity: 'countries', quickFilter: 'region',
    fields: [f('code', 'ISO code', 'text', { required: true }), f('name', 'Country', 'text', { primary: true, required: true }), f('dialCode', 'Dial code'), f('currency', 'Currency'), f('region', 'Region', 'select', { options: ['Asia', 'Middle East', 'Europe', 'Americas', 'Africa', 'Oceania'], filter: true }), status()],
    seed: [['IN', 'India', '+91', 'INR', 'Asia'], ['AE', 'United Arab Emirates', '+971', 'AED', 'Middle East'], ['SG', 'Singapore', '+65', 'SGD', 'Asia'], ['GB', 'United Kingdom', '+44', 'GBP', 'Europe'], ['US', 'United States', '+1', 'USD', 'Americas'], ['CA', 'Canada', '+1', 'CAD', 'Americas'], ['AU', 'Australia', '+61', 'AUD', 'Oceania'], ['DE', 'Germany', '+49', 'EUR', 'Europe'], ['NL', 'Netherlands', '+31', 'EUR', 'Europe'], ['KE', 'Kenya', '+254', 'KES', 'Africa'], ['SA', 'Saudi Arabia', '+966', 'SAR', 'Middle East'], ['QA', 'Qatar', '+974', 'QAR', 'Middle East'], ['JP', 'Japan', '+81', 'JPY', 'Asia'], ['FR', 'France', '+33', 'EUR', 'Europe'], ['ZA', 'South Africa', '+27', 'ZAR', 'Africa'], ['BR', 'Brazil', '+55', 'BRL', 'Americas'], ['MY', 'Malaysia', '+60', 'MYR', 'Asia'], ['NZ', 'New Zealand', '+64', 'NZD', 'Oceania'], ['OM', 'Oman', '+968', 'OMR', 'Middle East'], ['LK', 'Sri Lanka', '+94', 'LKR', 'Asia'], ['NG', 'Nigeria', '+234', 'NGN', 'Africa'], ['IT', 'Italy', '+39', 'EUR', 'Europe'], ['MX', 'Mexico', '+52', 'MXN', 'Americas'], ['TH', 'Thailand', '+66', 'THB', 'Asia']]
      .map(([code, name, dialCode, currency, region], i) => ({ code, name, dialCode, currency, region, status: i === 19 ? 'Inactive' : 'Active' })) },
  { slug: 'states', section: 'masters', group: 'Common', title: 'State master', template: 'dependent', entity: 'states', parent: { key: 'country', entity: 'countries', label: 'Country' }, quickFilter: 'type',
    fields: [f('code', 'Code', 'text', { required: true }), f('name', 'State / province', 'text', { primary: true, required: true }), f('country', 'Country', 'ref', { ref: 'countries', filter: true }), f('type', 'Type', 'select', { options: ['State', 'Union territory', 'Province', 'Emirate', 'County', 'Territory'], filter: true }), f('gstCode', 'Tax region code'), status()],
    seed: [
      ...[['MH', 'Maharashtra'], ['KA', 'Karnataka'], ['TN', 'Tamil Nadu'], ['DL', 'Delhi', 'Union territory'], ['GJ', 'Gujarat'], ['KL', 'Kerala'], ['TG', 'Telangana'], ['WB', 'West Bengal'], ['RJ', 'Rajasthan'], ['UP', 'Uttar Pradesh'], ['PY', 'Puducherry', 'Union territory']].map(([c, n, t], i) => ({ code: c, name: n, country: 'India', type: t ?? 'State', gstCode: String(27 - i).padStart(2, '0') })),
      ...['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'].map((n, i) => ({ code: `AE-${n.slice(0, 2).toUpperCase()}`, name: n, country: 'United Arab Emirates', type: 'Emirate', gstCode: `E${i + 1}` })),
      ...[['CA', 'California'], ['TX', 'Texas'], ['NY', 'New York'], ['IL', 'Illinois'], ['WA', 'Washington'], ['FL', 'Florida']].map(([c, n]) => ({ code: c, name: n, country: 'United States', type: 'State', gstCode: c })),
      ...[['ON', 'Ontario'], ['BC', 'British Columbia'], ['QC', 'Quebec'], ['AB', 'Alberta']].map(([c, n]) => ({ code: c, name: n, country: 'Canada', type: 'Province', gstCode: c })),
      ...[['NSW', 'New South Wales'], ['VIC', 'Victoria'], ['QLD', 'Queensland'], ['WA', 'Western Australia']].map(([c, n]) => ({ code: c, name: n, country: 'Australia', type: 'State', gstCode: c })),
      ...[['ENG', 'England'], ['SCT', 'Scotland'], ['WLS', 'Wales']].map(([c, n]) => ({ code: c, name: n, country: 'United Kingdom', type: 'County', gstCode: c })),
      ...[['BY', 'Bavaria'], ['BE', 'Berlin'], ['HH', 'Hamburg']].map(([c, n]) => ({ code: c, name: n, country: 'Germany', type: 'State', gstCode: c })),
    ].map((r) => ({ ...r, status: 'Active' })) },
  { slug: 'currencies', section: 'masters', group: 'Common', title: 'Currency master', template: 'grid', entity: 'currencies',
    fields: [f('code', 'Code', 'text', { required: true }), f('name', 'Currency', 'text', { primary: true }), f('symbol', 'Symbol'), f('decimals', 'Decimals', 'number'), f('rate', 'Rate to USD', 'number'), status()],
    seed: [['USD', 'US Dollar', '$', 2, 1], ['INR', 'Indian Rupee', '₹', 2, 83.2], ['AED', 'UAE Dirham', 'AED', 2, 3.67], ['EUR', 'Euro', '€', 2, 0.92], ['GBP', 'Pound Sterling', '£', 2, 0.79], ['SGD', 'Singapore Dollar', 'S$', 2, 1.34], ['JPY', 'Japanese Yen', '¥', 0, 151.4], ['AUD', 'Australian Dollar', 'A$', 2, 1.52], ['CAD', 'Canadian Dollar', 'C$', 2, 1.36], ['SAR', 'Saudi Riyal', 'SAR', 2, 3.75], ['KES', 'Kenyan Shilling', 'KSh', 2, 129.5], ['CHF', 'Swiss Franc', 'CHF', 2, 0.88]]
      .map(([code, name, symbol, decimals, rate]) => ({ code, name, symbol, decimals, rate, status: 'Active' })) },
  { slug: 'units', section: 'masters', group: 'Common', title: 'Unit of measure', template: 'grid', entity: 'units', quickFilter: 'category',
    fields: [f('code', 'Code', 'text', { required: true }), f('name', 'Unit', 'text', { primary: true }), f('category', 'Category', 'select', { options: ['Count', 'Weight', 'Volume', 'Length', 'Time'], filter: true }), f('decimals', 'Decimals', 'number'), status()],
    seed: [['NOS', 'Numbers', 'Count', 0], ['BOX', 'Box', 'Count', 0], ['SET', 'Set', 'Count', 0], ['PR', 'Pair', 'Count', 0], ['KG', 'Kilogram', 'Weight', 3], ['G', 'Gram', 'Weight', 2], ['TON', 'Tonne', 'Weight', 3], ['L', 'Litre', 'Volume', 2], ['ML', 'Millilitre', 'Volume', 0], ['M', 'Metre', 'Length', 2], ['CM', 'Centimetre', 'Length', 1], ['FT', 'Feet', 'Length', 2], ['HR', 'Hour', 'Time', 2], ['DAY', 'Day', 'Time', 1]]
      .map(([code, name, category, decimals]) => ({ code, name, category, decimals, status: 'Active' })) },
  { slug: 'holidays', section: 'masters', group: 'Common', title: 'Holiday calendar', template: 'grid', entity: 'holidays', quickFilter: 'type',
    fields: [f('name', 'Holiday', 'text', { primary: true, pool: ['New Year', 'Republic Day', 'Holi', 'Good Friday', 'Eid al-Fitr', 'Labour Day', 'Independence Day', 'Ganesh Chaturthi', 'Gandhi Jayanti', 'Dussehra', 'Diwali', 'Guru Nanak Jayanti', 'Christmas', 'Company Foundation Day', 'Annual Offsite'] }), f('date', 'Date', 'date', { future: true }), f('type', 'Type', 'select', { options: ['Public', 'Optional', 'Company'], filter: true }), f('location', 'Applies to', 'select', { options: ['All locations', 'India', 'UAE', 'Head office'], filter: true }), status()] },

  { slug: 'org-structure', section: 'masters', group: 'Organisation', title: 'Organisation structure', template: 'tree', entity: 'org-structure',
    fields: [f('name', 'Name', 'text', { primary: true, required: true }), f('code', 'Code'), f('type', 'Type', 'select', { options: ['Company', 'Division', 'Department', 'Team'] }), f('head', 'Head', 'person'), f('headcount', 'Headcount', 'number', { min: 3, max: 120 }), f('costCenter', 'Cost center'), status()],
    tree: [{ name: 'Northwind Industries', children: [
      { name: 'Commercial', children: [{ name: 'Sales', children: [{ name: 'Enterprise Sales' }, { name: 'Channel Sales' }, { name: 'Inside Sales' }] }, { name: 'Marketing', children: [{ name: 'Brand' }, { name: 'Performance' }] }, { name: 'Customer Success' }] },
      { name: 'Operations', children: [{ name: 'Production', children: [{ name: 'Plant 1' }, { name: 'Plant 2' }] }, { name: 'Quality' }, { name: 'Warehouse & Logistics' }, { name: 'Procurement' }] },
      { name: 'Corporate', children: [{ name: 'Finance', children: [{ name: 'Accounts Payable' }, { name: 'Accounts Receivable' }, { name: 'Treasury' }] }, { name: 'Human Resources' }, { name: 'IT', children: [{ name: 'Infrastructure' }, { name: 'Applications' }] }, { name: 'Legal' }] },
    ] }] },
  { slug: 'departments', section: 'masters', group: 'Organisation', title: 'Department master', template: 'grid', entity: 'departments',
    fields: [code(), f('name', 'Department', 'text', { primary: true, pool: DEPARTMENTS }), f('head', 'Head', 'person'), f('costCenter', 'Cost center', 'select', { options: ['CC-100', 'CC-200', 'CC-300', 'CC-400'] }), f('headcount', 'Headcount', 'number', { min: 4, max: 90 }), status()], codePrefix: 'DEP' },
  { slug: 'chart-of-accounts', section: 'masters', group: 'Finance', title: 'Chart of accounts', template: 'tree', entity: 'chart-of-accounts',
    fields: [f('name', 'Account', 'text', { primary: true, required: true }), f('code', 'Account no.'), f('type', 'Type', 'select', { options: ['Group', 'Ledger'] }), f('nature', 'Nature', 'select', { options: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'] }), f('balance', 'Balance', 'currency', { min: 1000, max: 250000 }), f('currency', 'Currency', 'select', { options: ['USD', 'INR', 'AED', 'EUR'] }), status()],
    tree: [
      { name: 'Assets', children: [{ name: 'Current Assets', children: [{ name: 'Cash in Hand' }, { name: 'Petty Cash' }, { name: 'Bank Accounts', children: [{ name: 'HDFC Current A/c' }, { name: 'Citi Operating A/c' }] }, { name: 'Accounts Receivable' }, { name: 'Inventory' }] }, { name: 'Fixed Assets', children: [{ name: 'Plant & Machinery' }, { name: 'Vehicles' }, { name: 'Computers' }, { name: 'Furniture' }] }] },
      { name: 'Liabilities', children: [{ name: 'Current Liabilities', children: [{ name: 'Accounts Payable' }, { name: 'Output Tax Payable' }, { name: 'Salaries Payable' }] }, { name: 'Long-term Loans' }] },
      { name: 'Income', children: [{ name: 'Sales Revenue' }, { name: 'Service Income' }, { name: 'Other Income', children: [{ name: 'Interest Received' }, { name: 'Scrap Sales' }] }] },
      { name: 'Expenses', children: [{ name: 'Direct Expenses', children: [{ name: 'Purchase Account' }, { name: 'Freight Inward' }] }, { name: 'Indirect Expenses', children: [{ name: 'Salaries & Wages' }, { name: 'Office Rent' }, { name: 'Electricity' }, { name: 'Travel Expense' }, { name: 'Advertising' }] }] },
      { name: 'Equity', children: [{ name: 'Share Capital' }, { name: 'Retained Earnings' }] },
    ] },
  { slug: 'tax-rates', section: 'masters', group: 'Finance', title: 'Tax rates', template: 'rate', entity: 'tax-rates', codePrefix: 'TX', count: 22, quickFilter: 'category',
    fields: [code(), f('name', 'Tax', 'text', { primary: true, pool: ['GST 0%', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%', 'VAT 5%', 'VAT 15%', 'VAT 20%', 'Sales Tax 7%', 'Sales Tax 8.25%', 'TDS 1%', 'TDS 2%', 'TDS 10%', 'Withholding 5%', 'Customs Duty 7.5%', 'Cess 1%', 'Service Tax 15%', 'Excise 12%', 'Import VAT 5%', 'Green Levy 2%', 'Tourism Tax 3%', 'Digital Services 2%'] }), f('rate', 'Rate', 'percent', { min: 0, max: 28 }), f('category', 'Category', 'select', { options: ['GST', 'VAT', 'Sales tax', 'Withholding'], filter: true }), f('effectiveFrom', 'Effective from', 'date'), f('effectiveTo', 'Effective to', 'date', { future: true })] },

  { slug: 'customers', section: 'masters', group: 'Sales & purchase', title: 'Customer master', template: 'profile', entity: 'customers', codePrefix: 'CUS', count: 64, quickFilter: 'status',
    fields: [code('Customer no.'), f('name', 'Customer', 'company', { primary: true, required: true, group: 'General' }), f('group', 'Customer group', 'select', { options: ['Wholesale', 'Retail', 'Distributor', 'Government', 'Export'], filter: true, group: 'General', secondary: true }), f('salesperson', 'Account manager', 'person', { group: 'General' }), f('since', 'Customer since', 'date', { past: 900, group: 'General' }), f('contact', 'Primary contact', 'person', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }), f('phone', 'Phone', 'phone', { group: 'Contact' }), f('city', 'City', 'city', { filter: true, group: 'Address' }), f('country', 'Country', 'country', { filter: true, group: 'Address' }), f('address', 'Street address', 'textarea', { group: 'Address', list: false }), f('creditLimit', 'Credit limit', 'currency', { min: 5000, max: 200000, group: 'Commercial' }), f('outstanding', 'Outstanding', 'currency', { min: 0, max: 90000, group: 'Commercial' }), f('paymentTerms', 'Payment terms', 'select', { options: PAY_TERMS, filter: true, group: 'Commercial' }), f('taxId', 'Tax ID', 'text', { group: 'Commercial', list: false }), status(['Active', 'On hold', 'Inactive'])] },
  { slug: 'suppliers', section: 'masters', group: 'Sales & purchase', title: 'Supplier master', template: 'profile', entity: 'suppliers', codePrefix: 'SUP', count: 42,
    fields: [code('Supplier no.'), f('name', 'Supplier', 'company', { primary: true, required: true, group: 'General' }), f('category', 'Category', 'select', { options: ['Raw material', 'Packaging', 'Services', 'Logistics', 'Capital goods'], filter: true, group: 'General', secondary: true }), f('rating', 'Rating (1–5)', 'number', { min: 2, max: 5, group: 'General' }), f('leadTime', 'Lead time (days)', 'number', { min: 2, max: 45, group: 'General' }), f('contact', 'Contact person', 'person', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }), f('phone', 'Phone', 'phone', { group: 'Contact' }), f('city', 'City', 'city', { filter: true, group: 'Address' }), f('country', 'Country', 'country', { filter: true, group: 'Address' }), f('payable', 'Payable', 'currency', { min: 0, max: 60000, group: 'Banking' }), f('paymentTerms', 'Payment terms', 'select', { options: PAY_TERMS, group: 'Banking' }), f('bank', 'Bank', 'select', { options: ['HDFC Bank', 'Citibank', 'HSBC', 'Emirates NBD', 'Barclays'], group: 'Banking', list: false }), f('iban', 'Account / IBAN', 'text', { group: 'Banking', list: false }), status(['Active', 'Blocked', 'Inactive'])] },

  { slug: 'items', section: 'masters', group: 'Inventory', title: 'Item master', template: 'profile', entity: 'items', codePrefix: 'ITM', quickFilter: 'category',
    fields: [code('Item code'), f('name', 'Item', 'text', { primary: true, pool: PRODUCTS, group: 'General' }), f('category', 'Category', 'select', { options: ['Hardware', 'Electrical', 'Safety', 'Consumables', 'IT', 'Medical'], filter: true, group: 'General', secondary: true }), f('brand', 'Brand', 'select', { options: ['Apex', 'Voltra', 'SafeCo', 'Northwind', 'MediPlus'], filter: true, group: 'General' }), f('uom', 'Unit', 'select', { options: UOMS, group: 'General' }), f('hsn', 'HS code', 'text', { group: 'General', list: false }), f('purchasePrice', 'Purchase price', 'currency', { min: 5, max: 600, group: 'Pricing' }), f('salePrice', 'Sale price', 'currency', { min: 9, max: 900, group: 'Pricing' }), f('stock', 'In stock', 'number', { min: 0, max: 900, group: 'Stock' }), f('reorder', 'Reorder level', 'number', { min: 10, max: 150, group: 'Stock' }), f('warehouse', 'Default warehouse', 'select', { options: WAREHOUSES, filter: true, group: 'Stock' }), f('batchTracked', 'Batch tracked', 'boolean', { group: 'Stock' }), status(['Active', 'Inactive'])] },
  { slug: 'product-categories', section: 'masters', group: 'Inventory', title: 'Product categories', template: 'tree', entity: 'product-categories',
    fields: [f('name', 'Category', 'text', { primary: true, required: true }), f('code', 'Code'), f('items', 'Items', 'number', { min: 2, max: 60 }), f('margin', 'Target margin', 'percent', { min: 8, max: 45 }), f('taxCode', 'Default tax', 'select', { options: ['GST 5%', 'GST 12%', 'GST 18%', 'VAT 5%'] }), status()],
    tree: [
      { name: 'Hardware', children: [{ name: 'Fasteners', children: [{ name: 'Bolts' }, { name: 'Nuts & Washers' }, { name: 'Anchors' }] }, { name: 'Tools', children: [{ name: 'Power Tools' }, { name: 'Hand Tools' }] }, { name: 'Bearings' }] },
      { name: 'Electrical', children: [{ name: 'Cables & Wires' }, { name: 'Lighting' }, { name: 'Switchgear' }, { name: 'Energy', children: [{ name: 'Inverters' }, { name: 'Batteries' }] }] },
      { name: 'Safety', children: [{ name: 'Head Protection' }, { name: 'Hand Protection' }, { name: 'Fire Safety' }] },
      { name: 'Consumables', children: [{ name: 'Packaging' }, { name: 'Adhesives' }, { name: 'Labels' }] },
      { name: 'Medical', children: [{ name: 'Pharmaceuticals' }, { name: 'Diagnostics' }, { name: 'Disposables' }] },
    ] },
  { slug: 'price-lists', section: 'masters', group: 'Inventory', title: 'Price lists', template: 'rate', entity: 'price-lists', codePrefix: 'PL', count: 60, quickFilter: 'list',
    fields: [code(), f('item', 'Item', 'text', { primary: true, pool: PRODUCTS }), f('list', 'Price list', 'select', { options: ['Retail', 'Wholesale', 'Distributor', 'Export'], filter: true }), f('price', 'Price', 'currency', { min: 9, max: 900 }), f('minQty', 'Min qty', 'number', { min: 1, max: 100 }), f('effectiveFrom', 'Effective from', 'date'), f('effectiveTo', 'Effective to', 'date', { future: true })] },
  { slug: 'bill-of-materials', section: 'masters', group: 'Inventory', title: 'Bill of materials', template: 'structure', entity: 'bill-of-materials', codePrefix: 'BOM', quickFilter: 'status',
    fields: [code('BOM no.'), f('name', 'Product', 'text', { primary: true, pool: FINISHED }), f('version', 'Version', 'select', { options: ['v1', 'v2', 'v3'] }), f('outputQty', 'Output qty', 'number', { min: 1, max: 10 }), f('owner', 'Owner', 'person'), f('total', 'Material cost', 'currency', { readOnly: true }), status(['Active', 'Draft', 'Obsolete'])],
    lines: { label: 'Components', fields: [f('item', 'Component', 'text', { pool: RAW }), f('qty', 'Qty', 'number', { min: 1, max: 12 }), f('uom', 'Unit', 'select', { options: UOMS }), f('rate', 'Unit cost', 'currency', { min: 2, max: 140 }), f('amount', 'Amount', 'currency', { readOnly: true })], min: 3, max: 8 } },

  { slug: 'employees', section: 'masters', group: 'People', title: 'Employee master', template: 'profile', entity: 'employees', codePrefix: 'EMP', count: 72, quickFilter: 'department',
    fields: [code('Employee ID'), f('name', 'Employee', 'person', { primary: true, required: true, group: 'General' }), f('designation', 'Designation', 'select', { options: DESIGNATIONS, group: 'General', secondary: true }), f('department', 'Department', 'select', { options: DEPARTMENTS, filter: true, group: 'General' }), f('manager', 'Reports to', 'person', { group: 'General' }), f('joined', 'Date of joining', 'date', { past: 1400, group: 'General' }), f('type', 'Employment type', 'select', { options: ['Full-time', 'Contract', 'Intern'], filter: true, group: 'General' }), f('email', 'Work email', 'email', { group: 'Contact' }), f('phone', 'Mobile', 'phone', { group: 'Contact' }), f('location', 'Location', 'city', { filter: true, group: 'Contact' }), f('salary', 'Monthly CTC', 'currency', { min: 1800, max: 14000, group: 'Payroll' }), f('bank', 'Salary bank', 'select', { options: ['HDFC Bank', 'Citibank', 'HSBC'], group: 'Payroll', list: false }), f('account', 'Account no.', 'text', { group: 'Payroll', list: false }), status(['Active', 'On leave', 'Probation', 'Exited'])] },
  { slug: 'leave-types', section: 'masters', group: 'People', title: 'Leave types', template: 'grid', entity: 'leave-types', codePrefix: 'LT',
    fields: [code(), f('name', 'Leave type', 'text', { primary: true, pool: ['Annual leave', 'Sick leave', 'Casual leave', 'Maternity leave', 'Paternity leave', 'Bereavement leave', 'Comp off', 'Loss of pay', 'Study leave'] }), f('days', 'Days / year', 'number', { min: 2, max: 30 }), f('carryForward', 'Carry forward', 'boolean'), f('paid', 'Paid', 'boolean'), status()] },
  { slug: 'shifts', section: 'masters', group: 'People', title: 'Shift master', template: 'grid', entity: 'shifts', codePrefix: 'SH',
    fields: [code(), f('name', 'Shift', 'text', { primary: true, pool: ['General', 'Morning', 'Evening', 'Night', 'Weekend', 'Split'] }), f('start', 'Starts', 'time'), f('end', 'Ends', 'time'), f('grace', 'Grace (min)', 'number', { min: 5, max: 20 }), status()] },
  { slug: 'salary-structures', section: 'masters', group: 'People', title: 'Salary structures', template: 'structure', entity: 'salary-structures', codePrefix: 'SS', count: 8,
    fields: [code(), f('name', 'Structure', 'text', { primary: true, pool: ['Staff grade A', 'Staff grade B', 'Management M1', 'Management M2', 'Sales incentive plan', 'Plant workforce', 'Contract staff', 'Interns'] }), f('grade', 'Grade', 'select', { options: ['A', 'B', 'M1', 'M2', 'S', 'P', 'C', 'I'] }), f('currency', 'Currency', 'select', { options: ['USD', 'INR', 'AED'] }), f('total', 'Monthly gross', 'currency', { readOnly: true }), status(['Active', 'Draft'])],
    lines: { label: 'Components', fields: [f('item', 'Component', 'text', { pool: ['Basic', 'House rent allowance', 'Special allowance', 'Conveyance', 'Medical allowance', 'Performance bonus', 'Provident fund', 'Professional tax'] }), f('kind', 'Type', 'select', { options: ['Earning', 'Deduction'] }), f('qty', 'Factor', 'number', { min: 1, max: 1 }), f('rate', 'Monthly', 'currency', { min: 50, max: 2400 }), f('amount', 'Amount', 'currency', { readOnly: true })], min: 4, max: 7 } },

  { slug: 'patients', section: 'masters', group: 'Healthcare', title: 'Patient master', template: 'profile', entity: 'patients', codePrefix: 'MRN', count: 80, quickFilter: 'status',
    fields: [code('MRN'), f('name', 'Patient', 'person', { primary: true, required: true, group: 'General' }), f('gender', 'Gender', 'select', { options: ['Female', 'Male', 'Other'], filter: true, group: 'General', secondary: true }), f('age', 'Age', 'number', { min: 2, max: 88, group: 'General' }), f('bloodGroup', 'Blood group', 'select', { options: ['A+', 'A−', 'B+', 'B−', 'O+', 'O−', 'AB+', 'AB−'], filter: true, group: 'General' }), f('doctor', 'Primary doctor', 'select', { options: DOCTORS, filter: true, group: 'General' }), f('lastVisit', 'Last visit', 'date', { past: 120, group: 'General' }), f('phone', 'Phone', 'phone', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }), f('city', 'City', 'city', { group: 'Contact' }), f('emergencyContact', 'Emergency contact', 'person', { group: 'Contact', list: false }), f('insurer', 'Insurer', 'select', { options: ['Self pay', 'Aetna', 'Allianz Care', 'Star Health', 'Daman', 'Bupa'], filter: true, group: 'Insurance' }), f('policyNo', 'Policy no.', 'text', { group: 'Insurance', list: false }), f('balance', 'Balance due', 'currency', { min: 0, max: 4000, group: 'Insurance' }), f('allergies', 'Allergies / alerts', 'textarea', { group: 'Clinical', list: false }), status(['Active', 'Admitted', 'Discharged', 'Inactive'])] },
  { slug: 'doctors', section: 'masters', group: 'Healthcare', title: 'Doctor master', template: 'profile', entity: 'doctors', codePrefix: 'DR', count: 24, quickFilter: 'speciality',
    fields: [code('Doctor ID'), f('name', 'Doctor', 'person', { primary: true, group: 'General' }), f('speciality', 'Speciality', 'select', { options: ['Cardiology', 'Orthopaedics', 'Paediatrics', 'General Medicine', 'Dermatology', 'ENT'], filter: true, group: 'General', secondary: true }), f('qualification', 'Qualification', 'select', { options: ['MBBS, MD', 'MBBS, MS', 'MBBS, DNB', 'MBBS, DM'], group: 'General' }), f('experience', 'Experience (yrs)', 'number', { min: 3, max: 32, group: 'General' }), f('phone', 'Phone', 'phone', { group: 'Contact' }), f('email', 'Email', 'email', { group: 'Contact' }), f('fee', 'Consultation fee', 'currency', { min: 30, max: 180, group: 'Schedule' }), f('days', 'OPD days', 'select', { options: ['Mon–Fri', 'Mon, Wed, Fri', 'Tue, Thu, Sat', 'Weekends'], group: 'Schedule' }), status(['Active', 'On leave', 'Inactive'])] },
  { slug: 'lab-tests', section: 'masters', group: 'Healthcare', title: 'Lab test master', template: 'grid', entity: 'lab-tests', codePrefix: 'LAB', quickFilter: 'sample',
    fields: [code(), f('name', 'Test', 'text', { primary: true, pool: LAB_TESTS }), f('sample', 'Sample', 'select', { options: ['Blood', 'Urine', 'Imaging', 'Swab'], filter: true }), f('tat', 'Turnaround (hrs)', 'number', { min: 2, max: 72 }), f('price', 'Price', 'currency', { min: 8, max: 420 }), status()] },
  { slug: 'consultation-fees', section: 'masters', group: 'Healthcare', title: 'Consultation fees', template: 'rate', entity: 'consultation-fees', codePrefix: 'FEE', count: 30, quickFilter: 'visitType',
    fields: [code(), f('doctor', 'Doctor', 'select', { options: DOCTORS, primary: true, filter: true }), f('visitType', 'Visit type', 'select', { options: ['New', 'Follow-up', 'Teleconsult', 'Emergency'], filter: true }), f('fee', 'Fee', 'currency', { min: 20, max: 200 }), f('effectiveFrom', 'Effective from', 'date'), f('effectiveTo', 'Effective to', 'date', { future: true })] },

  { slug: 'students', section: 'masters', group: 'Education', title: 'Student master', template: 'profile', entity: 'students', codePrefix: 'ADM', count: 60, quickFilter: 'grade',
    fields: [code('Admission no.'), f('name', 'Student', 'person', { primary: true, group: 'General' }), f('program', 'Program', 'select', { options: PROGRAMS, filter: true, group: 'General', secondary: true }), f('grade', 'Grade', 'select', { options: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'], filter: true, group: 'General' }), f('section', 'Section', 'select', { options: ['A', 'B', 'C'], group: 'General' }), f('guardian', 'Guardian', 'person', { group: 'Guardian' }), f('phone', 'Guardian phone', 'phone', { group: 'Guardian' }), f('email', 'Guardian email', 'email', { group: 'Guardian' }), f('feeDue', 'Fee due', 'currency', { min: 0, max: 2400, group: 'Academics' }), f('attendance', 'Attendance', 'percent', { min: 71, max: 99, group: 'Academics' }), status(['Active', 'On leave', 'Inactive'])] },
  { slug: 'fee-structures', section: 'masters', group: 'Education', title: 'Fee structures', template: 'structure', entity: 'fee-structures', codePrefix: 'FS', count: 10,
    fields: [code(), f('name', 'Structure', 'text', { primary: true, pool: ['Grade 9 Science', 'Grade 10 Science', 'Grade 11 Commerce', 'Grade 12 Commerce', 'Grade 11 Humanities', 'Grade 12 Computer Science', 'Grade 9 General', 'Grade 10 General', 'Hostel boarders', 'Day scholars'] }), f('term', 'Term', 'select', { options: ['Term 1', 'Term 2', 'Annual'] }), f('total', 'Total fee', 'currency', { readOnly: true }), status(['Active', 'Draft'])],
    lines: { label: 'Fee heads', fields: [f('item', 'Fee head', 'text', { pool: ['Tuition', 'Laboratory', 'Library', 'Transport', 'Examination', 'Sports', 'Technology', 'Activity'] }), f('frequency', 'Frequency', 'select', { options: ['Monthly', 'Termly', 'Annual'] }), f('qty', 'Instalments', 'number', { min: 1, max: 3 }), f('rate', 'Amount', 'currency', { min: 40, max: 900 }), f('amount', 'Total', 'currency', { readOnly: true })], min: 4, max: 7 } },
  { slug: 'vehicles', section: 'masters', group: 'Fleet & assets', title: 'Vehicle master', template: 'profile', entity: 'vehicles', codePrefix: 'VEH', quickFilter: 'type',
    fields: [code('Asset no.'), f('name', 'Vehicle', 'text', { primary: true, pool: VEHICLES, group: 'General' }), f('type', 'Type', 'select', { options: ['Light truck', 'Pickup', 'Van', 'Heavy truck', 'Bus'], filter: true, group: 'General', secondary: true }), f('regNo', 'Registration', 'text', { group: 'General' }), f('fuel', 'Fuel', 'select', { options: ['Diesel', 'Petrol', 'CNG', 'Electric'], filter: true, group: 'General' }), f('driver', 'Assigned driver', 'person', { group: 'Operations' }), f('capacity', 'Capacity (kg)', 'number', { min: 600, max: 12000, group: 'Operations' }), f('odometer', 'Odometer (km)', 'number', { min: 4000, max: 240000, group: 'Operations' }), f('insuranceExpiry', 'Insurance expiry', 'date', { future: true, group: 'Compliance' }), f('permitExpiry', 'Permit expiry', 'date', { future: true, group: 'Compliance' }), status(['Active', 'In service', 'Inactive'])] },

  { slug: 'sales-orders', section: 'transactions', group: 'Sales', title: 'Sales orders', template: 'document', entity: 'sales-orders', codePrefix: 'SO', count: 86, statusFlow: ['Draft', 'Submitted', 'Approved', 'Delivered'],
    fields: [code('Order no.'), f('customer', 'Customer', 'ref', { ref: 'customers', primary: true, filter: true, required: true }), f('date', 'Order date', 'date', { past: 90 }), f('deliveryDate', 'Delivery date', 'date', { future: true }), f('salesperson', 'Salesperson', 'person', { filter: true }), f('warehouse', 'Warehouse', 'select', { options: WAREHOUSES, filter: true }), f('paymentTerms', 'Payment terms', 'select', { options: PAY_TERMS, list: false }), f('total', 'Total', 'currency', { readOnly: true }), status(['Draft', 'Submitted', 'Approved', 'Delivered', 'Cancelled'])],
    lines: { fields: itemLines, min: 1, max: 6 } },
  { slug: 'sales-invoices', section: 'transactions', group: 'Sales', title: 'Sales invoices', template: 'document', entity: 'sales-invoices', codePrefix: 'INV', count: 110, statusFlow: ['Draft', 'Unpaid', 'Paid'],
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', primary: true, filter: true, required: true }), f('date', 'Invoice date', 'date', { past: 150 }), f('dueDate', 'Due date', 'date', { future: true }), f('orderRef', 'Order ref.', 'text', { list: false }), f('salesperson', 'Salesperson', 'person', { filter: true }), f('total', 'Total', 'currency', { readOnly: true }), status(['Draft', 'Unpaid', 'Partially paid', 'Paid', 'Overdue'])],
    lines: { fields: itemLines, min: 1, max: 6 } },
  { slug: 'purchase-orders', section: 'transactions', group: 'Purchase', title: 'Purchase orders', template: 'document', entity: 'purchase-orders', codePrefix: 'PO', count: 70, statusFlow: ['Draft', 'Submitted', 'Approved', 'Received'],
    fields: [code('PO no.'), f('supplier', 'Supplier', 'ref', { ref: 'suppliers', primary: true, filter: true, required: true }), f('date', 'PO date', 'date', { past: 90 }), f('expected', 'Expected by', 'date', { future: true }), f('buyer', 'Buyer', 'person', { filter: true }), f('warehouse', 'Ship to', 'select', { options: WAREHOUSES, filter: true }), f('total', 'Total', 'currency', { readOnly: true }), status(['Draft', 'Submitted', 'Approved', 'Received', 'Cancelled'])],
    lines: { fields: itemLines, min: 1, max: 7 } },
  { slug: 'goods-receipts', section: 'transactions', group: 'Purchase', title: 'Goods receipts', template: 'document', entity: 'goods-receipts', codePrefix: 'GRN', count: 58, statusFlow: ['Draft', 'Inspected', 'Received'],
    fields: [code('GRN no.'), f('supplier', 'Supplier', 'ref', { ref: 'suppliers', primary: true, filter: true }), f('date', 'Received on', 'date', { past: 60 }), f('poRef', 'PO ref.', 'text'), f('warehouse', 'Warehouse', 'select', { options: WAREHOUSES, filter: true }), f('receivedBy', 'Received by', 'person'), f('total', 'Value', 'currency', { readOnly: true }), status(['Draft', 'Inspected', 'Received', 'Rejected'])],
    lines: { fields: itemLines, min: 1, max: 5 } },
  { slug: 'journal-vouchers', section: 'transactions', group: 'Finance', title: 'Journal vouchers', template: 'voucher', entity: 'journal-vouchers', codePrefix: 'JV', count: 64, statusFlow: ['Draft', 'Posted'],
    fields: [code('Voucher no.'), f('date', 'Date', 'date', { past: 60 }), f('reference', 'Reference', 'text', { primary: true, pool: ['Month-end accrual', 'Depreciation entry', 'Salary provision', 'Rent prepaid', 'Bank charges', 'Inter-branch transfer', 'Opening adjustment', 'Tax reclassification', 'Bad debt write-off', 'Insurance amortisation'] }), f('branch', 'Branch', 'select', { options: ['Head office', 'Mumbai', 'Dubai'], filter: true }), f('preparedBy', 'Prepared by', 'person'), f('total', 'Amount', 'currency', { readOnly: true }), f('narration', 'Narration', 'textarea', { list: false }), status(['Draft', 'Posted', 'Reversed'])],
    lines: { fields: [f('account', 'Account', 'text', { pool: ACCOUNTS }), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency'), f('note', 'Line note')] } },
  { slug: 'payment-vouchers', section: 'transactions', group: 'Finance', title: 'Payment vouchers', template: 'voucher', entity: 'payment-vouchers', codePrefix: 'PV', count: 54, statusFlow: ['Draft', 'Approved', 'Posted'],
    fields: [code('Voucher no.'), f('date', 'Date', 'date', { past: 60 }), f('payee', 'Payee', 'company', { primary: true }), f('mode', 'Mode', 'select', { options: ['Bank transfer', 'Cheque', 'Cash', 'Card'], filter: true }), f('bank', 'Paid from', 'select', { options: ['HDFC Current A/c', 'Citi Operating A/c', 'Cash in Hand'], filter: true }), f('total', 'Amount', 'currency', { readOnly: true }), f('narration', 'Narration', 'textarea', { list: false }), status(['Draft', 'Approved', 'Posted', 'Reversed'])],
    lines: { fields: [f('account', 'Account', 'text', { pool: ACCOUNTS }), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency'), f('note', 'Line note')] } },
  { slug: 'petty-cash', section: 'transactions', group: 'Finance', title: 'Petty cash vouchers', template: 'voucher', entity: 'petty-cash', codePrefix: 'PC', count: 48, statusFlow: ['Draft', 'Posted'],
    fields: [code('Voucher no.'), f('date', 'Date', 'date', { past: 45 }), f('custodian', 'Custodian', 'person', { primary: true }), f('branch', 'Branch', 'select', { options: ['Head office', 'Mumbai', 'Dubai'], filter: true }), f('total', 'Amount', 'currency', { readOnly: true }), f('narration', 'Narration', 'textarea', { list: false }), status(['Draft', 'Posted'])],
    lines: { fields: [f('account', 'Account', 'text', { pool: ['Printing & Stationery', 'Staff Welfare', 'Travel Expense', 'Repairs & Maintenance', 'Telephone & Internet', 'Petty Cash'] }), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency'), f('note', 'Line note')] } },
  { slug: 'leave-requests', section: 'transactions', group: 'People', title: 'Leave requests', template: 'request', entity: 'leave-requests', codePrefix: 'LV', count: 52, steps: ['Submitted', 'Reporting manager', 'HR review'],
    balances: [{ label: 'Annual leave', total: 21, used: 9 }, { label: 'Sick leave', total: 10, used: 3 }, { label: 'Casual leave', total: 7, used: 5 }, { label: 'Comp off', total: 3, used: 1 }],
    fields: [code('Request no.'), f('employee', 'Employee', 'person', { primary: true }), f('leaveType', 'Leave type', 'select', { options: ['Annual leave', 'Sick leave', 'Casual leave', 'Comp off'], filter: true, required: true }), f('from', 'From', 'date', { future: true, required: true }), f('to', 'To', 'date', { future: true, required: true }), f('days', 'Days', 'number', { readOnly: true }), f('reason', 'Reason', 'textarea', { list: false }), status(['Pending', 'Approved', 'Rejected', 'Withdrawn'])] },
  { slug: 'expense-claims', section: 'transactions', group: 'People', title: 'Expense claims', template: 'request', entity: 'expense-claims', codePrefix: 'EXP', count: 58, steps: ['Submitted', 'Manager', 'Finance', 'Paid'],
    balances: [{ label: 'Travel budget', total: 3000, used: 1840 }, { label: 'Meals budget', total: 600, used: 212 }, { label: 'Training budget', total: 1500, used: 450 }],
    fields: [code('Claim no.'), f('employee', 'Employee', 'person', { primary: true }), f('category', 'Category', 'select', { options: ['Travel', 'Meals', 'Accommodation', 'Training', 'Office supplies'], filter: true, required: true }), f('date', 'Expense date', 'date', { past: 45, required: true }), f('amount', 'Amount', 'currency', { min: 12, max: 1400, required: true }), f('project', 'Project', 'select', { options: ['Internal', 'Client onboarding', 'Plant expansion', 'ERP rollout'], filter: true }), f('reason', 'Description', 'textarea', { list: false }), status(['Pending', 'Approved', 'Rejected', 'Paid'])] },
  { slug: 'attendance', section: 'transactions', group: 'People', title: 'Attendance register', template: 'matrix', entity: 'attendance', count: 28, matrix: { kind: 'attendance', values: ['P', 'A', 'L', 'H', 'WO'] },
    fields: [code('Emp ID'), f('name', 'Employee', 'person', { primary: true }), f('department', 'Department', 'select', { options: DEPARTMENTS })], codePrefix: 'EMP' },
  { slug: 'timesheets', section: 'transactions', group: 'People', title: 'Timesheets', template: 'matrix', entity: 'timesheets', count: 22, matrix: { kind: 'hours' },
    fields: [code('Emp ID'), f('name', 'Employee', 'person', { primary: true }), f('project', 'Project', 'select', { options: ['Internal', 'Client onboarding', 'Plant expansion', 'ERP rollout'] })], codePrefix: 'EMP' },
  { slug: 'payroll-run', section: 'transactions', group: 'People', title: 'Payroll run', template: 'process', entity: 'payroll-run', codePrefix: 'PR', count: 14, steps: ['Validate attendance', 'Calculate earnings', 'Apply deductions', 'Generate payslips', 'Post to accounts'],
    params: [f('period', 'Pay period', 'select', { options: ['September 2026', 'August 2026', 'July 2026'] }), f('branch', 'Branch', 'select', { options: ['All branches', 'Head office', 'Mumbai', 'Dubai'] }), f('payDate', 'Pay date', 'date', { future: true }), f('arrears', 'Include arrears', 'boolean')],
    fields: [code('Run no.'), f('period', 'Period', 'select', { options: ['August 2026', 'July 2026', 'June 2026', 'May 2026', 'April 2026', 'March 2026'], primary: true }), f('branch', 'Branch', 'select', { options: ['All branches', 'Head office', 'Mumbai', 'Dubai'], filter: true }), f('employees', 'Employees', 'number', { min: 60, max: 240 }), f('gross', 'Gross', 'currency', { min: 180000, max: 620000 }), f('net', 'Net pay', 'currency', { min: 150000, max: 520000 }), f('runAt', 'Run on', 'date', { past: 200 }), f('runBy', 'Run by', 'person'), status(['Completed', 'Failed'])] },
  { slug: 'depreciation-run', section: 'transactions', group: 'Finance', title: 'Depreciation run', template: 'process', entity: 'depreciation-run', codePrefix: 'DEP', count: 10, steps: ['Load asset register', 'Compute depreciation', 'Review exceptions', 'Post journal'],
    params: [f('period', 'Period', 'select', { options: ['September 2026', 'August 2026'] }), f('method', 'Method', 'select', { options: ['Straight line', 'Written down value'] }), f('assetClass', 'Asset class', 'select', { options: ['All classes', 'Plant & Machinery', 'Vehicles', 'Computers'] }), f('postJournal', 'Post journal automatically', 'boolean')],
    fields: [code('Run no.'), f('period', 'Period', 'select', { options: ['August 2026', 'July 2026', 'June 2026', 'May 2026'], primary: true }), f('assetClass', 'Asset class', 'select', { options: ['All classes', 'Plant & Machinery', 'Vehicles', 'Computers'], filter: true }), f('employees', 'Assets', 'number', { min: 90, max: 420 }), f('gross', 'Depreciation', 'currency', { min: 9000, max: 60000 }), f('runAt', 'Run on', 'date', { past: 150 }), f('runBy', 'Run by', 'person'), status(['Completed', 'Failed'])] },
  { slug: 'appointments', section: 'transactions', group: 'Healthcare', title: 'Appointments', template: 'booking', entity: 'appointments', codePrefix: 'TKN', count: 140, resources: DOCTORS,
    fields: [code('Token'), f('person', 'Patient', 'person', { primary: true, required: true }), f('resource', 'Doctor', 'select', { options: DOCTORS, filter: true, required: true }), f('date', 'Date', 'date', { required: true }), f('start', 'Time', 'time', { required: true }), f('duration', 'Minutes', 'number', { options: ['30', '60'] }), f('type', 'Visit type', 'select', { options: ['New', 'Follow-up', 'Teleconsult', 'Procedure'], filter: true }), f('phone', 'Phone', 'phone'), status(['Booked', 'Checked in', 'Completed', 'No show', 'Cancelled'])] },
  { slug: 'room-bookings', section: 'transactions', group: 'Admin', title: 'Meeting rooms', template: 'booking', entity: 'room-bookings', codePrefix: 'BK', count: 90, resources: ROOMS,
    fields: [code('Booking'), f('person', 'Booked by', 'person', { primary: true }), f('resource', 'Room', 'select', { options: ROOMS, filter: true, required: true }), f('date', 'Date', 'date', { required: true }), f('start', 'Time', 'time', { required: true }), f('duration', 'Minutes', 'number'), f('type', 'Purpose', 'select', { options: ['Internal meeting', 'Client call', 'Interview', 'Training'], filter: true }), f('phone', 'Extension', 'phone', { list: false }), status(['Booked', 'Checked in', 'Completed', 'Cancelled'])] },
  { slug: 'quality-inspections', section: 'transactions', group: 'Operations', title: 'Quality inspections', template: 'checklist', entity: 'quality-inspections', codePrefix: 'QC', count: 48, quickFilter: 'status',
    checks: [{ parameter: 'Visual appearance', spec: 'No dents, scratches or rust' }, { parameter: 'Dimensions', spec: 'Within ±0.5 mm of drawing' }, { parameter: 'Weight', spec: 'Nominal ±2%' }, { parameter: 'Surface finish', spec: 'Ra ≤ 3.2 µm' }, { parameter: 'Packaging integrity', spec: 'Seals intact, labels legible' }, { parameter: 'Functional test', spec: 'Runs 10 min without fault' }, { parameter: 'Documentation', spec: 'CoC and batch report attached' }],
    fields: [code('Inspection no.'), f('item', 'Item', 'text', { primary: true, pool: PRODUCTS }), f('batch', 'Batch'), f('stage', 'Stage', 'select', { options: ['Incoming', 'In-process', 'Final'], filter: true }), f('date', 'Date', 'date', { past: 30 }), f('inspector', 'Inspector', 'person', { filter: true }), status(['Pending', 'Passed', 'Failed', 'On hold'])] },
  { slug: 'support-tickets', section: 'transactions', group: 'Service', title: 'Support tickets', template: 'case', entity: 'support-tickets', codePrefix: 'TKT', count: 64, statusFlow: ['New', 'Open', 'In progress', 'Waiting', 'Resolved'],
    fields: [code('Ticket'), f('subject', 'Subject', 'text', { primary: true, pool: TICKET_SUBJECTS }), f('customer', 'Customer', 'ref', { ref: 'customers', filter: true }), f('category', 'Category', 'select', { options: ['Billing', 'Delivery', 'Product', 'Account'], filter: true }), f('priority', 'Priority', 'select', { options: ['Normal', 'High', 'Low', 'Urgent'], filter: true }), f('assignee', 'Assignee', 'person', { filter: true }), f('created', 'Created', 'date', { past: 20 }), status(['New', 'Open', 'In progress', 'Waiting', 'Resolved'])] },
  { slug: 'maintenance-requests', section: 'transactions', group: 'Operations', title: 'Maintenance requests', template: 'case', entity: 'maintenance-requests', codePrefix: 'MR', count: 40, statusFlow: ['New', 'Scheduled', 'In progress', 'Done'],
    fields: [code('Request'), f('subject', 'Issue', 'text', { primary: true, pool: MAINT_SUBJECTS }), f('location', 'Location', 'select', { options: ['Plant 1', 'Plant 2', 'Main Warehouse', 'Head office'], filter: true }), f('category', 'Category', 'select', { options: ['Electrical', 'Mechanical', 'Civil', 'HVAC'], filter: true }), f('priority', 'Priority', 'select', { options: ['Normal', 'High', 'Low', 'Urgent'], filter: true }), f('assignee', 'Technician', 'person', { filter: true }), f('created', 'Reported', 'date', { past: 20 }), status(['New', 'Scheduled', 'In progress', 'Done'])] },
  { slug: 'marks-entry', section: 'transactions', group: 'Education', title: 'Marks entry', template: 'matrix', entity: 'marks-entry', count: 26, matrix: { kind: 'marks', columns: ['English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Sc.'] },
    fields: [code('Roll no.'), f('name', 'Student', 'person', { primary: true }), f('section', 'Section', 'select', { options: ['A', 'B'] })], codePrefix: 'R' },

  { slug: 'sales-register', section: 'reports', group: 'Sales', title: 'Sales register', template: 'report', entity: 'sales-invoices', view: true,
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', filter: true }), f('date', 'Invoice date', 'date', { filter: true }), f('dueDate', 'Due date', 'date'), f('salesperson', 'Salesperson', 'person', { filter: true }), f('total', 'Total', 'currency', { filter: true }), status(['Draft', 'Unpaid', 'Partially paid', 'Paid', 'Overdue'])] },
  { slug: 'purchase-register', section: 'reports', group: 'Purchase', title: 'Purchase register', template: 'report', entity: 'purchase-orders', view: true,
    fields: [code('PO no.'), f('supplier', 'Supplier', 'ref', { ref: 'suppliers', filter: true }), f('date', 'PO date', 'date', { filter: true }), f('buyer', 'Buyer', 'person', { filter: true }), f('warehouse', 'Ship to', 'select', { options: WAREHOUSES, filter: true }), f('total', 'Total', 'currency', { filter: true }), status(['Draft', 'Submitted', 'Approved', 'Received', 'Cancelled'])] },
  { slug: 'stock-summary', section: 'reports', group: 'Inventory', title: 'Stock summary', template: 'report', entity: 'stock-summary', quickFilter: 'warehouse',
    fields: [f('item', 'Item', 'text', { primary: true, pool: PRODUCTS }), f('category', 'Category', 'select', { options: ['Hardware', 'Electrical', 'Safety', 'Consumables', 'IT', 'Medical'], filter: true }), f('warehouse', 'Warehouse', 'select', { options: WAREHOUSES, filter: true }), f('opening', 'Opening', 'number', { min: 20, max: 500 }), f('inward', 'Inward', 'number', { min: 0, max: 300 }), f('outward', 'Outward', 'number', { min: 0, max: 300 }), f('closing', 'Closing', 'number'), f('value', 'Stock value', 'currency', { min: 400, max: 60000 })] },
  { slug: 'receivables-aging', section: 'reports', group: 'Finance', title: 'Receivables aging', template: 'report', entity: 'receivables-aging', codePrefix: 'INV', count: 70, quickFilter: 'bucket',
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', filter: true }), f('date', 'Invoice date', 'date', { past: 150 }), f('bucket', 'Age bucket', 'select', { options: ['0–30', '31–60', '61–90', '90+'], filter: true }), f('current', '0–30', 'currency'), f('d60', '31–60', 'currency'), f('d90', '61–90', 'currency'), f('d90p', '90+', 'currency'), f('total', 'Outstanding', 'currency')] },
  { slug: 'customer-ledger', section: 'reports', group: 'Finance', title: 'Customer ledger', template: 'ledger', entity: 'ledger-entries', codePrefix: 'VCH', count: 1100,
    fields: [code('Voucher'), f('date', 'Date', 'date', { past: 360 }), f('party', 'Customer', 'ref', { ref: 'customers', filter: true }), f('type', 'Type', 'select', { options: ['Invoice', 'Receipt', 'Credit note'] }), f('narration', 'Narration', 'textarea'), f('debit', 'Debit', 'currency'), f('credit', 'Credit', 'currency')] },
  { slug: 'invoice-print', section: 'reports', group: 'Documents', title: 'Invoice print', template: 'print', entity: 'sales-invoices', view: true,
    fields: [code('Invoice no.'), f('customer', 'Customer', 'ref', { ref: 'customers', primary: true }), f('date', 'Invoice date', 'date'), f('total', 'Total', 'currency'), status(['Draft', 'Unpaid', 'Partially paid', 'Paid', 'Overdue'])] },

  { slug: 'company-settings', section: 'setup', group: 'Company', title: 'Company settings', template: 'settings', entity: 'company-settings', fields: [],
    sections: [
      { title: 'Company profile', description: 'Shown on invoices, letters and the login page.', fields: [f('legalName', 'Legal name', 'text', { pool: ['Northwind Industries Pvt Ltd'] }), f('tradeName', 'Trade name', 'text', { pool: ['Northwind'] }), f('taxId', 'Tax registration no.', 'text', { pool: ['27AABCN1234F1Z5'] }), f('email', 'Billing email', 'email'), f('phone', 'Phone', 'phone'), f('website', 'Website', 'text', { pool: ['northwind.example'] })] },
      { title: 'Address', description: 'Registered office address.', fields: [f('address', 'Street', 'textarea', { pool: ['4th Floor, Harbor Point, Marine Drive'] }), f('city', 'City', 'city'), f('country', 'Country', 'country'), f('postcode', 'Postcode', 'text', { pool: ['400020'] })] },
      { title: 'Regional defaults', description: 'Used when a document does not specify its own.', fields: [f('currency', 'Base currency', 'select', { options: ['USD', 'INR', 'AED', 'EUR'] }), f('timezone', 'Time zone', 'select', { options: ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York'] }), f('dateFormat', 'Date format', 'select', { options: ['DD MMM YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] }), f('fiscalStart', 'Financial year starts', 'select', { options: ['January', 'April', 'July'] })] },
      { title: 'Documents', description: 'Defaults for sales and purchase documents.', fields: [f('paymentTerms', 'Default payment terms', 'select', { options: PAY_TERMS }), f('roundOff', 'Round off totals', 'boolean'), f('allowNegativeStock', 'Allow negative stock', 'boolean'), f('requireApproval', 'Require approval above', 'currency', { min: 5000, max: 5000 })] },
    ] },
  { slug: 'users', section: 'setup', group: 'Access', title: 'Users', template: 'grid', entity: 'users', codePrefix: 'USR', count: 36, quickFilter: 'role',
    fields: [f('name', 'Name', 'person', { primary: true }), f('email', 'Email', 'email'), f('role', 'Role', 'select', { options: ['Administrator', 'Accountant', 'Sales', 'Purchase', 'HR', 'Viewer'], filter: true }), f('branch', 'Branch', 'select', { options: ['Head office', 'Mumbai', 'Dubai'], filter: true }), f('lastLogin', 'Last sign-in', 'date', { past: 20 }), f('mfa', '2-step', 'boolean'), status(['Active', 'Disabled'])] },
  { slug: 'number-series', section: 'setup', group: 'Documents', title: 'Number series', template: 'grid', entity: 'number-series',
    fields: [f('document', 'Document', 'text', { primary: true }), f('prefix', 'Prefix'), f('next', 'Next number', 'number'), f('padding', 'Digits', 'number'), f('reset', 'Resets', 'select', { options: ['Never', 'Yearly', 'Monthly'] }), status()],
    seed: [['Sales order', 'SO-'], ['Sales invoice', 'INV-'], ['Purchase order', 'PO-'], ['Goods receipt', 'GRN-'], ['Journal voucher', 'JV-'], ['Payment voucher', 'PV-'], ['Petty cash', 'PC-'], ['Leave request', 'LV-'], ['Expense claim', 'EXP-'], ['Support ticket', 'TKT-']]
      .map(([document, prefix], i) => ({ document, prefix, next: 1000 + 37 * (i + 3), padding: 4, reset: i % 3 === 0 ? 'Yearly' : 'Never', status: 'Active' })) },
  { slug: 'notifications', section: 'setup', group: 'Company', title: 'Notification settings', template: 'settings', entity: 'notification-settings', fields: [],
    sections: [
      { title: 'Approvals', description: 'Tell approvers when something needs them.', fields: [f('approvalEmail', 'Email approvers', 'boolean'), f('approvalReminder', 'Reminder after (hours)', 'number', { min: 24, max: 24 }), f('escalateTo', 'Escalate to', 'select', { options: ['Department head', 'Finance controller', 'Nobody'] })] },
      { title: 'Finance', description: 'Collections and payables.', fields: [f('overdueDigest', 'Daily overdue digest', 'boolean'), f('paymentReceived', 'Payment received alert', 'boolean'), f('largePayment', 'Flag payments above', 'currency', { min: 10000, max: 10000 })] },
      { title: 'Inventory', description: 'Stock health alerts.', fields: [f('reorderAlert', 'Reorder level alert', 'boolean'), f('expiryDays', 'Batch expiry warning (days)', 'number', { min: 30, max: 30 }), f('stockDigest', 'Weekly stock digest', 'select', { options: ['Monday', 'Friday', 'Off'] })] },
    ] },
];

const ownerDef = (entity) => PAGES.find((p) => p.entity === entity && !p.view);

/* ───────────────────────── deterministic generator (src/lib/mock/store.ts) ───────────────────────── */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const int = (r, min, max) => Math.floor(r() * (max - min + 1)) + min;
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const weighted = (r, arr) => { const n = arr.length; const total = (n * (n + 1)) / 2; let x = r() * total; for (let i = 0; i < n; i++) { x -= n - i; if (x < 0) return arr[i]; } return arr[n - 1]; };
const shuffle = (r, arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const round2 = (n) => Math.round(n * 100) / 100;
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayOffset = (d) => { const t = new Date(); t.setDate(t.getDate() + d); return toISO(t); };
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
const CITY_COUNTRY = { Mumbai: 'India', Bengaluru: 'India', Chennai: 'India', Pune: 'India', Delhi: 'India', Hyderabad: 'India', Dubai: 'United Arab Emirates', 'Abu Dhabi': 'United Arab Emirates', Singapore: 'Singapore', London: 'United Kingdom', Manchester: 'United Kingdom', 'New York': 'United States', Chicago: 'United States', Austin: 'United States', Toronto: 'Canada', Sydney: 'Australia', Melbourne: 'Australia', Berlin: 'Germany', Rotterdam: 'Netherlands', Nairobi: 'Kenya' };
const digits = (r, n) => Array.from({ length: n }, () => int(r, 0, 9)).join('');
const TEXT_KEYS = {
  hsn: (r) => `${int(r, 39, 94)}${digits(r, 6)}`,
  taxId: (r) => `${int(r, 10, 36)}AA${String.fromCharCode(65 + int(r, 0, 25))}C${digits(r, 4)}${String.fromCharCode(65 + int(r, 0, 25))}1Z${int(r, 1, 9)}`,
  iban: (r) => `GB${int(r, 10, 99)} NWBK ${digits(r, 4)} ${digits(r, 4)} ${digits(r, 4)}`,
  account: (r) => `50200${digits(r, 9)}`,
  policyNo: (r) => `POL-${digits(r, 7)}`,
  orderRef: (r) => `SO-${int(r, 1001, 1086)}`,
  poRef: (r) => `PO-${int(r, 1001, 1070)}`,
  gstCode: (r) => digits(r, 2),
  version: (r) => `v${int(r, 1, 3)}`,
};
function personName(r) { return `${pick(r, FIRST)} ${pick(r, LAST)}`; }
function companyName(r) { return `${pick(r, CO_A)} ${pick(r, CO_B)} ${pick(r, CO_SUFFIX)}`; }
/** `tables` is threaded explicitly (not a module global) so this resolves correctly both while generating
    sibling entities and when validating a write outside of generation. */
function refNames(entity, tables) { const def = ownerDef(entity); if (!def) return []; const pf = def.fields.find((f) => f.primary) ?? def.fields.find((f) => f.key === 'name'); return tables.getRows(entity).map((r) => String(r[pf?.key ?? 'name'] ?? r.name)); }

function valueFor(f, r, row, def, tables) {
  if (f.pool) return f.primary ? undefined : pick(r, f.pool);
  switch (f.type) {
    case 'code': return undefined;
    case 'person': return personName(r);
    case 'company': return companyName(r);
    case 'email': { const base = Object.values(row).find((v) => typeof v === 'string' && /^[A-Z][a-z]+ [A-Z]/.test(v)); return `${slug(base ?? personName(r)).split('.').slice(0, 2).join('.')}@${pick(r, ['northwind.example', 'mail.example', 'corp.example'])}`; }
    case 'phone': return `+${pick(r, ['91', '971', '44', '1'])} ${int(r, 70, 99)}${int(r, 100, 999)} ${int(r, 10000, 99999)}`;
    case 'city': return pick(r, CITIES);
    case 'country': { const city = Object.values(row).find((v) => typeof v === 'string' && CITY_COUNTRY[v]); return city ? CITY_COUNTRY[city] : pick(r, COUNTRIES); }
    case 'date': if (f.future) return dayOffset(int(r, 1, 75)); return dayOffset(-int(r, 0, f.past ?? 180));
    case 'time': return `${String(int(r, 7, 18)).padStart(2, '0')}:${pick(r, ['00', '30'])}`;
    case 'number': case 'percent': if (f.options) return Number(pick(r, f.options)); if (f.min === undefined && f.max === undefined) return undefined; return int(r, f.min ?? 0, f.max ?? 100);
    case 'currency': if (f.min === undefined && f.max === undefined) return undefined; return round2((f.min ?? 0) + r() * ((f.max ?? 1000) - (f.min ?? 0)));
    case 'status': case 'select': return f.options ? weighted(r, f.options) : undefined;
    case 'boolean': return r() < 0.72;
    case 'ref': { const names = f.ref ? refNames(f.ref, tables) : []; return names.length ? pick(r, names) : undefined; }
    case 'textarea': if (f.key === 'address') return `${int(r, 2, 480)} ${pick(r, ['Harbor', 'Park', 'Station', 'Market', 'Industrial', 'Cedar', 'Lake'])} ${pick(r, ['Road', 'Street', 'Avenue', 'Estate', 'Boulevard'])}, ${pick(r, ['Block', 'Unit', 'Floor'])} ${int(r, 1, 12)}`; if (f.key === 'allergies') return pick(r, ['No known allergies', 'Penicillin', 'Peanuts, shellfish', 'Latex', 'Sulfa drugs', 'No known allergies']); return pick(r, SENTENCES);
    case 'text': if (TEXT_KEYS[f.key]) return TEXT_KEYS[f.key](r); return f.key === 'regNo' ? `${pick(r, ['MH', 'KA', 'DL', 'DXB'])} ${int(r, 10, 99)} ${String.fromCharCode(65 + int(r, 0, 25))}${String.fromCharCode(65 + int(r, 0, 25))} ${int(r, 1000, 9999)}` : f.key === 'batch' ? `B${int(r, 24, 26)}${String(int(r, 1, 999)).padStart(3, '0')}` : `${pick(r, WORDS)} ${int(r, 100, 999)}`;
    default: return undefined;
  }
}
function genLines(def, r, tables) {
  const lf = def.lines.fields;
  const n = int(r, def.lines.min ?? 1, def.lines.max ?? 5);
  if (def.template === 'voucher') {
    const accounts = shuffle(r, lf[0].pool ?? ['Account']);
    const debits = Array.from({ length: Math.max(1, n - 1 > 3 ? 3 : n - 1) }, () => round2(40 + r() * 4200));
    const total = round2(debits.reduce((a, b) => a + b, 0));
    const lines = debits.map((d, k) => ({ account: accounts[k % accounts.length], debit: d, credit: 0, note: pick(r, WORDS) }));
    lines.push({ account: accounts[debits.length % accounts.length], debit: 0, credit: total, note: 'Contra' });
    return { lines, total };
  }
  const lines = Array.from({ length: n }, () => {
    const line = {};
    lf.forEach((f) => { if (f.key === 'amount') return; line[f.key] = valueFor({ ...f, primary: false }, r, { id: '' }, def, tables); });
    const qty = Number(line.qty ?? 1); const rate = Number(line.rate ?? 0);
    line.amount = round2(qty * rate);
    return line;
  });
  let total = 0;
  lines.forEach((l) => { const amt = Number(l.amount); const tax = Number(l.tax ?? 0); const sign = l.kind === 'Deduction' ? -1 : 1; total += sign * amt * (1 + tax / 100); });
  return { lines, total: round2(total) };
}
function flattenTree(def, r, tables) {
  const out = []; let id = 0;
  const natureOf = { Assets: 'Asset', Liabilities: 'Liability', Income: 'Income', Expenses: 'Expense', Equity: 'Equity' };
  const walk = (nodes, parentId, level, prefix, root) => {
    nodes.forEach((n, k) => {
      id += 1; const rowId = String(id);
      const codeStr = level === 0 ? String((k + 1) * 1000) : `${prefix}.${k + 1}`;
      const rootName = level === 0 ? n.name : root;
      const row = { id: rowId, name: n.name, parentId, level, code: codeStr };
      def.fields.forEach((f) => {
        if (row[f.key] !== undefined) return;
        if (f.key === 'type' && f.options) row.type = f.options.includes('Group') ? (n.children?.length ? 'Group' : 'Ledger') : f.options[Math.min(level, f.options.length - 1)];
        else if (f.key === 'status') row.status = level > 1 && r() < 0.06 ? 'Inactive' : 'Active';
        else if (f.key === 'nature') row.nature = natureOf[rootName] ?? 'Asset';
        else row[f.key] = valueFor(f, r, row, def, tables);
      });
      if (row.status === undefined) row.status = 'Active';
      out.push(row);
      if (n.children) walk(n.children, rowId, level + 1, codeStr, rootName);
    });
  };
  walk(def.tree ?? [], null, 0, '', '');
  return out;
}
function weekStart(d) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; }
function matrixColumns(def, period) {
  const m = def.matrix;
  if (m.kind === 'marks') return m.columns ?? [];
  if (m.kind === 'hours') { const start = period ? new Date(`${period}T00:00:00`) : weekStart(new Date()); return Array.from({ length: 7 }, (_, k) => { const d = new Date(start); d.setDate(d.getDate() + k); return toISO(d); }); }
  const [y, mo] = (period ?? toISO(new Date()).slice(0, 7)).split('-').map(Number);
  const days = new Date(y, mo, 0).getDate();
  return Array.from({ length: days }, (_, k) => `${y}-${String(mo).padStart(2, '0')}-${String(k + 1).padStart(2, '0')}`);
}
function matrixCells(def, r, cols) {
  const kind = def.matrix.kind; const today = toISO(new Date());
  if (kind === 'marks') return cols.map(() => (r() < 0.06 ? null : int(r, 38, 99)));
  if (kind === 'hours') return cols.map((c) => { const wd = new Date(`${c}T00:00:00`).getDay(); if (c > today) return null; if (wd === 0 || wd === 6) return r() < 0.1 ? int(r, 2, 5) : 0; return pick(r, [6, 7, 7.5, 8, 8, 8, 8.5, 9]); });
  return cols.map((c) => { const wd = new Date(`${c}T00:00:00`).getDay(); if (wd === 0 || wd === 6) return 'WO'; if (c > today) return null; const x = r(); return x < 0.86 ? 'P' : x < 0.92 ? 'L' : x < 0.97 ? 'A' : 'H'; });
}
function placeBookings(def, rows, r) {
  const resources = def.resources ?? []; const taken = new Set(); const today = new Date();
  rows.forEach((row) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const d = new Date(today); d.setDate(d.getDate() + int(r, -4, 9));
      const iso = toISO(d); const res = pick(r, resources); const slot = int(r, 0, 19);
      const len = Number(row.duration) >= 60 ? 2 : 1;
      const keys = Array.from({ length: len }, (_, k) => `${iso}|${res}|${slot + k}`);
      if (keys.some((k) => taken.has(k)) || slot + len > 20) continue;
      keys.forEach((k) => taken.add(k));
      row.date = iso; row.resource = res;
      const mins = 8 * 60 + slot * 30; row.start = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      const isPast = iso < toISO(today);
      if (isPast) row.status = r() < 0.85 ? 'Completed' : row.status === 'Cancelled' ? 'Cancelled' : 'No show';
      else if (iso > toISO(today)) row.status = r() < 0.9 ? 'Booked' : 'Cancelled';
      else row.status = pick(r, ['Booked', 'Checked in', 'Completed']);
      return;
    }
  });
}
function generate(def, variant, tables) {
  const r = rng(hash(def.entity + (variant ?? '')));
  if (def.template === 'tree') return flattenTree(def, r, tables);
  if (def.template === 'settings') {
    const row = { id: '1' };
    (def.sections ?? []).flatMap((s) => s.fields).forEach((f) => {
      row[f.key] = f.pool ? f.pool[0] : f.type === 'boolean' ? r() < 0.7 : valueFor(f, r, row, def, tables);
      if (f.type === 'currency' || f.type === 'number') row[f.key] = f.min ?? row[f.key];
    });
    return [row];
  }
  const primary = def.fields.find((f) => f.primary);
  const primaryPool = primary?.pool ? shuffle(r, primary.pool) : undefined;
  let count = def.seed ? def.seed.length : def.count ?? 48;
  if (primaryPool && !def.seed && ['grid', 'profile', 'structure', 'dependent'].includes(def.template)) count = Math.min(count, primaryPool.length);
  const rows = [];
  for (let i = 0; i < count; i++) {
    const row = { id: String(i + 1), ...(def.seed?.[i] ?? {}) };
    if (primaryPool && row[primary.key] === undefined) row[primary.key] = primaryPool[i % primaryPool.length];
    def.fields.forEach((f) => { if (row[f.key] !== undefined) return; const v = valueFor(f, r, row, def, tables); if (v !== undefined) row[f.key] = v; });
    if (row.from && row.to) {
      const len = int(r, 0, 4); const d = new Date(`${row.from}T00:00:00`); d.setDate(d.getDate() + len); row.to = toISO(d); row.days = len + 1;
      if (r() < 0.35) { const back = int(r, 5, 60); const s = new Date(); s.setDate(s.getDate() - back); row.from = toISO(s); s.setDate(s.getDate() + len); row.to = toISO(s); }
    }
    if (def.template === 'rate' && row.effectiveFrom) {
      const x = r();
      if (x < 0.14) { row.effectiveFrom = dayOffset(-int(r, 200, 400)); row.effectiveTo = dayOffset(-int(r, 5, 120)); }
      else if (x < 0.26) { row.effectiveFrom = dayOffset(int(r, 5, 60)); row.effectiveTo = dayOffset(int(r, 120, 400)); }
      else row.effectiveTo = r() < 0.4 ? '' : dayOffset(int(r, 30, 365));
    }
    if (def.lines) { const { lines, total } = genLines(def, r, tables); row.lines = lines; row.total = total; }
    if (def.template === 'checklist') {
      row.checks = (def.checks ?? []).map((c) => { const x = row.status === 'Pending' ? r() * 2 : r(); const result = x < 0.82 ? 'Pass' : x < 0.92 ? 'Fail' : x < 1 ? 'NA' : ''; return { ...c, observed: result === 'Pass' ? 'Within spec' : result === 'Fail' ? 'Out of spec' : '', result: row.status === 'Pending' && r() < 0.5 ? '' : result, remarks: '' }; });
      const checks = row.checks;
      if (row.status === 'Passed') checks.forEach((c) => { if (c.result !== 'NA') { c.result = 'Pass'; c.observed = 'Within spec'; } });
      if (row.status === 'Failed' && !checks.some((c) => c.result === 'Fail')) { const c = checks[int(r, 0, checks.length - 1)]; c.result = 'Fail'; c.observed = 'Out of spec'; c.remarks = 'Rework required'; }
    }
    if (def.template === 'case') { const n = int(r, 1, 4); row.activity = Array.from({ length: n }, (_, k) => ({ at: dayOffset(-int(r, 0, 12) + k), by: personName(r), text: pick(r, ['Logged via customer portal.', 'Called customer, awaiting photos.', 'Assigned to field team.', 'Replacement approved by supervisor.', 'Parts ordered, ETA 2 days.', 'Customer confirmed the fix.']) })); }
    if (def.template === 'booking') row.duration = row.duration ?? pick(r, [30, 30, 60]);
    if (def.template === 'matrix') { const cols = matrixColumns(def, variant); row.columns = cols; row.cells = matrixCells(def, r, cols); }
    if (def.template === 'ledger') { const t = r(); const amt = round2(200 + r() * 9000); row.type = t < 0.58 ? 'Invoice' : t < 0.92 ? 'Receipt' : 'Credit note'; row.debit = row.type === 'Invoice' ? amt : 0; row.credit = row.type === 'Invoice' ? 0 : round2(amt * (row.type === 'Receipt' ? 1 : 0.2)); row.narration = row.type === 'Invoice' ? `Sales invoice INV-${int(r, 1000, 1999)}` : row.type === 'Receipt' ? `Receipt by ${pick(r, ['bank transfer', 'cheque', 'card'])}` : 'Credit note for returns'; }
    if (def.entity === 'stock-summary') { row.closing = Math.max(0, Number(row.opening) + Number(row.inward) - Number(row.outward)); row.value = round2(Number(row.closing) * (5 + r() * 120)); }
    if (def.entity === 'receivables-aging') { const amt = round2(300 + r() * 14000); const b = weighted(r, ['0–30', '31–60', '61–90', '90+']); row.bucket = b; row.current = b === '0–30' ? amt : 0; row.d60 = b === '31–60' ? amt : 0; row.d90 = b === '61–90' ? amt : 0; row.d90p = b === '90+' ? amt : 0; row.total = amt; row.date = dayOffset(-({ '0–30': int(r, 1, 30), '31–60': int(r, 31, 60), '61–90': int(r, 61, 90), '90+': int(r, 91, 200) }[b])); }
    if (def.entity === 'approvals') { if (row.type === 'Leave') { row.days = int(r, 1, 6); row.amount = 0; } row.summary = row.type === 'Leave' ? `${row.requester} (${row.department}) is asking for ${row.days} day${row.days > 1 ? 's' : ''} of annual leave. Cover has been arranged within the team.` : `${row.type} from ${row.requester} (${row.department}). ${pick(r, SENTENCES)}`; if (r() < 0.72) row.status = 'Pending'; }
    if (def.entity === 'tax-rates') { const m = String(row.name).match(/([\d.]+)%/); if (m) row.rate = Number(m[1]); row.category = /GST/.test(row.name) ? 'GST' : /VAT/.test(row.name) ? 'VAT' : /TDS|Withholding/.test(row.name) ? 'Withholding' : 'Sales tax'; }
    if (def.template === 'process') { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1 - i); row.period = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); const run = new Date(d.getFullYear(), d.getMonth() + 1, int(r, 1, 3)); row.runAt = toISO(run); if (row.gross) row.net = round2(Number(row.gross) * (0.78 + r() * 0.08)); if (i > 0 && r() < 0.12) row.status = 'Failed'; else row.status = 'Completed'; row.processEvents = buildProcessEventHistory(def, row); }
    if (def.entity === 'sales-invoices' && row.status === 'Overdue') row.dueDate = dayOffset(-int(r, 3, 40));
    rows.push(row);
  }
  if (def.template === 'booking') placeBookings(def, rows, r);
  const dateKey = def.fields.find((f) => f.type === 'date')?.key;
  const isTxn = ['document', 'voucher', 'request', 'case', 'checklist', 'inbox', 'process', 'report', 'ledger'].includes(def.template);
  if (dateKey && isTxn) rows.sort((a, b) => String(b[dateKey]).localeCompare(String(a[dateKey])));
  const codeField = def.fields.find((f) => f.type === 'code');
  if (codeField) { const prefix = def.codePrefix ?? def.entity.slice(0, 3).toUpperCase(); rows.forEach((row, k) => { if (row[codeField.key] === undefined) row[codeField.key] = `${prefix}-${String((isTxn ? rows.length - k : k + 1) + 1000)}`; }); }
  rows.forEach((row, k) => (row.id = String(k + 1)));
  return rows;
}

/* ───────────────────────── per-scope table store ───────────────────────── */
function createTables() {
  const tables = new Map();
  const seq = new Map();
  const self = {
    getRows(entity, variant) {
      const key = variant ? `${entity}@${variant}` : entity;
      let rows = tables.get(key);
      if (!rows) {
        const def = ownerDef(entity);
        rows = def ? generate(def, variant, self) : [];
        tables.set(key, rows);
      }
      return rows;
    },
    nextId(entity, variant) {
      const rows = self.getRows(entity, variant);
      const key = variant ? `${entity}@${variant}` : entity;
      const n = (seq.get(key) ?? rows.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0)) + 1;
      seq.set(key, n);
      return String(n);
    },
    nextCode(def) {
      const codeField = def.fields.find((f) => f.type === 'code');
      if (!codeField) return undefined;
      const rows = self.getRows(def.entity);
      const prefix = def.codePrefix ?? def.entity.slice(0, 3).toUpperCase();
      const max = rows.reduce((m, x) => { const n = Number(String(x[codeField.key] ?? '').split('-').pop()); return isNaN(n) ? m : Math.max(m, n); }, 1000);
      return `${prefix}-${max + 1}`;
    },
  };
  return self;
}

/* ───────────────────────── RBAC ───────────────────────── */
const FULL_ROLES = new Set(['admin', 'enterprise-admin', 'operations', 'operations-analyst']);
const FINANCE_ROLES = new Set(['finance', 'finance-manager', 'accountant']);
/** Entities whose page registry `group` is "Finance". Explicit allowlist — a finance role never inherits write
    access to entities outside it (e.g. sales-invoices stays under the Sales group, not Finance). */
const FINANCE_ENTITIES = new Set(['chart-of-accounts', 'tax-rates', 'journal-vouchers', 'payment-vouchers', 'petty-cash', 'depreciation-run', 'receivables-aging', 'ledger-entries']);
function roleAccess(user) {
  const role = String(user?.role ?? '');
  if (FULL_ROLES.has(role)) return { read: true, canWrite: () => true };
  if (FINANCE_ROLES.has(role)) {
    const grants = new Set(Array.isArray(user?.permissions) ? user.permissions.filter((p) => typeof p === 'string' && p.startsWith('erp:write:')).map((p) => p.slice('erp:write:'.length)) : []);
    return { read: true, canWrite: (entity) => FINANCE_ENTITIES.has(entity) || grants.has(entity) };
  }
  return null;
}

/* ───────────────────────── request helpers ───────────────────────── */
const fail = (status, error, extra) => ({ status, body: { error, ...(extra ? extra : {}) } });
function toParams(query) {
  if (query instanceof URLSearchParams) return query;
  if (query == null) return new URLSearchParams();
  if (typeof query === 'string') return new URLSearchParams(query);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) { if (Array.isArray(v)) for (const x of v) sp.append(k, String(x)); else if (v !== undefined && v !== null) sp.set(k, String(v)); }
  return sp;
}
function normalizePath(path) {
  let p = String(path ?? '');
  if (p === '/api' || p === '') p = '/';
  else if (p.startsWith('/api/')) p = p.slice(4);
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}
function validateScopeIdentity(user, scope) {
  if (!user || typeof user.id !== 'string' || !user.id) return fail(400, 'erp.invalidUser');
  if (typeof user.tenantId !== 'string' || !user.tenantId) return fail(400, 'erp.invalidTenant');
  if (typeof user.branch !== 'string' || !user.branch) return fail(400, 'erp.invalidUserBranch');
  if (!scope || typeof scope.applicationId !== 'string' || !scope.applicationId) return fail(400, 'erp.invalidApplication');
  if (typeof scope.branchId !== 'string' || !scope.branchId) return fail(400, 'erp.invalidBranch');
  if (scope.branchId !== user.branch) return fail(403, 'erp.branchMismatch');
  return null;
}

/* ───────────────────────── list query semantics (src/app/api/entities/[entity]/route.ts) ───────────────────────── */
function matches(row, key, cond) {
  const v = row[key];
  if (cond === undefined || cond === null || cond === '') return true;
  if (Array.isArray(cond)) return cond.length === 0 || cond.map(String).includes(String(v));
  if (typeof cond === 'boolean') return Boolean(v) === cond;
  if (typeof cond === 'object') {
    const c = cond;
    if (c.from && String(v ?? '') < c.from) return false;
    if (c.to && String(v ?? '') > c.to) return false;
    if (c.min !== undefined && c.min !== null && String(c.min) !== '' && Number(v) < Number(c.min)) return false;
    if (c.max !== undefined && c.max !== null && String(c.max) !== '' && Number(v) > Number(c.max)) return false;
    return true;
  }
  return String(v ?? '').toLowerCase().includes(String(cond).toLowerCase());
}
function listEntity(def, tables, params) {
  const variant = params.get('period') ?? undefined;
  let rows = tables.getRows(def.entity, def.template === 'matrix' ? variant : undefined);
  let filters = {};
  try { filters = JSON.parse(params.get('filters') || '{}'); } catch { /* malformed filter JSON is ignored, matching source */ }
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const facetKey = params.get('facet') || def.quickFilter || (def.fields.some((f) => f.key === 'status') ? 'status' : '');
  const asOf = params.get('asOf');
  if (q) rows = rows.filter((r) => Object.entries(r).some(([k, v]) => k !== 'id' && (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(q)));
  if (asOf) rows = rows.filter((r) => (!r.effectiveFrom || r.effectiveFrom <= asOf) && (!r.effectiveTo || r.effectiveTo >= asOf));
  const others = Object.entries(filters).filter(([k]) => k !== facetKey);
  rows = rows.filter((r) => others.every(([k, c]) => matches(r, k, c)));
  const facets = {};
  if (facetKey) rows.forEach((r) => { const k = String(r[facetKey] ?? '—'); facets[k] = (facets[k] ?? 0) + 1; });
  if (facetKey && filters[facetKey] !== undefined) rows = rows.filter((r) => matches(r, facetKey, filters[facetKey]));
  const sort = params.get('sort');
  const dir = params.get('dir') === 'desc' ? -1 : 1;
  if (sort) rows = [...rows].sort((a, b) => { const x = a[sort], y = b[sort]; if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir; return String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true }) * dir; });
  const totals = {};
  def.fields.filter((f) => f.type === 'currency' || f.type === 'number').forEach((f) => { totals[f.key] = Math.round(rows.reduce((s, r) => s + (Number(r[f.key]) || 0), 0) * 100) / 100; });
  const size = Math.min(Math.max(Number(params.get('size')) || 25, 1), 5000);
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const total = rows.length;
  const slice = rows.slice((page - 1) * size, page * size);
  return { rows: slice, total, page, size, facets, totals };
}

/* ───────────────────────── write validation ───────────────────────── */
function findRow(entity, tables, id, variant) { const rows = tables.getRows(entity, variant); const idx = rows.findIndex((r) => r.id === id); return { rows, idx }; }
function describesCycle(rows, id, candidateParentId) {
  let cursor = candidateParentId;
  const seen = new Set();
  while (cursor) {
    if (cursor === id) return true;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    const parent = rows.find((r) => r.id === cursor);
    cursor = parent ? parent.parentId : null;
  }
  return false;
}
function validateWrite(def, tables, body, existing) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { error: fail(400, 'erp.malformedBody') };
  const clean = { ...body };
  const fieldErrors = {};
  for (const field of def.fields) {
    if (field.readOnly && field.key in clean) delete clean[field.key];
    if (!(field.key in clean)) continue;
    const value = clean[field.key];
    if (field.required && (value === undefined || value === null || value === '')) fieldErrors[field.key] = 'erp.required';
    if ((field.type === 'number' || field.type === 'currency' || field.type === 'percent') && value !== undefined && value !== null && value !== '') {
      const n = Number(value);
      if (!Number.isFinite(n)) fieldErrors[field.key] = 'erp.notFinite';
      else if (n < 0 && !['debit', 'credit'].includes(field.key)) fieldErrors[field.key] = 'erp.negative';
      else if (field.min !== undefined && n < field.min) fieldErrors[field.key] = 'erp.belowMin';
      else if (field.max !== undefined && n > field.max) fieldErrors[field.key] = 'erp.aboveMax';
    }
    if (field.type === 'ref' && value) {
      const names = refNames(field.ref, tables);
      if (!names.includes(String(value))) fieldErrors[field.key] = 'erp.unknownReference';
    }
  }
  if (def.tree && 'parentId' in clean) {
    const rows = tables.getRows(def.entity);
    if (clean.parentId && !rows.some((r) => r.id === clean.parentId)) fieldErrors.parentId = 'erp.unknownReference';
    else if (existing && clean.parentId && describesCycle(rows, existing.id, clean.parentId)) fieldErrors.parentId = 'erp.cycle';
  }
  if (Object.keys(fieldErrors).length) return { error: fail(422, 'erp.invalidFields', { fieldErrors }) };
  if (def.lines && Array.isArray(clean.lines)) {
    for (const line of clean.lines) {
      if (line.qty !== undefined && (!Number.isFinite(Number(line.qty)) || Number(line.qty) < 0)) return { error: fail(422, 'erp.invalidLine') };
      if (line.rate !== undefined && (!Number.isFinite(Number(line.rate)) || Number(line.rate) < 0)) return { error: fail(422, 'erp.invalidLine') };
      if (line.debit !== undefined && (!Number.isFinite(Number(line.debit)) || Number(line.debit) < 0)) return { error: fail(422, 'erp.invalidLine') };
      if (line.credit !== undefined && (!Number.isFinite(Number(line.credit)) || Number(line.credit) < 0)) return { error: fail(422, 'erp.invalidLine') };
    }
    if (def.template === 'voucher') {
      const debit = round2(clean.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
      const credit = round2(clean.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
      if (debit !== credit) return { error: fail(422, 'erp.unbalanced', { debit, credit }) };
      clean.total = credit;
    } else {
      clean.lines = clean.lines.map((l) => { const amount = round2((Number(l.qty) || 0) * (Number(l.rate) || 0)); return { ...l, amount }; });
      clean.total = round2(clean.lines.reduce((s, l) => { const tax = Number(l.tax ?? 0); const sign = l.kind === 'Deduction' ? -1 : 1; return s + sign * Number(l.amount) * (1 + tax / 100); }, 0));
    }
  }
  return { clean };
}

/* ───────────────────────── dashboard (src/app/api/dashboard/route.ts) ───────────────────────── */
function buildDashboard(tables) {
  const has = (e) => !!ownerDef(e);
  const invoices = has('sales-invoices') ? tables.getRows('sales-invoices') : [];
  const orders = has('sales-orders') ? tables.getRows('sales-orders') : [];
  const purchases = has('purchase-orders') ? tables.getRows('purchase-orders') : [];
  const employees = has('employees') ? tables.getRows('employees') : [];
  const approvals = has('approvals') ? tables.getRows('approvals') : [];
  const tickets = has('support-tickets') ? tables.getRows('support-tickets') : [];
  const customers = has('customers') ? tables.getRows('customers') : [];
  const sum = (rows) => Math.round(rows.reduce((s, r) => s + (Number(r.total) || 0), 0));
  const revenue = sum(invoices);
  const receivable = sum(invoices.filter((i) => ['Unpaid', 'Partially paid', 'Overdue'].includes(i.status)));
  const overdue = invoices.filter((i) => i.status === 'Overdue').length;
  const openOrders = orders.filter((o) => ['Submitted', 'Approved'].includes(o.status)).length;
  const r = rng(hash('dashboard'));
  const months = []; const now = new Date();
  for (let k = 11; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push(d.toLocaleDateString('en-US', { month: 'short' })); }
  let base = 210000;
  const sales = months.map(() => (base = Math.round(base * (0.94 + r() * 0.16))));
  const purchaseSeries = sales.map((s) => Math.round(s * (0.55 + r() * 0.15)));
  const spark = (n, start) => { let v = start; return Array.from({ length: n }, () => (v = Math.max(1, v * (0.9 + r() * 0.22)))); };
  const statusSplit = {};
  invoices.forEach((i) => (statusSplit[i.status] = (statusSplit[i.status] ?? 0) + (Number(i.total) || 0)));
  const topCustomers = [...customers].sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0)).slice(0, 6).map((c) => ({ name: c.name, value: c.outstanding, group: c.group }));
  return {
    kpis: [
      { key: 'revenue', label: 'Invoiced, last 150 days', value: revenue, format: 'currency', delta: 8.4, spark: spark(14, 30) },
      { key: 'receivable', label: 'Receivables open', value: receivable, format: 'currency', delta: -3.1, spark: spark(14, 20), note: `${overdue} overdue` },
      { key: 'orders', label: 'Orders in progress', value: openOrders, format: 'number', delta: 12.0, spark: spark(14, 10) },
      { key: 'headcount', label: 'Active employees', value: employees.filter((e) => e.status !== 'Exited').length, format: 'number', delta: 1.6, spark: spark(14, 40) },
    ],
    months, sales, purchases: purchaseSeries,
    statusSplit: Object.entries(statusSplit).map(([label, value]) => ({ label, value: Math.round(value) })),
    topCustomers,
    recentOrders: orders.slice(0, 7).map((o) => ({ id: o.id, code: o.code, customer: o.customer, date: o.date, total: o.total, status: o.status })),
    approvals: approvals.filter((a) => a.status === 'Pending').slice(0, 6).map((a) => ({ id: a.id, code: a.code, type: a.type, requester: a.requester, amount: a.amount, days: a.days, priority: a.priority, submitted: a.submitted })),
    pendingApprovals: approvals.filter((a) => a.status === 'Pending').length,
    openTickets: tickets.filter((t) => t.status !== 'Resolved').length,
    purchaseValue: sum(purchases),
  };
}

/* ───────────────────────── lookups (GET /api/lookups) ───────────────────────── */
function pageByPath(page) {
  const [section, slug] = String(page ?? '').split('/');
  return PAGES.find((p) => p.section === section && p.slug === slug);
}
function lookupFieldValues(fields) {
  const out = {};
  for (const field of fields ?? []) {
    if (Array.isArray(field.pool)) out[field.key] = field.pool;
    else if (Array.isArray(field.options)) out[field.key] = field.options;
  }
  return out;
}
/** Manager-like designations used to source request-page approvers from the scope's own employees. */
const MANAGER_DESIGNATIONS = new Set(['Manager', 'Senior Manager', 'Team Lead', 'Director']);
function approversFor(tables) {
  const employees = tables.getRows('employees');
  const managers = employees.filter((e) => MANAGER_DESIGNATIONS.has(e.designation)).map((e) => e.name);
  return (managers.length ? managers : employees.map((e) => e.name)).slice(0, 5);
}
function buildLookups(def, tables) {
  const body = { fields: lookupFieldValues(def.fields), lines: lookupFieldValues(def.lines?.fields) };
  if (def.params) body.params = lookupFieldValues(def.params);
  if (def.sections) body.sections = def.sections.reduce((acc, s) => Object.assign(acc, lookupFieldValues(s.fields)), {});
  if (def.resources) body.resources = def.resources;
  if (def.balances) body.balances = def.balances;
  if (def.template === 'request') body.approvers = approversFor(tables);
  return body;
}

/* ───────────────────────── view state (GET/PUT /api/view-state) ───────────────────────── */
const VIEW_STATE_KEY_RE = /^keystone\.(cols|views|mode)\.([a-z0-9-]+)$/;
const VIEW_STATE_MAX_JSON_LENGTH = 20000;
/** Known modes: only ProfileTemplate's split/table toggle consumes `keystone.mode.<slug>` today. */
const VIEW_STATE_MODES = new Set(['split', 'table']);
function isKnownViewStateKey(key) {
  const m = VIEW_STATE_KEY_RE.exec(String(key ?? ''));
  return Boolean(m) && PAGES.some((p) => p.slug === m[2]);
}
function userViewState(viewStates, user, scope) {
  const key = JSON.stringify([user.tenantId, scope.applicationId, scope.branchId, user.id]);
  let m = viewStates.get(key);
  if (!m) { m = new Map(); viewStates.set(key, m); }
  return m;
}
/** Columns a list may hide: matches WorkList's `listFields` (excludes textarea and `list: false`). */
const listFieldKeys = (def) => def.fields.filter((f) => f.list !== false && f.type !== 'textarea').map((f) => f.key);
/** Fields a saved view is allowed to filter by: filterable fields plus the page's quick filter. */
function filterableKeys(def) {
  const keys = new Set(def.fields.filter((f) => f.filter).map((f) => f.key));
  if (def.quickFilter) keys.add(def.quickFilter);
  return keys;
}
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
function validFilterValue(v) {
  if (typeof v === 'string') return v.length <= 200;
  if (typeof v === 'boolean' || typeof v === 'number') return true;
  if (Array.isArray(v)) return v.length <= 50 && v.every((x) => typeof x === 'string');
  if (isPlainObject(v)) return Object.keys(v).every((k) => ['from', 'to', 'min', 'max'].includes(k));
  return false;
}
/** Matches WorkList's SavedView shape: `{ name, q, quick, filters }` with bounded strings and
    filters limited to the page's own recognized keys. */
function validSavedView(view, allowedFilterKeys) {
  if (!isPlainObject(view)) return false;
  if (typeof view.name !== 'string' || !view.name.length || view.name.length > 60) return false;
  if (typeof view.q !== 'string' || view.q.length > 200) return false;
  if (view.quick !== null && typeof view.quick !== 'string') return false;
  if (!isPlainObject(view.filters)) return false;
  return Object.entries(view.filters).every(([k, v]) => allowedFilterKeys.has(k) && validFilterValue(v));
}
/** Bounded-JSON contract per key kind; `null` always means "reset to default". Malformed shapes
    (wrong type, unknown column/filter keys, oversized strings) are rejected rather than stored,
    so a client array/object can never crash on a value another client wrote. */
function validateViewStateShape(key, value) {
  const m = VIEW_STATE_KEY_RE.exec(key);
  const def = PAGES.find((p) => p.slug === m[2]);
  if (!def) return false;
  if (value === null) return true;
  if (m[1] === 'cols') {
    if (!Array.isArray(value) || value.length > 200) return false;
    const allowed = new Set(listFieldKeys(def));
    return value.every((k) => typeof k === 'string' && allowed.has(k));
  }
  if (m[1] === 'views') {
    if (!Array.isArray(value) || value.length > 30) return false;
    const allowed = filterableKeys(def);
    return value.every((v) => validSavedView(v, allowed));
  }
  if (m[1] === 'mode') return VIEW_STATE_MODES.has(value);
  return false;
}

/* ───────────────────────── record support (GET /api/entities/:entity/:id/support) ───────────────────────── */
const nounOf = (def) => def.title.replace(/ master$/i, '').replace(/s$/, '').replace(/ie$/, 'y').toLowerCase();
function buildSupport(def, row) {
  const dateField = def.fields.find((f) => f.type === 'date');
  const base = (dateField && row[dateField.key]) || dayOffset(-40);
  const support = {
    activities: [
      { when: dayOffset(-2), who: 'Maya Okafor', text: 'Updated contact details' },
      { when: dayOffset(-9), who: 'System', text: 'Nightly sync with finance completed' },
      { when: dayOffset(-21), who: 'Arjun Patel', text: `Changed status to ${row.status ?? 'Active'}` },
      { when: base, who: 'Arjun Patel', text: `Created ${nounOf(def)} ${row.code ?? ''}`.trim() },
    ],
    documents: [
      { name: `${row.code ?? 'record'}-agreement.pdf`, size: '248 KB', when: dayOffset(-30) },
      { name: 'kyc-documents.zip', size: '1.2 MB', when: dayOffset(-64) },
      { name: 'correspondence-2026.pdf', size: '96 KB', when: dayOffset(-5) },
    ],
  };
  /* Only process-template rows ever carry a run history; every other template must never surface processLogs. */
  if (def.template === 'process' && Array.isArray(row.processEvents)) support.processEvents = structuredClone(row.processEvents);
  return support;
}

/* ───────────────────────── process runner (POST /api/processes/:entity/run) ───────────────────────── */
/** Fixed 09:00 base so the same row always replays the same timeline through GET support — never
    wall-clock time, which would render a different history on every read. */
function processTimeAt(minutesOffset) {
  const total = 9 * 60 + minutesOffset;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}
/** Deterministic, persisted step history for one process row. A `Failed` row stops at its last step
    with a danger event instead of asserting every step completed. */
function buildProcessEventHistory(def, row) {
  const steps = def.steps ?? [];
  if (!steps.length) return [];
  const failed = row.status === 'Failed';
  const failStep = failed ? steps.length - 1 : -1;
  const events = [];
  for (let i = 0; i < steps.length; i++) {
    if (failed && i === failStep) { events.push({ time: processTimeAt(i * 3), text: `${steps[i]} — failed.`, tone: 'danger', step: i, progress: 65 }); break; }
    events.push({ time: processTimeAt(i * 3), text: `${steps[i]} — done.`, tone: 'info', step: i, progress: 100 });
  }
  const lastStep = failed ? failStep : steps.length - 1;
  events.push(failed
    ? { time: processTimeAt((lastStep + 1) * 3), text: `${row.code ?? def.title} failed and needs attention.`, tone: 'danger' }
    : { time: processTimeAt((lastStep + 1) * 3), text: `${row.code ?? def.title} completed successfully.`, tone: 'ok' });
  return events;
}
function validateProcessParams(def, body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { error: fail(400, 'erp.malformedBody') };
  const clean = {};
  for (const field of def.params ?? []) {
    if (!(field.key in body)) continue;
    const v = body[field.key];
    if (field.type === 'boolean') { if (typeof v !== 'boolean') return { error: fail(422, 'erp.invalidFields', { fieldErrors: { [field.key]: 'erp.invalidType' } }) }; clean[field.key] = v; continue; }
    if (field.type === 'select' && Array.isArray(field.options)) { if (!field.options.includes(String(v))) return { error: fail(422, 'erp.invalidFields', { fieldErrors: { [field.key]: 'erp.unknownOption' } }) }; clean[field.key] = v; continue; }
    if (field.type === 'date') { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: fail(422, 'erp.invalidFields', { fieldErrors: { [field.key]: 'erp.invalidDate' } }) }; clean[field.key] = v; continue; }
    clean[field.key] = v;
  }
  return { clean };
}
function runProcess(def, tables, user, clean) {
  const rows = tables.getRows(def.entity);
  const seed = rng(hash(`${def.entity}:${rows.length}:${JSON.stringify(clean)}`));
  const row = { id: tables.nextId(def.entity) };
  for (const field of def.fields) {
    if (field.type === 'code') continue;
    if (field.key in clean) { row[field.key] = clean[field.key]; continue; }
    if (field.key === 'employees') { row[field.key] = int(seed, field.min ?? 1, field.max ?? 100); continue; }
    if (field.key === 'gross') { row[field.key] = round2((field.min ?? 0) + seed() * ((field.max ?? 1000) - (field.min ?? 0))); continue; }
    if (field.key === 'net') { row[field.key] = round2(Number(row.gross ?? 0) * (0.78 + seed() * 0.08)); continue; }
    if (field.key === 'runAt') { row[field.key] = dayOffset(0); continue; }
    if (field.key === 'runBy') { row[field.key] = user.name; continue; }
    if (field.type === 'status') { row[field.key] = 'Completed'; continue; }
    if (field.type === 'select' && Array.isArray(field.options)) { row[field.key] = field.options[0]; continue; }
  }
  const codeField = def.fields.find((f) => f.type === 'code');
  if (codeField) row[codeField.key] = tables.nextCode(def);
  row.version = 1;
  /* Persisted once at run time so a later GET support replays the identical history (never regenerated). */
  row.processEvents = buildProcessEventHistory(def, row);
  rows.unshift(row);
  return row;
}

/* ───────────────────────── company profile (GET /api/company-profile) ───────────────────────── */
function buildCompanyProfile(tables) {
  const row = tables.getRows('company-settings')[0] ?? {};
  const cityLine = [row.city, row.postcode].filter(Boolean).join(' ');
  const address = [row.address, cityLine].filter(Boolean).join(', ');
  return {
    company: row.tradeName || row.legalName || 'Northwind',
    address: address || '4th Floor, Harbor Point, Marine Drive, Mumbai 400020',
    taxId: row.taxId || '27AABCN1234F1Z5',
    email: row.email || 'accounts@northwind.example',
    bank: 'HDFC Bank',
    account: '50200012345678',
    ifsc: 'HDFC0000060',
    swift: 'HDFCINBB',
    paymentTerms: row.paymentTerms || 'Net 30',
    invoiceTerms: 'Payment is due by the date shown. Interest at 1.5% per month applies to overdue amounts. Goods once sold are returnable within 7 days in original packaging. Subject to Mumbai jurisdiction.',
  };
}

/* ───────────────────────── store factory ───────────────────────── */
export function createReferenceErpStore({ variant } = {}) {
  if (variant !== 'erp1' && variant !== 'erp2') throw new TypeError('createReferenceErpStore requires { variant: "erp1" | "erp2" }');
  const scopes = new Map();
  const receipts = new Map();
  const viewStates = new Map();
  function scopeTables(user, scope) {
    const key = JSON.stringify([user.tenantId, scope.applicationId, scope.branchId]);
    let t = scopes.get(key);
    if (!t) { t = createTables(); scopes.set(key, t); }
    return { key, tables: t };
  }
  return {
    variant,
    pages: PAGES,
    handle(user, scope, request) {
      const scopeError = validateScopeIdentity(user, scope);
      if (scopeError) return scopeError;
      const access = roleAccess(user);
      if (!access) return fail(403, 'erp.roleDenied');
      const method = String(request?.method ?? 'GET').toUpperCase();
      const path = normalizePath(request?.path);
      const params = toParams(request?.query);
      const body = request?.body;
      const { key: scopeKey, tables } = scopeTables(user, scope);

      if (path === '/dashboard') {
        if (method !== 'GET') return fail(405, 'erp.methodNotAllowed');
        return { status: 200, body: buildDashboard(tables) };
      }

      if (path === '/company-profile') {
        if (method !== 'GET') return fail(405, 'erp.methodNotAllowed');
        return { status: 200, body: buildCompanyProfile(tables) };
      }

      if (path === '/lookups') {
        if (method !== 'GET') return fail(405, 'erp.methodNotAllowed');
        const entity = params.get('entity');
        const page = params.get('page');
        if (!entity || !page) return fail(400, 'erp.missingParams');
        const def = pageByPath(page);
        if (!def) return fail(404, 'erp.unknownPage', { page });
        if (def.entity !== entity) return fail(422, 'erp.pageEntityMismatch', { entity, page });
        return { status: 200, body: buildLookups(def, tables) };
      }

      if (path === '/view-state') {
        const key = method === 'GET' ? params.get('key') : (typeof body === 'object' && body !== null && !Array.isArray(body) ? body.key : undefined);
        if (method === 'GET') {
          if (!isKnownViewStateKey(key)) return fail(400, 'erp.invalidViewStateKey');
          const vs = userViewState(viewStates, user, scope);
          return { status: 200, body: { key, value: vs.has(key) ? structuredClone(vs.get(key)) : null } };
        }
        if (method === 'PUT') {
          if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'erp.malformedBody');
          if (!isKnownViewStateKey(key)) return fail(400, 'erp.invalidViewStateKey');
          if (!('value' in body)) return fail(400, 'erp.missingValue');
          const value = body.value ?? null;
          let serialized;
          try { serialized = JSON.stringify(value) ?? 'null'; } catch { return fail(400, 'erp.malformedValue'); }
          if (serialized.length > VIEW_STATE_MAX_JSON_LENGTH) return fail(413, 'erp.valueTooLarge');
          if (!validateViewStateShape(key, value)) return fail(422, 'erp.invalidViewStateValue');
          const vs = userViewState(viewStates, user, scope);
          const stored = structuredClone(value);
          vs.set(key, stored);
          return { status: 200, body: { key, value: structuredClone(stored) } };
        }
        return fail(405, 'erp.methodNotAllowed');
      }

      let m = /^\/processes\/([^/]+)\/run$/.exec(path);
      if (m) {
        const entity = decodeURIComponent(m[1]);
        const def = ownerDef(entity);
        if (!def || def.template !== 'process') return fail(404, 'erp.unknownProcess', { entity });
        if (method !== 'POST') return fail(405, 'erp.methodNotAllowed');
        if (!access.canWrite(entity)) return fail(403, 'erp.writeDenied', { entity });
        const { error, clean } = validateProcessParams(def, body);
        if (error) return error;
        const row = runProcess(def, tables, user, clean);
        return { status: 200, body: { row: structuredClone(row), events: structuredClone(row.processEvents) } };
      }

      m = /^\/entities\/([^/]+)\/([^/]+)\/support$/.exec(path);
      if (m) {
        const entity = decodeURIComponent(m[1]);
        const id = decodeURIComponent(m[2]);
        const def = ownerDef(entity);
        if (!def) return fail(404, 'erp.unknownEntity', { entity });
        if (method !== 'GET') return fail(405, 'erp.methodNotAllowed');
        const { rows, idx } = findRow(entity, tables, id);
        if (idx < 0) return fail(404, 'erp.notFound', { entity, id });
        return { status: 200, body: buildSupport(def, rows[idx]) };
      }

      m = /^\/entities\/([^/]+)$/.exec(path);
      if (m) {
        const entity = decodeURIComponent(m[1]);
        const def = ownerDef(entity);
        if (!def) return fail(404, 'erp.unknownEntity', { entity });
        if (method === 'GET') return { status: 200, body: listEntity(def, tables, params) };
        if (method === 'POST') {
          if (!access.canWrite(entity)) return fail(403, 'erp.writeDenied', { entity });
          if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'erp.malformedBody');
          const operationId = typeof body.operationId === 'string' ? body.operationId : null;
          if (operationId) {
            const receiptKey = JSON.stringify([scopeKey, user.id, entity, 'POST', operationId]);
            const prior = receipts.get(receiptKey);
            if (prior) return prior.hash === JSON.stringify(body) ? { status: prior.status, body: prior.body } : fail(409, 'erp.operationConflict');
          }
          const { error, clean } = validateWrite(def, tables, body, null);
          if (error) return error;
          delete clean.id; delete clean.version; delete clean.expectedVersion; delete clean.operationId;
          for (const field of def.fields) if (field.required && (clean[field.key] === undefined || clean[field.key] === null || clean[field.key] === '')) return fail(422, 'erp.invalidFields', { fieldErrors: { [field.key]: 'erp.required' } });
          const rows = tables.getRows(entity);
          const row = { ...clean, id: tables.nextId(entity) };
          const codeField = def.fields.find((f) => f.type === 'code');
          if (codeField && !row[codeField.key]) row[codeField.key] = tables.nextCode(def);
          row.version = 1;
          rows.unshift(row);
          const result = { status: 201, body: structuredClone(row) };
          if (operationId) receipts.set(JSON.stringify([scopeKey, user.id, entity, 'POST', operationId]), { hash: JSON.stringify(body), ...result });
          return result;
        }
        return fail(405, 'erp.methodNotAllowed');
      }

      m = /^\/entities\/([^/]+)\/([^/]+)$/.exec(path);
      if (m) {
        const entity = decodeURIComponent(m[1]);
        const id = decodeURIComponent(m[2]);
        const def = ownerDef(entity);
        if (!def) return fail(404, 'erp.unknownEntity', { entity });
        const period = params.get('period');
        const variant = def.template === 'matrix' && period ? period : undefined;
        if (method === 'GET') {
          const { rows, idx } = findRow(entity, tables, id, variant);
          if (idx < 0) return fail(404, 'erp.notFound', { entity, id });
          return { status: 200, body: structuredClone(rows[idx]) };
        }
        if (method === 'PUT') {
          if (!access.canWrite(entity)) return fail(403, 'erp.writeDenied', { entity });
          if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail(400, 'erp.malformedBody');
          const { rows, idx } = findRow(entity, tables, id, variant);
          if (idx < 0) return fail(404, 'erp.notFound', { entity, id });
          const existing = rows[idx];
          if (typeof body.expectedVersion === 'number' && body.expectedVersion !== (existing.version ?? 0)) return fail(409, 'erp.versionConflict', { expected: body.expectedVersion, actual: existing.version ?? 0 });
          const operationId = typeof body.operationId === 'string' ? body.operationId : null;
          if (operationId) {
            const receiptKey = JSON.stringify([scopeKey, user.id, entity, 'PUT', id, operationId]);
            const prior = receipts.get(receiptKey);
            if (prior) return prior.hash === JSON.stringify(body) ? { status: prior.status, body: prior.body } : fail(409, 'erp.operationConflict');
          }
          const { error, clean } = validateWrite(def, tables, body, existing);
          if (error) return error;
          delete clean.id; delete clean.version; delete clean.expectedVersion; delete clean.operationId;
          const updated = { ...existing, ...clean, id, version: (existing.version ?? 0) + 1 };
          rows[idx] = updated;
          const result = { status: 200, body: structuredClone(updated) };
          if (operationId) receipts.set(JSON.stringify([scopeKey, user.id, entity, 'PUT', id, operationId]), { hash: JSON.stringify(body), ...result });
          return result;
        }
        if (method === 'DELETE') {
          if (!access.canWrite(entity)) return fail(403, 'erp.writeDenied', { entity });
          const { rows, idx } = findRow(entity, tables, id, variant);
          if (idx < 0) return fail(404, 'erp.notFound', { entity, id });
          const [removed] = rows.splice(idx, 1);
          return { status: 200, body: { deleted: removed.id } };
        }
        return fail(405, 'erp.methodNotAllowed');
      }

      return fail(404, 'erp.unknownRoute', { path });
    },
  };
}
