import { Boxes, FileCheck2, History, Landmark, LayoutDashboard, Pill, Receipt, ScanBarcode, ShieldCheck, ShoppingBag, Truck, Users, type LucideIcon } from "lucide-react";

export type { Dashboard } from "../../lib/types";

export interface NavItem { href: string; label: string; icon: LucideIcon; hint?: string }
/** The source navigation: the host renders the sidebar from `pharmacyNavigation`; the command palette's "Go to" list uses this. */
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Operate", items: [
    { href: "/", label: "Command center", icon: LayoutDashboard, hint: "Today at a glance" },
    { href: "/workbench", label: "Rx workbench", icon: Pill, hint: "Verify, fill, check, hand over" },
    { href: "/counter", label: "Counter sale", icon: ScanBarcode, hint: "Sell non-prescription items" },
    { href: "/orders", label: "Customer orders", icon: ShoppingBag, hint: "Phone, web and WhatsApp orders" },
    { href: "/sales", label: "Sales and returns", icon: Receipt, hint: "Invoices, receipts, refunds" },
  ] },
  { group: "Stock", items: [
    { href: "/inventory", label: "Inventory", icon: Boxes, hint: "Batches, expiry, ledger" },
    { href: "/purchasing", label: "Purchasing", icon: Truck, hint: "Orders and receiving" },
  ] },
  { group: "Revenue", items: [
    { href: "/authorizations", label: "Prior authorizations", icon: ShieldCheck, hint: "Request and record approvals" },
    { href: "/claims", label: "Claims", icon: FileCheck2, hint: "Submit, fix, follow up" },
    { href: "/remittance", label: "Remittance & payments", icon: Landmark, hint: "Post payer payments" },
  ] },
  { group: "Records", items: [
    { href: "/patients", label: "Patients", icon: Users, hint: "Profiles, coverage, history" },
    { href: "/audit", label: "Audit trail", icon: History, hint: "Every status change" },
  ] },
];
