import {
  Activity,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  ContactRound,
  CreditCard,
  FileChartColumn,
  FileCog,
  FlaskConical,
  FileSpreadsheet,
  FileText,
  Gauge,
  HeartPulse,
  Gavel,
  HandCoins,
  IdCard,
  Landmark,
  Languages,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  MapPinned,
  NotebookTabs,
  PackageCheck,
  PackageOpen,
  PanelTop,
  Percent,
  Pill,
  ReceiptText,
  RefreshCw,
  Scale,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Stethoscope,
  Sparkles,
  Store,
  TableProperties,
  Tags,
  Truck,
  Undo2,
  UserCog,
  UserRoundCheck,
  UsersRound,
  UserSquare2,
  WalletCards,
  Warehouse,
} from "lucide-react";
import type { ModuleDefinition, ModuleKey, PageAiConfig, PageDefinition, PageKind } from "./types.ts";

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  hr: {
    id: "hr",
    label: "Human Resources",
    shortLabel: "HR",
    description: "People, organization, attendance, leave and talent operations",
    /* Each module's mark is this colour with WHITE letters on it, so every accent
       here has to clear 4.5:1 against white — four of the eight did not, the
       worst at 3.29:1. Darkened only as far as that needed, so the hue each
       module is recognised by is unchanged. verify:contrast checks them. */
    accent: "#6d5ce7",
    icon: UsersRound,
    navigation: [
      { id: "hr-overview", label: "Overview", items: [{ id: "hr-dashboard", label: "HR Dashboard", icon: LayoutDashboard, pageId: "hr-dashboard" }] },
      {
        id: "hr-masters", label: "Masters", items: [
          { id: "identity", label: "Identity & Access", icon: ShieldCheck, children: [
            { id: "user-master", label: "User Master", icon: UserCog, pageId: "user-master" },
            { id: "role-master", label: "Role & Permission", icon: IdCard, pageId: "role-master" },
            { id: "delegation-master", label: "Delegation Rules", icon: UserRoundCheck, pageId: "delegation-master" },
          ] },
          { id: "people", label: "People", icon: ContactRound, children: [
            { id: "employee-master", label: "Employee Master", pageId: "employee-master" },
            { id: "contractor-master", label: "Contractor Master", pageId: "contractor-master" },
            { id: "position-master", label: "Position Master", pageId: "position-master" },
          ] },
          { id: "organization", label: "Organization", icon: Building2, children: [
            { id: "department-master", label: "Department Master", pageId: "department-master" },
            { id: "grade-master", label: "Grade & Band", pageId: "grade-master" },
            { id: "location-master", label: "Location Master", pageId: "location-master" },
          ] },
        ]
      },
      {
        id: "hr-transactions", label: "Transactions", items: [
          { id: "workforce", label: "Workforce Events", icon: BriefcaseBusiness, children: [
            { id: "onboarding", label: "Employee Onboarding", pageId: "employee-onboarding" },
            { id: "transfer", label: "Transfer & Promotion", pageId: "employee-transfer" },
            { id: "separation", label: "Separation", pageId: "employee-separation" },
          ] },
          { id: "time", label: "Time & Leave", icon: CalendarClock, children: [
            { id: "leave-request", label: "Leave Request", pageId: "leave-request" },
            { id: "attendance-adjustment", label: "Attendance Adjustment", pageId: "attendance-adjustment" },
            { id: "shift-roster", label: "Shift Roster", pageId: "shift-roster" },
          ] },
        ]
      },
      {
        id: "hr-worklists", label: "Worklists", items: [
          { id: "hr-ops", label: "Operations", icon: ClipboardList, children: [
            { id: "employee-worklist", label: "Employee Worklist", pageId: "employee-worklist" },
            { id: "approval-worklist", label: "Approval Worklist", pageId: "approval-worklist" },
            { id: "attendance-anomalies", label: "Attendance Anomalies", pageId: "attendance-anomalies" },
          ] },
        ]
      },
      {
        id: "hr-reports", label: "Reports", items: [
          { id: "hr-analytics", label: "Analytics", icon: BarChart3, children: [
            { id: "workforce-report", label: "Workforce Analytics", pageId: "workforce-report" },
            { id: "attendance-report", label: "Attendance Report", pageId: "attendance-report" },
            { id: "compliance-report", label: "Compliance Register", pageId: "compliance-report" },
          ] },
        ]
      },
      {
        id: "hr-config", label: "Configuration", items: [
          { id: "hr-settings", label: "HR Setup", icon: Settings2, children: [
            { id: "hr-policy", label: "Policy Designer", pageId: "hr-policy" },
            { id: "hr-numbering", label: "Numbering Rules", pageId: "hr-numbering" },
            { id: "hr-workflow", label: "Approval Workflow", pageId: "hr-workflow" },
          ] },
        ]
      },
    ],
  },
  finance: {
    id: "finance",
    label: "Finance & Accounting",
    shortLabel: "Finance",
    description: "Billing, ledger, receivables, payables, taxation and financial control",
    accent: "#0f8468",
    icon: Landmark,
    navigation: [
      { id: "fin-overview", label: "Overview", items: [{ id: "finance-dashboard", label: "Finance Dashboard", icon: LayoutDashboard, pageId: "finance-dashboard" }] },
      { id: "fin-masters", label: "Masters", items: [
        { id: "fin-parties", label: "Parties", icon: ContactRound, children: [
          { id: "customer-master", label: "Customer Master", pageId: "customer-master" },
          { id: "supplier-fin-master", label: "Supplier Master", pageId: "supplier-fin-master" },
          { id: "credit-profile", label: "Credit Profile", pageId: "credit-profile" },
        ] },
        { id: "fin-accounting", label: "Accounting", icon: Scale, children: [
          { id: "chart-account", label: "Chart of Accounts", pageId: "chart-account" },
          { id: "cost-center", label: "Cost Center", pageId: "cost-center" },
          { id: "bank-master", label: "Bank & Cash", pageId: "bank-master" },
        ] },
        { id: "fin-tax", label: "Tax & Jurisdiction", icon: Gavel, children: [
          { id: "tax-master", label: "Taxation Master", pageId: "tax-master" },
          { id: "jurisdiction-master", label: "Jurisdiction Master", pageId: "jurisdiction-master" },
          { id: "fiscal-period", label: "Fiscal Period", pageId: "fiscal-period" },
        ] },
      ] },
      { id: "fin-transactions", label: "Transactions", items: [
        { id: "billing", label: "Billing & Receipts", icon: ReceiptText, children: [
          { id: "billing-entry", label: "Billing Entry", pageId: "billing-entry" },
          { id: "credit-note", label: "Credit Note", pageId: "credit-note" },
          { id: "receipt-entry", label: "Receipt Entry", pageId: "receipt-entry" },
        ] },
        { id: "ledger", label: "General Ledger", icon: NotebookTabs, children: [
          { id: "journal-entry", label: "Journal Entry", pageId: "journal-entry" },
          { id: "expense-entry", label: "Expense Entry", pageId: "expense-entry" },
          { id: "bank-reconciliation", label: "Bank Reconciliation", pageId: "bank-reconciliation" },
        ] },
      ] },
      { id: "fin-worklists", label: "Worklists", items: [
        { id: "fin-queues", label: "Finance Queues", icon: ClipboardCheck, children: [
          { id: "billing-worklist", label: "Billing Worklist", pageId: "billing-worklist" },
          { id: "receivables-worklist", label: "Receivables Worklist", pageId: "receivables-worklist" },
          { id: "journal-review", label: "Journal Review", pageId: "journal-review" },
        ] },
      ] },
      { id: "fin-reports", label: "Reports", items: [
        { id: "fin-statements", label: "Financial Statements", icon: FileChartColumn, children: [
          { id: "profit-loss", label: "Profit & Loss", pageId: "profit-loss-report" },
          { id: "balance-sheet", label: "Balance Sheet", pageId: "balance-sheet-report" },
          { id: "ar-aging", label: "AR Aging", pageId: "ar-aging-report" },
          { id: "tax-return", label: "Tax Return", pageId: "tax-return-report" },
        ] },
      ] },
      { id: "fin-config", label: "Configuration", items: [
        { id: "fin-setup", label: "Finance Setup", icon: Settings2, children: [
          { id: "currency-config", label: "Currencies & Rates", pageId: "currency-config" },
          { id: "posting-rules", label: "Posting Rules", pageId: "posting-rules" },
          { id: "fin-approvals", label: "Approval Matrix", pageId: "fin-approvals" },
        ] },
      ] },
    ],
  },
  payroll: {
    id: "payroll",
    label: "Payroll",
    shortLabel: "Payroll",
    description: "Earnings, deductions, payroll processing, settlements and statutory outputs",
    accent: "#b65a29",
    icon: Banknote,
    navigation: [
      { id: "pay-overview", label: "Overview", items: [{ id: "payroll-dashboard", label: "Payroll Dashboard", icon: LayoutDashboard, pageId: "payroll-dashboard" }] },
      { id: "pay-masters", label: "Masters", items: [
        { id: "pay-structure", label: "Pay Structure", icon: WalletCards, children: [
          { id: "earning-master", label: "Earning Master", pageId: "earning-master" },
          { id: "deduction-master", label: "Deduction Master", pageId: "deduction-master" },
          { id: "pay-group", label: "Pay Group", pageId: "pay-group" },
        ] },
        { id: "pay-compliance", label: "Statutory", icon: ShieldCheck, children: [
          { id: "statutory-master", label: "Statutory Rule", pageId: "statutory-master" },
          { id: "bank-format", label: "Bank File Format", pageId: "bank-format" },
          { id: "benefit-plan", label: "Benefit Plan", pageId: "benefit-plan" },
        ] },
      ] },
      { id: "pay-transactions", label: "Transactions", items: [
        { id: "pay-processing", label: "Processing", icon: Calculator, children: [
          { id: "payroll-run", label: "Payroll Run", pageId: "payroll-run" },
          { id: "payroll-adjustment", label: "Payroll Adjustment", pageId: "payroll-adjustment" },
          { id: "final-settlement", label: "Final Settlement", pageId: "final-settlement" },
        ] },
      ] },
      { id: "pay-worklists", label: "Worklists", items: [
        { id: "pay-queues", label: "Payroll Queues", icon: ListChecks, children: [
          { id: "payroll-worklist", label: "Payroll Worklist", pageId: "payroll-worklist" },
          { id: "exception-worklist", label: "Exception Worklist", pageId: "exception-worklist" },
          { id: "settlement-review", label: "Settlement Review", pageId: "settlement-review" },
        ] },
      ] },
      { id: "pay-reports", label: "Reports", items: [
        { id: "pay-outputs", label: "Payroll Outputs", icon: FileText, children: [
          { id: "pay-register", label: "Payroll Register", pageId: "pay-register-report" },
          { id: "payslip-report", label: "Payslip Distribution", pageId: "payslip-report" },
          { id: "statutory-report", label: "Statutory Report", pageId: "statutory-report" },
        ] },
      ] },
      { id: "pay-config", label: "Configuration", items: [
        { id: "pay-settings", label: "Payroll Setup", icon: Settings2, children: [
          { id: "pay-calendar", label: "Payroll Calendar", pageId: "pay-calendar" },
          { id: "pay-formula", label: "Formula Designer", pageId: "pay-formula" },
          { id: "pay-approval", label: "Approval Workflow", pageId: "pay-approval" },
        ] },
      ] },
    ],
  },
  sales: {
    id: "sales",
    label: "Sales & CRM",
    shortLabel: "Sales",
    description: "Leads, customers, quotations, orders, invoices and revenue operations",
    accent: "#2563eb",
    icon: ShoppingBag,
    navigation: [
      { id: "sales-overview", label: "Overview", items: [{ id: "sales-dashboard", label: "Sales Dashboard", icon: LayoutDashboard, pageId: "sales-dashboard" }] },
      { id: "sales-masters", label: "Masters", items: [
        { id: "sales-market", label: "Market", icon: MapPinned, children: [
          { id: "sales-customer", label: "Customer Master", pageId: "sales-customer" },
          { id: "territory-master", label: "Territory Master", pageId: "territory-master" },
          { id: "sales-channel", label: "Sales Channel", pageId: "sales-channel" },
        ] },
        { id: "sales-catalog", label: "Catalog", icon: Tags, children: [
          { id: "product-master", label: "Product Master", pageId: "product-master" },
          { id: "price-list", label: "Price List", pageId: "price-list" },
          { id: "discount-rule", label: "Discount Rule", pageId: "discount-rule" },
        ] },
      ] },
      { id: "sales-transactions", label: "Transactions", items: [
        { id: "sales-cycle", label: "Sales Cycle", icon: ShoppingCart, children: [
          { id: "quotation", label: "Quotation", pageId: "quotation" },
          { id: "sales-order", label: "Sales Order", pageId: "sales-order" },
          { id: "sales-invoice", label: "Sales Invoice", pageId: "sales-invoice" },
          { id: "sales-return", label: "Sales Return", pageId: "sales-return" },
        ] },
      ] },
      { id: "sales-worklists", label: "Worklists", items: [
        { id: "sales-queues", label: "Sales Queues", icon: ClipboardList, children: [
          { id: "customer-worklist", label: "Customer Worklist", pageId: "customer-worklist" },
          { id: "order-worklist", label: "Order Worklist", pageId: "order-worklist" },
          { id: "fulfillment-worklist", label: "Fulfillment Worklist", pageId: "fulfillment-worklist" },
        ] },
      ] },
      { id: "sales-reports", label: "Reports", items: [
        { id: "sales-insights", label: "Sales Insights", icon: ChartNoAxesCombined, children: [
          { id: "pipeline-report", label: "Pipeline Report", pageId: "pipeline-report" },
          { id: "revenue-report", label: "Revenue Report", pageId: "revenue-report" },
          { id: "margin-report", label: "Margin Analysis", pageId: "margin-report" },
        ] },
      ] },
      { id: "sales-config", label: "Configuration", items: [
        { id: "sales-settings", label: "Sales Setup", icon: Settings2, children: [
          { id: "sales-numbering", label: "Document Numbering", pageId: "sales-numbering" },
          { id: "sales-approval", label: "Approval Rules", pageId: "sales-approval" },
          { id: "sales-targets", label: "Target Setup", pageId: "sales-targets" },
        ] },
      ] },
    ],
  },
  supply: {
    id: "supply",
    label: "Supply Chain",
    shortLabel: "Supply",
    description: "Procurement, inventory, warehouses, logistics and supplier collaboration",
    accent: "#9d6a1f",
    icon: Truck,
    navigation: [
      { id: "supply-overview", label: "Overview", items: [{ id: "supply-dashboard", label: "Supply Chain Dashboard", icon: LayoutDashboard, pageId: "supply-dashboard" }] },
      { id: "supply-masters", label: "Masters", items: [
        { id: "supply-partners", label: "Partners", icon: Store, children: [
          { id: "supplier-master", label: "Supplier Master", pageId: "supplier-master" },
          { id: "carrier-master", label: "Carrier Master", pageId: "carrier-master" },
          { id: "supplier-contract", label: "Supplier Contract", pageId: "supplier-contract" },
        ] },
        { id: "inventory", label: "Inventory", icon: Boxes, children: [
          { id: "item-master", label: "Item Master", pageId: "item-master" },
          { id: "warehouse-master", label: "Warehouse Master", pageId: "warehouse-master" },
          { id: "uom-master", label: "Unit of Measure", pageId: "uom-master" },
        ] },
      ] },
      { id: "supply-transactions", label: "Transactions", items: [
        { id: "procurement", label: "Procurement", icon: PackageOpen, children: [
          { id: "purchase-requisition", label: "Purchase Requisition", pageId: "purchase-requisition" },
          { id: "purchase-order", label: "Purchase Order", pageId: "purchase-order" },
          { id: "goods-receipt", label: "Goods Receipt", pageId: "goods-receipt" },
        ] },
        { id: "stock", label: "Stock Operations", icon: RefreshCw, children: [
          { id: "stock-transfer", label: "Stock Transfer", pageId: "stock-transfer" },
          { id: "inventory-count", label: "Inventory Count", pageId: "inventory-count" },
          { id: "stock-adjustment", label: "Stock Adjustment", pageId: "stock-adjustment" },
        ] },
      ] },
      { id: "supply-worklists", label: "Worklists", items: [
        { id: "supply-queues", label: "Supply Queues", icon: PackageCheck, children: [
          { id: "procurement-worklist", label: "Procurement Worklist", pageId: "procurement-worklist" },
          { id: "receiving-worklist", label: "Receiving Worklist", pageId: "receiving-worklist" },
          { id: "reorder-worklist", label: "Reorder Worklist", pageId: "reorder-worklist" },
        ] },
      ] },
      { id: "supply-reports", label: "Reports", items: [
        { id: "supply-insights", label: "Supply Insights", icon: BarChart3, children: [
          { id: "inventory-valuation", label: "Inventory Valuation", pageId: "inventory-valuation-report" },
          { id: "supplier-performance", label: "Supplier Performance", pageId: "supplier-performance-report" },
          { id: "stock-aging", label: "Stock Aging", pageId: "stock-aging-report" },
        ] },
      ] },
      { id: "supply-config", label: "Configuration", items: [
        { id: "supply-settings", label: "Supply Setup", icon: Settings2, children: [
          { id: "reorder-rules", label: "Reorder Rules", pageId: "reorder-rules" },
          { id: "procurement-approval", label: "Approval Matrix", pageId: "procurement-approval" },
          { id: "valuation-method", label: "Valuation Method", pageId: "valuation-method" },
        ] },
      ] },
    ],
  },
  healthcare: {
    id: "healthcare",
    label: "Healthcare",
    shortLabel: "HC",
    description: "Patient administration, clinical workflow and revenue cycle",
    accent: "#0d8379",
    icon: HeartPulse,
    navigation: [
      { id: "hc-overview", label: "Overview", items: [{ id: "healthcare-dashboard", label: "Healthcare Dashboard", icon: LayoutDashboard, pageId: "healthcare-dashboard" }] },
      {
        id: "hc-patient", label: "Patient Administration", items: [
          { id: "hc-registry", label: "Registry", icon: ContactRound, children: [
            { id: "patient-master", label: "Patient Master", pageId: "patient-master" },
            { id: "patient-merge", label: "Duplicate Review", pageId: "patient-merge" },
            { id: "next-of-kin", label: "Next of Kin", pageId: "next-of-kin" },
          ] },
          { id: "hc-access", label: "Admissions & Visits", icon: CalendarClock, children: [
            { id: "appointment-worklist", label: "Appointments", pageId: "appointment-worklist" },
            { id: "admission-worklist", label: "Admissions", pageId: "admission-worklist" },
            { id: "bed-management", label: "Bed Management", pageId: "bed-management" },
            { id: "discharge-worklist", label: "Discharges", pageId: "discharge-worklist" },
          ] },
        ],
      },
      {
        id: "hc-clinical", label: "Clinical", items: [
          { id: "hc-encounter", label: "Encounters", icon: Stethoscope, children: [
            { id: "encounter-worklist", label: "Encounter Worklist", pageId: "encounter-worklist" },
            { id: "consultation-worklist", label: "Consultations", pageId: "consultation-worklist" },
            { id: "consultation-entry", label: "New Consultation", pageId: "consultation-entry" },
            { id: "clinical-notes", label: "Clinical Notes", pageId: "clinical-notes" },
            { id: "vitals-worklist", label: "Vitals & Observations", pageId: "vitals-worklist" },
          ] },
          { id: "hc-orders", label: "Orders & Results", icon: FlaskConical, children: [
            { id: "order-worklist", label: "Order Worklist", pageId: "order-worklist" },
            { id: "lab-results", label: "Laboratory Results", pageId: "lab-results" },
            { id: "imaging-worklist", label: "Imaging", pageId: "imaging-worklist" },
            { id: "medication-orders", label: "Medication Orders", pageId: "medication-orders" },
          ] },
        ],
      },
      {
        id: "hc-revenue", label: "Revenue Cycle", items: [
          { id: "hc-payer", label: "Payer & Claims", icon: ReceiptText, children: [
            { id: "preauthorization", label: "Pre-authorisation", pageId: "preauthorization" },
            { id: "claim-worklist", label: "Claim Worklist", pageId: "claim-worklist" },
            { id: "denial-worklist", label: "Denials & Appeals", pageId: "denial-worklist" },
          ] },
        ],
      },
      {
        id: "hc-insight", label: "Reports", items: [
          { id: "hc-reports", label: "Clinical & Operational", icon: BarChart3, children: [
            { id: "occupancy-report", label: "Bed Occupancy", pageId: "occupancy-report" },
            { id: "los-report", label: "Length of Stay", pageId: "los-report" },
            { id: "denial-rate-report", label: "Denial Rate", pageId: "denial-rate-report" },
          ] },
        ],
      },
      {
        id: "hc-setup", label: "Configuration", items: [
          { id: "hc-config", label: "Clinical Setup", icon: Settings2, children: [
            { id: "service-catalog", label: "Service Catalogue", pageId: "service-catalog" },
            { id: "payer-master", label: "Payer Master", pageId: "payer-master" },
            { id: "clinician-master", label: "Clinician Master", pageId: "clinician-master" },
          ] },
        ],
      },
    ],
  },
  pharmacy: {
    id: "pharmacy",
    label: "Pharmacy",
    shortLabel: "RX",
    description: "Dispensing, formulary, stock, controlled substances and procurement",
    accent: "#7a5cd6",
    icon: Pill,
    navigation: [
      { id: "rx-overview", label: "Overview", items: [{ id: "pharmacy-dashboard", label: "Pharmacy Dashboard", icon: LayoutDashboard, pageId: "pharmacy-dashboard" }] },
      {
        id: "rx-dispensing", label: "Dispensing", items: [
          { id: "rx-queue", label: "Prescriptions", icon: ClipboardCheck, children: [
            { id: "prescription-queue", label: "Prescription Queue", pageId: "prescription-queue" },
            { id: "dispense-history", label: "Dispense History", pageId: "dispense-history" },
            { id: "medication-review", label: "Medication Review", pageId: "medication-review" },
          ] },
        ],
      },
      {
        id: "rx-inventory", label: "Inventory", items: [
          { id: "rx-formulary", label: "Formulary & Stock", icon: Boxes, children: [
            { id: "drug-master", label: "Drug Master", pageId: "drug-master" },
            { id: "stock-on-hand", label: "Stock on Hand", pageId: "stock-on-hand" },
            { id: "batch-expiry", label: "Batch & Expiry", pageId: "batch-expiry" },
            { id: "stock-transfer", label: "Stock Transfer", pageId: "stock-transfer" },
          ] },
          { id: "rx-controlled", label: "Controlled Substances", icon: ShieldCheck, children: [
            { id: "controlled-register", label: "Controlled Register", pageId: "controlled-register" },
            { id: "controlled-reconciliation", label: "Reconciliation", pageId: "controlled-reconciliation" },
          ] },
        ],
      },
      {
        id: "rx-procurement", label: "Procurement", items: [
          { id: "rx-buy", label: "Purchasing", icon: ReceiptText, children: [
            { id: "pharmacy-requisition", label: "Requisitions", pageId: "pharmacy-requisition" },
            { id: "pharmacy-goods-receipt", label: "Goods Receipt", pageId: "pharmacy-goods-receipt" },
            { id: "pharmacy-supplier", label: "Supplier Master", pageId: "pharmacy-supplier" },
          ] },
        ],
      },
      {
        id: "rx-insight", label: "Reports", items: [
          { id: "rx-reports", label: "Analysis", icon: BarChart3, children: [
            { id: "consumption-report", label: "Consumption", pageId: "consumption-report" },
            { id: "expiry-risk-report", label: "Expiry Risk", pageId: "expiry-risk-report" },
            { id: "stock-turn-report", label: "Stock Turn", pageId: "stock-turn-report" },
          ] },
        ],
      },
      {
        id: "rx-setup", label: "Configuration", items: [
          { id: "rx-config", label: "Pharmacy Setup", icon: Settings2, children: [
            { id: "formulary-setup", label: "Formulary Setup", pageId: "formulary-setup" },
            { id: "dispensing-rules", label: "Dispensing Rules", pageId: "dispensing-rules" },
          ] },
        ],
      },
    ],
  },
  library: {
    id: "library",
    label: "Developer Library",
    shortLabel: "Library",
    description: "Components, patterns, schemas, tokens, contracts and implementation guidance",
    accent: "#7c3aed",
    icon: LibraryBig,
    navigation: [
      { id: "lib-overview", label: "Overview", items: [{ id: "library-dashboard", label: "Library Dashboard", icon: Gauge, pageId: "library-dashboard" }] },
      { id: "lib-components", label: "Components", items: [
        { id: "ui-primitives", label: "UI Primitives", icon: Sparkles, children: [
          { id: "component-library", label: "Component Gallery", pageId: "component-library" },
          { id: "form-controls", label: "Form Controls", pageId: "form-controls" },
          { id: "feedback-components", label: "Feedback & Overlays", pageId: "feedback-components" },
          { id: "date-components", label: "Dates & Calendars", pageId: "date-components" },
          { id: "card-components", label: "Cards & Data Display", pageId: "card-components" },
          { id: "table-components", label: "Tables", pageId: "table-components" },
          { id: "navigation-components", label: "Buttons & Navigation", pageId: "navigation-components" },
          { id: "inline-components", label: "Inline Editing", pageId: "inline-components" },
        ] },
        { id: "composition", label: "Compositions", icon: PanelTop, children: [
          { id: "form-patterns", label: "Form Patterns", pageId: "form-patterns" },
          { id: "data-patterns", label: "Data Worklists", pageId: "data-patterns" },
          { id: "billing-patterns", label: "Billing Workspace", pageId: "billing-patterns" },
        ] },
      ] },
      { id: "lib-tools", label: "Utilities", items: [
        { id: "workspace-tools", label: "Workspace Tools", icon: FileSpreadsheet, children: [
          { id: "spreadsheet-studio", label: "Spreadsheet Studio", pageId: "spreadsheet-studio" },
          { id: "import-export", label: "Import & Export", pageId: "import-export" },
          { id: "bulk-operations", label: "Bulk Operations", pageId: "bulk-operations" },
        ] },
      ] },
      { id: "lib-design", label: "Design System", items: [
        { id: "design-tokens", label: "Design Tokens", icon: SlidersHorizontal, children: [
          { id: "theme-studio", label: "Theme Studio", pageId: "theme-studio" },
          { id: "localization", label: "Localization", icon: Languages, pageId: "localization" },
          { id: "accessibility", label: "Accessibility", pageId: "accessibility" },
        ] },
      ] },
      { id: "lib-docs", label: "Documentation", items: [
        { id: "engineering", label: "Engineering", icon: BookOpen, children: [
          { id: "page-catalog", label: "Page Catalog", pageId: "page-catalog" },
          { id: "component-contracts", label: "Component Contracts", pageId: "component-contracts" },
          { id: "keyboard-shortcuts", label: "Keyboard Shortcuts", pageId: "keyboard-shortcuts" },
          { id: "integration-guide", label: "Integration Guide", pageId: "integration-guide" },
        ] },
      ] },
      { id: "lib-settings", label: "Configuration", items: [
        { id: "personalization", label: "Personalization", icon: FileCog, children: [
          { id: "preferences", label: "My Preferences", pageId: "preferences" },
          { id: "saved-views", label: "Saved Views", pageId: "saved-views" },
          { id: "shortcut-manager", label: "Shortcut Manager", pageId: "shortcut-manager" },
        ] },
        { id: "inbox", label: "Inbox", icon: Bell, children: [
          { id: "notifications", label: "Notifications", pageId: "notifications" },
          { id: "messages", label: "Messages", pageId: "messages" },
        ] },
        { id: "ai-assistant", label: "AI Assistant", icon: Sparkles, children: [
          { id: "ai-administration", label: "AI Administration", pageId: "ai-administration" },
        ] },
      ] },
    ],
  },
};

