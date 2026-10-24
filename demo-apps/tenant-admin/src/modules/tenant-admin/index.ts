export { ReferenceTenantAdminModule } from "./module";
export {
  tenantAdminRoutes, tenantAdminDynamicRoutes, tenantAdminNavigation, tenantAdminPaths, resolveTenantAdminRoute,
  type TenantAdminRoute, type TenantAdminRouteKind, type TenantAdminNavItem, type TenantAdminMatch,
} from "./routes";
export { TENANT_ADMIN_NAMESPACE, IDEMPOTENCY_HEADER, ApiError, createTenantAdminClient, toApiError, newOperationKey, type TenantAdminClient, type TenantAdminTransport, type CallOptions } from "./lib/api";
export type { Meta, User, ResourceDef, CategoryDef, FieldDef, RecordDto, Status } from "./lib/types";
