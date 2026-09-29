/** CarePoint reference workspace, separate from the existing Healthcare module. */
export const HEALTHCARE_SUITE_REFERENCE = {
  "id": "reference-healthcare-suite",
  "variant": "healthcare-suite",
  "title": "Healthcare Suite",
  "shortLabel": "Healthcare Suite",
  "accent": "#0e7490",
  "pages": [
    {
      "id": "reference-healthcare-suite-dashboard",
      "path": "/",
      "title": "Dashboard",
      "section": "front"
    },
    {
      "id": "reference-healthcare-suite-appointments",
      "path": "/appointments",
      "title": "Appointments",
      "section": "front"
    },
    {
      "id": "reference-healthcare-suite-patients",
      "path": "/patients",
      "title": "Patients",
      "section": "front"
    },
    {
      "id": "reference-healthcare-suite-encounters",
      "path": "/encounters",
      "title": "Encounters",
      "section": "front"
    },
    {
      "id": "reference-healthcare-suite-approvals",
      "path": "/approvals",
      "title": "Approvals & eRx",
      "section": "front"
    },
    {
      "id": "reference-healthcare-suite-billing-hospital",
      "path": "/billing/hospital",
      "title": "Hospital billing",
      "section": "billing"
    },
    {
      "id": "reference-healthcare-suite-billing-pharmacy",
      "path": "/billing/pharmacy",
      "title": "Pharmacy billing",
      "section": "billing"
    },
    {
      "id": "reference-healthcare-suite-billing-invoices",
      "path": "/billing/invoices",
      "title": "Invoices",
      "section": "billing"
    },
    {
      "id": "reference-healthcare-suite-masters-payers",
      "path": "/masters/payers",
      "title": "Payers",
      "section": "insurance"
    },
    {
      "id": "reference-healthcare-suite-masters-tpas",
      "path": "/masters/tpas",
      "title": "TPAs",
      "section": "insurance"
    },
    {
      "id": "reference-healthcare-suite-masters-insurance-plans",
      "path": "/masters/insurance-plans",
      "title": "Plans",
      "section": "insurance"
    },
    {
      "id": "reference-healthcare-suite-masters-networks",
      "path": "/masters/networks",
      "title": "Networks",
      "section": "insurance"
    },
    {
      "id": "reference-healthcare-suite-masters-price-lists",
      "path": "/masters/price-lists",
      "title": "Contracts",
      "section": "insurance"
    },
    {
      "id": "reference-healthcare-suite-contracts",
      "path": "/contracts",
      "title": "Contract pricing",
      "section": "insurance"
    },
    {
      "id": "reference-healthcare-suite-masters-items",
      "path": "/masters/items",
      "title": "Items (stock)",
      "section": "catalog"
    },
    {
      "id": "reference-healthcare-suite-masters-services",
      "path": "/masters/services",
      "title": "Services",
      "section": "catalog"
    },
    {
      "id": "reference-healthcare-suite-masters-facilities",
      "path": "/masters/facilities",
      "title": "Facilities",
      "section": "org"
    },
    {
      "id": "reference-healthcare-suite-masters-departments",
      "path": "/masters/departments",
      "title": "Departments",
      "section": "org"
    },
    {
      "id": "reference-healthcare-suite-masters-specialties",
      "path": "/masters/specialties",
      "title": "Specialties",
      "section": "org"
    },
    {
      "id": "reference-healthcare-suite-masters-providers",
      "path": "/masters/providers",
      "title": "Providers & staff",
      "section": "org"
    },
    {
      "id": "reference-healthcare-suite-masters-resources",
      "path": "/masters/resources",
      "title": "Resources",
      "section": "scheduling"
    },
    {
      "id": "reference-healthcare-suite-masters-resource-schedules",
      "path": "/masters/resource-schedules",
      "title": "Availability",
      "section": "scheduling"
    },
    {
      "id": "reference-healthcare-suite-masters-resource-blocks",
      "path": "/masters/resource-blocks",
      "title": "Blocks & leave",
      "section": "scheduling"
    },
    {
      "id": "reference-healthcare-suite-rcm-claims",
      "path": "/rcm/claims",
      "title": "Claims, payers and appeals",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-exchange",
      "path": "/rcm/exchange",
      "title": "Payer connections",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-remittances",
      "path": "/rcm/remittances",
      "title": "Remittances and clawbacks",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-patient-finance",
      "path": "/rcm/patient-finance",
      "title": "Refunds, credits and deposits",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-packages",
      "path": "/rcm/packages",
      "title": "Packages and case rates",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-drg",
      "path": "/rcm/drg",
      "title": "DRG and day-case grouping",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-accounting",
      "path": "/rcm/accounting",
      "title": "Accounting and reconciliation",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-commercial",
      "path": "/rcm/commercial",
      "title": "Commercial governance",
      "section": "rcm"
    },
    {
      "id": "reference-healthcare-suite-rcm-receivables",
      "path": "/rcm/receivables",
      "title": "Receivables and collections",
      "section": "rcm"
    }
  ]
} as const;
export const HEALTHCARE_SUITE_SECTION_TITLES:Readonly<Record<string,string>> = {
  "rcm": "Revenue cycle management",
  "front": "Front office",
  "billing": "Billing",
  "insurance": "Insurance & pricing",
  "catalog": "Catalog",
  "org": "Organization",
  "scheduling": "Scheduling setup"
};
