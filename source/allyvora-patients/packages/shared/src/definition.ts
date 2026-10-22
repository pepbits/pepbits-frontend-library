import type { Condition, FieldDef, SectionDef, SectionId } from './types';

export const SECTIONS: SectionDef[] = [
  { id: 'mrn', index: 1, short: 'MRN', title: 'Medical record number', description: 'Registering branch, numbering and patient category' },
  { id: 'personal', index: 2, short: 'Personal', title: 'Personal details', description: 'Name, birth details, sex and demographics' },
  { id: 'contact', index: 3, short: 'Contact', title: 'Contact', description: 'Phone, email and emergency contact' },
  { id: 'address', index: 4, short: 'Address', title: 'Address', description: 'Current and permanent address' },
  { id: 'identity', index: 5, short: 'Identity', title: 'Identity documents', description: 'Government ID and ABHA health account' },
  { id: 'insurance', index: 6, short: 'Insurance', title: 'Insurance and payer', description: 'Who pays for this patient’s care' },
  { id: 'clinical', index: 7, short: 'Clinical', title: 'Clinical summary', description: 'Blood group, allergies and long-term conditions' },
  { id: 'registration', index: 8, short: 'Registration', title: 'Registration', description: 'Visit type, department and registration fee' },
  { id: 'consent', index: 9, short: 'Consent', title: 'Consent', description: 'Treatment, data sharing and signature' },
];

export const SECTION_IDS = SECTIONS.map((s) => s.id);

const eq = (field: string, value: string | boolean): Condition => ({ field, op: 'eq', value });
const neq = (field: string, value: string): Condition => ({ field, op: 'neq', value });
const oneOf = (field: string, value: string[]): Condition => ({ field, op: 'in', value });
const filled = (field: string): Condition => ({ field, op: 'filled' });
const isFalse = (field: string): Condition => ({ field, op: 'false' });

const NAME = { regex: "^[\\p{L}\\p{M} .'-]+$", flags: 'u', message: 'Use letters, spaces, apostrophes or hyphens' };
const MOBILE = { regex: '^[6-9][0-9]{9}$', message: 'Enter a 10-digit mobile number starting with 6–9' };
const PIN = { regex: '^[1-9][0-9]{5}$', message: 'Enter a 6-digit PIN code' };

const identityKnown = eq('identityAvailability', 'known');
const isInsurance = eq('payerType', 'insurance');