const explicitPages: Record<string, Partial<PageDefinition>> = {
  "hr-dashboard": { kind: "dashboard", title: "HR Command Center" },
  "finance-dashboard": { kind: "dashboard", title: "Finance Command Center" },
  "payroll-dashboard": { kind: "dashboard", title: "Payroll Command Center" },
  "sales-dashboard": { kind: "dashboard", title: "Sales Command Center" },
  "supply-dashboard": { kind: "dashboard", title: "Supply Chain Command Center" },
  "library-dashboard": { kind: "dashboard", title: "Developer Library" },
  "user-master": { kind: "form", entity: "user", title: "User Master" },
  /* These two name their own use cases; every other page now falls back to
     defaultAiFor(kind). They are kept explicit because their sets were chosen
     for the page rather than derived from its kind. */
  "customer-master": { kind: "worklist", entity: "customer", title: "Customer Master",
    ai: { enabled: true, useCases: ["worklist.summarise-selection", "record.explain"] } },
  "sales-customer": { kind: "worklist", entity: "customer", title: "Customer Master" },
  "billing-entry": { kind: "billing", entity: "invoice", title: "Billing Entry",
    ai: { enabled: true, useCases: ["form.draft-note"] } },
  "sales-invoice": { kind: "billing", entity: "invoice", title: "Sales Invoice" },
  "billing-worklist": { kind: "worklist", entity: "invoice", title: "Billing Worklist" },
  "profit-loss-report": { kind: "reports", title: "Profit & Loss" },
  "balance-sheet-report": { kind: "reports", title: "Balance Sheet" },
  "ar-aging-report": { kind: "reports", title: "Accounts Receivable Aging" },
  "tax-return-report": { kind: "reports", title: "Tax Return" },
  "workforce-report": { kind: "reports", title: "Workforce Analytics" },
  "attendance-report": { kind: "reports", title: "Attendance Report" },
  "compliance-report": { kind: "reports", title: "Compliance Register" },
  "pay-register-report": { kind: "reports", title: "Payroll Register" },
  "payslip-report": { kind: "reports", title: "Payslip Distribution" },
  "statutory-report": { kind: "reports", title: "Statutory Report" },
  "pipeline-report": { kind: "reports", title: "Sales Pipeline" },
  "revenue-report": { kind: "reports", title: "Revenue Analysis" },
  "margin-report": { kind: "reports", title: "Margin Analysis" },
  "inventory-valuation-report": { kind: "reports", title: "Inventory Valuation" },
  "supplier-performance-report": { kind: "reports", title: "Supplier Performance" },
  "stock-aging-report": { kind: "reports", title: "Stock Aging" },
  "preferences": { kind: "preferences", title: "My Preferences" },
  /* The assistant is explicitly OFF on the screen that configures it. Not
     because the config carries a secret -- it does not -- but because an
     assistant offering to explain the page where you revoke it reads as a
     joke in a demo and as a finding in an audit. It is also the live proof
     that an explicit block still beats defaultAiFor. */
  /* Shared, not owned by a module: the header raises them from anywhere, so
     filing them under Finance would make the breadcrumb lie on every other
     page. */
  "notifications": { kind: "inbox", entity: "notification", title: "Notifications", subtitle: "Everything the system has raised for you, and the record behind each one." },
  "messages": { kind: "inbox", entity: "message", title: "Messages", subtitle: "Conversations from colleagues and shared service desks." },
  /* `consultation-entry` needs an explicit kind: inferredKind reads "report" and
     "dashboard" out of a page id and defaults everything else to worklist, so a
     form whose id ends in -entry would have rendered as a table of one row. */
  /* Explicit entities: the suffix rule strips -master/-worklist/-report and the
     rest, which does not reach "queue", "history" or "on-hand". Without these
     the dispensing pages resolve to an entity named after themselves -- generic
     rows, and outside PHI_ENTITIES, which is the half that matters. */
  "prescription-queue": { kind: "worklist", entity: "prescription", title: "Prescription Queue", subtitle: "Prescriptions awaiting dispense, by ward and priority." },
  "dispense-history": { kind: "worklist", entity: "prescription", title: "Dispense History", subtitle: "What has been dispensed, when and by whom." },
  "medication-review": { kind: "worklist", entity: "prescription", title: "Medication Review", subtitle: "Prescriptions flagged for pharmacist review." },
  "stock-on-hand": { kind: "worklist", entity: "drug", title: "Stock on Hand" },
  "batch-expiry": { kind: "worklist", entity: "drug", title: "Batch & Expiry" },
  "controlled-register": { kind: "worklist", entity: "drug", title: "Controlled Register" },
  "consultation-entry": { kind: "consultation", entity: "consultation", title: "New Consultation", subtitle: "Composed from consultation type, specialty, complaint and patient context." },
  "consultation-worklist": { kind: "worklist", entity: "consultation", title: "Consultations", subtitle: "Outpatient consultations by specialty, clinician and outcome." },
  "ai-administration": { kind: "ai-admin", entity: "ai", title: "AI Administration", subtitle: "Provider, credential, limits and prompts for this tenant's assistant.", ai: { enabled: false, useCases: [] } },
  "spreadsheet-studio": { kind: "spreadsheet", title: "Spreadsheet Studio" },
  "component-library": { kind: "library", title: "Component Gallery" },
  "form-controls": { kind: "library", title: "Form Controls" },
  "date-components": { kind: "library", title: "Dates & Calendars" },
  "card-components": { kind: "library", title: "Cards & Data Display" },
  "table-components": { kind: "library", title: "Tables" },
  "navigation-components": { kind: "library", title: "Buttons & Navigation" },
  "inline-components": { kind: "library", title: "Inline Editing" },
  "feedback-components": { kind: "library", title: "Feedback & Overlays" },
  "form-patterns": { kind: "library", title: "Form Patterns" },
  "data-patterns": { kind: "library", title: "Data Worklists" },
  "billing-patterns": { kind: "library", title: "Billing Workspace" },
  "theme-studio": { kind: "library", title: "Theme Studio" },
  "localization": { kind: "library", title: "Localization" },
  "accessibility": { kind: "library", title: "Accessibility" },
  "page-catalog": { kind: "library", title: "Page Catalog" },
  "component-contracts": { kind: "library", title: "Component Contracts" },
  "keyboard-shortcuts": { kind: "library", title: "Keyboard Shortcuts" },
  "integration-guide": { kind: "library", title: "Integration Guide" },
};

