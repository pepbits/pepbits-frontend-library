/** Original Phial navigation plus its Settings destination, hosted as Pharmacy-1. */
export const PHARMACY_REFERENCE = {
  "id": "reference-pharmacy",
  "variant": "pharmacy",
  "title": "Pharmacy-1",
  "shortLabel": "Pharmacy-1",
  "accent": "#2a4bd7",
  "pages": [
    {
      "id": "reference-pharmacy-dashboard",
      "path": "/",
      "title": "Command center",
      "section": "operate"
    },
    {
      "id": "reference-pharmacy-workbench",
      "path": "/workbench",
      "title": "Rx workbench",
      "section": "operate"
    },
    {
      "id": "reference-pharmacy-counter",
      "path": "/counter",
      "title": "Counter sale",
      "section": "operate"
    },
    {
      "id": "reference-pharmacy-orders",
      "path": "/orders",
      "title": "Customer orders",
      "section": "operate"
    },
    {
      "id": "reference-pharmacy-sales",
      "path": "/sales",
      "title": "Sales and returns",
      "section": "operate"
    },
    {
      "id": "reference-pharmacy-inventory",
      "path": "/inventory",
      "title": "Inventory",
      "section": "stock"
    },
    {
      "id": "reference-pharmacy-purchasing",
      "path": "/purchasing",
      "title": "Purchasing",
      "section": "stock"
    },
    {
      "id": "reference-pharmacy-authorizations",
      "path": "/authorizations",
      "title": "Prior authorizations",
      "section": "revenue"
    },
    {
      "id": "reference-pharmacy-claims",
      "path": "/claims",
      "title": "Claims",
      "section": "revenue"
    },
    {
      "id": "reference-pharmacy-remittance",
      "path": "/remittance",
      "title": "Remittance & payments",
      "section": "revenue"
    },
    {
      "id": "reference-pharmacy-patients",
      "path": "/patients",
      "title": "Patients",
      "section": "records"
    },
    {
      "id": "reference-pharmacy-audit",
      "path": "/audit",
      "title": "Audit trail",
      "section": "records"
    },
    {
      "id": "reference-pharmacy-settings",
      "path": "/settings",
      "title": "Settings",
      "section": "configuration"
    }
  ]
} as const;
