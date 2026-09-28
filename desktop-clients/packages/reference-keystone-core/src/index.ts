/*
 * @pepbits/reference-keystone-core — shared Keystone source-family layer used by
 * @pepbits/reference-erp1 and @pepbits/reference-erp2: ops-ui primitive adapters, hooks
 * (API, formatting, preferences, view state, navigation, session), the form and line
 * engines, the WorkList engine, compatible template renderers and the page shells.
 * It holds no page registry and never imports a variant.
 */
export * from './lib/types';
export * from './lib/registry';
export * from './lib/variant';
export * from './lib/client';
export * from './lib/api';
export * from './lib/export';
export * from './lib/format';
export * from './lib/preferences';
export * from './lib/session';
export * from './lib/routes';
export * from './lib/process';
export { APP } from './lib/config';
export { Link, RouteParamsContext, useOpenInNewContext, useParams, usePathname, useRouter, useSearchParams, type RouteParams } from './lib/navigation';
export * from './components/ui';
export { Icon } from './components/icons';
export { LogoMark } from './components/shell/Logo';
export * from './components/form/RecordForm';
export * from './components/form/LinesEditor';
export * from './components/worklist/WorkList';
export * from './components/templates/shared';
export { ReadyPage } from './components/ReadyPage';
export { KeystoneInvoice } from './components/print/Invoice';
export { CompanyGate } from './components/CompanyGate';
export { RecordActivity, RecordDocuments } from './components/RecordSupport';
export { default as LedgerTemplate } from './components/templates/LedgerTemplate';
export { default as MatrixTemplate } from './components/templates/MatrixTemplate';
export { default as SettingsTemplate } from './components/templates/SettingsTemplate';
export { default as DashboardTemplate } from './components/templates/DashboardTemplate';
export { default as ReportTemplate } from './components/templates/ReportTemplate';
export { default as KeystoneLoginPage } from './pages/LoginPage';
export { default as KeystoneNotFound } from './pages/NotFound';
export { default as KeystoneRegistryPage } from './pages/RegistryPage';