function flattenPages() {
  const pages: Array<{ pageId: string; label: string; module: ModuleKey }> = [];
  Object.values(MODULES).forEach((module) => {
    module.navigation.forEach((section) => section.items.forEach((item) => {
      if (item.pageId) pages.push({ pageId: item.pageId, label: item.label, module: module.id });
      item.children?.forEach((child) => {
        if (child.pageId) pages.push({ pageId: child.pageId, label: child.label, module: module.id });
      });
    }));
  });
  return pages;
}

/**
 * The use cases a page offers when it does not name its own.
 *
 * Keyed by kind rather than given to every page, because the use case is the
 * allowlist: offering `form.draft-note` on a dashboard would put a control on
 * screen that can only ever assemble an empty context. What a kind cannot feed
 * it does not advertise.
 */
/** Modules where every page is clinical, whatever its entity says. */
const CLINICAL_MODULES: ReadonlySet<string> = new Set(["healthcare"]);

/**
 * Entities that carry patient data wherever they appear.
 *
 * A set rather than a flag on each page, for the reason the healthcare rule was
 * written the same way: the next page is the one nobody remembers to mark. Add a
 * page whose entity is `prescription` in any module and it is covered the day it
 * is added.
 */
const PHI_ENTITIES: ReadonlySet<string> = new Set([
  "patient", "consultation", "encounter", "prescription", "dispense", "medication",
]);

