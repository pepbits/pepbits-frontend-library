import type { EntitySchema, FormOption } from "./types.ts";

const statusOptions: FormOption[] = [
  { label: "Active", value: "Active" },
  { label: "Inactive", value: "Inactive" },
  { label: "Draft", value: "Draft" },
  { label: "On hold", value: "On Hold" },
];

const countryOptions: FormOption[] = [
  { label: "United Arab Emirates", value: "AE" },
  { label: "India", value: "IN" },
  { label: "Saudi Arabia", value: "SA" },
  { label: "Qatar", value: "QA" },
  { label: "United Kingdom", value: "GB" },
];

export const ENTITY_SCHEMAS: Record<string, EntitySchema> = {
  user: {
    id: "user",
    singular: "User",
    plural: "Users",
    description: "Identity, access, organization assignment, security policy and personal settings.",
    sections: [
      {
        id: "identity",
        title: "Identity",
        description: "Core identity and sign-in details.",
        fields: [
          { id: "userCode", label: "User code", type: "text", required: true, placeholder: "USR-000245" },
          { id: "displayName", label: "Display name", type: "text", required: true, placeholder: "Enter full name" },
          { id: "email", label: "Business email", type: "email", required: true, placeholder: "name@company.com" },
          { id: "mobile", label: "Mobile number", type: "phone", placeholder: "+971 50 000 0000" },
          { id: "employeeRef", label: "Linked employee", type: "select", options: [
            { label: "EMP-1042 • Prakash Mathew", value: "EMP-1042" },
            { label: "EMP-1086 • Sara Ahmed", value: "EMP-1086" },
            { label: "EMP-1120 • Omar Khan", value: "EMP-1120" },
          ] },
          { id: "status", label: "Account status", type: "select", required: true, options: statusOptions, defaultValue: "Active" },
        ],
      },
      {
        id: "access",
        title: "Access & roles",
        description: "Role, branch and module entitlements. Changes are audited.",
        fields: [
          { id: "roles", label: "Assigned roles", type: "multiselect", required: true, colSpan: 2, options: [
            { label: "Enterprise Administrator", value: "enterprise-admin" },
            { label: "Finance Manager", value: "finance-manager" },
            { label: "HR Business Partner", value: "hr-business-partner" },
            { label: "Operations Analyst", value: "operations-analyst" },
            { label: "Internal Auditor", value: "auditor" },
          ], defaultValue: ["operations-analyst"] },
          { id: "branches", label: "Accessible branches", type: "multiselect", required: true, colSpan: 2, options: [
            { label: "Abu Dhabi • Head Office", value: "hq" },
            { label: "Dubai • Business Center", value: "dubai" },
            { label: "Sharjah • Operations Hub", value: "sharjah" },
            { label: "Kochi • Delivery Center", value: "india" },
          ], defaultValue: ["hq", "dubai"] },
          { id: "modules", label: "Modules", type: "multiselect", colSpan: 2, options: [
            { label: "Human Resources", value: "hr" },
            { label: "Finance & Accounting", value: "finance" },
            { label: "Payroll", value: "payroll" },
            { label: "Sales & CRM", value: "sales" },
            { label: "Supply Chain", value: "supply" },
          ], defaultValue: ["hr", "finance"] },
        ],
      },
      {
        id: "security",
        title: "Security policy",
        description: "Authentication, session and risk controls.",
        fields: [
          { id: "mfa", label: "Require multi-factor authentication", type: "toggle", defaultValue: true },
          { id: "sso", label: "Single sign-on account", type: "toggle", defaultValue: true },
          { id: "sessionTimeout", label: "Session timeout", type: "select", options: [
            { label: "15 minutes", value: "15" }, { label: "30 minutes", value: "30" }, { label: "60 minutes", value: "60" }, { label: "8 hours", value: "480" },
          ], defaultValue: "30" },
          { id: "riskLevel", label: "Risk profile", type: "select", options: [
            { label: "Standard", value: "standard" }, { label: "Privileged", value: "privileged" }, { label: "Service account", value: "service" },
          ], defaultValue: "standard" },
          { id: "validFrom", label: "Access valid from", type: "date" },
          { id: "validTo", label: "Access valid until", type: "date" },
        ],
      },
      {
        id: "preferences",
        title: "User defaults",
        description: "Initial workspace defaults; the user can refine these later.",
        fields: [
          { id: "language", label: "Default language", type: "select", options: [
            { label: "English", value: "en" }, { label: "Arabic", value: "ar" }, { label: "Hindi", value: "hi" }, { label: "Malayalam", value: "ml" },
          ], defaultValue: "en" },
          { id: "landingModule", label: "Landing module", type: "select", options: [
            { label: "Human Resources", value: "hr" }, { label: "Finance & Accounting", value: "finance" }, { label: "Payroll", value: "payroll" }, { label: "Sales", value: "sales" }, { label: "Supply Chain", value: "supply" },
          ], defaultValue: "hr" },
          { id: "dateFormat", label: "Date format", type: "select", options: [
            { label: "DD MMM YYYY", value: "dd-mmm-yyyy" }, { label: "DD/MM/YYYY", value: "dd/mm/yyyy" }, { label: "YYYY-MM-DD", value: "iso" },
          ] },
          { id: "timeZone", label: "Time zone", type: "select", options: [
            { label: "Asia/Dubai (UTC+4)", value: "Asia/Dubai" }, { label: "Asia/Kolkata (UTC+5:30)", value: "Asia/Kolkata" }, { label: "Europe/London", value: "Europe/London" },
          ], defaultValue: "Asia/Dubai" },
        ],
      },
      {
        id: "audit",
        title: "Audit & notes",
        description: "Administrative reason and record ownership.",
        fields: [
          { id: "owner", label: "Record owner", type: "select", options: [
            { label: "Identity Operations", value: "identity-ops" }, { label: "HR Shared Services", value: "hr-shared" }, { label: "IT Service Desk", value: "it-desk" },
          ] },
          { id: "ticket", label: "Request / ticket reference", type: "text", placeholder: "REQ-2026-01842" },
          { id: "notes", label: "Administrative notes", type: "textarea", colSpan: 2, placeholder: "Reason, restrictions, dependencies or handover notes" },
        ],
      },
    ],
  },
  consultation: {
    id: "consultation",
    singular: "Consultation",
    plural: "Consultations",
    description: "Outpatient consultation: presentation, examination, assessment and plan.",
    sections: [
      { id: "encounter", title: "Encounter", description: "Who was seen, by whom, and under what cover.", fields: [
        { id: "consultationCode", label: "Consultation no.", type: "text", required: true, placeholder: "CON-48100" },
        { id: "patient", label: "Patient MRN", type: "text", required: true, placeholder: "MRN-90210" },
        { id: "consultedOn", label: "Seen on", type: "date", required: true },
        { id: "specialty", label: "Specialty", type: "select", required: true, options: [
          { label: "General Medicine", value: "General Medicine" }, { label: "Cardiology", value: "Cardiology" },
          { label: "Orthopaedics", value: "Orthopaedics" }, { label: "Paediatrics", value: "Paediatrics" },
          { label: "Endocrinology", value: "Endocrinology" }, { label: "Dermatology", value: "Dermatology" },
        ] },
        { id: "clinician", label: "Consulting clinician", type: "text", required: true, placeholder: "Dr Haddad" },
        { id: "payer", label: "Payer", type: "select", options: [
          { label: "Daman", value: "Daman" }, { label: "AXA Gulf", value: "AXA Gulf" }, { label: "Thiqa", value: "Thiqa" },
          { label: "MetLife", value: "MetLife" }, { label: "Self-pay", value: "Self-pay" },
        ] },
      ] },
      { id: "presentation", title: "Presentation", description: "What the patient came with, in their terms and yours.", fields: [
        { id: "chiefComplaint", label: "Presenting complaint", type: "text", required: true, colSpan: 2, placeholder: "In the patient's own words where possible" },
        { id: "history", label: "History of presenting complaint", type: "textarea", colSpan: 2 },
        { id: "pastHistory", label: "Relevant past history", type: "textarea", colSpan: 2 },
        { id: "allergies", label: "Allergies", type: "text", placeholder: "Or 'none known'" },
        { id: "currentMedication", label: "Current medication", type: "textarea", colSpan: 2 },
      ] },
      { id: "examination", title: "Examination", description: "Observations and findings recorded at the visit.", fields: [
        { id: "bloodPressure", label: "Blood pressure", type: "text", placeholder: "120/80" },
        { id: "pulse", label: "Pulse (bpm)", type: "number" },
        { id: "temperature", label: "Temperature (°C)", type: "text", placeholder: "36.8" },
        { id: "examinationNotes", label: "Findings", type: "textarea", colSpan: 2 },
      ] },
      { id: "assessment", title: "Assessment and plan", description: "The clinical conclusion and what happens next.", fields: [
        { id: "primaryDiagnosis", label: "Primary diagnosis", type: "text", required: true, colSpan: 2 },
        { id: "differential", label: "Differential", type: "textarea", colSpan: 2 },
        { id: "plan", label: "Management plan", type: "textarea", required: true, colSpan: 2 },
        { id: "outcome", label: "Outcome", type: "select", required: true, options: [
          { label: "Follow-up in 4 weeks", value: "Follow-up in 4 weeks" }, { label: "Discharged to GP", value: "Discharged to GP" },
          { label: "Referred for imaging", value: "Referred for imaging" }, { label: "Referred to specialist", value: "Referred to specialist" },
          { label: "Medication adjusted", value: "Medication adjusted" }, { label: "Admitted", value: "Admitted" },
        ] },
        { id: "followUp", label: "Follow-up date", type: "date" },
        { id: "acuity", label: "Acuity", type: "select", options: [
          { label: "Routine", value: "Routine" }, { label: "Urgent", value: "Urgent" }, { label: "Critical", value: "Critical" },
        ], defaultValue: "Routine" },
      ] },
    ],
  },
  customer: {
    id: "customer",
    singular: "Customer",
    plural: "Customers",
    description: "Party identity, commercial profile, addresses, taxation and credit controls.",
    sections: [
      { id: "profile", title: "Customer profile", description: "Primary commercial identity and classification.", fields: [
        { id: "customerCode", label: "Customer code", type: "text", required: true, placeholder: "CUS-000482" },
        { id: "legalName", label: "Legal name", type: "text", required: true, placeholder: "Registered company or person" },
        { id: "tradeName", label: "Trade name", type: "text", placeholder: "Display name" },
        { id: "customerType", label: "Customer type", type: "select", required: true, options: [
          { label: "Corporate", value: "Corporate" }, { label: "Retail", value: "Retail" }, { label: "Government", value: "Government" }, { label: "Distributor", value: "Distributor" },
        ] },
        { id: "segment", label: "Segment", type: "select", options: [
          { label: "Enterprise", value: "Enterprise" }, { label: "Mid-market", value: "Mid-market" }, { label: "SMB", value: "SMB" }, { label: "Strategic", value: "Strategic" },
        ] },
        { id: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "Active" },
      ] },
      { id: "contact", title: "Contacts", description: "Communication and account ownership.", fields: [
        { id: "contactName", label: "Primary contact", type: "text", required: true },
        { id: "email", label: "Email", type: "email", required: true },
        { id: "phone", label: "Phone", type: "phone" },
        { id: "accountManager", label: "Account manager", type: "select", options: [
          { label: "Maya Thomas", value: "maya" }, { label: "Ibrahim Noor", value: "ibrahim" }, { label: "Leena George", value: "leena" },
        ] },
        { id: "preferredChannels", label: "Preferred channels", type: "multiselect", colSpan: 2, options: [
          { label: "Email", value: "email" }, { label: "Phone", value: "phone" }, { label: "Portal", value: "portal" }, { label: "WhatsApp Business", value: "whatsapp" },
        ] },
      ] },
      { id: "address", title: "Address", description: "Billing and registered location.", fields: [
        { id: "address1", label: "Address line 1", type: "text", required: true, colSpan: 2 },
        { id: "address2", label: "Address line 2", type: "text", colSpan: 2 },
        { id: "city", label: "City", type: "text", required: true },
        { id: "state", label: "State / Emirate", type: "select", optionsByField: {field:"country",values:{
          AE: [{label:"Abu Dhabi",value:"Abu Dhabi"},{label:"Dubai",value:"Dubai"},{label:"Sharjah",value:"Sharjah"}],
          SA: [{label:"Riyadh",value:"Riyadh"},{label:"Makkah",value:"Makkah"}],
          QA: [{label:"Doha",value:"Doha"},{label:"Al Rayyan",value:"Al Rayyan"}],
          GB: [{label:"England",value:"England"},{label:"Scotland",value:"Scotland"},{label:"Wales",value:"Wales"},{label:"Northern Ireland",value:"Northern Ireland"}],
          IN: [{label:"Kerala",value:"Kerala"},{label:"Maharashtra",value:"Maharashtra"}],
        }} },
        { id: "country", label: "Country", type: "select", required: true, options: countryOptions, defaultValue: "AE" },
        { id: "postalCode", label: "Postal code", type: "text" },
      ] },
      { id: "tax", title: "Tax & compliance", description: "Tax registration, jurisdiction and invoicing settings.", fields: [
        { id: "taxRegistration", label: "Tax registration number", type: "text", placeholder: "100XXXXXXXXXXXX" },
        { id: "jurisdiction", label: "Jurisdiction", type: "select", options: [
          { label: "UAE Federal", value: "uae-federal" }, { label: "Saudi Arabia", value: "ksa" }, { label: "India GST", value: "india-gst" }, { label: "Export / zero-rated", value: "export" },
        ] },
        { id: "taxExempt", label: "Tax exempt", type: "toggle" },
        { id: "eInvoice", label: "Electronic invoice enabled", type: "toggle", defaultValue: true },
      ] },
      { id: "credit", title: "Credit controls", description: "Terms, limits and collection risk.", fields: [
        { id: "creditLimit", label: "Credit limit", type: "number", min: 0, prefix: "AED", defaultValue: 100000 },
        { id: "paymentTerms", label: "Payment terms", type: "select", options: [
          { label: "Due immediately", value: "0" }, { label: "Net 15", value: "15" }, { label: "Net 30", value: "30" }, { label: "Net 60", value: "60" }, { label: "Net 90", value: "90" },
        ], defaultValue: "30" },
        { id: "creditHold", label: "Place on credit hold", type: "toggle" },
        { id: "riskRating", label: "Risk rating", type: "select", options: [
          { label: "Low", value: "Low" }, { label: "Medium", value: "Medium" }, { label: "High", value: "High" },
        ], defaultValue: "Low" },
        { id: "collectionNotes", label: "Collection notes", type: "textarea", colSpan: 2, visibleWhen: {field:"creditHold",equals:true}, requiredWhen: {field:"creditHold",equals:true} },
      ] },
    ],
  },
};

