export { ReferenceErp2Module, REFERENCE_ERP2_MODULE_ID, type ReferenceErp2ModuleProps } from './Module';
import { buildRouteManifest } from '@pepbits/reference-keystone-core';
import { PAGES, SECTIONS } from './lib/registry';
import { TEMPLATES } from './components/templates';

/** Navigable routes for host menus: '/', '/login' and every registry page. */
export const referenceErp2Routes = buildRouteManifest(PAGES);
/** All 57 source page definitions (structure only; value lists hydrate from GET /api/lookups). */
export const referenceErp2Pages = PAGES;
export const referenceErp2Sections = SECTIONS;
/** Template key → screen component (20 keys). */
export const referenceErp2Templates = TEMPLATES;
export { matchReferencePath as matchErp2Path, splitPath as splitErp2Path, DASHBOARD_PATH as referenceErp2DashboardPath, listUrl as referenceErp2ListUrl, createEntityApi as createReferenceErp2EntityApi, createReferenceFormat as createReferenceErp2Format, lookupsUrl as referenceErp2LookupsUrl, hydratePageDef as hydrateReferenceErp2PageDef } from '@pepbits/reference-keystone-core';
export type { ReferenceMatch as ReferenceErp2Match, RecordMode as ReferenceErp2RecordMode, ReferenceRouteEntry as ReferenceErp2Route, ListParams as ReferenceErp2ListParams, EntityApi as ReferenceErp2EntityApi, ReferenceFormat as ReferenceErp2Format, PageDef as ReferenceErp2PageDef, Field as ReferenceErp2Field, FieldType as ReferenceErp2FieldType, TemplateKey as ReferenceErp2TemplateKey, Section as ReferenceErp2Section, Row as ReferenceErp2Row, ListResponse as ReferenceErp2ListResponse, Filters as ReferenceErp2Filters, LookupResponse as ReferenceErp2LookupResponse, EntitySupport as ReferenceErp2EntitySupport, CompanyProfile as ReferenceErp2CompanyProfile, ProcessRunResult as ReferenceErp2ProcessRunResult } from '@pepbits/reference-keystone-core';