function defaultAiFor(kind: PageKind): PageAiConfig {
  switch (kind) {
    case "form":
    case "billing":
      return { enabled: true, useCases: ["form.draft-note", "record.explain"] };
    case "dashboard":
      return { enabled: true, useCases: ["dashboard.explain-metrics"] };
    case "reports":
      return { enabled: true, useCases: ["report.summarise"] };
    /* OFF, and that is the fix rather than a gap in it.

       These pages offered `record.explain` and had no record to give it: the
       button appeared, the transparency panel said nothing matched, and Send
       was disabled. Honest, but a control that can only ever refuse is worse
       than no control -- it costs a click to learn nothing.

       A component gallery, a spreadsheet scratchpad and a preferences form have
       nothing an approved use case may read, and inventing one to fill the hole
       would mean writing a `reads` list to fit a screen rather than a purpose.
       They opt out at gate 1, which is exactly what { enabled: false } is for. */
    case "template":
    case "library":
    case "spreadsheet":
    case "preferences":
      return { enabled: false, useCases: [] };
    /* The inbox was in that list until inbox.summarise-unread existed. It now
       has a source, a reads list and a prompt of its own, which is what it
       needed -- not record.explain aimed at something it was never written for. */
    case "inbox":
      return { enabled: true, useCases: ["inbox.summarise-unread"] };
    /* Nothing here offers the assistant, and the explicit block on the page
       means this arm is unreachable today. It is written anyway so a second
       ai-admin page cannot inherit the worklist default by omission. */
    case "ai-admin":
      return { enabled: false, useCases: [] };
    case "worklist":
    default:
      return { enabled: true, useCases: ["worklist.summarise-selection", "record.explain"] };
  }
}

