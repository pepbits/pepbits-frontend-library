import type { LucideIcon } from 'lucide-react';
import { Boxes, Building2, CalendarClock, CalendarX2, ClipboardList, FileSignature, Handshake, Hospital, Layers, Network, ShieldCheck, Stethoscope, UserRound, Wrench } from 'lucide-react';
import { Row } from './types';

export type FieldType = 'text' | 'number' | 'money' | 'percent' | 'date' | 'time' | 'select' | 'ref' | 'checkbox' | 'textarea' | 'days' | 'email' | 'tel';

export interface FieldDef {
  key: string; label: string; type: FieldType; required?: boolean; span?: 1 | 2 | 3 | 4;
  options?: string[];
  /** ref: lookup entity, how to filter it from other form fields, and which option property is stored. */
  ref?: { entity: string; filterBy?: Record<string, string>; staticFilter?: Record<string, string>; valueField?: 'value' | 'code'; display?: string };
  hint?: string; placeholder?: string; defaultValue?: unknown;
  visibleIf?: (r: Row) => boolean;
  /** When this field changes, derive other values (e.g. plan -> TPA). */
  onPick?: (meta: Row | undefined) => Row;
}
export interface SectionDef { title: string; fields: FieldDef[] }
export type ColumnKind = 'text' | 'code' | 'status' | 'money' | 'bool' | 'badge' | 'number' | 'date' | 'percent';
export interface ColumnDef { key: string; header: string; kind?: ColumnKind; width?: string; sortKey?: string; align?: 'right' }

export interface MasterDef {
  entity: string; title: string; singular: string; icon: LucideIcon; description: string;
  titleOf: (r: Row) => string; subtitleOf?: (r: Row) => string;
  sections: SectionDef[]; columns: ColumnDef[];
  presets?: { param: string; label: string; values: string[] };
  links?: (r: Row) => { href: string; label: string }[];
}

const STATUS: FieldDef = { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], defaultValue: 'Active' };
const code = (placeholder: string): FieldDef => ({ key: 'code', label: 'Code', type: 'text', required: true, placeholder });
const name = (label = 'Name', span: 1 | 2 | 3 = 2): FieldDef => ({ key: 'name', label, type: 'text', required: true, span });
const PROVIDER_TYPES = ['Doctor', 'Lab Doctor', 'Nurse', 'Pharmacist', 'Physiotherapist', 'Technician', 'Receptionist'];
const LICENSED = ['Doctor', 'Lab Doctor', 'Pharmacist', 'Nurse', 'Physiotherapist'];