export function getEntitySchema(entity = "record", title = "Record"): EntitySchema {
  if (ENTITY_SCHEMAS[entity]) return ENTITY_SCHEMAS[entity];
  return {
    id: entity,
    singular: title.replace(/ (Master|Worklist|Entry|Review|Setup)$/i, ""),
    plural: title,
    description: `Reusable schema-driven ${title.toLowerCase()} form.`,
    sections: [
      { id: "general", title: "General information", description: "Identification, ownership and lifecycle.", fields: [
        { id: "code", label: "Code", type: "text", required: true, placeholder: "Auto or manual code" },
        { id: "name", label: "Name", type: "text", required: true, placeholder: `Enter ${title.toLowerCase()} name` },
        { id: "category", label: "Category", type: "select", options: [
          { label: "Primary", value: "Primary" }, { label: "Secondary", value: "Secondary" }, { label: "Internal", value: "Internal" }, { label: "External", value: "External" },
        ] },
        { id: "status", label: "Status", type: "select", options: statusOptions, defaultValue: "Active" },
        { id: "effectiveFrom", label: "Effective from", type: "date" },
        { id: "effectiveTo", label: "Effective to", type: "date", notBefore: "effectiveFrom" },
      ] },
      { id: "assignment", title: "Assignment", description: "Organizational scope and ownership.", fields: [
        { id: "branch", label: "Branch", type: "select", required: true, options: [
          { label: "Abu Dhabi • Head Office", value: "hq" }, { label: "Dubai • Business Center", value: "dubai" }, { label: "Sharjah • Operations Hub", value: "sharjah" },
        ] },
        { id: "department", label: "Department", type: "select", options: [
          { label: "Finance", value: "finance" }, { label: "Human Resources", value: "hr" }, { label: "Operations", value: "operations" }, { label: "Sales", value: "sales" },
        ] },
        { id: "owner", label: "Owner", type: "text" },
        { id: "tags", label: "Tags", type: "multiselect", options: [
          { label: "Priority", value: "priority" }, { label: "Audited", value: "audited" }, { label: "Restricted", value: "restricted" }, { label: "Shared", value: "shared" },
        ] },
      ] },
      { id: "details", title: "Details", description: "Additional business information.", fields: [
        { id: "description", label: "Description", type: "textarea", colSpan: 2, placeholder: "Purpose, business rules and notes" },
        { id: "externalRef", label: "External reference", type: "text" },
        { id: "priority", label: "Priority", type: "select", options: [
          { label: "Low", value: "Low" }, { label: "Normal", value: "Normal" }, { label: "High", value: "High" }, { label: "Critical", value: "Critical" },
        ] },
      ] },
      { id: "audit", title: "Audit", description: "Change context and approval controls.", fields: [
        { id: "changeReason", label: "Change reason", type: "textarea", colSpan: 2 },
        { id: "approvalRequired", label: "Approval required", type: "toggle", defaultValue: true },
        { id: "notifyOwner", label: "Notify owner", type: "toggle", defaultValue: true },
      ] },
    ],
  };
}
