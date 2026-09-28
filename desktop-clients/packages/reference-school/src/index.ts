/* @pepbits/reference-school public API. Pages render only inside ReferenceSchoolModule, which supplies the host,
   session, lookups and toasts they need. All production and demo data comes from the school API through the host;
   the package ships no fixture data (fictional fixtures under src/test-support are for unit tests only). */
export { ReferenceSchoolModule } from "./module";
export { matchSchoolRoute, SCHOOL_ROLE_NAVIGATION, SCHOOL_ROUTES, schoolAllowedPaths } from "./routes";
export type { SchoolPageId, SchoolRole, SchoolRoute, SchoolRouteMatch } from "./routes";
export { SCHOOL_API_PREFIX } from "./lib/api";
export { schoolRoleFor, trustedSchoolRoles, SCHOOL_ROLES } from "./lib/session";
export type * from "./lib/contract";
export type * from "./lib/types";