export const FIELDS: FieldDef[] = [
  // 1. MRN
  { id: 'branchId', section: 'mrn', label: 'Registering branch', type: 'select', lookup: 'branch', required: true, span: 2, help: 'The branch’s numbering rule assigns the MRN' },
  { id: 'mrn', section: 'mrn', label: 'Branch MRN', type: 'readonly' },
  { id: 'orgNumber', section: 'mrn', label: 'Organisation patient number', type: 'readonly', help: 'Shared across every branch' },
  { id: 'patientCategory', section: 'mrn', label: 'Patient category', type: 'segmented', lookup: 'patientCategory', required: true, span: 2 },
  { id: 'legacyId', section: 'mrn', label: 'Previous hospital ID', type: 'text', maxLength: 30, help: 'From a paper file or an older system', uppercase: true },

  // 2. Personal
  { id: 'identityAvailability', section: 'personal', group: 'Identification', label: 'Identity status', type: 'segmented', lookup: 'identityAvailability', required: true, span: 2 },
  { id: 'identityUnavailableReason', section: 'personal', group: 'Identification', label: 'Reason identity is unavailable', type: 'select', lookup: 'identityUnavailableReason', required: true, visibleWhen: [neq('identityAvailability', 'known')], span: 2 },

  { id: 'title', section: 'personal', group: 'Name', label: 'Title', type: 'select', lookup: 'title' },
  { id: 'givenName', section: 'personal', group: 'Name', label: 'First name', type: 'text', requiredWhen: [identityKnown], maxLength: 60, pattern: NAME, autoComplete: 'given-name' },
  { id: 'middleName', section: 'personal', group: 'Name', label: 'Middle name', type: 'text', maxLength: 60, pattern: NAME, autoComplete: 'additional-name' },
  { id: 'familyName', section: 'personal', group: 'Name', label: 'Last name', type: 'text', maxLength: 60, pattern: NAME, autoComplete: 'family-name', help: 'Leave blank if the patient uses one name' },
  { id: 'displayName', section: 'personal', group: 'Name', label: 'Display name', type: 'text', required: true, maxLength: 120, span: 2, help: 'Built from the name fields. Edit to override.' },
  { id: 'preferredName', section: 'personal', group: 'Name', label: 'Preferred name', type: 'text', maxLength: 60 },
  { id: 'localName', section: 'personal', group: 'Name', label: 'Name in local script', type: 'text', maxLength: 120, help: 'For example, in Malayalam or Hindi' },

  { id: 'dobPrecision', section: 'personal', group: 'Birth and sex', label: 'Date of birth is', type: 'segmented', lookup: 'dobPrecision', required: true, span: 2, requiredMessage: 'Choose how exact the date of birth is' },
  { id: 'dateOfBirth', section: 'personal', group: 'Birth and sex', label: 'Date of birth', type: 'date', required: true, visibleWhen: [eq('dobPrecision', 'exact')], date: { rule: 'past', min: '1900-01-01' } },
  { id: 'birthYear', section: 'personal', group: 'Birth and sex', label: 'Birth year', type: 'number', required: true, visibleWhen: [oneOf('dobPrecision', ['yearMonth', 'year'])], min: 1900, inputMode: 'numeric' },
  { id: 'birthMonth', section: 'personal', group: 'Birth and sex', label: 'Birth month', type: 'select', lookup: 'month', required: true, visibleWhen: [eq('dobPrecision', 'yearMonth')] },
  { id: 'estimatedAge', section: 'personal', group: 'Birth and sex', label: 'Approximate age in years', type: 'number', required: true, visibleWhen: [eq('dobPrecision', 'age')], min: 0, max: 130, inputMode: 'numeric' },
  { id: 'administrativeSex', section: 'personal', group: 'Birth and sex', label: 'Sex', type: 'segmented', lookup: 'administrativeSex', required: true, span: 2 },
  { id: 'genderIdentity', section: 'personal', group: 'Birth and sex', label: 'Gender identity', type: 'select', lookup: 'genderIdentity' },
  { id: 'pronoun', section: 'personal', group: 'Birth and sex', label: 'Pronouns', type: 'select', lookup: 'pronoun' },

  { id: 'maritalStatus', section: 'personal', group: 'Demographics', label: 'Marital status', type: 'select', lookup: 'maritalStatus' },
  { id: 'nationality', section: 'personal', group: 'Demographics', label: 'Nationality', type: 'select', lookup: 'nationality' },
  { id: 'religion', section: 'personal', group: 'Demographics', label: 'Religion', type: 'select', lookup: 'religion' },
  { id: 'race', section: 'personal', group: 'Demographics', label: 'Race', type: 'select', lookup: 'race' },
  { id: 'ethnicity', section: 'personal', group: 'Demographics', label: 'Ethnicity', type: 'select', lookup: 'ethnicity' },
  { id: 'occupation', section: 'personal', group: 'Demographics', label: 'Occupation', type: 'select', lookup: 'occupation' },
  { id: 'educationLevel', section: 'personal', group: 'Demographics', label: 'Education', type: 'select', lookup: 'educationLevel' },

  // 3. Contact
  { id: 'mobile', section: 'contact', group: 'Patient', label: 'Mobile number', type: 'tel', required: true, prefix: '+91', maxLength: 10, pattern: MOBILE, inputMode: 'tel', autoComplete: 'tel-national' },
  { id: 'mobileIsWhatsapp', section: 'contact', group: 'Patient', label: 'WhatsApp on this number', type: 'switch' },
  { id: 'alternatePhone', section: 'contact', group: 'Patient', label: 'Alternate phone', type: 'tel', maxLength: 12, pattern: { regex: '^[0-9]{6,12}$', message: 'Use 6 to 12 digits' }, inputMode: 'tel' },
  { id: 'email', section: 'contact', group: 'Patient', label: 'Email', type: 'email', maxLength: 120, autoComplete: 'email', inputMode: 'email' },
  { id: 'preferredContactMethod', section: 'contact', group: 'Patient', label: 'Preferred contact method', type: 'segmented', lookup: 'contactMethod', span: 2 },
  { id: 'preferredLanguage', section: 'contact', group: 'Patient', label: 'Preferred language', type: 'select', lookup: 'language' },
  { id: 'emergencyName', section: 'contact', group: 'Emergency contact', label: 'Contact name', type: 'text', maxLength: 120, pattern: NAME },
  { id: 'emergencyRelationship', section: 'contact', group: 'Emergency contact', label: 'Relationship', type: 'select', lookup: 'relationship', requiredWhen: [filled('emergencyName')] },
  { id: 'emergencyPhone', section: 'contact', group: 'Emergency contact', label: 'Contact phone', type: 'tel', prefix: '+91', maxLength: 10, pattern: MOBILE, inputMode: 'tel', requiredWhen: [filled('emergencyName')] },

  // 4. Address
  { id: 'addressType', section: 'address', group: 'Current address', label: 'Address type', type: 'segmented', lookup: 'addressType', span: 2 },
  { id: 'pincode', section: 'address', group: 'Current address', label: 'PIN code', type: 'text', required: true, maxLength: 6, pattern: PIN, inputMode: 'numeric', autoComplete: 'postal-code', help: 'Fills in city, district and state' },
  { id: 'addressLine1', section: 'address', group: 'Current address', label: 'House, building and street', type: 'text', required: true, maxLength: 160, span: 2, autoComplete: 'address-line1' },
  { id: 'addressLine2', section: 'address', group: 'Current address', label: 'Area or locality', type: 'text', maxLength: 160, span: 2, autoComplete: 'address-line2' },
  { id: 'landmark', section: 'address', group: 'Current address', label: 'Landmark', type: 'text', maxLength: 120 },
  { id: 'city', section: 'address', group: 'Current address', label: 'City or town', type: 'text', required: true, maxLength: 80, autoComplete: 'address-level2' },
  { id: 'district', section: 'address', group: 'Current address', label: 'District', type: 'text', maxLength: 80 },
  { id: 'state', section: 'address', group: 'Current address', label: 'State', type: 'select', lookup: 'state', required: true },
  { id: 'country', section: 'address', group: 'Current address', label: 'Country', type: 'select', lookup: 'country', required: true },
  { id: 'permanentSameAsCurrent', section: 'address', group: 'Current address', label: 'Permanent address is the same as current', type: 'switch', span: 'full' },
  { id: 'permPincode', section: 'address', group: 'Permanent address', label: 'PIN code', type: 'text', required: true, maxLength: 6, pattern: PIN, inputMode: 'numeric', visibleWhen: [isFalse('permanentSameAsCurrent')] },
  { id: 'permAddressLine1', section: 'address', group: 'Permanent address', label: 'House, building and street', type: 'text', required: true, maxLength: 160, span: 2, visibleWhen: [isFalse('permanentSameAsCurrent')] },
  { id: 'permCity', section: 'address', group: 'Permanent address', label: 'City or town', type: 'text', required: true, maxLength: 80, visibleWhen: [isFalse('permanentSameAsCurrent')] },
  { id: 'permState', section: 'address', group: 'Permanent address', label: 'State', type: 'select', lookup: 'state', required: true, visibleWhen: [isFalse('permanentSameAsCurrent')] },

  // 5. Identity
  { id: 'idDocumentType', section: 'identity', group: 'Government ID', label: 'Primary ID document', type: 'select', lookup: 'idDocumentType' },
  { id: 'idNumber', section: 'identity', group: 'Government ID', label: 'Document number', type: 'text', required: true, maxLength: 20, uppercase: true, sensitive: true, visibleWhen: [filled('idDocumentType')] },
  { id: 'idIssuingCountry', section: 'identity', group: 'Government ID', label: 'Issuing country', type: 'select', lookup: 'country', required: true, visibleWhen: [eq('idDocumentType', 'passport')] },
  { id: 'idExpiry', section: 'identity', group: 'Government ID', label: 'Valid until', type: 'date', required: true, visibleWhen: [oneOf('idDocumentType', ['passport', 'dl'])], date: { rule: 'future', message: 'This document has expired' } },
  { id: 'idVerified', section: 'identity', group: 'Government ID', label: 'Original document seen and verified', type: 'switch', span: 2, visibleWhen: [filled('idDocumentType')] },
  { id: 'abhaNumber', section: 'identity', group: 'ABHA health account', label: 'ABHA number', type: 'text', maxLength: 17, sensitive: true, inputMode: 'numeric', placeholder: '91-1234-5678-9012', pattern: { regex: '^[0-9]{2}-?[0-9]{4}-?[0-9]{4}-?[0-9]{4}$', message: 'Use 14 digits, for example 91-1234-5678-9012' } },
  { id: 'abhaAddress', section: 'identity', group: 'ABHA health account', label: 'ABHA address', type: 'text', maxLength: 60, placeholder: 'name@abdm', pattern: { regex: '^[a-zA-Z0-9._]{4,}@(abdm|sbx)$', message: 'Use the format name@abdm' } },

  // 6. Insurance
  { id: 'payerType', section: 'insurance', label: 'Payer', type: 'segmented', lookup: 'payerType', required: true, span: 2 },
  { id: 'insurer', section: 'insurance', group: 'Policy', label: 'Insurance company', type: 'select', lookup: 'insurer', required: true, visibleWhen: [isInsurance] },
  { id: 'tpa', section: 'insurance', group: 'Policy', label: 'Third-party administrator', type: 'select', lookup: 'tpa', visibleWhen: [isInsurance] },
  { id: 'policyNumber', section: 'insurance', group: 'Policy', label: 'Policy number', type: 'text', required: true, maxLength: 40, uppercase: true, visibleWhen: [isInsurance] },
  { id: 'memberId', section: 'insurance', group: 'Policy', label: 'Member ID', type: 'text', maxLength: 40, uppercase: true, visibleWhen: [isInsurance] },
  { id: 'policyHolderRelation', section: 'insurance', group: 'Policy', label: 'Relationship to policyholder', type: 'select', lookup: 'policyRelation', visibleWhen: [isInsurance] },
  { id: 'validFrom', section: 'insurance', group: 'Policy', label: 'Cover starts', type: 'date', visibleWhen: [isInsurance] },
  { id: 'validTo', section: 'insurance', group: 'Policy', label: 'Cover ends', type: 'date', required: true, visibleWhen: [isInsurance], date: { rule: 'future', message: 'This policy has expired' } },
  { id: 'corporateName', section: 'insurance', group: 'Corporate', label: 'Company', type: 'select', lookup: 'corporate', required: true, visibleWhen: [eq('payerType', 'corporate')] },
  { id: 'employeeId', section: 'insurance', group: 'Corporate', label: 'Employee ID', type: 'text', maxLength: 30, uppercase: true, visibleWhen: [eq('payerType', 'corporate')] },
  { id: 'governmentScheme', section: 'insurance', group: 'Government scheme', label: 'Scheme', type: 'select', lookup: 'govtScheme', required: true, visibleWhen: [eq('payerType', 'government')] },
  { id: 'schemeCardNumber', section: 'insurance', group: 'Government scheme', label: 'Scheme card number', type: 'text', required: true, maxLength: 30, uppercase: true, visibleWhen: [eq('payerType', 'government')] },

  // 7. Clinical
  { id: 'bloodGroup', section: 'clinical', label: 'Blood group', type: 'select', lookup: 'bloodGroup' },
  { id: 'allergyStatus', section: 'clinical', label: 'Allergies', type: 'segmented', lookup: 'allergyStatus', required: true, span: 2 },
  { id: 'allergens', section: 'clinical', label: 'Known allergens', type: 'multiselect', lookup: 'allergen', required: true, span: 2, visibleWhen: [eq('allergyStatus', 'known')] },
  { id: 'allergyNotes', section: 'clinical', label: 'Reactions and severity', type: 'textarea', maxLength: 500, span: 2, visibleWhen: [eq('allergyStatus', 'known')] },
  { id: 'chronicConditions', section: 'clinical', label: 'Long-term conditions', type: 'multiselect', lookup: 'chronicCondition', span: 2 },
  { id: 'currentMedications', section: 'clinical', label: 'Current medicines', type: 'textarea', maxLength: 500, span: 2 },
  { id: 'primaryPhysician', section: 'clinical', label: 'Family doctor', type: 'text', maxLength: 120 },
  { id: 'mobilityAssistance', section: 'clinical', label: 'Needs mobility assistance', type: 'switch' },
  { id: 'organDonor', section: 'clinical', label: 'Registered organ donor', type: 'switch' },
  { id: 'clinicalNotes', section: 'clinical', label: 'Notes for the care team', type: 'textarea', maxLength: 1000, span: 'full' },

  // 8. Registration
  { id: 'registrationType', section: 'registration', label: 'Visit type', type: 'segmented', lookup: 'registrationType', required: true, span: 2 },
  { id: 'priority', section: 'registration', label: 'Priority', type: 'segmented', lookup: 'priority', required: true },
  { id: 'department', section: 'registration', label: 'Department', type: 'select', lookup: 'department', required: true },
  { id: 'consultant', section: 'registration', label: 'Consultant', type: 'select', lookup: 'doctor', lookupParent: 'department', help: 'Filtered by department' },
  { id: 'referralSource', section: 'registration', label: 'How the patient came', type: 'select', lookup: 'referralSource', required: true },
  { id: 'referringDoctor', section: 'registration', label: 'Referring doctor', type: 'text', required: true, maxLength: 120, visibleWhen: [oneOf('referralSource', ['doctor', 'hospital'])] },
  { id: 'referringHospital', section: 'registration', label: 'Referring hospital', type: 'text', required: true, maxLength: 120, visibleWhen: [eq('referralSource', 'hospital')] },
  { id: 'visitReason', section: 'registration', label: 'Reason for visit', type: 'textarea', maxLength: 500, span: 2 },
  { id: 'paymentMode', section: 'registration', label: 'Registration fee paid by', type: 'select', lookup: 'paymentMode', required: true },
  { id: 'feeWaiverReason', section: 'registration', label: 'Reason for waiver', type: 'text', required: true, maxLength: 160, visibleWhen: [eq('paymentMode', 'waived')] },

  // 9. Consent
  { id: 'consentTreatment', section: 'consent', group: 'Permissions', label: 'Consents to registration and treatment', type: 'switch', required: true, span: 2, requiredMessage: 'Treatment consent is needed to register the patient' },
  { id: 'consentDataSharing', section: 'consent', group: 'Permissions', label: 'Share health records through ABDM', type: 'switch', span: 2 },
  { id: 'consentCommunication', section: 'consent', group: 'Permissions', label: 'Appointment reminders by SMS and WhatsApp', type: 'switch', span: 2 },
  { id: 'consentResearch', section: 'consent', group: 'Permissions', label: 'May be contacted about research studies', type: 'switch', span: 2 },
  { id: 'consentGivenBy', section: 'consent', group: 'Given by', label: 'Consent given by', type: 'segmented', lookup: 'consentGivenBy', required: true, span: 2 },
  { id: 'guardianName', section: 'consent', group: 'Given by', label: 'Guardian or relative name', type: 'text', required: true, maxLength: 120, pattern: NAME, visibleWhen: [neq('consentGivenBy', 'patient')] },
  { id: 'guardianRelationship', section: 'consent', group: 'Given by', label: 'Relationship to patient', type: 'select', lookup: 'relationship', required: true, visibleWhen: [neq('consentGivenBy', 'patient')] },
  { id: 'consentDate', section: 'consent', group: 'Given by', label: 'Consent date', type: 'date', required: true, date: { rule: 'past' } },
  { id: 'consentCapture', section: 'consent', group: 'Record', label: 'Captured as', type: 'segmented', lookup: 'consentCapture', required: true },
  { id: 'signature', section: 'consent', group: 'Record', label: 'Signature', type: 'signature', required: true, span: 2, visibleWhen: [eq('consentCapture', 'digital')], requiredMessage: 'Ask the patient to sign' },
  { id: 'paperFormRef', section: 'consent', group: 'Record', label: 'Paper form reference', type: 'text', required: true, maxLength: 40, uppercase: true, visibleWhen: [eq('consentCapture', 'paper')] },
];

