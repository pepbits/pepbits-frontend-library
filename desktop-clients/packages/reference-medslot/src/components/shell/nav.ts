"use client";
import { LayoutDashboard, CalendarPlus, CalendarDays, ListChecks, Users, Boxes, Stethoscope, Building, CalendarX, Bell, Settings, ShieldCheck } from "lucide-react";
import type { Role } from "../../lib/types";

export const NAV: { group?: string; items: { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] }[] }[] = [
  { items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/book", label: "Book appointment", icon: CalendarPlus, roles: ["admin", "scheduler"] },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/appointments", label: "Appointments", icon: ListChecks },
    { href: "/patients", label: "Patients", icon: Users },
  ] },
  { group: "Setup", items: [
    { href: "/resources", label: "Resources & schedules", icon: Boxes, roles: ["admin", "scheduler"] },
    { href: "/services", label: "Services", icon: Stethoscope, roles: ["admin", "scheduler"] },
    { href: "/departments", label: "Departments", icon: Building, roles: ["admin"] },
    { href: "/holidays", label: "Holidays", icon: CalendarX, roles: ["admin", "scheduler"] },
    { href: "/notifications", label: "Notifications", icon: Bell, roles: ["admin"] },
  ] },
  { group: "Admin", items: [
    { href: "/settings", label: "Users & settings", icon: Settings, roles: ["admin"] },
    { href: "/audit", label: "Audit log", icon: ShieldCheck, roles: ["admin"] },
  ] },
];