export const PAGE_REGISTRY: Record<string, PageDefinition> = Object.fromEntries(
  flattenPages().map(({ pageId, label, module }) => {
    const explicit = explicitPages[pageId] ?? {};
    const inferredKind = pageId.includes("report") ? "reports" : pageId.includes("dashboard") ? "dashboard" : "worklist";
    const title = explicit.title ?? label;
    /* Hoisted out of the returned object: the AI rule below decides from the
       ENTITY, so it has to exist before the decision rather than beside it. */
    const entity = explicit.entity ?? pageId.replace(/-(master|worklist|report|entry|config|review|setup)$/g, "");
    return [pageId, {
      id: pageId,
      title,
      /* An explicit subtitle wins. The generic line below is written for pages
         that hold RECORDS, and reads as nonsense on anything else -- "manage ai
         administration records with saved views" described a screen that has
         neither records nor saved views. */
      subtitle: explicit.subtitle ?? (explicit.kind === "dashboard"
        ? MODULES[module].description
        : `Search, review and manage ${title.toLowerCase()} records with saved views and configurable actions.`),
      kind: explicit.kind ?? inferredKind,
      module,
      entity,
      /* Gate 1, now on for every page by default.
         This USED to carry `ai` through only when explicitPages declared it,
         so a page with no block was off at gate 1. That default was reversed
         deliberately (requested: the assistant should be reachable everywhere
         the help button is), and the honest consequence is that gate 1 no
         longer stops anything -- it hands the decision to the module/page
         policy the server owns, which is the layer that can be changed without
         a client release. An explicit block still wins, INCLUDING an explicit
         `{ enabled: false }`, so a page can still opt out at build time. */
      /* A page that holds patient data gets the clinical use cases and nothing
         else, and cannot opt out -- the rule sits ahead of `explicit.ai` so no
         page can widen itself.

         Keyed on the ENTITY, not the module. Healthcare is clinical throughout,
         but pharmacy is not: a prescription queue carries a patient, a drug and
         a dose -- the triple you least want at a general-purpose provider --
         while a drug master carries stock levels and suppliers and is ordinary
         supply-chain data. A per-module rule would have to be wrong about one of
         them.

         Gate 1 saying yes is still not the assistant appearing: the tenant
         policy denies healthcare server-side, which is the layer an
         administrator changes once a PHI-approved provider exists. */
      ai: CLINICAL_MODULES.has(module) || PHI_ENTITIES.has(entity)
        ? { enabled: true, useCases: ["encounter.summarise", "documentation.gaps", "cohort.summarise-selection", "coding.suggest-icd", "orders.suggest"] }
        : explicit.ai ?? defaultAiFor(explicit.kind ?? inferredKind),
    } satisfies PageDefinition];
  })
);

