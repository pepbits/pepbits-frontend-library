export { ReferenceErp1Module, REFERENCE_ERP1_MODULE_ID, type ReferenceErp1ModuleProps } from './Module';
import { buildRouteManifest } from '@pepbits/reference-keystone-core';
import { PAGES, SECTIONS } from './lib/registry';
import { TEMPLATES } from './components/templates';

/** Navigable routes for host menus: '/', '/login' and every registry page. */
export const referenceErp1Routes = buildRouteManifest(PAGES);
/** All 57 source page definitions (structure only; value lists hydrate from GET /api/lookups). */
export const referenceErp1Pages = PAGES;
export const referenceErp1Sections = SECTIONS;
/** Template key → screen component (20 keys). */
export const referenceErp1Templates = TEMPLATES;
export { matchReferencePath as matchErp1Path, splitPath as splitErp1Path, DASHBOARD_PATH as referenceErp1DashboardPath, listUrl as referenceErp1ListUrl, createEntityApi as createReferenceErp1EntityApi, createReferenceFormat as createReferenceErp1Format, lookupsUrl as referenceErp1LookupsUrl, hydratePageDef as hydrateReferenceErp1PageDef } from '@pepbits/reference-keystone-core';
export type { ReferenceMatch as ReferenceErp1Match, RecordMode as ReferenceErp1RecordMode, ReferenceRouteEntry as ReferenceErp1Route, ListParams as ReferenceErp1ListParams, EntityApi as ReferenceErp1EntityApi, ReferenceFormat as ReferenceErp1Format, PageDef as ReferenceErp1PageDef, Field as ReferenceErp1Field, FieldType as ReferenceErp1FieldType, TemplateKey as ReferenceErp1TemplateKey, Section as ReferenceErp1Section, Row as ReferenceErp1Row, ListResponse as ReferenceErp1ListResponse, Filters as ReferenceErp1Filters, LookupResponse as ReferenceErp1LookupResponse, EntitySupport as ReferenceErp1EntitySupport, CompanyProfile as ReferenceErp1CompanyProfile, ProcessRunResult as ReferenceErp1ProcessRunResult } from '@pepbits/reference-keystone-core';