export const MASTERS: Record<string, MasterDef> = {
  facilities: {
    entity: 'facilities', title: 'Facilities', singular: 'Facility', icon: Building2, description: 'Clinics and pharmacies that share this workspace',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.type}`,
    sections: [{ title: 'Facility', fields: [code('ANMC'), name(), { key: 'type', label: 'Type', type: 'select', required: true, options: ['Clinic', 'Pharmacy', 'Hospital', 'Diagnostic center'] }, { key: 'city', label: 'City', type: 'text' }, { key: 'licenseNo', label: 'Licence no.', type: 'text' }, STATUS] }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '110px' }, { key: 'name', header: 'Name' }, { key: 'type', header: 'Type', kind: 'badge' }, { key: 'city', header: 'City' }, { key: 'licenseNo', header: 'Licence', kind: 'code' }, { key: 'status', header: 'Status', kind: 'status' }],
    presets: { param: 'type', label: 'Type', values: ['Clinic', 'Pharmacy'] },
  },
  departments: {
    entity: 'departments', title: 'Departments', singular: 'Department', icon: Hospital, description: 'Clinical, diagnostic and support departments per facility',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.facilityName ?? ''}`,
    sections: [{ title: 'Department', fields: [code('GEN'), name(), { key: 'facilityId', label: 'Facility', type: 'ref', required: true, ref: { entity: 'facilities', display: 'facilityName' } }, { key: 'type', label: 'Type', type: 'select', required: true, options: ['Clinical', 'Diagnostic', 'Nursing', 'Pharmacy', 'Administrative'] }, STATUS] }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '100px' }, { key: 'name', header: 'Name' }, { key: 'type', header: 'Type', kind: 'badge' }, { key: 'facilityName', header: 'Facility' }, { key: 'status', header: 'Status', kind: 'status' }],
    presets: { param: 'type', label: 'Type', values: ['Clinical', 'Diagnostic', 'Nursing', 'Pharmacy', 'Administrative'] },
  },
  specialties: {
    entity: 'specialties', title: 'Specialties', singular: 'Specialty', icon: Stethoscope, description: 'Specialties offered within each department',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.departmentName ?? ''}`,
    sections: [{ title: 'Specialty', fields: [code('FM'), name(), { key: 'departmentId', label: 'Department', type: 'ref', required: true, ref: { entity: 'departments', display: 'departmentName' } }, STATUS] }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '100px' }, { key: 'name', header: 'Name' }, { key: 'departmentName', header: 'Department' }, { key: 'status', header: 'Status', kind: 'status' }],
  },
  providers: {
    entity: 'providers', title: 'Providers & staff', singular: 'Provider', icon: UserRound, description: 'Doctors, nurses, pharmacists, therapists, technicians and front office staff',
    titleOf: (r) => r.name, subtitleOf: (r) => [r.providerType, r.specialtyName || r.departmentName].filter(Boolean).join(' · '),
    sections: [
      {
        title: 'Identity', fields: [code('DR-SH'), name('Full name'), { key: 'providerType', label: 'Provider type', type: 'select', required: true, options: PROVIDER_TYPES },
          { key: 'gender', label: 'Gender', type: 'select', required: true, options: ['Female', 'Male'] }, { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email', span: 2 }, STATUS],
      },
      {
        title: 'Placement & licence', fields: [
          { key: 'departmentId', label: 'Department', type: 'ref', required: true, ref: { entity: 'departments', display: 'departmentName' } },
          { key: 'specialtyId', label: 'Specialty', type: 'ref', ref: { entity: 'specialties', filterBy: { departmentId: 'departmentId' }, display: 'specialtyName' }, hint: 'Filtered by department' },
          { key: 'licenseNo', label: 'Licence no.', type: 'text', hint: 'Required for licensed clinicians' },
          { key: 'licenseExpiry', label: 'Licence expiry', type: 'date', visibleIf: (r) => LICENSED.includes(r.providerType) },
          { key: 'consultationServiceCode', label: 'Consultation service', type: 'ref', span: 2, ref: { entity: 'services', staticFilter: { category: 'Consultation' }, valueField: 'code' }, visibleIf: (r) => ['Doctor', 'Physiotherapist', 'Lab Doctor'].includes(r.providerType), hint: 'Auto-charged when an encounter is created' },
        ],
      },
    ],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '100px' }, { key: 'name', header: 'Name' }, { key: 'providerType', header: 'Type', kind: 'badge' }, { key: 'departmentName', header: 'Department' }, { key: 'specialtyName', header: 'Specialty' }, { key: 'licenseNo', header: 'Licence', kind: 'code' }, { key: 'licenseExpiry', header: 'Expiry', kind: 'date' }, { key: 'status', header: 'Status', kind: 'status' }],
    presets: { param: 'providerType', label: 'Type', values: PROVIDER_TYPES },
  },
  payers: {
    entity: 'payers', title: 'Payers', singular: 'Payer', icon: ShieldCheck, description: 'Insurers and funders that carry the risk',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.payerType}`,
    sections: [{
      title: 'Payer', fields: [code('GSI'), name(), { key: 'payerType', label: 'Payer type', type: 'select', required: true, options: ['Insurance', 'Government', 'Corporate'] }, { key: 'regulatorId', label: 'Regulator ID', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email', span: 2 },
        { key: 'eligibilityEnabled', label: 'Real-time eligibility', type: 'checkbox', defaultValue: true, hint: 'Off means front desk verifies manually' }, STATUS],
    }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '90px' }, { key: 'name', header: 'Name' }, { key: 'payerType', header: 'Type', kind: 'badge' }, { key: 'regulatorId', header: 'Regulator ID', kind: 'code' }, { key: 'eligibilityEnabled', header: 'Eligibility API', kind: 'bool' }, { key: 'status', header: 'Status', kind: 'status' }],
  },
  tpas: {
    entity: 'tpas', title: 'TPAs', singular: 'TPA', icon: Handshake, description: 'Third-party administrators that adjudicate on behalf of payers',
    titleOf: (r) => r.name, subtitleOf: (r) => r.code,
    sections: [{ title: 'TPA', fields: [code('MAT'), name(), { key: 'regulatorId', label: 'Regulator ID', type: 'text' }, { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email', span: 2 }, STATUS] }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '90px' }, { key: 'name', header: 'Name' }, { key: 'regulatorId', header: 'Regulator ID', kind: 'code' }, { key: 'phone', header: 'Phone' }, { key: 'email', header: 'Email' }, { key: 'status', header: 'Status', kind: 'status' }],
  },
  'insurance-plans': {
    entity: 'insurance-plans', title: 'Insurance plans', singular: 'Plan', icon: Layers, description: 'Plans sold by a payer and administered by a TPA',
    titleOf: (r) => `${r.payerName ?? ''} ${r.name}`.trim(), subtitleOf: (r) => `${r.code} · ${r.tpaName ?? ''}`,
    sections: [{
      title: 'Plan', fields: [code('GSI-GOLD'), name('Plan name'), { key: 'payerId', label: 'Payer', type: 'ref', required: true, ref: { entity: 'payers', display: 'payerName' } },
        { key: 'tpaId', label: 'TPA', type: 'ref', required: true, ref: { entity: 'tpas', display: 'tpaName' } }, { key: 'planCategory', label: 'Category', type: 'select', options: ['Basic', 'Standard', 'Comprehensive', 'Premium'] }, STATUS],
    }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '120px' }, { key: 'name', header: 'Plan' }, { key: 'payerName', header: 'Payer' }, { key: 'tpaName', header: 'TPA' }, { key: 'planCategory', header: 'Category', kind: 'badge' }, { key: 'status', header: 'Status', kind: 'status' }],
    links: (r) => [{ href: `/masters/networks?planId=${r.id}`, label: 'Networks' }],
  },
  networks: {
    entity: 'networks', title: 'Networks', singular: 'Network', icon: Network, description: 'Provider networks: link a plan to a contract and its cost-sharing rules',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.planName ?? ''}`,
    sections: [
      { title: 'Network', fields: [code('GSI-GOLD-GN'), name(), { key: 'planId', label: 'Plan', type: 'ref', required: true, ref: { entity: 'insurance-plans', display: 'planName' } }, { key: 'priceListId', label: 'Contract (price list)', type: 'ref', required: true, ref: { entity: 'price-lists', display: 'priceListName' } }, STATUS] },
      {
        title: 'Cost sharing & authorization', fields: [
          { key: 'copayPct', label: 'Co-pay %', type: 'percent', defaultValue: 0 }, { key: 'deductible', label: 'Deductible per visit', type: 'money', defaultValue: 0 },
          { key: 'maxCopayPerVisit', label: 'Co-pay cap per visit', type: 'money', defaultValue: 0, hint: '0 means no cap' },
          { key: 'priorAuthLimit', label: 'Prior approval above', type: 'money', defaultValue: 0, hint: 'Lines above this net amount need approval' },
        ],
      },
    ],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '130px' }, { key: 'name', header: 'Network' }, { key: 'planName', header: 'Plan' }, { key: 'priceListName', header: 'Contract' }, { key: 'copayPct', header: 'Co-pay', kind: 'percent', align: 'right' }, { key: 'maxCopayPerVisit', header: 'Cap', kind: 'money', align: 'right' }, { key: 'priorAuthLimit', header: 'PA limit', kind: 'money', align: 'right' }, { key: 'status', header: 'Status', kind: 'status' }],
  },
  'price-lists': {
    entity: 'price-lists', title: 'Contracts', singular: 'Contract', icon: FileSignature, description: 'Price lists: the cash tariff and payer contracts',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.contractType}`,
    sections: [{
      title: 'Contract', fields: [code('GSI-2026'), name('Contract name'), { key: 'contractType', label: 'Contract type', type: 'select', required: true, options: ['Cash', 'Insurance', 'Corporate', 'Government'] },
        { key: 'payerId', label: 'Payer', type: 'ref', ref: { entity: 'payers', display: 'payerName' }, visibleIf: (r) => r.contractType !== 'Cash' },
        { key: 'validFrom', label: 'Valid from', type: 'date', required: true }, { key: 'validTo', label: 'Valid to', type: 'date', required: true },
        { key: 'defaultDiscountPct', label: 'Default discount %', type: 'percent', defaultValue: 0, hint: 'Applied to base price when no contract line exists' }, STATUS],
    }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '110px' }, { key: 'name', header: 'Contract' }, { key: 'contractType', header: 'Type', kind: 'badge' }, { key: 'payerName', header: 'Payer' }, { key: 'validFrom', header: 'From', kind: 'date' }, { key: 'validTo', header: 'To', kind: 'date' }, { key: 'defaultDiscountPct', header: 'Discount', kind: 'percent', align: 'right' }, { key: 'status', header: 'Status', kind: 'status' }],
    links: (r) => [{ href: `/contracts?priceListId=${r.id}`, label: 'Pricing lines' }],
  },
  items: {
    entity: 'items', title: 'Items', singular: 'Item', icon: Boxes, description: 'Stock-managed drugs, consumables and devices',
    titleOf: (r) => r.name, subtitleOf: (r) => [r.code, r.genericName, r.strength].filter(Boolean).join(' · '),
    sections: [
      {
        title: 'Item', fields: [code('ITM-PAR500'), name('Item name'), { key: 'category', label: 'Category', type: 'select', required: true, options: ['Drug', 'Consumable', 'Orthotic'] },
          { key: 'genericName', label: 'Generic name', type: 'text', visibleIf: (r) => r.category === 'Drug' }, { key: 'form', label: 'Form', type: 'select', options: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Inhaler', 'Gel', 'Cream', 'Drops'], visibleIf: (r) => r.category === 'Drug' },
          { key: 'strength', label: 'Strength', type: 'text', visibleIf: (r) => r.category === 'Drug' },
          { key: 'requiresErx', label: 'Requires eRx', type: 'checkbox', defaultValue: false, visibleIf: (r) => r.category === 'Drug', hint: 'Prescription must be validated by the payer' }, STATUS],
      },
      {
        title: 'Stock & price', fields: [{ key: 'uom', label: 'Unit', type: 'select', required: true, options: ['Pack', 'Each', 'Tube', 'Roll', 'Bottle'] }, { key: 'stockQty', label: 'On hand', type: 'number', defaultValue: 0 },
          { key: 'reorderLevel', label: 'Reorder level', type: 'number', defaultValue: 0 }, { key: 'basePrice', label: 'Base price', type: 'money', required: true }, { key: 'taxPct', label: 'Tax %', type: 'percent', defaultValue: 0 }],
      },
    ],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '120px' }, { key: 'name', header: 'Item' }, { key: 'category', header: 'Category', kind: 'badge' }, { key: 'uom', header: 'Unit' }, { key: 'stockQty', header: 'On hand', kind: 'number', align: 'right' }, { key: 'basePrice', header: 'Base price', kind: 'money', align: 'right' }, { key: 'requiresErx', header: 'eRx', kind: 'bool' }, { key: 'status', header: 'Status', kind: 'status' }],
    presets: { param: 'category', label: 'Category', values: ['Drug', 'Consumable', 'Orthotic'] },
  },
  services: {
    entity: 'services', title: 'Services', singular: 'Service', icon: ClipboardList, description: 'Non-stock chargeable services: consultations, lab, radiology, procedures',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.category}`,
    sections: [{
      title: 'Service', fields: [code('SRV-LAB-CBC'), name('Service name'), { key: 'category', label: 'Category', type: 'select', required: true, options: ['Consultation', 'Laboratory', 'Radiology', 'Procedure', 'Nursing', 'Physiotherapy'] },
        { key: 'departmentId', label: 'Performing department', type: 'ref', ref: { entity: 'departments', display: 'departmentName' } }, { key: 'basePrice', label: 'Base price', type: 'money', required: true },
        { key: 'durationMin', label: 'Duration (min)', type: 'number', defaultValue: 15 }, STATUS],
    }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '130px' }, { key: 'name', header: 'Service' }, { key: 'category', header: 'Category', kind: 'badge' }, { key: 'departmentName', header: 'Department' }, { key: 'durationMin', header: 'Min', kind: 'number', align: 'right' }, { key: 'basePrice', header: 'Base price', kind: 'money', align: 'right' }, { key: 'status', header: 'Status', kind: 'status' }],
    presets: { param: 'category', label: 'Category', values: ['Consultation', 'Laboratory', 'Radiology', 'Procedure', 'Nursing', 'Physiotherapy'] },
  },
  resources: {
    entity: 'resources', title: 'Resources', singular: 'Resource', icon: Wrench, description: 'Bookable providers, rooms and equipment',
    titleOf: (r) => r.name, subtitleOf: (r) => `${r.code} · ${r.resourceType} · ${r.departmentName ?? ''}`,
    sections: [{
      title: 'Resource', fields: [code('RS-SH'), name('Display name'), { key: 'resourceType', label: 'Resource type', type: 'select', required: true, options: ['Provider', 'Room', 'Equipment'] },
        { key: 'departmentId', label: 'Department', type: 'ref', required: true, ref: { entity: 'departments', display: 'departmentName' } },
        { key: 'providerId', label: 'Provider', type: 'ref', ref: { entity: 'providers', filterBy: { departmentId: 'departmentId' }, display: 'providerName' }, visibleIf: (r) => r.resourceType === 'Provider', onPick: (m) => (m ? { name: m.name } : {}) }, STATUS],
    }],
    columns: [{ key: 'code', header: 'Code', kind: 'code', width: '110px' }, { key: 'name', header: 'Resource' }, { key: 'resourceType', header: 'Type', kind: 'badge' }, { key: 'departmentName', header: 'Department' }, { key: 'providerName', header: 'Provider' }, { key: 'status', header: 'Status', kind: 'status' }],
    presets: { param: 'resourceType', label: 'Type', values: ['Provider', 'Room', 'Equipment'] },
    links: (r) => [{ href: `/masters/resource-schedules?resourceId=${r.id}`, label: 'Availability' }, { href: `/appointments?resourceId=${r.id}`, label: 'Bookings' }],
  },
  'resource-schedules': {
    entity: 'resource-schedules', title: 'Availability', singular: 'Schedule', icon: CalendarClock, description: 'Recurring working hours and slot length per resource',
    titleOf: (r) => r.resourceName || 'Schedule', subtitleOf: (r) => `${String(r.days ?? '').split('|').join(', ')} · ${r.startTime}-${r.endTime}`,
    sections: [{
      title: 'Working hours', fields: [
        { key: 'resourceId', label: 'Resource', type: 'ref', required: true, span: 2, ref: { entity: 'resources', display: 'resourceName' } },
        { key: 'slotMinutes', label: 'Slot length (min)', type: 'number', required: true, defaultValue: 15 }, STATUS,
        { key: 'days', label: 'Days', type: 'days', required: true, span: 4, defaultValue: 'Mon|Tue|Wed|Thu|Fri' },
        { key: 'startTime', label: 'Start time', type: 'time', required: true, defaultValue: '08:00' }, { key: 'endTime', label: 'End time', type: 'time', required: true, defaultValue: '13:00' },
        { key: 'validFrom', label: 'Valid from', type: 'date', required: true }, { key: 'validTo', label: 'Valid to', type: 'date', required: true },
      ],
    }],
    columns: [{ key: 'resourceName', header: 'Resource' }, { key: 'days', header: 'Days' }, { key: 'startTime', header: 'From', width: '80px' }, { key: 'endTime', header: 'To', width: '80px' }, { key: 'slotMinutes', header: 'Slot', kind: 'number', align: 'right' }, { key: 'validFrom', header: 'Valid from', kind: 'date' }, { key: 'validTo', header: 'Valid to', kind: 'date' }, { key: 'status', header: 'Status', kind: 'status' }],
  },
  'resource-blocks': {
    entity: 'resource-blocks', title: 'Blocks & leave', singular: 'Block', icon: CalendarX2, description: 'One-off unavailability: leave, meetings, maintenance',
    titleOf: (r) => `${r.resourceName || 'Block'} · ${r.reason ?? ''}`, subtitleOf: (r) => `${r.date} ${r.startTime}-${r.endTime}`,
    sections: [{
      title: 'Block', fields: [
        { key: 'resourceId', label: 'Resource', type: 'ref', required: true, span: 2, ref: { entity: 'resources', display: 'resourceName' } }, { key: 'date', label: 'Date', type: 'date', required: true }, STATUS,
        { key: 'startTime', label: 'From', type: 'time', required: true }, { key: 'endTime', label: 'To', type: 'time', required: true }, { key: 'reason', label: 'Reason', type: 'text', required: true, span: 2 },
      ],
    }],
    columns: [{ key: 'resourceName', header: 'Resource' }, { key: 'date', header: 'Date', kind: 'date', sortKey: 'date' }, { key: 'startTime', header: 'From', width: '80px' }, { key: 'endTime', header: 'To', width: '80px' }, { key: 'reason', header: 'Reason' }, { key: 'status', header: 'Status', kind: 'status' }],
  },
};

export const allFields = (def: MasterDef) => def.sections.flatMap((s) => s.fields);
export const blankRecord = (def: MasterDef): Row => Object.fromEntries(allFields(def).map((f) => [f.key, f.defaultValue ?? (f.type === 'checkbox' ? false : '')]));

/** Converts form strings to the types the API stores. */
export function toPayload(def: MasterDef, r: Row): Row {
  const out: Row = {};
  for (const f of allFields(def)) {
    const v = r[f.key];
    if (['number', 'money', 'percent'].includes(f.type)) out[f.key] = v === '' || v === null || v === undefined ? 0 : Number(v);
    else if (f.type === 'checkbox') out[f.key] = !!v;
    else out[f.key] = v ?? '';
  }
  return out;
}