PAGE_REGISTRY["documentation-center"] = {id:"documentation-center",title:"Documentation Center",subtitle:"Page guides, releases, patches and changes.",kind:"library",module:"shared",icon:BookOpen};

PAGE_REGISTRY["error-monitor"] = {id:"error-monitor",title:"Error Monitor",subtitle:"Review sanitized application incidents.",kind:"library",module:"shared",icon:Activity};

export const BRANCHES = [
  { value: "hq", label: "Abu Dhabi • Head Office" },
  { value: "dubai", label: "Dubai • Business Center" },
  { value: "sharjah", label: "Sharjah • Operations Hub" },
  { value: "india", label: "Kochi • Delivery Center" },
];

export const ROLES = [
  { value: "enterprise-admin", label: "Enterprise Administrator" },
  { value: "finance-manager", label: "Finance Manager" },
  { value: "hr-business-partner", label: "HR Business Partner" },
  { value: "operations-analyst", label: "Operations Analyst" },
  { value: "auditor", label: "Internal Auditor" },
  { value: "school-admin", label: "School Admin" },
  { value: "school-teacher", label: "School Teacher" },
  { value: "school-student", label: "School Student" },
  { value: "school-parent", label: "School Parent" },
  { value: "school-librarian", label: "School Librarian" },
  { value: "school-accountant", label: "School Accountant" },

];

