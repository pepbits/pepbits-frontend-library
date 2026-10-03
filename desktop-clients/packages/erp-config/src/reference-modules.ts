import {MEDSLOT_REFERENCE} from "./medslot-reference.ts";
import {SURGISUITE_REFERENCE} from "./surgisuite-reference.ts";
import {RCM_REFERENCE} from "./rcm-reference.ts";
import {TENANT_ADMIN_REFERENCE,MEDBAND_REFERENCE} from "./access-reference.ts";
import {PHARMACY_REFERENCE} from './pharmacy-reference.ts';
import {QUALITY_REFERENCE} from './quality-reference.ts';
import {TELECONSULT_REFERENCES,sourceRouteMatches} from './teleconsult-reference.ts';
import {DIAGNOSTIC_REFERENCES} from './diagnostic-reference.ts';
import {HEALTHCARE_SUITE_REFERENCE} from "./healthcare-suite-reference.ts";
import {SCHOOL_ROLE_VIEWS, schoolRoleView} from "./school-role-views.ts";
import type {ReferenceModuleId} from "./reference-module-types.ts";
/** Source-preserving modules, independent of their reusable render packages. */
export const REFERENCE_MODULES = [
  {
    "id": "reference-reports",
    "variant": "reports",
    "title": "Lumen Reports",
    "shortLabel": "Reports",
    "accent": "#315e4d",
    "pages": [
      {"id":"reference-reports-overview","path":"/","title":"Overview","section":"workspace"},
      {
        "id": "reference-reports-reports",
        "path": "/reports",
        "title": "Report library",
        "section": "workspace"
      },
      {
        "id": "reference-reports-admin-access",
        "path": "/admin/access",
        "title": "Admin · Access",
        "section": "admin"
      },
      {
        "id": "reference-reports-admin-audit",
        "path": "/admin/audit",
        "title": "Admin · Audit",
        "section": "admin"
      },
      {
        "id": "reference-reports-admin-outbox",
        "path": "/admin/outbox",
        "title": "Admin · Outbox",
        "section": "admin"
      },
      {
        "id": "reference-reports-admin-settings",
        "path": "/admin/settings",
        "title": "Admin · Settings",
        "section": "admin"
      },
      {
        "id": "reference-reports-admin-sources",
        "path": "/admin/sources",
        "title": "Admin · Sources",
        "section": "admin"
      },
      {
        "id": "reference-reports-admin-users",
        "path": "/admin/users",
        "title": "Admin · Users",
        "section": "admin"
      },
      {
        "id": "reference-reports-api-keys",
        "path": "/api-keys",
        "title": "API keys",
        "section": "workspace"
      },
      {
        "id": "reference-reports-builder",
        "path": "/builder",
        "title": "Report builder",
        "section": "workspace"
      },
      {
        "id": "reference-reports-dashboards",
        "path": "/dashboards",
        "title": "Dashboards",
        "section": "workspace"
      },
      {
        "id": "reference-reports-email-in",
        "path": "/email-in",
        "title": "Email-in requests",
        "section": "workspace"
      },
      {
        "id": "reference-reports-jobs",
        "path": "/jobs",
        "title": "Background jobs",
        "section": "workspace"
      },
      {
        "id": "reference-reports-schedules",
        "path": "/schedules",
        "title": "Schedules",
        "section": "workspace"
      }
    ]
  },
  {
    "id": "reference-erp1",
    "variant": "erp1",
    "title": "Keystone ERP 1",
    "shortLabel": "ERP 1",
    "accent": "#2f5ba2",
    "pages": [
      {
        "id": "reference-erp1-workspace-dashboard",
        "path": "/workspace/dashboard",
        "title": "Dashboard",
        "section": "workspace"
      },
      {
        "id": "reference-erp1-workspace-approvals",
        "path": "/workspace/approvals",
        "title": "Approvals inbox",
        "section": "workspace"
      },
      {
        "id": "reference-erp1-masters-countries",
        "path": "/masters/countries",
        "title": "Country master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-states",
        "path": "/masters/states",
        "title": "State master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-currencies",
        "path": "/masters/currencies",
        "title": "Currency master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-units",
        "path": "/masters/units",
        "title": "Unit of measure",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-holidays",
        "path": "/masters/holidays",
        "title": "Holiday calendar",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-org-structure",
        "path": "/masters/org-structure",
        "title": "Organisation structure",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-departments",
        "path": "/masters/departments",
        "title": "Department master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-chart-of-accounts",
        "path": "/masters/chart-of-accounts",
        "title": "Chart of accounts",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-tax-rates",
        "path": "/masters/tax-rates",
        "title": "Tax rates",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-customers",
        "path": "/masters/customers",
        "title": "Customer master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-suppliers",
        "path": "/masters/suppliers",
        "title": "Supplier master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-items",
        "path": "/masters/items",
        "title": "Item master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-product-categories",
        "path": "/masters/product-categories",
        "title": "Product categories",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-price-lists",
        "path": "/masters/price-lists",
        "title": "Price lists",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-bill-of-materials",
        "path": "/masters/bill-of-materials",
        "title": "Bill of materials",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-employees",
        "path": "/masters/employees",
        "title": "Employee master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-leave-types",
        "path": "/masters/leave-types",
        "title": "Leave types",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-shifts",
        "path": "/masters/shifts",
        "title": "Shift master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-salary-structures",
        "path": "/masters/salary-structures",
        "title": "Salary structures",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-patients",
        "path": "/masters/patients",
        "title": "Patient master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-doctors",
        "path": "/masters/doctors",
        "title": "Doctor master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-lab-tests",
        "path": "/masters/lab-tests",
        "title": "Lab test master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-consultation-fees",
        "path": "/masters/consultation-fees",
        "title": "Consultation fees",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-students",
        "path": "/masters/students",
        "title": "Student master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-fee-structures",
        "path": "/masters/fee-structures",
        "title": "Fee structures",
        "section": "masters"
      },
      {
        "id": "reference-erp1-masters-vehicles",
        "path": "/masters/vehicles",
        "title": "Vehicle master",
        "section": "masters"
      },
      {
        "id": "reference-erp1-transactions-sales-orders",
        "path": "/transactions/sales-orders",
        "title": "Sales orders",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-sales-invoices",
        "path": "/transactions/sales-invoices",
        "title": "Sales invoices",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-purchase-orders",
        "path": "/transactions/purchase-orders",
        "title": "Purchase orders",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-goods-receipts",
        "path": "/transactions/goods-receipts",
        "title": "Goods receipts",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-journal-vouchers",
        "path": "/transactions/journal-vouchers",
        "title": "Journal vouchers",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-payment-vouchers",
        "path": "/transactions/payment-vouchers",
        "title": "Payment vouchers",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-petty-cash",
        "path": "/transactions/petty-cash",
        "title": "Petty cash vouchers",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-leave-requests",
        "path": "/transactions/leave-requests",
        "title": "Leave requests",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-expense-claims",
        "path": "/transactions/expense-claims",
        "title": "Expense claims",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-attendance",
        "path": "/transactions/attendance",
        "title": "Attendance register",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-timesheets",
        "path": "/transactions/timesheets",
        "title": "Timesheets",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-payroll-run",
        "path": "/transactions/payroll-run",
        "title": "Payroll run",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-depreciation-run",
        "path": "/transactions/depreciation-run",
        "title": "Depreciation run",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-appointments",
        "path": "/transactions/appointments",
        "title": "Appointments",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-room-bookings",
        "path": "/transactions/room-bookings",
        "title": "Meeting rooms",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-quality-inspections",
        "path": "/transactions/quality-inspections",
        "title": "Quality inspections",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-support-tickets",
        "path": "/transactions/support-tickets",
        "title": "Support tickets",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-maintenance-requests",
        "path": "/transactions/maintenance-requests",
        "title": "Maintenance requests",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-transactions-marks-entry",
        "path": "/transactions/marks-entry",
        "title": "Marks entry",
        "section": "transactions"
      },
      {
        "id": "reference-erp1-reports-sales-register",
        "path": "/reports/sales-register",
        "title": "Sales register",
        "section": "reports"
      },
      {
        "id": "reference-erp1-reports-purchase-register",
        "path": "/reports/purchase-register",
        "title": "Purchase register",
        "section": "reports"
      },
      {
        "id": "reference-erp1-reports-stock-summary",
        "path": "/reports/stock-summary",
        "title": "Stock summary",
        "section": "reports"
      },
      {
        "id": "reference-erp1-reports-receivables-aging",
        "path": "/reports/receivables-aging",
        "title": "Receivables aging",
        "section": "reports"
      },
      {
        "id": "reference-erp1-reports-customer-ledger",
        "path": "/reports/customer-ledger",
        "title": "Customer ledger",
        "section": "reports"
      },
      {
        "id": "reference-erp1-reports-invoice-print",
        "path": "/reports/invoice-print",
        "title": "Invoice print",
        "section": "reports"
      },
      {
        "id": "reference-erp1-setup-company-settings",
        "path": "/setup/company-settings",
        "title": "Company settings",
        "section": "setup"
      },
      {
        "id": "reference-erp1-setup-users",
        "path": "/setup/users",
        "title": "Users",
        "section": "setup"
      },
      {
        "id": "reference-erp1-setup-number-series",
        "path": "/setup/number-series",
        "title": "Number series",
        "section": "setup"
      },
      {
        "id": "reference-erp1-setup-notifications",
        "path": "/setup/notifications",
        "title": "Notification settings",
        "section": "setup"
      }
    ]
  },
  {
    "id": "reference-erp2",
    "variant": "erp2",
    "title": "Keystone ERP 2",
    "shortLabel": "ERP 2",
    "accent": "#66519e",
    "pages": [
      {
        "id": "reference-erp2-workspace-dashboard",
        "path": "/workspace/dashboard",
        "title": "Dashboard",
        "section": "workspace"
      },
      {
        "id": "reference-erp2-workspace-approvals",
        "path": "/workspace/approvals",
        "title": "Approvals inbox",
        "section": "workspace"
      },
      {
        "id": "reference-erp2-masters-countries",
        "path": "/masters/countries",
        "title": "Country master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-states",
        "path": "/masters/states",
        "title": "State master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-currencies",
        "path": "/masters/currencies",
        "title": "Currency master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-units",
        "path": "/masters/units",
        "title": "Unit of measure",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-holidays",
        "path": "/masters/holidays",
        "title": "Holiday calendar",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-org-structure",
        "path": "/masters/org-structure",
        "title": "Organisation structure",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-departments",
        "path": "/masters/departments",
        "title": "Department master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-chart-of-accounts",
        "path": "/masters/chart-of-accounts",
        "title": "Chart of accounts",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-tax-rates",
        "path": "/masters/tax-rates",
        "title": "Tax rates",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-customers",
        "path": "/masters/customers",
        "title": "Customer master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-suppliers",
        "path": "/masters/suppliers",
        "title": "Supplier master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-items",
        "path": "/masters/items",
        "title": "Item master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-product-categories",
        "path": "/masters/product-categories",
        "title": "Product categories",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-price-lists",
        "path": "/masters/price-lists",
        "title": "Price lists",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-bill-of-materials",
        "path": "/masters/bill-of-materials",
        "title": "Bill of materials",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-employees",
        "path": "/masters/employees",
        "title": "Employee master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-leave-types",
        "path": "/masters/leave-types",
        "title": "Leave types",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-shifts",
        "path": "/masters/shifts",
        "title": "Shift master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-salary-structures",
        "path": "/masters/salary-structures",
        "title": "Salary structures",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-patients",
        "path": "/masters/patients",
        "title": "Patient master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-doctors",
        "path": "/masters/doctors",
        "title": "Doctor master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-lab-tests",
        "path": "/masters/lab-tests",
        "title": "Lab test master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-consultation-fees",
        "path": "/masters/consultation-fees",
        "title": "Consultation fees",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-students",
        "path": "/masters/students",
        "title": "Student master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-fee-structures",
        "path": "/masters/fee-structures",
        "title": "Fee structures",
        "section": "masters"
      },
      {
        "id": "reference-erp2-masters-vehicles",
        "path": "/masters/vehicles",
        "title": "Vehicle master",
        "section": "masters"
      },
      {
        "id": "reference-erp2-transactions-sales-orders",
        "path": "/transactions/sales-orders",
        "title": "Sales orders",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-sales-invoices",
        "path": "/transactions/sales-invoices",
        "title": "Sales invoices",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-purchase-orders",
        "path": "/transactions/purchase-orders",
        "title": "Purchase orders",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-goods-receipts",
        "path": "/transactions/goods-receipts",
        "title": "Goods receipts",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-journal-vouchers",
        "path": "/transactions/journal-vouchers",
        "title": "Journal vouchers",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-payment-vouchers",
        "path": "/transactions/payment-vouchers",
        "title": "Payment vouchers",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-petty-cash",
        "path": "/transactions/petty-cash",
        "title": "Petty cash vouchers",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-leave-requests",
        "path": "/transactions/leave-requests",
        "title": "Leave requests",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-expense-claims",
        "path": "/transactions/expense-claims",
        "title": "Expense claims",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-attendance",
        "path": "/transactions/attendance",
        "title": "Attendance register",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-timesheets",
        "path": "/transactions/timesheets",
        "title": "Timesheets",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-payroll-run",
        "path": "/transactions/payroll-run",
        "title": "Payroll run",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-depreciation-run",
        "path": "/transactions/depreciation-run",
        "title": "Depreciation run",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-appointments",
        "path": "/transactions/appointments",
        "title": "Appointments",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-room-bookings",
        "path": "/transactions/room-bookings",
        "title": "Meeting rooms",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-quality-inspections",
        "path": "/transactions/quality-inspections",
        "title": "Quality inspections",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-support-tickets",
        "path": "/transactions/support-tickets",
        "title": "Support tickets",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-maintenance-requests",
        "path": "/transactions/maintenance-requests",
        "title": "Maintenance requests",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-transactions-marks-entry",
        "path": "/transactions/marks-entry",
        "title": "Marks entry",
        "section": "transactions"
      },
      {
        "id": "reference-erp2-reports-sales-register",
        "path": "/reports/sales-register",
        "title": "Sales register",
        "section": "reports"
      },
      {
        "id": "reference-erp2-reports-purchase-register",
        "path": "/reports/purchase-register",
        "title": "Purchase register",
        "section": "reports"
      },
      {
        "id": "reference-erp2-reports-stock-summary",
        "path": "/reports/stock-summary",
        "title": "Stock summary",
        "section": "reports"
      },
      {
        "id": "reference-erp2-reports-receivables-aging",
        "path": "/reports/receivables-aging",
        "title": "Receivables aging",
        "section": "reports"
      },
      {
        "id": "reference-erp2-reports-customer-ledger",
        "path": "/reports/customer-ledger",
        "title": "Customer ledger",
        "section": "reports"
      },
      {
        "id": "reference-erp2-reports-invoice-print",
        "path": "/reports/invoice-print",
        "title": "Invoice print",
        "section": "reports"
      },
      {
        "id": "reference-erp2-setup-company-settings",
        "path": "/setup/company-settings",
        "title": "Company settings",
        "section": "setup"
      },
      {
        "id": "reference-erp2-setup-users",
        "path": "/setup/users",
        "title": "Users",
        "section": "setup"
      },
      {
        "id": "reference-erp2-setup-number-series",
        "path": "/setup/number-series",
        "title": "Number series",
        "section": "setup"
      },
      {
        "id": "reference-erp2-setup-notifications",
        "path": "/setup/notifications",
        "title": "Notification settings",
        "section": "setup"
      }
    ]
  },
  {
    "id": "reference-school",
    "variant": "school",
    "title": "Scholaris School",
    "shortLabel": "School",
    "accent": "#006f66",
    "pages": [
      {
        "id": "reference-school-dashboard",
        "path": "/dashboard",
        "title": "Dashboard",
        "section": "workspace"
      },
      {
        "id": "reference-school-admissions",
        "path": "/admissions",
        "title": "Admissions",
        "section": "workspace"
      },
      {
        "id": "reference-school-assignments",
        "path": "/assignments",
        "title": "Assignments",
        "section": "workspace"
      },
      {
        "id": "reference-school-attendance",
        "path": "/attendance",
        "title": "Attendance",
        "section": "workspace"
      },
      {
        "id": "reference-school-calendar",
        "path": "/calendar",
        "title": "Calendar",
        "section": "workspace"
      },
      {
        "id": "reference-school-classes",
        "path": "/classes",
        "title": "Classes",
        "section": "workspace"
      },
      {
        "id": "reference-school-exams",
        "path": "/exams",
        "title": "Exams",
        "section": "workspace"
      },
      {
        "id": "reference-school-fees",
        "path": "/fees",
        "title": "Fees",
        "section": "workspace"
      },
      {
        "id": "reference-school-library",
        "path": "/library",
        "title": "Library",
        "section": "workspace"
      },
      {
        "id": "reference-school-live",
        "path": "/live",
        "title": "Live",
        "section": "workspace"
      },
      {
        "id": "reference-school-marks",
        "path": "/marks",
        "title": "Marks",
        "section": "workspace"
      },
      {
        "id": "reference-school-messages",
        "path": "/messages",
        "title": "Messages",
        "section": "workspace"
      },
      {
        "id": "reference-school-notices",
        "path": "/notices",
        "title": "Notices",
        "section": "workspace"
      },
      {
        "id": "reference-school-quizzes",
        "path": "/quizzes",
        "title": "Quizzes",
        "section": "workspace"
      },
      {
        "id": "reference-school-quizzes-new",
        "path": "/quizzes/new",
        "title": "Quizzes · New",
        "section": "workspace"
      },
      {
        "id": "reference-school-reports",
        "path": "/reports",
        "title": "Reports",
        "section": "workspace"
      },
      {
        "id": "reference-school-settings",
        "path": "/settings",
        "title": "Settings",
        "section": "workspace"
      },
      {
        "id": "reference-school-students",
        "path": "/students",
        "title": "Students",
        "section": "workspace"
      },
      {
        "id": "reference-school-students-new",
        "path": "/students/new",
        "title": "Students · New",
        "section": "workspace"
      },
      {
        "id": "reference-school-subjects",
        "path": "/subjects",
        "title": "Subjects",
        "section": "workspace"
      },
      {
        "id": "reference-school-teachers",
        "path": "/teachers",
        "title": "Teachers",
        "section": "workspace"
      },
      {
        "id": "reference-school-teachers-new",
        "path": "/teachers/new",
        "title": "Teachers · New",
        "section": "workspace"
      },
      {
        "id": "reference-school-timetable",
        "path": "/timetable",
        "title": "Timetable",
        "section": "workspace"
      },
      {
        "id": "reference-school-whiteboard",
        "path": "/whiteboard",
        "title": "Whiteboard",
        "section": "workspace"
      }
    ]
  }
, HEALTHCARE_SUITE_REFERENCE, ...DIAGNOSTIC_REFERENCES, ...TELECONSULT_REFERENCES, QUALITY_REFERENCE, PHARMACY_REFERENCE, TENANT_ADMIN_REFERENCE, MEDBAND_REFERENCE, RCM_REFERENCE, SURGISUITE_REFERENCE, MEDSLOT_REFERENCE
] as const;
export const REFERENCE_PAGE_BY_ID:Readonly<Record<string,{id:string;path:string;title:string;moduleId:ReferenceModuleId;variant:string;navigation?:boolean}>>=Object.fromEntries(REFERENCE_MODULES.flatMap(module=>module.pages.map(page=>[page.id,{...page,moduleId:module.id,variant:module.variant}])));
/** Extra portals share the original School page descriptors and renderer. */
export const REFERENCE_ROLE_VIEWS = SCHOOL_ROLE_VIEWS.filter(view => view.id !== 'reference-school');
export function referenceNavigationTarget(moduleId:ReferenceModuleId,path:string){
 const view=schoolRoleView(moduleId);
 const module=REFERENCE_MODULES.find(m=>m.id===(view?'reference-school':moduleId));
 if(!module)throw new Error('Unknown reference module');
 const pathname=path.split("?")[0];
 const ordered=[...module.pages].sort((a,b)=>b.path.length-a.path.length);
 const page=ordered.find(p=>sourceRouteMatches(p.path,pathname))??ordered.find(p=>!p.path.includes("[id]")&&(pathname===p.path||pathname.startsWith(p.path+"/")))??module.pages[0];
 return {pageId:page.id,recordId:path,title:page.title,...(view?{moduleId:view.id}:{})};
}
/** Next keeps encoded slashes in dynamic parameters; desktop paths are already plain. */
export function referenceInternalPath(recordId:string|undefined):string|undefined {
 if(!recordId)return undefined;
 if(recordId.startsWith('/'))return recordId;
 if(!/^%2f/i.test(recordId))return undefined;
 try{return decodeURIComponent(recordId);}catch{return undefined;}
}
