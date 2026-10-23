export { ReferenceRcmModule } from "./module";
export {
  rcmRoutes, rcmDynamicRoutes, rcmNavigation, rcmPaths, resolveRcmRoute, safeRcmHref,
  type RcmRoute, type RcmRouteKind, type RcmNavItem, type RcmMatch,
} from "./routes";
export { RCM_NAMESPACE, IDEMPOTENCY_HEADER, SCOPE_HEADER, ApiError, createRcmClient, toApiError, newOperationKey, type RcmClient, type RcmTransport, type CallOptions } from "./lib/api";
export type { Meta, User, ResourceDef, CategoryDef, PageDef, FieldDef, RecordDto, Branch } from "./lib/types";
