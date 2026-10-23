export const medslotRoutes = [
  {
    "path": "/",
    "title": "Dashboard",
    "kind": "dashboard"
  },
  {
    "path": "/book",
    "title": "Book appointment",
    "kind": "book"
  },
  {
    "path": "/calendar",
    "title": "Calendar",
    "kind": "calendar"
  },
  {
    "path": "/appointments",
    "title": "Appointments",
    "kind": "appointments"
  },
  {
    "path": "/patients",
    "title": "Patients",
    "kind": "patients"
  },
  {
    "path": "/resources",
    "title": "Resources & schedules",
    "kind": "resources"
  },
  {
    "path": "/services",
    "title": "Services",
    "kind": "services"
  },
  {
    "path": "/departments",
    "title": "Departments",
    "kind": "departments"
  },
  {
    "path": "/holidays",
    "title": "Holidays",
    "kind": "holidays"
  },
  {
    "path": "/notifications",
    "title": "Notifications",
    "kind": "notifications"
  },
  {
    "path": "/settings",
    "title": "Users & settings",
    "kind": "settings"
  },
  {
    "path": "/audit",
    "title": "Audit log",
    "kind": "audit"
  },
  {
    "path": "/patients/[id]",
    "title": "Patient record",
    "kind": "patient"
  },
  {
    "path": "/resources/[id]",
    "title": "Resource and schedule",
    "kind": "resource"
  }
] as const;
export const medslotNavigation=medslotRoutes.filter(p=>!p.path.includes('[id]'));
export const medslotRoles=['enterprise-admin','medslot-admin','medslot-scheduler','medslot-provider'];
export function medslotPageRoles(kind:string){return ['departments','notifications','settings','audit'].includes(kind)?medslotRoles.slice(0,2):['book','resources','resource','services','holidays'].includes(kind)?medslotRoles.slice(0,3):medslotRoles;}
export function resolveMedslotRoute(path:string){
 const pathname=path.split('?')[0]!;const fixed=medslotNavigation.find(p=>p.path===pathname);if(fixed)return {kind:fixed.kind};
 const match=/^\/(patients|resources)\/([1-9]\d*)$/.exec(pathname);return match?{kind:match[1]==='patients'?'patient' as const:'resource' as const,id:match[2]}:null;
}