export const HEADER_QUICK_PAGES = [
  { id: "journal-entry", label: "New journal", icon: CircleDollarSign },
  { id: "billing-entry", label: "New invoice", icon: BadgeDollarSign },
  { id: "employee-master", label: "New employee", icon: UserSquare2 },
  { id: "spreadsheet-studio", label: "Open spreadsheet", icon: TableProperties },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "customer-master", label: "Undo navigation", icon: Undo2 },
  { id: "billing-worklist", label: "Payment queue", icon: CreditCard },
  { id: "payroll-run", label: "Payroll run", icon: HandCoins },
  { id: "activity", label: "Activity", icon: Activity },
];

PAGE_REGISTRY["draft-recovery"] = {id:"draft-recovery",title:"Draft Recovery Center",subtitle:"Find and resume your unfinished work.",kind:"library",module:"shared",icon:BookOpen};


// Page templates share rendering engines but retain stable application-specific menu IDs.
import {PAGE_TEMPLATES,TEMPLATE_GROUPS} from './page-templates.ts';
PAGE_REGISTRY['page-templates']={id:'page-templates',title:'template.library',subtitle:'template.libraryHelp',kind:'library',module:'library',icon:BookOpen};
for(const template of PAGE_TEMPLATES)PAGE_REGISTRY[template.id]={id:template.id,title:template.title,subtitle:template.description,kind:'library',module:'library',icon:BookOpen};
MODULES.library.navigation.splice(2,0,{id:'lib-page-templates',label:'template.library',items:[
 {id:'page-templates',label:'template.library',pageId:'page-templates',icon:BookOpen},
 ...TEMPLATE_GROUPS.map(group=>({id:`template-group-${group.id}`,label:group.title,icon:BookOpen,children:PAGE_TEMPLATES.filter(template=>template.group===group.id).map(template=>({id:template.id,label:template.title,pageId:template.id}))})),
]});

