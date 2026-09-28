/*
 * Public contract of @pepbits/reference-reports: the Lumen Reports reference frontend as a reusable module
 * for an existing host shell. See ../README.md for the route map, API inventory and limitations.
 */
export { ReferenceReportsModule } from './module';
export {
  REFERENCE_REPORTS_ROUTES, REPORTS_ROUTE_DEFINITIONS, SYSTEM_REPORT_DESTINATIONS, matchReportsRoute, loaderPath,
  type ReportsRouteDefinition, type ReportsRouteId, type ReportsRouteMatch,
} from './routes';
export { REPORTS_NAVIGATION, visibleReportsNavigation, type ReportsNavItem } from './navigation';
export { ApiError, createReportsClient, toApiError, type ReportsClient } from './api/client';
export type { ReportsSession } from './shell/ModuleBar';
export type * from './types';
