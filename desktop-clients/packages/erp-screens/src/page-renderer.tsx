"use client";
import {moduleContainsPage, legacySchoolModuleAlias} from "@pepbits/erp-config";

import {DraftRecoveryCenter} from "./drafts/draft-center";
import { RecordApproval } from "./approvals/approval-workspace";
import { RecordPanelsPanel } from "./records/record-panels";
import React from "react";
import { LIBRARY_PAGE_IDS, canProductAction } from "@pepbits/erp-config";
import type { NavigationTarget } from "@pepbits/platform-ports";
import { ErrorMonitor, DocumentationCenter, useProduct, useERP } from "@pepbits/erp-shell";
import { PresentationProvider, AccessDenied, DashboardSkeleton, ErrorState, FormSkeleton, TableSkeleton } from "@pepbits/ops-ui";
import { ModuleDashboard } from "./dashboard/module-dashboard";
import { WorklistPage } from "./worklist/worklist-page";
import { DynamicRecordForm } from "./forms/dynamic-record-form";
import { BillingPage } from "./billing/billing-page";
import { ReportsPage } from "./reports/reports-page";
import { PreferencesPage } from "./preferences";
import { SpreadsheetPage } from "./spreadsheet";
const ConfiguredTemplatePage=React.lazy(()=>import("./templates/configured-template-page").then(module=>({default:module.ConfiguredTemplatePage})));
import { LibraryPage } from "./library";
import { AiAdministration } from "@pepbits/ai-ui";
import { InboxPage } from "./inbox";
import { ConsultationPage } from "./consultation";

/* The switch body is unchanged from EnterpriseApp's PageRenderer. What changed is
   where mode and recordId come from: an explicit target, supplied by the route on
   web and by the active tab on desktop, rather than a tab read from context. */
/**
 * The loading placeholder for a page, chosen by its kind.
 *
 * Exported for the shell's own loading state rather than used inside
 * PageRenderer, and the distinction is worth recording because two obvious
 * wirings were tried and neither fires:
 *
 *   `loading.tsx` at the route segment never renders — these pages do no async
 *   server work, so the segment never suspends and Next simply holds the
 *   previous screen until the RSC payload arrives.
 *
 *   A React transition around router.push reports nothing, because push is
 *   fire-and-forget: isPending flips true and back inside one tick.
 *
 * The honest conclusion is that per-navigation there is no wait to fill here —
 * Next holds the old page, which is arguably better than a skeleton anyway. The
 * wait that IS real is the shell's first load, and that is where this is used.
 */
export function SkeletonFor({ kind }: { kind: string }) {
  if (kind === "dashboard") return <DashboardSkeleton />;
  if (kind === "template" || kind === "form" || kind === "billing" || kind === "consultation") return <FormSkeleton />;
  return <TableSkeleton />;
}

export function PageRenderer({ target, showTabPreferences = true }: { target: NavigationTarget; showTabPreferences?: boolean }) {
  const product = useProduct();
  const alias=legacySchoolModuleAlias(product,target.moduleId);
  if(alias)target={...target,moduleId:alias};
  const page = product.pages[target.pageId];
  if (target.moduleId && !moduleContainsPage(product,target.moduleId,target.pageId)) return <AccessDenied title="Page unavailable for your role" description="Your account does not have access to this page." />;
  if(page && target.pageId==="draft-recovery")return <DraftRecoveryCenter />;
  if(page && target.pageId==="error-monitor")return <ErrorMonitor />;
  if(page && target.pageId==="documentation-center")return <DocumentationCenter />;
  /* A page id with no entry is a configuration fault, not an empty result, and
     it used to render as one line of grey text with nothing to do about it. */
  if (product.access?.pages?.[target.pageId] && !page) return <AccessDenied title="Page unavailable for your role" description="Your account does not have access to this page." />;
  if ((target.mode === "new" && !canProductAction(product,"create")) || (target.mode === "edit" && !canProductAction(product,"edit"))) return <AccessDenied title="Action unavailable for your role" description="You can return to the list to view available records." />;
  if (!page) return <ErrorState title="This page is not configured" description="The workspace asked for a page that is not in the registry." detail={`pageId: ${target.pageId}`} />;
  return <PresentedPage pageId={page.id} library={LIBRARY_PAGE_IDS.includes(page.id)}><PageBody page={page} target={target} showTabPreferences={showTabPreferences}/></PresentedPage>;
}
function PresentedPage({pageId,library, children}: {pageId:string;library:boolean;children:React.ReactNode}) {
  const {preferences}=useERP();
  return <PresentationProvider value={preferences}><div data-page-id={pageId} className={library ? "library-preferences h-full min-h-0" : "contents"}>{children}</div></PresentationProvider>;
}
function PageBody({page,target,showTabPreferences}: {page:import("@pepbits/erp-config").PageDefinition;target:NavigationTarget;showTabPreferences:boolean}) {
  const product=useProduct();
  const withPanels = (screen: React.ReactNode) => <div className="flex flex-col gap-4">{screen}<RecordApproval pageId={page.id} recordId={target.recordId} /><RecordPanelsPanel pageId={page.id} recordId={target.recordId} /></div>;
  if (target.mode && (page.kind === "worklist" || page.kind === "form")) return withPanels(<DynamicRecordForm page={page} target={target} />);
  switch (page.kind) {
    case "dashboard": return <ModuleDashboard moduleKey={page.module === "shared" ? undefined : page.module} />;
    case "worklist": return <WorklistPage page={page} />;
    case "form": return withPanels(<DynamicRecordForm page={page} target={!target.mode && !canProductAction(product,"edit") ? {...target,mode:"view"} : target} />);
    case "billing": return withPanels(<BillingPage page={page} target={target} />);
    case "reports": return <ReportsPage page={page} />;
    case "preferences": return <PreferencesPage showTabPreferences={showTabPreferences} />;
    case "spreadsheet": return <SpreadsheetPage />;
    case "template": return <React.Suspense fallback={<FormSkeleton/>}><ConfiguredTemplatePage page={page} target={target}/></React.Suspense>;
    case "library": return <LibraryPage page={page} target={target} />;
    case "ai-admin": return <AiAdministration />;
    case "inbox": return <InboxPage page={page} />;
    case "consultation": return withPanels(<ConsultationPage page={page} target={target} />);
    default: return <WorklistPage page={page} />;
  }
}