export const FIELD_MAP: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.id, f]));

export function sectionOf(fieldId: string): SectionId | undefined {
  return FIELD_MAP[fieldId]?.section;
}

export function sectionDef(id: SectionId): SectionDef {
  return SECTIONS.find((s) => s.id === id)!;
}

/** Fields that build the display name automatically. */
export const NAME_PARTS = ['title', 'givenName', 'middleName', 'familyName'];

/** ID document number patterns, applied based on the selected document type. */
export const ID_PATTERNS: Record<string, { regex: RegExp; message: string }> = {
  aadhaar: { regex: /^[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}$/, message: 'Aadhaar has 12 digits and does not start with 0 or 1' },
  pan: { regex: /^[A-Z]{5}[0-9]{4}[A-Z]$/, message: 'PAN looks like ABCDE1234F' },
  passport: { regex: /^[A-Z][0-9]{7}$/, message: 'Indian passport numbers look like K1234567' },
  voter: { regex: /^[A-Z]{3}[0-9]{7}$/, message: 'Voter ID looks like ABC1234567' },
  dl: { regex: /^[A-Z]{2}[0-9]{2}\s?[0-9]{11}$/, message: 'Driving licence looks like KL07 20110012345' },
};

/** Values for a brand new registration. */
export function defaultValues(today: string, branchId?: number | null): Record<string, string | number | boolean | null> {
  return {
    branchId: branchId ?? null,
    patientCategory: 'general',
    identityAvailability: 'known',
    dobPrecision: 'exact',
    nationality: 'IN',
    mobileIsWhatsapp: true,
    preferredContactMethod: 'whatsapp',
    preferredLanguage: 'ml',
    addressType: 'home',
    country: 'IN',
    permanentSameAsCurrent: true,
    payerType: 'self',
    registrationType: 'op',
    priority: 'routine',
    referralSource: 'walkin',
    paymentMode: 'upi',
    consentCommunication: true,
    consentGivenBy: 'patient',
    consentDate: today,
    consentCapture: 'digital',
  };
}
