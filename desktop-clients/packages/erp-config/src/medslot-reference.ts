export const MEDSLOT_REFERENCE={
  "id": "reference-medslot",
  "variant": "medslot",
  "title": "MedSlot",
  "shortLabel": "MedSlot",
  "accent": "#0f7a68",
  "pages": [
    {
      "id": "reference-medslot-dashboard",
      "path": "/",
      "title": "Dashboard",
      "section": "workspace"
    },
    {
      "id": "reference-medslot-book",
      "path": "/book",
      "title": "Book appointment",
      "section": "workspace",
      "roles": [
        "admin",
        "scheduler"
      ]
    },
    {
      "id": "reference-medslot-calendar",
      "path": "/calendar",
      "title": "Calendar",
      "section": "workspace"
    },
    {
      "id": "reference-medslot-appointments",
      "path": "/appointments",
      "title": "Appointments",
      "section": "workspace"
    },
    {
      "id": "reference-medslot-patients",
      "path": "/patients",
      "title": "Patients",
      "section": "workspace"
    },
    {
      "id": "reference-medslot-resources",
      "path": "/resources",
      "title": "Resources & schedules",
      "section": "setup",
      "roles": [
        "admin",
        "scheduler"
      ]
    },
    {
      "id": "reference-medslot-services",
      "path": "/services",
      "title": "Services",
      "section": "setup",
      "roles": [
        "admin",
        "scheduler"
      ]
    },
    {
      "id": "reference-medslot-departments",
      "path": "/departments",
      "title": "Departments",
      "section": "setup",
      "roles": [
        "admin"
      ]
    },
    {
      "id": "reference-medslot-holidays",
      "path": "/holidays",
      "title": "Holidays",
      "section": "setup",
      "roles": [
        "admin",
        "scheduler"
      ]
    },
    {
      "id": "reference-medslot-notifications",
      "path": "/notifications",
      "title": "Notifications",
      "section": "setup",
      "roles": [
        "admin"
      ]
    },
    {
      "id": "reference-medslot-settings",
      "path": "/settings",
      "title": "Users & settings",
      "section": "admin",
      "roles": [
        "admin"
      ]
    },
    {
      "id": "reference-medslot-audit",
      "path": "/audit",
      "title": "Audit log",
      "section": "admin",
      "roles": [
        "admin"
      ]
    },
    {
      "id": "reference-medslot-patient",
      "path": "/patients/[id]",
      "title": "Patient details",
      "section": "workspace"
    },
    {
      "id": "reference-medslot-resource",
      "path": "/resources/[id]",
      "title": "Resource details",
      "section": "setup",
      "roles": [
        "admin",
        "scheduler"
      ]
    }
  ]
} as const;
