"use client";
import {REFERENCE_PAGE_BY_ID,CARE_PAGES,type CarePageId} from "@pepbits/erp-config";
import React, {Suspense, lazy} from "react";
const DcpDesigner=lazy(()=>import('../dcp-designer/library-page').then(m=>({default:m.DcpDesignerLibraryPage})));
const CareLibrary=lazy(()=>import("../care-pages/library-page").then(m=>({default:m.CareLibraryPage})));

import {LocalizedText} from "@pepbits/ops-ui";
import {IDENTITY_PAGES,DEVICE_PAGES,LABEL_PAGES} from "@pepbits/erp-config";
const IdentityLibrary=lazy(()=>import("../identity-devices/library-page").then(m=>({default:m.IdentityLibraryPage})));
const DeviceLibrary=lazy(()=>import("../device-integrations/library-page").then(m=>({default:m.DeviceLibraryPage})));
const LabelLibrary=lazy(()=>import("../label-printing/library-page").then(m=>({default:m.LabelLibraryPage})));
import type {PageDefinition} from "@pepbits/erp-config";
import {LibraryReferencePage} from "./reference-pages";
import { TEMPLATE_BY_ID, CLINICAL_TEMPLATE_PAGES } from "@pepbits/erp-config";
const TemplateLibrary = lazy(() => import("../templates/template-library").then(module => ({default:module.TemplateLibraryPage})));
import { CATALOG_GROUPS } from "./catalog";
const Catalog = lazy(() => import("./component-catalog").then(module => ({default:module.ComponentCatalog})));

import type {NavigationTarget} from '@pepbits/platform-ports';
const PageList=lazy(()=>import("../page-library").then(m=>({default:m.PageLibraryCatalog})));
const ClinicalTriage=lazy(()=>import('../clinical-triage/library-page').then(m=>({default:m.ClinicalTriageLibraryPage})));
const ClinicalConsultation=lazy(()=>import('../clinical-consultation/library-page').then(m=>({default:m.ClinicalConsultationLibraryPage})));
const ComprehensiveConsultation=lazy(()=>import('../comprehensive-consultation/library-page').then(m=>({default:m.ComprehensiveConsultationLibraryPage})));
const OPRegistration=lazy(()=>import('../op-registration/library-page').then(m=>({default:m.OPRegistrationLibraryPage})));
const OPConsultation=lazy(()=>import('../op-consultation/library-page').then(m=>({default:m.OPConsultationLibraryPage})));
const BillingClinic=lazy(()=>import('../clinic-billing/library-page').then(m=>({default:m.BillingClinicLibraryPage})));
const ClinicalLibrary=lazy(()=>import('../clinical-templates/library-page').then(m=>({default:m.ClinicalLibraryPage})));
const ReferenceModule=lazy(()=>import("../reference-modules/library-page").then(m=>({default:m.ReferenceModuleLibraryPage})));
export function LibraryPage({page,target={pageId:page.id}}: {page:PageDefinition;target?:NavigationTarget}) {
  if(REFERENCE_PAGE_BY_ID[page.id])return <Suspense fallback={<p role='status'><LocalizedText message='reference.modules.loading'/></p>}><ReferenceModule pageId={page.id} target={target}/></Suspense>;
  if(page.id==='dcp-designer')return <Suspense fallback={<p role='status'><LocalizedText message='designer.loading'/></p>}><DcpDesigner/></Suspense>;
  if(CARE_PAGES.includes(page.id as CarePageId))return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><CareLibrary pageId={page.id as CarePageId}/></Suspense>;
  if(IDENTITY_PAGES.includes(page.id as typeof IDENTITY_PAGES[number]))return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><IdentityLibrary pageId={page.id}/></Suspense>;
  if(DEVICE_PAGES.includes(page.id as typeof DEVICE_PAGES[number]))return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><DeviceLibrary pageId={page.id}/></Suspense>;
  if(LABEL_PAGES.some(p=>p[0]===page.id))return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><LabelLibrary pageId={page.id}/></Suspense>;
  if(page.id==='list-of-pages')return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><PageList/></Suspense>;
  if(page.id==='clinical-triage')return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><ClinicalTriage/></Suspense>;
  if(page.id==='clinical-consultation')return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><ClinicalConsultation/></Suspense>;
  if(page.id==='comprehensive-consultation')return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><ComprehensiveConsultation/></Suspense>;
  if(page.id==='op-registration')return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><OPRegistration/></Suspense>;
  if(page.id==='op-consultation')return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><OPConsultation/></Suspense>;
  if(page.id==='billing-clinic')return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><BillingClinic/></Suspense>;
  if(CLINICAL_TEMPLATE_PAGES.some(p=>p.id===page.id))return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><ClinicalLibrary page={page} target={target}/></Suspense>;
  if(page.id === "page-templates" || TEMPLATE_BY_ID[page.id]) return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><TemplateLibrary key={page.id} page={page}/></Suspense>;
  if(page.id === "component-library" || CATALOG_GROUPS.some(group => group.pageId === page.id)) return <Suspense fallback={<p role="status"><LocalizedText message="Loading…"/></p>}><Catalog key={page.id} page={page}/></Suspense>;
  return <LibraryReferencePage page={page}/>;
}

