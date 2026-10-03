/** Original RCM operational pages; registry and business data are API-owned. */
export const RCM_REFERENCE={
  "id": "reference-rcm",
  "variant": "rcm",
  "title": "RCM Workspace",
  "shortLabel": "RCM Workspace",
  "accent": "#163854",
  "pages": [
    {
      "id": "reference-rcm-home",
      "path": "/",
      "title": "Billing home",
      "section": "front",
      "icon": "Home"
    },
    {
      "id": "reference-rcm-coverages",
      "path": "/w/coverages",
      "title": "Patient and encounter coverage",
      "section": "front",
      "icon": "IdCard"
    },
    {
      "id": "reference-rcm-authorizations",
      "path": "/w/authorizations",
      "title": "Payer authorizations",
      "section": "front",
      "icon": "ShieldCheck"
    },
    {
      "id": "reference-rcm-eligibility",
      "path": "/w/eligibility",
      "title": "Eligibility checks",
      "section": "front",
      "icon": "BadgeCheck"
    },
    {
      "id": "reference-rcm-estimates",
      "path": "/w/estimates",
      "title": "Estimates and admission clearance",
      "section": "front",
      "icon": "Calculator"
    },
    {
      "id": "reference-rcm-deposits",
      "path": "/w/deposits",
      "title": "Deposits",
      "section": "front",
      "icon": "PiggyBank"
    },
    {
      "id": "reference-rcm-cash-sessions",
      "path": "/w/cash-sessions",
      "title": "Cash drawer",
      "section": "front",
      "icon": "Banknote"
    },
    {
      "id": "reference-rcm-encounters",
      "path": "/w/encounters",
      "title": "Unbilled worklist",
      "section": "charges",
      "icon": "ListTodo"
    },
    {
      "id": "reference-rcm-charges",
      "path": "/w/charges",
      "title": "Charge detail",
      "section": "charges",
      "icon": "Receipt"
    },
    {
      "id": "reference-rcm-manual-charges",
      "path": "/w/manual-charges",
      "title": "Manual charges and procedure groups",
      "section": "charges",
      "icon": "HandCoins"
    },
    {
      "id": "reference-rcm-invoices",
      "path": "/w/invoices",
      "title": "Invoices",
      "section": "charges",
      "icon": "FileText"
    },
    {
      "id": "reference-rcm-debit-notes",
      "path": "/w/debit-notes",
      "title": "Debit notes",
      "section": "charges",
      "icon": "FilePlus2"
    },
    {
      "id": "reference-rcm-credit-notes",
      "path": "/w/credit-notes",
      "title": "Credit notes",
      "section": "charges",
      "icon": "FileMinus2"
    },
    {
      "id": "reference-rcm-adjustments",
      "path": "/w/adjustments",
      "title": "Adjustments",
      "section": "charges",
      "icon": "Scale"
    },
    {
      "id": "reference-rcm-receipts",
      "path": "/w/receipts",
      "title": "Receipts and allocation",
      "section": "money",
      "icon": "Wallet"
    },
    {
      "id": "reference-rcm-refunds",
      "path": "/w/refunds",
      "title": "Refunds and payouts",
      "section": "money",
      "icon": "Undo2"
    },
    {
      "id": "reference-rcm-packages",
      "path": "/w/packages",
      "title": "Packages",
      "section": "money",
      "icon": "Package"
    },
    {
      "id": "reference-rcm-claims",
      "path": "/w/claims",
      "title": "Claims",
      "section": "insurance",
      "icon": "FileStack"
    },
    {
      "id": "reference-rcm-exchange-messages",
      "path": "/w/exchange-messages",
      "title": "Exchange monitor",
      "section": "insurance",
      "icon": "RadioTower"
    },
    {
      "id": "reference-rcm-remittances",
      "path": "/w/remittances",
      "title": "Remittances",
      "section": "insurance",
      "icon": "Landmark"
    },
    {
      "id": "reference-rcm-remittance-corrections",
      "path": "/w/remittance-corrections",
      "title": "Remittance corrections",
      "section": "insurance",
      "icon": "PencilLine"
    },
    {
      "id": "reference-rcm-appeals",
      "path": "/w/appeals",
      "title": "Appeals",
      "section": "insurance",
      "icon": "Gavel"
    },
    {
      "id": "reference-rcm-payer-reconciliations",
      "path": "/w/payer-reconciliations",
      "title": "Payer reconciliation",
      "section": "insurance",
      "icon": "GitCompare"
    },
    {
      "id": "reference-rcm-responsibility-transfers",
      "path": "/w/responsibility-transfers",
      "title": "Responsibility transfers",
      "section": "insurance",
      "icon": "ArrowRightLeft"
    },
    {
      "id": "reference-rcm-aging",
      "path": "/aging",
      "title": "Aging",
      "section": "receivables",
      "icon": "BarChart3"
    },
    {
      "id": "reference-rcm-payment-plans",
      "path": "/w/payment-plans",
      "title": "Payment plans",
      "section": "receivables",
      "icon": "CalendarClock"
    },
    {
      "id": "reference-rcm-statements",
      "path": "/w/statements",
      "title": "Statements",
      "section": "receivables",
      "icon": "Mail"
    },
    {
      "id": "reference-rcm-collections",
      "path": "/w/collections",
      "title": "Dunning and collections",
      "section": "receivables",
      "icon": "Megaphone"
    },
    {
      "id": "reference-rcm-reports",
      "path": "/reports",
      "title": "Reports",
      "section": "receivables",
      "icon": "PieChart"
    },
    {
      "id": "reference-rcm-coding-cases",
      "path": "/w/coding-cases",
      "title": "Coding worklist",
      "section": "coding",
      "icon": "Code2"
    },
    {
      "id": "reference-rcm-cdi-queries",
      "path": "/w/cdi-queries",
      "title": "CDI clarifications",
      "section": "coding",
      "icon": "MessageSquareText"
    },
    {
      "id": "reference-rcm-drg-groupings",
      "path": "/w/drg-groupings",
      "title": "DRG grouping",
      "section": "coding",
      "icon": "Layers"
    },
    {
      "id": "reference-rcm-em-determinations",
      "path": "/w/em-determinations",
      "title": "E&M determinations",
      "section": "coding",
      "icon": "Activity"
    },
    {
      "id": "reference-rcm-model-settlements",
      "path": "/w/model-settlements",
      "title": "Model settlements",
      "section": "coding",
      "icon": "Sigma"
    },
    {
      "id": "reference-rcm-journals",
      "path": "/w/journals",
      "title": "Journals and exceptions",
      "section": "accounting",
      "icon": "BookOpen"
    },
    {
      "id": "reference-rcm-gl-reconciliations",
      "path": "/w/gl-reconciliations",
      "title": "GL reconciliation",
      "section": "accounting",
      "icon": "Columns3"
    },
    {
      "id": "reference-rcm-exports",
      "path": "/w/exports",
      "title": "Exports",
      "section": "accounting",
      "icon": "FileOutput"
    },
    {
      "id": "reference-rcm-approvals",
      "path": "/approvals",
      "title": "Approvals inbox",
      "section": "cross",
      "icon": "Inbox"
    },
    {
      "id": "reference-rcm-tasks",
      "path": "/w/tasks",
      "title": "Workflow worklist",
      "section": "cross",
      "icon": "KanbanSquare"
    },
    {
      "id": "reference-rcm-assistance",
      "path": "/w/assistance",
      "title": "Assistance",
      "section": "cross",
      "icon": "Sparkles"
    }
  ]
} as const;
export const RCM_SECTION_TITLES={
  "front": "Front office",
  "charges": "Charges and documents",
  "money": "Money",
  "insurance": "Insurance",
  "receivables": "Receivables",
  "coding": "Coding and models",
  "accounting": "Accounting",
  "cross": "Cross-cutting"
} as const;
