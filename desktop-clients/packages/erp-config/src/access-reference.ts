/** Original reference navigation; implementation and seed data are API-owned. */
export const TENANT_ADMIN_REFERENCE={
  "id": "reference-tenant-admin",
  "variant": "tenant-admin",
  "title": "Tenant Admin",
  "shortLabel": "Tenant Admin",
  "accent": "#215249",
  "pages": [
    {
      "id": "reference-tenant-admin-overview",
      "path": "/",
      "title": "Overview",
      "section": "workspace",
      "icon": "LayoutDashboard"
    },
    {
      "id": "reference-tenant-admin-billing-grants",
      "path": "/config/billing-grants",
      "title": "Billing access grants",
      "section": "access",
      "icon": "KeyRound"
    },
    {
      "id": "reference-tenant-admin-commercial-grants",
      "path": "/config/commercial-grants",
      "title": "Commercial authority",
      "section": "access",
      "icon": "BadgeCheck"
    },
    {
      "id": "reference-tenant-admin-numbering",
      "path": "/config/numbering",
      "title": "Document numbering",
      "section": "access",
      "icon": "Hash"
    },
    {
      "id": "reference-tenant-admin-items",
      "path": "/config/items",
      "title": "Items and services",
      "section": "catalogue",
      "icon": "Stethoscope"
    },
    {
      "id": "reference-tenant-admin-categories",
      "path": "/config/categories",
      "title": "Categories and terminology",
      "section": "catalogue",
      "icon": "FolderTree"
    },
    {
      "id": "reference-tenant-admin-tax-rules",
      "path": "/config/tax-rules",
      "title": "Tax rules",
      "section": "catalogue",
      "icon": "Percent"
    },
    {
      "id": "reference-tenant-admin-price-books",
      "path": "/config/price-books",
      "title": "Price books and prices",
      "section": "catalogue",
      "icon": "BookText"
    },
    {
      "id": "reference-tenant-admin-discounts",
      "path": "/config/discounts",
      "title": "Discounts",
      "section": "catalogue",
      "icon": "TicketPercent"
    },
    {
      "id": "reference-tenant-admin-modifiers",
      "path": "/config/modifiers",
      "title": "Modifiers and MPR",
      "section": "catalogue",
      "icon": "SlidersHorizontal"
    },
    {
      "id": "reference-tenant-admin-commercial-releases",
      "path": "/config/commercial-releases",
      "title": "Commercial releases",
      "section": "catalogue",
      "icon": "Rocket"
    },
    {
      "id": "reference-tenant-admin-commercial-parties",
      "path": "/config/commercial-parties",
      "title": "Payers, TPAs and sponsors",
      "section": "payers",
      "icon": "Building2"
    },
    {
      "id": "reference-tenant-admin-networks",
      "path": "/config/networks",
      "title": "Networks",
      "section": "payers",
      "icon": "Share2"
    },
    {
      "id": "reference-tenant-admin-insurance-plans",
      "path": "/config/insurance-plans",
      "title": "Plans and benefit rules",
      "section": "payers",
      "icon": "ClipboardList"
    },
    {
      "id": "reference-tenant-admin-contracts",
      "path": "/config/contracts",
      "title": "Contracts",
      "section": "payers",
      "icon": "FileSignature"
    },
    {
      "id": "reference-tenant-admin-branch-arrangements",
      "path": "/config/branch-arrangements",
      "title": "Branch arrangements",
      "section": "payers",
      "icon": "Handshake"
    },
    {
      "id": "reference-tenant-admin-benefit-pools",
      "path": "/config/benefit-pools",
      "title": "Benefit pools",
      "section": "payers",
      "icon": "Users"
    },
    {
      "id": "reference-tenant-admin-billing-policies",
      "path": "/config/billing-policies",
      "title": "Billing policy",
      "section": "policy",
      "icon": "ScrollText"
    },
    {
      "id": "reference-tenant-admin-reimbursement-routes",
      "path": "/config/reimbursement-routes",
      "title": "Reimbursement routes",
      "section": "policy",
      "icon": "Route"
    },
    {
      "id": "reference-tenant-admin-stay-models",
      "path": "/config/stay-models",
      "title": "Stay and case models",
      "section": "policy",
      "icon": "BedDouble"
    },
    {
      "id": "reference-tenant-admin-drg-config",
      "path": "/config/drg-config",
      "title": "DRG configuration",
      "section": "policy",
      "icon": "Layers"
    },
    {
      "id": "reference-tenant-admin-category-rates",
      "path": "/config/category-rates",
      "title": "Category rates",
      "section": "policy",
      "icon": "Grid3x3"
    },
    {
      "id": "reference-tenant-admin-em-tables",
      "path": "/config/em-tables",
      "title": "E&M level tables",
      "section": "policy",
      "icon": "Activity"
    },
    {
      "id": "reference-tenant-admin-advanced-models",
      "path": "/config/advanced-models",
      "title": "Advanced models",
      "section": "policy",
      "icon": "Sigma"
    },
    {
      "id": "reference-tenant-admin-exchange-profiles",
      "path": "/config/exchange-profiles",
      "title": "Exchange profiles and routes",
      "section": "exchange",
      "icon": "ArrowLeftRight"
    },
    {
      "id": "reference-tenant-admin-provider-profiles",
      "path": "/config/provider-profiles",
      "title": "Payment and refund providers",
      "section": "exchange",
      "icon": "CreditCard"
    },
    {
      "id": "reference-tenant-admin-gl-accounts",
      "path": "/config/gl-accounts",
      "title": "Chart of accounts",
      "section": "ledger",
      "icon": "ListTree"
    },
    {
      "id": "reference-tenant-admin-gl-mappings",
      "path": "/config/gl-mappings",
      "title": "GL mappings",
      "section": "ledger",
      "icon": "GitCompareArrows"
    },
    {
      "id": "reference-tenant-admin-fiscal-periods",
      "path": "/config/fiscal-periods",
      "title": "Fiscal periods",
      "section": "ledger",
      "icon": "CalendarRange"
    },
    {
      "id": "reference-tenant-admin-workflow-definitions",
      "path": "/config/workflow-definitions",
      "title": "Workflows and rules",
      "section": "platform",
      "icon": "GitBranch"
    },
    {
      "id": "reference-tenant-admin-platform-settings",
      "path": "/config/platform-settings",
      "title": "Assistance and marketplace",
      "section": "platform",
      "icon": "Sparkles"
    },
    {
      "id": "reference-tenant-admin-approvals",
      "path": "/approvals",
      "title": "Approvals inbox",
      "section": "workspace",
      "icon": "Inbox"
    },
    {
      "id": "reference-tenant-admin-activity",
      "path": "/activity",
      "title": "Activity log",
      "section": "workspace",
      "icon": "History"
    }
  ]
} as const;
export const MEDBAND_REFERENCE={
  "id": "reference-medband",
  "variant": "medband",
  "title": "MedBand Patient Access",
  "shortLabel": "MedBand",
  "accent": "#1f7a8c",
  "pages": [
    {
      "id": "reference-medband-dashboard",
      "path": "/",
      "title": "Today",
      "icon": "LayoutDashboard",
      "section": "workspace"
    },
    {
      "id": "reference-medband-patients",
      "path": "/patients",
      "title": "Find patient",
      "icon": "Users",
      "section": "workspace"
    },
    {
      "id": "reference-medband-patients-new",
      "path": "/patients/new",
      "title": "Register patient",
      "icon": "UserPlus",
      "section": "workspace"
    },
    {
      "id": "reference-medband-patients-detail",
      "path": "/patients/[id]",
      "title": "Patient record",
      "icon": "UserRound",
      "section": "workspace"
    },
    {
      "id": "reference-medband-encounters-new",
      "path": "/encounters/new",
      "title": "New encounter",
      "icon": "CalendarPlus",
      "section": "workspace"
    },
    {
      "id": "reference-medband-admissions",
      "path": "/admissions",
      "title": "Admissions",
      "icon": "BedDouble",
      "section": "workspace"
    },
    {
      "id": "reference-medband-admissions-new",
      "path": "/admissions/new",
      "title": "Request admission",
      "icon": "BedDouble",
      "section": "workspace",
      "navigation": false
    },
    {
      "id": "reference-medband-encounters",
      "path": "/encounters",
      "title": "Encounters",
      "icon": "ClipboardList",
      "section": "workspace"
    },
    {
      "id": "reference-medband-episodes",
      "path": "/episodes",
      "title": "Episodes and cases",
      "icon": "FolderHeart",
      "section": "workspace"
    }
  ]
} as const;
export const TENANT_ADMIN_SECTION_TITLES={
  "access": "Access and numbering",
  "catalogue": "Catalogue and pricing",
  "payers": "Payers and coverage",
  "policy": "Billing policy and models",
  "exchange": "Exchange and providers",
  "ledger": "Accounting",
  "platform": "Platform",
  "workspace": "Workspace"
} as const;