// Specialized clinical compositions are additive; existing presets remain unchanged.
import {CLINICAL_TEMPLATE_PAGES} from './clinical-templates.ts';
for(const page of CLINICAL_TEMPLATE_PAGES)PAGE_REGISTRY[page.id]={id:page.id,title:({'dcp-designer':'DCP Visual Designer','allyvora-patient-query':'Patient Query','allyvora-patient-record':'Patient Record','allyvora-patient-360':'360 Data','billing-clinic':'Billing Clinic','clinical-triage':'Clinical Triage','clinical-consultation':'Clinical Consultation','op-consultation':'OP Consultation','comprehensive-consultation':'Comprehensive Consultation','op-registration':'OP Registration',"emergency-registration":"Emergency Registration","inpatient-admission":"Inpatient Admission","consultation-entry-design":"Consultation Entry","consultation-entry-v2":"Consultation Entry v2"} as Record<string,string>)[page.id],titleKey:page.title,subtitle:'template.clinical.demoNotice',kind:'library',module:'library',icon:BookOpen};
PAGE_REGISTRY['list-of-pages']={id:'list-of-pages',title:'List of pages',titleKey:'template.pageLibrary.title',subtitle:'template.pageLibrary.help',kind:'library',module:'library',icon:BookOpen};
MODULES.library.navigation.splice(3,0,{id:'lib-clinical-templates',label:'template.clinical.library',items:[{id:"list-of-pages",label:"template.pageLibrary.title",pageId:"list-of-pages",icon:BookOpen},...CLINICAL_TEMPLATE_PAGES.map(page=>({id:page.id,label:page.title,pageId:page.id,icon:BookOpen}))]});

import {LABEL_PAGES} from './label-printing.ts';
for(const [id] of LABEL_PAGES)PAGE_REGISTRY[id]={id,title:id,titleKey:'labels.'+id,subtitle:'labels.demoNotice',kind:'library',module:'library',icon:Tags};
MODULES.library.navigation.push({id:'lib-label-printing',label:'labels.title',items:LABEL_PAGES.map(([id])=>({id,label:'labels.'+id,pageId:id,icon:Tags}))});

import {DEVICE_PAGES} from './device-integrations.ts';
for(const id of DEVICE_PAGES)PAGE_REGISTRY[id]={id,title:id,titleKey:'devices.'+id,subtitle:'devices.notice',kind:'library',module:'library',icon:Tags};
MODULES.library.navigation.push({id:'lib-device-integrations',label:'devices.device-integrations',items:DEVICE_PAGES.map(id=>({id,label:'devices.'+id,pageId:id,icon:Tags}))});
import {IDENTITY_PAGES} from './identity-devices.ts';
for(const id of IDENTITY_PAGES)PAGE_REGISTRY[id]={id,title:id,titleKey:'identity.'+id,subtitle:'identity.notice',kind:'library',module:'library',icon:Tags};
MODULES.library.navigation.find(s=>s.id==='lib-device-integrations')!.items.push(...IDENTITY_PAGES.map(id=>({id,label:'identity.'+id,pageId:id,icon:Tags})));

import {REFERENCE_MODULES} from './reference-modules.ts';
import {HEALTHCARE_SUITE_SECTION_TITLES} from './healthcare-suite-reference.ts';
for(const module of REFERENCE_MODULES){
 const groups=[...new Set(module.pages.map(page=>page.section))];
 MODULES[module.id]={id:module.id,label:module.title,shortLabel:module.shortLabel,description:'Reusable reference workspace with authenticated demo adapters',accent:module.accent,icon:module.variant==='school'?BookOpen:module.variant==='reports'?FileChartColumn:module.variant==='healthcare-suite'?Stethoscope:Boxes,navigation:groups.map(section=>({id:module.id+'-'+section,label:module.variant==='healthcare-suite'?HEALTHCARE_SUITE_SECTION_TITLES[section]:section.charAt(0).toUpperCase()+section.slice(1),items:module.pages.filter(page=>page.section===section).map(page=>({id:page.id,label:page.title,pageId:page.id,icon:FileText}))}))};
 for(const page of module.pages)PAGE_REGISTRY[page.id]={id:page.id,title:page.title,titleKey:'page.'+page.id+'.title',subtitle:'reference.modules.demoNotice',kind:'library',module:module.id,icon:FileText,ai:{enabled:false,useCases:[]}};
}

import {SCHOOL_ROLE_VIEWS} from './school-role-views.ts';
const schoolPages=REFERENCE_MODULES.find(module=>module.id==='reference-school')!.pages;
for(const view of SCHOOL_ROLE_VIEWS){
 MODULES[view.id]={...MODULES['reference-school'],id:view.id,label:view.title,labelKey:view.titleKey,shortLabel:view.shortLabel,shortLabelKey:view.shortLabelKey,navigation:[...view.groups,{label:'Account',items:[{href:'/settings',label:'Settings'}]}].map(group=>({id:view.id+'-'+group.label.toLowerCase(),label:group.label,labelKey:'reference-school.section.'+group.label.toLowerCase(),items:group.items.map(item=>({id:view.id+'-'+item.href.slice(1),label:item.label,pageId:schoolPages.find(page=>page.path===item.href)!.id,icon:FileText}))}))};
}
