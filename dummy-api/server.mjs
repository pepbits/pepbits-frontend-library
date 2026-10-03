#!/usr/bin/env node
import {createReferenceMedslotStore} from "./reference-medslot-store.mjs";
import {createReferenceSurgiSuiteStore} from "./reference-surgisuite-store.mjs";
import {createReferenceRcmStore} from './reference-rcm-store.mjs';
import {createReferenceTenantAdminStore,createReferenceMedbandStore} from './reference-access-store.mjs';
import {createReferencePharmacyStore} from './reference-pharmacy-store.mjs';
import {createReferenceQualityStore} from './reference-quality-store.mjs';
import {createReferenceTeleconsultStore} from './reference-teleconsult-store.mjs';
import {createDiagnosticStore} from './reference-diagnostics-store.mjs';
import {createReferenceReportsStore} from './reference-reports-store.mjs';
import {acquireHealthcareSuiteInvoice} from './healthcare-suite-source-persistence.mjs';
import {createRcmMoneyProvider} from './healthcare-suite-rcm-money-provider.mjs';
import {createHealthcareSuiteRcmStore} from './healthcare-suite-rcm-store.mjs';
import {createReferenceHealthcareSuiteStore} from './reference-healthcare-suite-store.mjs';
import {createReferenceSchoolStore} from './reference-school-store.mjs';
import {resolveSchoolView} from './school-view-policy.mjs';
import {schoolPathAllowed} from '../desktop-clients/packages/erp-config/src/school-role-views.ts';
import {createReferenceErpStore} from './reference-erp-store.mjs';
import {isDcpValues,isDcpRevision} from '../desktop-clients/packages/erp-config/src/dcp-runtime.ts';
import {createDesignerStore} from './dcp-designer-store.mjs';
import {createCarePageStore} from './care-page-store.mjs';
import {createIdentityStore} from './identity-device-store.mjs';
import {createDeviceStore} from './device-integration-store.mjs';
import {createLabelStore} from './label-printing-store.mjs';
import {createRegistrationStore} from './op-registration-store.ts';
import {createComprehensiveConsultationStore} from './comprehensive-consultation-store.ts';
import {createClinicalConsultationStore} from "./clinical-consultation-store.ts";
import {createClinicalTriageStore} from "./clinical-triage-store.ts";
import {createClinicBillingStore} from "./clinic-billing-store.ts";
import {createClinicalTemplateStore} from "./clinical-template-store.ts";
import {createDraftCenter} from "./draft-center.mjs";
import {createDraftPolicyStore} from "./draft-policy-store.mjs";
import {createMonitoringStore} from "./monitoring-store.mjs";
import {createDocumentationStore} from "./documentation-store.mjs";
import {createPreferenceStore,canManagePreferences} from "./preference-store.mjs";
import {createReportScheduler} from "./report-scheduler.mjs";
import {reportRows} from "../desktop-clients/packages/erp-data/src/report-data.ts";
import {createAuditStore} from "./audit-store.mjs";
import {createCredentialStore} from "./credential-store.mjs";
import {providerAllowed, credentialExpired, redactProviderContext, createUserLimiter} from "./ai-security.mjs";
import {resolveAi} from "../desktop-clients/packages/ai-config/src/gates.ts";
import {gatesForPage} from "../desktop-clients/packages/ai-config/src/policy.ts";
import {homedir} from "node:os";
import { allowedMethods } from "./route-methods.mjs";
import {withMessageMetadata} from "./message-descriptors.mjs";
/**
 * Nexora demo auth API.
 *
 * Deliberately zero dependencies: a stand-in for a real identity and settings service
 * so the two shells have something to log in against. Sessions live in a Map and die
 * with the process; per-user preferences are written to data/preferences.json and do
 * survive a restart, because "log out, log back in, your settings are still there" is
 * the whole point of that endpoint.
 *
 * NOT a security boundary. Passwords are compared in plaintext, tokens are random hex
 * with no expiry claim. CORS and AI egress are now constrained, but these demo
 * accounts are not a production identity service. See the AI hardening ledger.
 *
 *   node server.mjs            # :3200
 *   PORT=4100 node server.mjs
 */
import { createApplicationConfig } from "./application-config.mjs";
import { BRANCHES, PAGE_REGISTRY } from "../desktop-clients/packages/erp-config/src/navigation.ts";
import { getEntitySchema } from "../desktop-clients/packages/erp-config/src/entity-schemas.ts";
import { validateForm } from "../desktop-clients/packages/erp-config/src/form-rules.ts";
import { createApprovalStore } from "./approval-store.mjs";
import { createImportStore } from "./import-store.mjs";
import { getImportDefinition } from "../desktop-clients/packages/erp-config/src/imports.ts";
import { createRecordPanelsStore } from "./record-panels-store.mjs";
import { createWorkspaceStore } from "./workspace-store.mjs";
import { createRecordStore } from "./record-store.mjs";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { ADAPTERS, acceptKey, attachSocket, chooseProvider, mockSegment } from "./speech-gateway.mjs";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 3200);
const HOST = process.env.HOST ?? "0.0.0.0";
const applicationConfig = createApplicationConfig(process.env.NEXORA_CONFIG_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "config"), new Set(Object.keys(PAGE_REGISTRY)));

/* Roles are the `value` strings from packages/erp-config's ROLES, so the shell's role
   selector can reflect the account instead of being free-choice. */
const ACCOUNTS = [
  {
    username: "user1",
    password: "user1",
    user: {
      id: "USR-00311",
      name: "Aisha Rahman",
      email: "aisha.rahman@nexora.example",
      initials: "AR",
      title: "Finance Operations",
      role: "finance-manager",
      branch: "dubai",
      tenantId: "NEX-AE-001",
    },
  },
  {
    username: "user2",
    password: "user2",
    user: {
      id: "USR-00327",
      name: "Omar Khan",
      email: "omar.khan@nexora.example",
      initials: "OK",
      title: "Supply Chain",
      role: "operations-analyst",
      branch: "sharjah",
      tenantId: "NEX-AE-001",
    },
  },
  {
    username: "admin",
    password: "admin",
    user: {
      id: "USR-00301",
      permissions: ["preferences:manage","monitoring:manage"],
      name: "Prakash Mathew",
      email: "prakash@nexora.example",
      initials: "PM",
      title: "Solution Architecture",
      role: "enterprise-admin",
      referenceSchoolViews: ['admin','teacher','student','parent','librarian','accountant'],
      branch: "hq",
      tenantId: "NEX-AE-001",
    },
  },
];


// Explicit fictional school identities. A role comes from this authenticated account, never a UI choice.
for(const role of ['admin','teacher','student','parent','librarian','accountant'])ACCOUNTS.push({username:'school-'+role,password:'school-'+role,user:{id:'SCHOOL-'+role.toUpperCase(),name:'Demo '+role.charAt(0).toUpperCase()+role.slice(1),email:role+'@school.example',initials:role.slice(0,2).toUpperCase(),title:'School '+role,role:'school-'+role,branch:'hq',tenantId:'NEX-SCHOOL-DEMO',...(role==='admin'?{permissions:['preferences:manage','monitoring:manage']}:{} )}});

for(const role of ['admin','pharmacist','technician','billing','viewer'])ACCOUNTS.push({username:'pharmacy-'+role,password:'pharmacy-'+role,user:{id:'PHARMACY-'+role.toUpperCase(),name:'Demo Pharmacy '+role,email:role+'@pharmacy.example',initials:role.slice(0,2).toUpperCase(),title:'Pharmacy '+role,role:'pharmacy-'+role,branch:'hq',tenantId:'NEX-AE-001'}});
for(const role of ['manager','steward','verifier','approver','viewer'])ACCOUNTS.push({username:'quality-'+role,password:'quality-'+role,user:{id:'QUALITY-'+role.toUpperCase(),name:'Demo Quality '+role,email:role+'@quality.example',initials:role.slice(0,2).toUpperCase(),title:'Quality '+role,role:'quality-'+role,branch:'hq',tenantId:'NEX-AE-001'}});

// Fictional teleconsult accounts; roles and patient grants are authenticated server claims.
for(const role of ['doctor','nurse','patient'])ACCOUNTS.push({username:'teleconsult-'+role,password:'teleconsult-'+role,user:{id:'TC-'+role.toUpperCase(),name:'Demo teleconsult '+role,email:role+'@teleconsult.example',initials:role.slice(0,2).toUpperCase(),title:'Teleconsult '+role,role:'teleconsult-'+role,branch:'hq',tenantId:'NEX-AE-001',...(role==='patient'?{teleconsultPatientId:'p8'}:{})}});

/** token -> user. Lost on restart, which is correct for a demo. */
const sessions = new Map();
// Synthetic commercial reviewer provides a separate maker/checker actor for the
// reference RCM workflow. This grants no clinical registration write capability.
ACCOUNTS.push({username:'rcm-reviewer',password:'rcm-reviewer',user:{
 id:'USR-RCM-REVIEWER',name:'Synthetic RCM reviewer',email:'rcm-reviewer@nexora.example',
 initials:'RC',title:'Commercial review',role:'finance-manager',branch:'dubai',tenantId:'NEX-AE-001',
 permissions:['rcm:configure'],
}});
const referenceStores={reports:createReferenceReportsStore({inboundSecret:process.env.REFERENCE_REPORTS_INBOUND_SECRET,inboundIdentity:{user:ACCOUNTS[2].user,scope:{applicationId:'nexora',branchId:ACCOUNTS[2].user.branch}}}),school:createReferenceSchoolStore(),erp1:createReferenceErpStore({variant:'erp1'}),erp2:createReferenceErpStore({variant:'erp2'}),'healthcare-suite':createReferenceHealthcareSuiteStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'healthcare-suite-source')})};
for(const variant of ['lis1','lis2','ris1'])referenceStores[variant]=createDiagnosticStore({variant,dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'diagnostics',variant)});
for(const role of ['medslot-admin','medslot-scheduler','medslot-provider','surgisuite-admin','surgisuite-coordinator','surgisuite-surgeon','surgisuite-anesthesia','surgisuite-nurse','surgisuite-approver','surgisuite-coder','surgisuite-viewer','tenant-config-admin','tenant-config-editor','tenant-config-approver','tenant-config-viewer','medband-admin','medband-reception','medband-admissions','medband-clinician','medband-viewer','rcm-reference-admin','rcm-reference-clerk','rcm-reference-supervisor','rcm-reference-insurance','rcm-reference-accountant','rcm-reference-coder','rcm-reference-viewer'])ACCOUNTS.push({username:role,password:role,user:{id:'ACCESS-'+role.toUpperCase(),name:'Demo '+role,email:role+'@access.example',initials:'DA',title:role,role,branch:'hq',tenantId:'NEX-AE-001'}});
const pharmacyStore=createReferencePharmacyStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'pharmacy')});
referenceStores.pharmacy=pharmacyStore;
const tenantAdminStore=createReferenceTenantAdminStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'tenant-admin')});
const medbandStore=createReferenceMedbandStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'medband')});
referenceStores['tenant-admin']=tenantAdminStore;referenceStores.medband=medbandStore;
const rcmReferenceStore=createReferenceRcmStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'rcm-reference')});
referenceStores.rcm=rcmReferenceStore;
const surgisuiteStore=createReferenceSurgiSuiteStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'surgisuite')});
referenceStores.surgisuite=surgisuiteStore;
const medslotStore=createReferenceMedslotStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'medslot')});
referenceStores.medslot=medslotStore;
const qualityStore=createReferenceQualityStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'quality')});
referenceStores.quality=qualityStore;
const teleconsultStore=createReferenceTeleconsultStore({dataDir:join(process.env.NEXORA_DATA_DIR??join(dirname(fileURLToPath(import.meta.url)),'data'),'teleconsult'),policy:JSON.parse(readFileSync(join(process.env.NEXORA_CONFIG_DIR??join(dirname(fileURLToPath(import.meta.url)),'config'),'teleconsult','nexora.json'),'utf8'))});
referenceStores['teleconsult-provider']=teleconsultStore;referenceStores['teleconsult-patient']=teleconsultStore;


/* Preferences, unlike sessions, are written to disk. An in-memory store would lose
   every saved preference the moment the process restarted, which defeats the whole
   point of "log out, log back in, your settings are still there".
   Shape: { "<userId>": { <only the keys that differ from the client's defaults> } } */
const DATA_DIR = process.env.NEXORA_DATA_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "data");
// RCM owns immutable financial snapshots after trusted source import. The original
// clinical demo remains a separate adapter; no caller supplies invoice money or identity.
const healthcareSuiteRcm=createHealthcareSuiteRcmStore({
 dataDir:join(DATA_DIR,'healthcare-suite-rcm'),
 defaultCurrency:process.env.CURRENCY??'AED',
 moneyProvider:(process.env.HC_RCM_MOCKPAY_URL||process.env.HC_RCM_MOCKCOLLECTION_URL)?createRcmMoneyProvider({
  payments:process.env.HC_RCM_MOCKPAY_URL?{origin:process.env.HC_RCM_MOCKPAY_URL,apiKey:process.env.HC_RCM_MOCKPAY_KEY}:undefined,
  collections:process.env.HC_RCM_MOCKCOLLECTION_URL?{origin:process.env.HC_RCM_MOCKCOLLECTION_URL,apiKey:process.env.HC_RCM_MOCKCOLLECTION_KEY}:undefined,
 }):undefined,
 provider:process.env.HC_RCM_MOCKINS_URL ? {
  baseUrl:process.env.HC_RCM_MOCKINS_URL,apiKey:process.env.HC_RCM_MOCKINS_KEY,
  senderId:process.env.HC_RCM_MOCKINS_SENDER,providerId:process.env.HC_RCM_MOCKINS_PROVIDER,
  maxPayerLevel:Number(process.env.HC_RCM_MOCKINS_MAX_PAYER_LEVEL??3),
 } : undefined,
 referenceReader:async({user,scope,invoiceId})=>{
  const selected=scope.facilityId;
  const result=await referenceStores['healthcare-suite'].handle(user,scope,{method:'GET',path:'/api/billing/invoices/'+encodeURIComponent(invoiceId),headers:{'x-reference-facility':selected}});
  if(result.status!==200||!result.body?.id||result.body.facility?.id!==selected)return null;
  return {invoice:result.body,facilityId:selected,currency:process.env.CURRENCY??'AED'};
 },
});
const clinicalTemplates=createClinicalTemplateStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,"clinical-templates.csv"));
const clinicalTriage=createClinicalTriageStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,"clinical-triage.csv"),(user,product,id)=>clinicalTemplates.handle(user,product,{action:"overview",id},false));
const clinicalConsultation=createClinicalConsultationStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,"clinical-consultation.csv"),(user,product,id)=>clinicalTemplates.handle(user,product,{action:"overview",id},false));
const dcpDesigner=createDesignerStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,'dcp-designer.csv'));
const carePages=createCarePageStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,'care-pages.csv'));
const identityDevices=createIdentityStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,'identity-devices.csv'));
const deviceIntegrations=createDeviceStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,'device-integrations.csv'));
const labelPrinting=createLabelStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,'label-printing.csv'));
const opRegistration=createRegistrationStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,'op-registration.csv'),(user,product,id)=>clinicalTemplates.handle(user,product,{action:'overview',id},false),()=>new Date(),(user,product)=>draftPolicies.read(user,product));
const comprehensiveConsultation=createComprehensiveConsultationStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,'comprehensive-consultation.csv'),(user,product,id)=>clinicalTemplates.handle(user,product,{action:'overview',id},false));
const clinicBilling=createClinicBillingStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,"clinic-billing.csv"),(user,product,id)=>clinicalTemplates.handle(user,product,{action:"overview",id},false));
const monitoringStore=createMonitoringStore(join(DATA_DIR,"monitoring.sqlite"));
const documentationStore=createDocumentationStore(join(DATA_DIR,"documentation.sqlite"),process.env.NEXORA_CONFIG_DIR ?? join(dirname(fileURLToPath(import.meta.url)),"config"),applicationConfig);
const auditStore = createAuditStore(join(DATA_DIR,"audit.sqlite"), {retentionDays:Number(process.env.NEXORA_AUDIT_RETENTION_DAYS ?? 90)});
auditStore.prune();
setInterval(() => {try {auditStore.prune();} catch {console.error("Audit retention failed");}},3600000).unref();
const perUserLimiter = createUserLimiter();
const recordPanelsStore = createRecordPanelsStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,"record-panels.json"));
const workspaceStore = createWorkspaceStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR, "workspaces.json"));
const draftPolicies=createDraftPolicyStore(join(DATA_DIR,"draft-policy.sqlite"),{
  scrub:(...args)=>{recordStore.scrub(...args);opRegistration.scrub(...args);},audit:(...args)=>auditStore.append(...args),
});
const recordStore = createRecordStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR, "records.json"),{draftPolicy:(user,product)=>draftPolicies.read(user,product)});
recordStore.prune();opRegistration.prune();
setInterval(()=>{try{recordStore.prune();opRegistration.prune();}catch{console.error("Draft retention failed");}},3600000).unref();
const approvalStore=createApprovalStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,"approvals.json"),{
  record:(user,product,pageId,id)=>{
    if(!Object.hasOwn(PAGE_REGISTRY,pageId))return null;
    const page=PAGE_REGISTRY[pageId],config=getWorklistConfig(pageId,page.title,page.entity);
    return rowsWithSaved(user,product,pageId,config).find(row=>String(row[config.primaryKey])===id)??null;
  },
});
const draftCenter=createDraftCenter({records:recordStore,policy:(...args)=>draftPolicies.read(...args),
  labels:(user,product,language)=>{
    const nav=applicationConfig.navigation(user,product),locale=applicationConfig.localization(user,product,language);if(nav.status!==200||locale.status!==200)return {};
    return Object.fromEntries(nav.body.pages.map(page=>[page.id,locale.body.messages[page.titleKey]??page.id]));
  },
  access:(user,product,{kind,pageId,recordId})=>{
    const nav=applicationConfig.navigation(user,product);if(nav.status!==200||!nav.body.pages.some(p=>p.id===pageId))return false;
    if(kind==='dcp')return pageId==='dcp-designer';
    const page=PAGE_REGISTRY[pageId];if(!page)return false;
    if(kind==='import')return !!getImportDefinition(page.entity);
    if(kind==='approval'&&pageId!=='customer-master')return false;
    if(recordId==='new'||kind==='approval'&&recordId==='inbox')return true;
    if(page.kind==='worklist'||page.kind==='form'){
      const config=getWorklistConfig(pageId,page.title,page.entity);return rowsWithSaved(user,product,pageId,config).some(row=>String(row[config.primaryKey])===recordId);
    }
    return ['billing','consultation'].includes(page.kind);
  },
  context:(user,product,pageId,recordId)=>{
    const result=approvalStore.handle(user,{scope:[product,pageId],action:'read',...(recordId==='inbox'?{}:{recordId})});if(result.status!==200)return undefined;
    const data=result.body;return createHash('sha256').update(JSON.stringify([data.config.version,data.items.map(i=>[i.recordId,i.version,i.recordChanged])])).digest('hex');
  },
});
const importStore = createImportStore(join(process.env.RECORD_DATA_DIR ?? DATA_DIR,"imports.json"),{
  definition: pageId => Object.hasOwn(PAGE_REGISTRY,pageId) ? getImportDefinition(PAGE_REGISTRY[pageId].entity) : null,
  existing: (user,product,pageId) => {
    const page=PAGE_REGISTRY[pageId],config=getWorklistConfig(pageId,page.title,page.entity);
    return rowsWithSaved(user,product,pageId,config).map(row=>row.customerCode??row[config.primaryKey]);
  },
  alreadySaved: (user,job,id) => !!recordStore.handle(user,JSON.stringify([job.productId,`form:${job.pageId}:${id}`]),'load').body.record,
  save: (user,job,id,values) => {
    const result=recordStore.handle(user,JSON.stringify([job.productId,`form:${job.pageId}:${id}`]),'save',{values,version:0,draftVersion:0,operationId:`${job.id}-${id.split('-').at(-1)}`});
    if(result.status!==200)throw new Error('Import row was not saved.');
  },
});

function reportAccess(user,spec) {
  const current=ACCOUNTS.find(account=>account.user.id===user.id && account.user.tenantId===user.tenantId)?.user;
  if(!current || !spec || !Object.hasOwn(PAGE_REGISTRY,spec.pageId) || PAGE_REGISTRY[spec.pageId].kind!=="reports")return false;
  const navigation=applicationConfig.navigation(current,spec.productId);
  return navigation.status===200 && navigation.body.pages.some(page=>page.id===spec.pageId);
}
const reportScheduler=createReportScheduler(join(DATA_DIR,"reports.sqlite"),{
  audit:(...args)=>auditStore.append(...args),
  render:async(user,spec)=>{
    if(!reportAccess(user,spec))throw new Error("Report access revoked");
    const current=ACCOUNTS.find(account=>account.user.id===user.id && account.user.tenantId===user.tenantId).user;
    const locale=applicationConfig.localization(current,spec.productId,spec.language);
    if(locale.status!==200)throw new Error("Report language unavailable");
    const messages=locale.body.messages;
    const t=source=>messages[source]??source;
    const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
    const headings=["Branch","Current period","Previous period","Budget / target","Variance","Contribution"];
    const numeric=new Intl.NumberFormat({en:"en-US",ar:"ar",hi:"hi-IN",ml:"ml-IN"}[spec.language],{maximumFractionDigits:2});
    return "\uFEFF"+[headings.map(t).map(quote).join(','),...reportRows.map(row=>[row.dimension,...[row.current,row.previous,row.budget,row.variance,row.contribution].map(value=>numeric.format(value))].map(quote).join(','))].join('\r\n');
  }
});
setInterval(()=>{void reportScheduler.tick().catch(()=>console.error("Report worker failed"));},5000).unref();

const PREFS_FILE = join(DATA_DIR, "preferences.json");

function loadPrefs() {
  try {
    return JSON.parse(readFileSync(PREFS_FILE, "utf8"));
  } catch {
    // Missing or corrupt: start clean rather than refusing to boot.
    return {};
  }
}

const preferences = loadPrefs();
const preferenceStore=createPreferenceStore(join(DATA_DIR,"preferences.sqlite"),{
 modules:(user,product)=>applicationConfig.navigation(user,product).body?.nodes.filter(node=>node.kind==="module").map(node=>node.moduleId)??[],
 legacy:(user,product)=>product==="nexora"&&ACCOUNTS.some(account=>account.user.id===user.id&&account.user.tenantId===user.tenantId)?preferences[user.id]??{}:{},
 audit:(...args)=>auditStore.append(...args),
});

/* Temp file + rename, so a crash mid-write cannot leave a truncated JSON file that
   then fails to parse on the next boot and silently drops everyone's settings. */
function savePrefs() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${PREFS_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(preferences, null, 2) + "\n");
  renameSync(tmp, PREFS_FILE);
}

/* Worklist column layout, per user per page. A separate file rather than a key
   inside preferences.json: this grows with the number of pages a user visits
   (~200 in PAGE_REGISTRY), and mixing unbounded data into the settings blob
   would make every preference save rewrite all of it. */
/* ---- saved views -------------------------------------------------------- *
 *
 * A shareable link to a filtered list, INCLUDING filters that may never appear
 * in a URL. The filter definition lives here; the link carries only an opaque
 * id, so a patient name is not written into nginx access logs, APM traces,
 * browser history or a Referer header on the way to a colleague.
 *
 * Four properties, and each is the reason a plain URL was not enough:
 *
 *   opaque         VW_ + 16 hex from randomBytes. Not a hash of the filters,
 *                  which would be reversible for a small search space -- there
 *                  are not many MRNs in a tenant, and a rainbow table over them
 *                  is trivial.
 *   tenant-scoped  a view is read back only by its own tenant, whatever id is
 *                  presented. Guessing an id from another tenant gets a 404,
 *                  the same answer as an id that does not exist.
 *   audited        who created and who opened, with the FILTER KEYS and never
 *                  the values. HHS wants enough to examine activity, not a
 *                  second copy of the clinical data in a log nobody guards.
 *   expiring       a link mailed to someone stops working. Default 30 days.
 * ------------------------------------------------------------------------- */
/* ---- worklist search ---------------------------------------------------- *
 *
 * A POST, and that is the whole point. A GET puts the filters in the request
 * line, and the request line is what nginx, the API gateway, APM, OpenTelemetry
 * and every cloud log record — so moving a patient name out of the visible URL
 * and leaving it in a GET query changes nothing downstream. HTTPS protects the
 * wire and nothing after the terminator.
 *
 * The body arrives in two halves because they are treated differently: the safe
 * half is logged, the sensitive half is logged BY KEY ONLY. That is the same
 * rule the saved-view audit follows, and §14's redaction table in the roadmap.
 *
 * Rows come from the REAL generator in packages/erp-data, imported through
 * Node's type stripping exactly as the verify scripts import the real gate
 * resolver. A second copy of the data here would drift from the one the client
 * renders, and a search that disagrees with the table it filters is worse than
 * no search.
 * ------------------------------------------------------------------------- */
import { getWorklistConfig } from "../desktop-clients/packages/erp-data/src/mock.ts";
import { DATA_CLASSIFICATIONS } from "../desktop-clients/packages/erp-config/src/data-classification.ts";

/* The redaction table, as a function. A value never reaches a log; a key does,
   because "someone searched by MRN" is what an audit needs and "AV204581" is
   what it must not keep. */
function loggableFilters(safe, sensitive) {
  const safePart = Object.entries(safe).map(([key, value]) => `${key}=${value}`).join(" ");
  const sensitiveKeys = Object.keys(sensitive).sort().join(",");
  return `${safePart}${sensitiveKeys ? ` +redacted[${sensitiveKeys}]` : ""}`;
}

/* Every filter the client sends is checked against the registry here too. A
   client that has been edited can put a patient name in `safeFilters` and it
   would be logged in full — so the server decides which half a key belongs to,
   not the caller. */
function partitionOnServer(filters) {
  const safe = {};
  const sensitive = {};
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (DATA_CLASSIFICATIONS[key] === "operational") safe[key] = value;
    else sensitive[key] = value;
  }
  return { safe, sensitive };
}

function rowsWithSaved(user, product, pageId, config) {
  const rows = new Map(config.rows.map(row => [String(row[config.primaryKey]), row]));
  for (const item of recordStore.list(user, JSON.stringify([product, `form:${pageId}:`]))) {
    const id = JSON.parse(item.key)[1].slice(`form:${pageId}:`.length);
    const values = item.record.values, mapped = {};
    for (const [key,value] of Object.entries(values)) if (["string","number","boolean"].includes(typeof value)) mapped[key]=value;
    for (const [field,column] of Object.entries({ legalName:"name",displayName:"name",mobile:"phone",customerType:"type",accountManager:"owner" })) if(mapped[field]!==undefined)mapped[column]=mapped[field];
    rows.set(id,{...rows.get(id),...mapped,[config.primaryKey]:id});
  }
  return [...rows.values()];
}

function matchesRow(row, key, value, mode = "contains") {
  const needle = value.trim().toLowerCase();
  if (!needle) return true;
  /* `query` is the free-text box: it searches every visible field, which is
     exactly why it is classified phi rather than operational. */
  if (key === "query") return Object.values(row).some(field => { const text = String(field).toLowerCase(); return mode === "exact" ? text === needle : mode === "starts-with" ? text.startsWith(needle) : text.includes(needle); });
  const field = row[key];
  if (key === "from" || key === "to") return Object.values(row).some(field => /^\d{4}-\d{2}-\d{2}/.test(String(field)) && (key === "from" ? String(field) >= value : String(field) <= value));
  if (["recordRef", "tags", "createdBy"].includes(key)) return Object.values(row).some(field => String(field).toLowerCase().includes(needle));
  if (field === undefined) return false;
  return String(field).toLowerCase().includes(needle);
}

/* ---- reference data, with per-key failure ------------------------------- *
 *
 * An empty dropdown is ambiguous. "This tenant configured nothing" and "this
 * list is broken today" look identical on screen and mean opposite things — one
 * is a setup task and the other is an incident, and a user who cannot tell them
 * apart raises a ticket for the first and ignores the second.
 *
 * So the fan-out catches PER KEY: one bad list omits one list instead of 500ing
 * the whole response, and the keys that failed come back in `failures`. That
 * field is the entire contract. Without it a client sees `[]` and has to guess.
 * ------------------------------------------------------------------------- */
const REFERENCE_SOURCES = {
  branches: () => BRANCH_REFERENCE,
  departments: () => DEPARTMENT_REFERENCE,
  roles: () => ROLE_REFERENCE,
  /* Deliberately breakable, so the failure path can be exercised without
     waiting for something to actually break. REFERENCE_FAIL=insuranceNetworks
     makes this one throw. */
  insuranceNetworks: () => INSURANCE_REFERENCE,
};

const BRANCH_REFERENCE = [
  { value: "hq", label: "Abu Dhabi • Head Office" },
  { value: "dubai", label: "Dubai • Business Center" },
  { value: "sharjah", label: "Sharjah • Operations Hub" },
  { value: "india", label: "Kochi • Delivery Center" },
];
const DEPARTMENT_REFERENCE = [
  { value: "finance", label: "Finance" },
  { value: "hr", label: "Human Resources" },
  { value: "clinical", label: "Clinical Services" },
];
const ROLE_REFERENCE = [
  { value: "enterprise-admin", label: "Enterprise Administrator" },
  { value: "finance-manager", label: "Finance Manager" },
  { value: "clinician", label: "Clinician" },
];
const INSURANCE_REFERENCE = [
  { value: "daman", label: "Daman" },
  { value: "thiqa", label: "Thiqa" },
  { value: "adnic", label: "ADNIC" },
];

/* Which keys should fail this run. Comma-separated, from the environment, so a
   demo can show the warning without anyone editing code. */
const FAILING_REFERENCES = new Set((process.env.REFERENCE_FAIL ?? "").split(",").map((key) => key.trim()).filter(Boolean));

function loadReferences(keys) {
  const references = {};
  const failures = [];
  for (const key of keys) {
    const source = REFERENCE_SOURCES[key];
    if (!source) {
      failures.push({ key, code: "REFERENCE_UNKNOWN" });
      references[key] = [];
      continue;
    }
    try {
      if (FAILING_REFERENCES.has(key)) throw new Error("simulated reference failure");
      references[key] = source();
    } catch {
      /* The list comes back EMPTY and the key is named in failures. Omitting
         the key entirely would make a client crash on `references[key].map`,
         and returning nothing at all would lose the other 53 lists to one bad
         column mapping. */
      references[key] = [];
      failures.push({ key, code: "REFERENCE_LOAD_FAILED" });
    }
  }
  return { references, failures, partial: failures.length > 0 };
}

/* Cell edits, in memory and per tenant. See the PATCH handler for why they are
   not persisted. */
const cellEdits = new Map();

const VIEWS_FILE = join(DATA_DIR, "saved-views.json");
const VIEW_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function loadViews() {
  try { return JSON.parse(readFileSync(VIEWS_FILE, "utf8")); } catch { return {}; }
}

let savedViews = loadViews();

function saveViews() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${VIEWS_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(savedViews, null, 2) + "\n");
  renameSync(tmp, VIEWS_FILE);
  /* Same 0600 as the credential store. These hold the filter values a URL was
     not allowed to carry, so the file is not more public than the URL would
     have been. */
  try { chmodSync(VIEWS_FILE, 0o600); } catch { /* best effort */ }
}

function newViewId() {
  return `VW_${randomBytes(8).toString("hex").toUpperCase()}`;
}

/* Keys only. The whole point of the saved view is that the values do not travel
   to places that keep logs, and an audit line is such a place. */
function auditView(action, user, view) {
  console.log(`[audit] saved-view ${action} tenant=${user.tenantId} user=${user.id} view=${view.id} page=${view.pageId} filters=${Object.keys(view.filters).sort().join(",") || "none"}`);
}

const LAYOUTS_FILE = join(DATA_DIR, "layouts.json");

function loadLayouts() {
  try {
    return JSON.parse(readFileSync(LAYOUTS_FILE, "utf8"));
  } catch {
    return {};
  }
}

const layouts = loadLayouts();

function saveLayouts() {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${LAYOUTS_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(layouts, null, 2) + "\n");
  renameSync(tmp, LAYOUTS_FILE);
}

/* AI access policy: gates 2-7 of eight, per tenant.
 *
 * A STAND-IN, and the endpoint most likely to be mistaken for governance. It
 * reads a JSON file and returns it. It enforces nothing, it is not multi-tenant
 * in any real sense, and the process it runs in states in its own header that it
 * is not a security boundary. The real service owns policy authorship,
 * versioning, an audit trail of who changed which gate, and -- above all -- the
 * server-side re-check at dispatch, which is the actual enforcement point. The
 * client-side resolver only decides what to RENDER.
 *
 * Seeded from ai-policy.example.json, which is committed; the live copy lives
 * under data/ and is gitignored, exactly as preferences.json is.
 */
const POLICY_FILE = join(DATA_DIR, "ai-policy.json");
const POLICY_SEED = join(dirname(fileURLToPath(import.meta.url)), "ai-policy.example.json");

function loadPolicies() {
  for (const file of [POLICY_FILE, POLICY_SEED]) {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // Try the seed next; an unreadable seed means no policy, handled below.
    }
  }
  return {};
}

const policies = loadPolicies();

/* Configuration and encrypted provider credentials are separate stores. A config
   response never contains secret material. Authentication remains a demo adapter. */
const AI_CONFIG_FILE = join(DATA_DIR, "ai-config.json");
const AI_CONFIG_SEED = join(dirname(fileURLToPath(import.meta.url)), "ai-config.example.json");

function loadAiConfig() {
  for (const file of [AI_CONFIG_FILE, AI_CONFIG_SEED]) {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // Fall through to the seed, then to an empty map.
    }
  }
  return {};
}

const aiConfig = loadAiConfig();

/* The loader had no counterpart for four tasks: PUT /ai/config mutated this
   object and never wrote it, so every administrative change survived exactly
   until the next restart. It went unnoticed because the credential DID persist,
   so a restart left a valid key pointing at no provider and dispatch answered
   "No provider or model is configured" -- a message that reads like a setup
   step nobody had done, rather than a setting that had been silently dropped. */
function saveAiConfig() {
  try {
    writeFileSync(AI_CONFIG_FILE, JSON.stringify(aiConfig, null, 2));
  } catch {
    console.warn("[ai] could not persist the AI configuration; changes will be lost on restart");
  }
}

/* Provider credentials are encrypted with AES-256-GCM. The master key is a
   separate operator-owned file, not a managed vault. Existing plaintext stores
   migrate on startup. Historical backups need separate operator retention review. */
const CREDENTIAL_FILE = join(DATA_DIR, "ai-credential.json");

// The master key is kept outside the repository and data backups. Operators must
// back it up separately; losing it makes the credential store unreadable.
const masterKeyFile = process.env.NEXORA_KEY_FILE ?? join(homedir(), ".config/nexora/provider-master.key");
mkdirSync(dirname(masterKeyFile),{recursive:true,mode:0o700});
try {writeFileSync(masterKeyFile,randomBytes(32),{flag:"wx",mode:0o600});} catch(error) {if(error.code!=="EEXIST")throw error;}
const credentialStore = createCredentialStore(CREDENTIAL_FILE,masterKeyFile);
const credentials = credentialStore.load();
function saveCredentials() { credentialStore.save(credentials); }

/* Takes a TENANT, never a secret, and returns only values that cannot be
   reversed: the last four characters and a hash prefix. The shape is byte for
   byte what it was when nothing was stored, which is the part worth noticing --
   adding storage did not add a field capable of carrying the value. */
/* `scope` lets speech providers reuse this exact machinery rather than growing a
   second credential store with its own subtly different rules. The main provider
   keeps the bare tenant key so nothing already stored has to move. */
function credentialKey(tenantId, scope) {
  return scope ? `${tenantId}:${scope}` : tenantId;
}

function credentialStatus(tenantId, scope) {
  const held = credentials[credentialKey(tenantId, scope)];
  if (!held) {
    return {
      configured: false,
      hint: null,
      fingerprint: null,
      setBy: null,
      setAt: null,
      rotatedAt: null,
      lastVerifiedAt: null,
      lastError: null,
    };
  }
  /* Field by field rather than a spread of `held`. A spread would put `secret`
     into every response the day someone adds a field and forgets to omit it. */
  return {
    configured: !credentialExpired(held),
    hint: held.hint ?? null,
    fingerprint: held.fingerprint ?? null,
    setBy: held.setBy ?? null,
    setAt: held.setAt ?? null,
    rotatedAt: held.rotatedAt ?? null,
    lastVerifiedAt: held.lastVerifiedAt ?? null,
    lastError: held.lastError ?? null,
  };
}

function fingerprintOf(secret) {
  return `sha256:${createHash("sha256").update(secret).digest("hex").slice(0, 16)}`;
}

/* The stand-in for an authorization layer.

   This used to refuse EVERYONE, which was the honest answer while nothing could
   be written anyway. It is now a role check, and that is a deliberate loosening
   made so the credential can be set through the admin API as asked.

   The one property that makes it worth more than nothing: `role` is read off
   the session object this server issued at login, never off the request, so a
   caller cannot claim to be an admin. It is still a comparison against a
   hardcoded account list. A real deployment needs real authorization, and this
   function is where that goes.

   Returns a response body when refused, or null when the write may proceed. */
function refuseAdminWrite(user) {
  if (user?.role === "enterprise-admin") return null;
  return {
    error: "This change requires an administrator.",
    detail: `Signed in as ${user?.role ?? "an unknown role"}. The demo API accepts administrative writes only from enterprise-admin.`,
  };
}

/* Prompt TEXT, server-side and nowhere else.

   The client sends a promptId; this is what that id resolves to. Keeping the
   text here is the whole reason a browser cannot read, replay or edit a prompt,
   and it is why changing one is a server restart rather than a client release. */
const PROMPT_TEXT = {
  "worklist.summarise.v1":
    "You summarise ERP worklist rows for an operations user. Use ONLY the fields provided. Never invent a value, a total or a status. If the fields do not support a statement, omit it. Be brief and factual.",
  "record.explain.v1":
    "You explain one ERP record and what its current status means for the person looking at it. Use ONLY the fields provided. Never invent a value. If something looks unusual given the fields, say so plainly.",
  "form.draft-note.v1":
    "You draft a short internal note from values a user has entered on a form. Use ONLY those values. Never invent a reference, a name or an amount. Output the note text alone, with no preamble.",
  "dashboard.explain-metrics.v1":
    "You explain a set of dashboard figures to the person looking at them. Use ONLY the figures provided, including their movement and footnotes. Say what they mean TOGETHER rather than restating each one in turn, and name anything that looks inconsistent between them. Never invent a figure, a period or a cause.",
  "inbox.summarise-unread.v1":
    "You tell someone what is waiting in their inbox. Use ONLY the unread items provided. Lead with anything that looks time-critical or blocking, group the rest by what they are about, and give a one-line count. Do not invent an item, a deadline or a sender, and do not tell the reader what to do about any of it.",
  /* Clinical. Each is told what it is NOT for as plainly as what it is: a
     summary that quietly turns into advice is the failure mode that matters
     here, and the model has no way to know it is not the treating clinician
     unless the prompt says so. */
  "encounter.summarise.v1":
    "You summarise one clinical record for the clinician already responsible for it. Use ONLY the fields provided. State the picture plainly: ward, working diagnosis, how long the stay has run and current status. You are NOT diagnosing, NOT recommending treatment and NOT assessing risk. Never invent a finding, a date or a name, and if the fields do not support a statement, leave it out.",
  "documentation.gaps.v1":
    "You name what a clinical record of this kind would normally carry and this one does not. Use ONLY the fields provided. Output is a short list of gaps for a human to act on -- never the content that would fill them, never a clinical judgement, and never an instruction to a clinician.",
  "cohort.summarise-selection.v1":
    "You summarise a set of selected clinical records as a GROUP for an operational reader: where the load sits by ward, which look urgent by acuity, and any outlier length of stay. Use ONLY the rows provided. Never single out an individual, never infer anything about a person, and never invent a count.",
  /* SELECTION, NOT GENERATION. Both of these are told to choose from a list
     that travels in the payload. A model asked for an ICD code will produce
     something shaped exactly like one, and a plausible wrong code survives
     review because it is well formed -- so the instruction to refuse when
     nothing fits matters more than the instruction to choose. */
  "coding.suggest-icd.v1":
    "You select diagnosis codes for a documented clinical problem. You may ONLY choose from the candidate list given in the fields; it is the service's catalogue. Never output a code that is not in that list, never adjust a code you were given, and if none of them fit the documented problem say so explicitly and choose nothing. Return at most three, each as `CODE — term — one short reason it fits`. You are not diagnosing; you are matching what has already been documented.",
  "orders.suggest.v1":
    "You select orders for a documented clinical problem. You may ONLY choose from the candidate list given in the fields; it is what this service can actually place. Never output an order that is not in that list, and if none fit say so and choose nothing. Return at most four, each as `CODE — name — one short reason`. Do not state urgency, do not imply an order is required, and do not recommend treatment. A clinician decides what is placed.",
  "report.summarise.v1":
    "You summarise a report's rows: actual against previous and against budget. Use ONLY the rows provided. Lead with where the movement is and which rows drive it. State variances in the direction they are given and never invent a total, a percentage or a reason.",
};

/* ---------------------------------------------------------------------------
   Rate and budget enforcement.

   `limits.requestsPerMinute` and `limits.tokensPerDay` were in AiConfig from the
   start, displayed on the administration surface, and enforced nowhere. That was
   survivable while dispatch echoed a mock. It stopped being survivable the day a
   real billed provider was wired in behind a public host whose demo passwords are
   printed on its own login screen: anyone who can reach the site can sign in and
   spend the tenant's balance in a loop.

   Two properties this is built around:

   ABSENCE OF CONFIG IS NOT ABSENCE OF A LIMIT. A tenant with no config, or a
   zero, or a string where a number belongs, gets DEFAULT_LIMITS. The failure
   mode of a missing limit must never be "unlimited spend".

   REQUESTS ARE COUNTED ON ADMISSION, NOT ON SUCCESS. A failing or slow provider
   still costs a round trip, and a caller who can retry for free on every error
   has no limit at all. So the slot is taken before the work is attempted, and
   the counter sits ahead of prompt and credential validation for the same
   reason -- a malformed request is still a request.
   --------------------------------------------------------------------------- */
const USAGE_FILE = join(DATA_DIR, "ai-usage.json");

/* The token budget is persisted; the per-minute window is not. A restart losing
   a minute of history is irrelevant, but a restart resetting the DAY'S spend
   would make the budget bypassable by anyone who can bounce the process. */
function loadUsage() {
  try {
    return JSON.parse(readFileSync(USAGE_FILE, "utf8"));
  } catch {
    return {};
  }
}

const usage = loadUsage();
const recentRequests = new Map();

const DEFAULT_LIMITS = { requestsPerMinute: 20, tokensPerDay: 200000 };

function limitsFor(tenantId) {
  const configured = aiConfig[tenantId]?.limits ?? {};
  const positive = (value, fallback) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback);
  return {
    requestsPerMinute: positive(configured.requestsPerMinute, DEFAULT_LIMITS.requestsPerMinute),
    tokensPerDay: positive(configured.tokensPerDay, DEFAULT_LIMITS.tokensPerDay),
  };
}

/* UTC, not local. A budget that resets at the server's local midnight silently
   changes meaning when the machine moves timezone. */
function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function tokensUsedToday(tenantId) {
  const held = usage[tenantId];
  return held && held.day === utcDay() ? held.tokens : 0;
}

/* Returns a refusal, or null to proceed. Does NOT take the slot -- admit() does,
   so a caller can report the limit without consuming budget. */
function refuseForRate(tenantId) {
  const { requestsPerMinute, tokensPerDay } = limitsFor(tenantId);
  const now = Date.now();
  const window = (recentRequests.get(tenantId) ?? []).filter((at) => now - at < 60_000);
  recentRequests.set(tenantId, window);

  if (window.length >= requestsPerMinute) {
    const retryAfter = Math.max(1, Math.ceil((60_000 - (now - window[0])) / 1000));
    return {
      status: 429,
      retryAfter,
      body: {
        error: "Rate limit reached.",
        detail: `${requestsPerMinute} requests per minute for this tenant. Try again in ${retryAfter}s.`,
      },
    };
  }

  const used = tokensUsedToday(tenantId);
  if (used >= tokensPerDay) {
    return {
      status: 429,
      /* Seconds to the next UTC midnight, so a client is not told to retry into
         the same refusal. */
      retryAfter: Math.max(1, Math.ceil((Date.parse(`${utcDay()}T23:59:59.999Z`) + 1 - Date.now()) / 1000)),
      body: {
        error: "Daily token budget spent.",
        detail: `${used} of ${tokensPerDay} tokens used today. The budget resets at 00:00 UTC.`,
      },
    };
  }
  return null;
}

function admit(tenantId) {
  const window = recentRequests.get(tenantId) ?? [];
  window.push(Date.now());
  recentRequests.set(tenantId, window);
}

function recordTokens(tenantId, tokens) {
  if (!(Number(tokens) > 0)) return;
  const day = utcDay();
  const held = usage[tenantId];
  usage[tenantId] = held && held.day === day ? { day, tokens: held.tokens + Number(tokens) } : { day, tokens: Number(tokens) };
  try {
    writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
  } catch {
    console.warn("[ai] could not persist token usage; the daily budget will reset on restart");
  }
}

/* One place reads `secret`, and this is it. */
async function callProvider(config, secret, messages) {
  const endpoint = String(config?.provider?.endpoint ?? "").replace(/\/+$/, "");
  const model = config?.model?.id;
  if (!endpoint || !model || model === "unset") {
    return { ok: false, status: 409, error: "No provider or model is configured.", detail: "Set provider.endpoint and model.id through PUT /ai/config first." };
  }
  if (!providerAllowed(endpoint)) return {ok:false,status:403,error:"AI provider is not approved."};
  let response;
  try {
    response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
      /* 700 was the original figure and it was wrong for a reasoning model: the
         provider spends completion tokens THINKING before it writes anything, so
         a 700-token budget was consumed entirely by reasoning and the answer
         came back empty. Measured against this provider, a five-item inbox
         summary needs ~1,100 reasoning tokens before the first word of output.
         The daily budget counts total_tokens, so a larger cap here is honestly
         accounted for rather than hidden. */
      body: JSON.stringify({ model, messages, max_tokens: 2000, temperature: 0.2 }),
      signal: AbortSignal.timeout(45000),
      redirect: "error",
    });
  } catch (cause) {
    /* The provider's own message, not the request that produced it: a thrown
       fetch error can carry the request headers, and those hold the key. */
    return { ok: false, status: 502, error: "The provider could not be reached.", detail: cause?.name === "TimeoutError" ? "Timed out after 45s." : "Network error." };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, status: response.status === 401 ? 401 : 502, error: "The provider rejected the request.", detail: payload?.error?.message ?? `HTTP ${response.status}.` };
  }
  const choice = payload?.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    /* Say WHICH kind of nothing. "Returned no text" was true of both a provider
       fault and a budget that ran out mid-thought, and those need opposite
       responses -- one is retry, the other is raise the cap. finish_reason is
       the provider telling us which, and throwing it away made a diagnosable
       failure look like an outage. */
    if (choice?.finish_reason === "length") {
      const reasoning = payload?.usage?.completion_tokens_details?.reasoning_tokens;
      return {
        ok: false,
        status: 502,
        error: "The model ran out of output budget before answering.",
        detail: `It spent its entire allowance${reasoning ? ` (${reasoning} reasoning tokens)` : ""} without producing an answer. Raise max_tokens for this provider.`,
      };
    }
    return { ok: false, status: 502, error: "The provider returned no text.", detail: choice?.finish_reason ? `finish_reason: ${choice.finish_reason}` : undefined };
  }
  return { ok: true, text: text.trim(), model: payload?.model ?? model, usage: payload?.usage ?? null };
}

const allowedOrigins = new Set((process.env.NEXORA_ALLOWED_ORIGINS ?? [
  "https://front-design.pepbits.com","https://desktop.front-design.pepbits.com",
  "http://localhost:3100","http://localhost:3101","http://localhost:1420",
  "http://127.0.0.1:3100","http://127.0.0.1:3101","http://127.0.0.1:3109","http://127.0.0.1:3119",
  "tauri://localhost","http://tauri.localhost","https://tauri.localhost"
].join(",")).split(",").map(value=>value.trim()).filter(Boolean));

const CORS = {
  "Vary": "Origin",
    /* PATCH is here because a browser silently drops a method the preflight does
     not name: the request never leaves, nothing is logged, and the only symptom
     is a cell that will not save. */
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, If-None-Match, X-Product-Id, X-Reference-Branch, X-Reference-Module, X-Reference-Facility, Idempotency-Key, X-Reports-Api-Key, X-Inbound-Secret, Pepbits-Contract-Version",
  "Access-Control-Expose-Headers": "ETag, Content-Disposition",
  "Access-Control-Max-Age": "86400",
};

function send(res, status, body, extraHeaders) {
  if (res.auditContext) {
    const {user,action,metadata} = res.auditContext;
    res.auditContext = null;
    try {auditStore.append(user,action,status,metadata);} catch {
      status=503;body={error:"Audit storage is unavailable."};
    }
  }
  const payload = body === undefined ? "" : JSON.stringify(withMessageMetadata(body));
  res.writeHead(status, {
    ...CORS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    ...(extraHeaders ?? {}),
  });
  res.end(payload);
}

async function readJson(req, limit = 16_384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    // A demo service still should not be a memory bomb.
    if (size > limit) throw new Error("body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(req.auditContext && body && typeof body==="object") {
    req.auditContext.metadata={pageId:body.pageId,useCaseId:body.useCaseId,
      filterKeys:[...Object.keys(body.safeFilters??{}),...Object.keys(body.sensitiveFilters??{})],
      fieldKeys:Array.isArray(body.fields)?body.fields.map(field=>field?.key):[]};
  }
  return body;
}

function bearer(req) {
  const header = req.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const { pathname } = requestUrl;
  const origin=req.headers.origin;
  if(origin && !allowedOrigins.has(origin)) return send(res,403,{error:"Origin is not allowed."});
  if(origin)res.setHeader("Access-Control-Allow-Origin",origin);
  const auditUser = sessions.get(bearer(req));
  if(auditUser && /^\/(ai|exports|worklists|views|report-schedules)(?:\/|$)/.test(pathname)) {
    req.auditContext=res.auditContext={user:auditUser,action:`${req.method}:${pathname.split('/').slice(0,pathname.startsWith("/ai/")?3:2).join('/')}`,metadata:{}};
  }
  try {
  if(res.auditContext)auditStore.append(auditUser,"request.admitted",202);

  if (req.method === "OPTIONS") {
    return send(res,204);
  }

  const allowed = allowedMethods(pathname);
  if (allowed && !allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    return send(res, 405, { error: "Method not allowed." });
  }

  const referenceMatch=pathname.match(/^\/reference-modules\/(reports|school|erp1|erp2|healthcare-suite|lis1|lis2|ris1|teleconsult-provider|teleconsult-patient|quality|pharmacy|tenant-admin|medband|rcm|surgisuite|medslot)(\/.*)?$/);
  if(referenceMatch){
    const variant=referenceMatch[1],modulePath=referenceMatch[2]??'/';
    let user=sessions.get(bearer(req)),keyIdentity=null;
    if(!user&&variant==='reports'&&modulePath.startsWith('/api/v1/')){
      keyIdentity=referenceStores.reports.authenticateApiKey(req.headers['x-reports-api-key']??bearer(req));
      if(keyIdentity)user=ACCOUNTS.find(account=>account.user.id===keyIdentity.user.id&&account.user.tenantId===keyIdentity.user.tenantId)?.user;
    }
    if(!user&&variant==='reports'&&modulePath==='/api/inbound-email'&&req.method==='POST'){
      keyIdentity=referenceStores.reports.authenticateInboundSecret(req.headers['x-inbound-secret']);
      if(keyIdentity)user=ACCOUNTS.find(account=>account.user.id===keyIdentity.user.id&&account.user.tenantId===keyIdentity.user.tenantId)?.user;
    }
    if(!user)return send(res,401,{error:'Not signed in.'});
    // A key's owner and partition come from the server. Client scope headers cannot move a key.
    const product=keyIdentity?.scope.applicationId??req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    const schoolView=variant==='school'?resolveSchoolView(user,req.headers['x-reference-module']):null;
    const requestedModule=variant==='school'?schoolView?.id:'reference-'+variant;
    if(!requestedModule||!nav.body.nodes.some(node=>node.kind==='module'&&node.moduleId===requestedModule))return send(res,403,{error:'Module is unavailable.'});
    const branch=keyIdentity?.scope.branchId??req.headers['x-reference-branch']??user.branch;
    if(typeof branch!=='string'||!BRANCHES.some(item=>item.value===branch)||(user.role!=='enterprise-admin'&&user.role!=='school-admin'&&branch!==user.branch))return send(res,403,{error:'Branch is unavailable.'});
    if(schoolView){
      let schoolPath;try{schoolPath=decodeURIComponent(modulePath).replace(/\/{2,}/g,'/').replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'')||'/';}catch{return send(res,400,{error:'Malformed School path.'});}
      const restrictedPage=['/students/new','/teachers/new','/quizzes/new','/reports'].find(path=>schoolPath===path||schoolPath.startsWith(path+'/'));
      if(restrictedPage&&!schoolPathAllowed(schoolView.role,restrictedPage))return send(res,403,{error:'School page is unavailable.'});
    }
    if(['lis1','lis2','ris1'].includes(variant)){
      const chunks=[];let bytes=0;
      for await(const chunk of req){bytes+=chunk.length;if(bytes>16_000_000)return send(res,413,{error:'Diagnostic payload is too large'});chunks.push(chunk);}
      const result=await referenceStores[variant].handle({...user,branch},{applicationId:product,branchId:branch},{method:req.method,path:modulePath+requestUrl.search,headers:req.headers,raw:Buffer.concat(chunks).toString('base64')});
      if(Buffer.isBuffer(result.body)){res.writeHead(result.status,{...CORS,'Cache-Control':'no-store',...result.headers,'Content-Length':result.body.length});return res.end(result.body);}
      return send(res,result.status,result.body,result.headers);
    }
    let body={};if(!['GET','HEAD'].includes(req.method)){try{body=await readJson(req,2_000_000);}catch{return send(res,400,{error:'Malformed request body.'});}}
    const scope={applicationId:product,branchId:branch,...(schoolView?{moduleId:schoolView.id}:{})};
    const effectiveUser={...user,branch,...(schoolView?{role:'school-'+schoolView.role}:{})};
    if(['tenant-admin','medband','rcm','surgisuite','medslot'].includes(variant)){
      const result=await referenceStores[variant].handle(effectiveUser,scope,{method:req.method,path:modulePath+requestUrl.search,body,headers:req.headers});
      return send(res,result.status,result.body,result.headers);
    }
    if(variant==='pharmacy'){
      const result=await pharmacyStore.handle(effectiveUser,scope,{method:req.method,path:modulePath+requestUrl.search,body,headers:req.headers});
      return send(res,result.status,result.body,result.headers);
    }
    if(variant==='quality'){
      const result=await qualityStore.handle(effectiveUser,scope,{method:req.method,path:modulePath+requestUrl.search,body,headers:req.headers});
      if(Buffer.isBuffer(result.body)){res.writeHead(result.status,{...CORS,'Cache-Control':'no-store',...result.headers,'Content-Length':result.body.length});return res.end(result.body);}
      return send(res,result.status,result.body,result.headers);
    }
    if(variant.startsWith('teleconsult-')){
      const result=await teleconsultStore.handle(effectiveUser,{...scope,moduleId:requestedModule},{method:req.method,path:modulePath,query:requestUrl.searchParams,body,headers:req.headers});
      return send(res,result.status,result.body,result.headers);
    }
    let financialPath;
    try{financialPath=decodeURIComponent(modulePath).replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'')||'/';}
    catch{return send(res,400,{message:'Malformed reference API path.'});}
    const sourceCommand=variant==='healthcare-suite'&&req.method==='POST'?financialPath.match(/^\/billing\/invoices\/([^/]+)\/(payments|cancel)$/):null;
    const transferId=variant==='healthcare-suite'&&financialPath==='/rcm/commands'&&body.kind==='import-invoice'&&typeof body.invoiceId==='string'?body.invoiceId:sourceCommand?.[1];
    const releaseInvoice=transferId?await acquireHealthcareSuiteInvoice(JSON.stringify([effectiveUser.tenantId,product,branch,transferId])):()=>{};
    try {
    const request={method:req.method,path:modulePath,query:requestUrl.searchParams,body,headers:req.headers};
    const rcmScope={...scope,facilityId:req.headers['x-reference-facility']??'F001'};
    if(variant==='healthcare-suite'&&req.method==='POST'){
      let sourcePath;
      try{sourcePath=decodeURIComponent(modulePath).replace(/^\/api(?=\/|$)/,'').replace(/\/+$/,'')||'/';}
      catch{return send(res,400,{message:'Malformed Healthcare Suite path.'});}
      const sourceMutation=sourcePath.match(/^\/billing\/invoices\/([^/]+)\/(payments|cancel)$/);
      if(sourceMutation){
        const sourceId=sourceMutation[1];
        const source=await referenceStores[variant].handle(effectiveUser,scope,{method:'GET',path:'/api/billing/invoices/'+encodeURIComponent(sourceId),headers:{'x-reference-facility':rcmScope.facilityId}});
        if(source.status!==200)return send(res,source.status,source.body);
        if(source.body.facility?.id!==rcmScope.facilityId)return send(res,403,{message:'Invoice is outside the selected facility.'});
        if(await healthcareSuiteRcm.ownsInvoice(effectiveUser,rcmScope,sourceId,rcmScope.facilityId))return send(res,409,{message:'This invoice is managed by RCM. Use the RCM financial workflow.'});
      }
    }
    if(variant==='healthcare-suite'){
      const scopeCheck=await referenceStores[variant].handle(effectiveUser,scope,{method:'GET',path:'/api/session',headers:{'x-reference-facility':rcmScope.facilityId}});
      if(scopeCheck.status!==200)return send(res,scopeCheck.status,scopeCheck.body);
    }
    const rcmResult=variant==='healthcare-suite'?await healthcareSuiteRcm.handle(effectiveUser,rcmScope,request):null;
    const result=rcmResult??await referenceStores[variant].handle(effectiveUser,scope,request);
    if(variant==='healthcare-suite'&&req.method==='GET'&&modulePath.replace(/^\/api(?=\/|$)/,'')==='/session'&&result.status===200){
      result.body.canWriteRcm=['enterprise-admin','admin','finance-manager','finance'].includes(effectiveUser.role);
    }
    const contentType=result.headers?.['Content-Type']??result.headers?.['content-type'];
    if(contentType&&!contentType.includes('application/json')){
      const payload=Buffer.isBuffer(result.body)?result.body:Buffer.from(String(result.body??''));
      res.writeHead(result.status,{...CORS,'Cache-Control':'no-store',...result.headers,'Content-Length':payload.length});return res.end(payload);
    }
    return send(res,result.status,result.body,result.headers);
    }finally{releaseInvoice();}
  }

  if (req.method === "POST" && pathname === "/auth/login") {
    let body;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: "Malformed request body." });
    }
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const account = ACCOUNTS.find((a) => a.username === username && a.password === password);
    if (!account) {
      /* One message for both a wrong username and a wrong password — the demo
         credentials are printed on the login screen anyway, and splitting them is a
         habit worth not building. */
      return send(res, 401, { error: "Username or password is incorrect." });
    }
    const token = randomBytes(24).toString("hex");
    sessions.set(token, account.user);
    console.log(`[auth] ${account.username} signed in`);
    return send(res, 200, { token, user: account.user });
  }

  if (req.method === "GET" && pathname === "/auth/me") {
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });
    return send(res, 200, { user });
  }

  if (req.method === "POST" && pathname === "/auth/logout") {
    const token = bearer(req);
    if (token) sessions.delete(token);
    return send(res,204);
  }

  if(pathname==="/clinical-triage"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    if(req.method!=="POST")return send(res,405,{error:"template.triage.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='clinical-triage'))return send(res,403,{error:'template.triage.denied'});
    const input=await readJson(req,262144).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
    try{const result=clinicalTriage.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'template.triage.storage'});}
  }

  if(pathname==="/clinical-consultation"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    if(req.method!=="POST")return send(res,405,{error:"template.consultation.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='clinical-consultation'))return send(res,403,{error:'template.consultation.denied'});
    const input=await readJson(req,262144).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
    try{const result=clinicalConsultation.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'template.consultation.storage'});}
  }

  if(pathname==="/dcp-designer"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"designer.denied"});
    if(req.method!=="POST")return send(res,405,{error:"designer.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200||!nav.body.pages.some(p=>p.id==='dcp-designer'))return send(res,403,{error:'designer.denied'});
    const input=await readJson(req,262144).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:'designer.denied'});
    try{const result=dcpDesigner.handle(user,product,input);return send(res,result.status,result.body,{'Cache-Control':'no-store'});}catch{return send(res,500,{error:'designer.storage'});}
  }
  if(pathname==="/care-pages"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"care.denied"});
    if(req.method!=="POST")return send(res,405,{error:"care.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    const input=await readJson(req,262144).catch(()=>null);
    if(sessions.get(token)!==user)return send(res,401,{error:"care.denied"});
    if(!nav.body.pages.some(p=>p.id===input?.pageId))return send(res,403,{error:'care.denied'});
    try{const result=carePages.handle(user,product,input);return send(res,result.status,result.body,{'Cache-Control':'no-store'});}catch{return send(res,500,{error:'care.storage'});}
  }
  if(pathname==="/identity-devices"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"identity.denied"});
    if(req.method!=="POST")return send(res,405,{error:"identity.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='identity-card-readers'))return send(res,403,{error:'identity.denied'});
    const input=await readJson(req,32768).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:'identity.denied'});
    try{const result=identityDevices.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'identity.storage'});}
  }

  if(pathname==="/device-integrations"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"devices.denied"});
    if(req.method!=="POST")return send(res,405,{error:"devices.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='device-integrations'))return send(res,403,{error:'devices.denied'});
    const input=await readJson(req,32768).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:'devices.denied'});
    try{const result=deviceIntegrations.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'devices.storage'});}
  }

  if(pathname==="/label-printing"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"labels.denied"});
    if(req.method!=="POST")return send(res,405,{error:"labels.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='barcode-labels'))return send(res,403,{error:'labels.denied'});
    const input=await readJson(req,32768).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:'labels.denied'});
    try{const result=labelPrinting.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'labels.storage'});}
  }

  if(pathname==="/op-registration"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"registration.denied"});
    if(req.method!=="POST")return send(res,405,{error:"registration.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='op-registration'))return send(res,403,{error:'registration.denied'});
    const input=await readJson(req,262144).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:"registration.denied"});
    try{const result=opRegistration.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'registration.storage'});}
  }

  if(pathname==="/comprehensive-consultation"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    if(req.method!=="POST")return send(res,405,{error:"template.comprehensive.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='comprehensive-consultation'))return send(res,403,{error:'template.comprehensive.denied'});
    const input=await readJson(req,262144).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
    try{const result=comprehensiveConsultation.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'template.comprehensive.storage'});}
  }

  if(pathname==="/clinic-billing"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    if(req.method!=="POST")return send(res,405,{error:"template.clinic.error.invalid"});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='billing-clinic'))return send(res,403,{error:'template.clinic.error.denied'});
    const input=await readJson(req,262144).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
    try{const result=clinicBilling.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'template.clinic.error.storage'});}
  }

  if(pathname==="/clinical-templates"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(!nav.body.pages.some(p=>p.id==='allyvora-patient-query'))return send(res,403,{error:'template.clinical.denied'});
    let input;try{input=await readJson(req,262144);}catch{return send(res,400,{error:'template.clinical.invalid'});}
    if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
    try{const result=clinicalTemplates.handle(user,product,input,user.role==='enterprise-admin');return send(res,result.status,result.body,{'Cache-Control':'no-store'});}
    catch{return send(res,500,{error:'template.clinical.saveFailed'});}
  }

  if(pathname==="/draft-center"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    const product=req.headers['x-product-id']??'nexora',nav=applicationConfig.navigation(user,product);if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    const input=await readJson(req).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
    const result=draftCenter.handle(user,product,input);return send(res,result.status,result.body,{'Cache-Control':'no-store'});
  }

  if(pathname==="/draft-policy"||pathname==="/drafts"){
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    const product=req.headers["x-product-id"]??"nexora",nav=applicationConfig.navigation(user,product);
    if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    if(pathname==="/draft-policy"){
      if(req.method==="GET")return send(res,200,{policy:draftPolicies.read(user,product),canManage:canManagePreferences(user)},{"Cache-Control":"no-store"});
      const input=await readJson(req).catch(()=>null);if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
      const result=draftPolicies.write(user,product,input);return send(res,result.status,result.body);
    }
    const input=await readJson(req,262144).catch(()=>null);
    if(sessions.get(token)!==user)return send(res,401,{error:"Session ended."});
    if(!input||!['import','approval','dcp'].includes(input.kind)||typeof input.pageId!=="string"||typeof input.recordId!=="string"||!input.recordId||input.recordId.length>150||!['load','draft','discard'].includes(input.action))return send(res,400,{error:"Invalid draft request."});
    if(!nav.body.pages.some(p=>p.id===input.pageId))return send(res,403,{error:"Draft page is not available."});
    if(input.kind==='dcp'&&input.pageId!=='dcp-designer')return send(res,403,{error:'Draft page is not available.'});
    if(input.action==='draft'){
      const v=input.values;
      if(!v||v.schemaVersion!==1||typeof v.context!=="string"||!/^[a-f0-9]{64}$/.test(v.context)||!v.data||typeof v.data!=='object'||Array.isArray(v.data)||Object.keys(v).some(k=>!['schemaVersion','context','data'].includes(k)))return send(res,400,{error:"Invalid draft request."});
      if(input.kind==='dcp'&&(Object.keys(v.data).some(k=>!['patch','version','checksum'].includes(k))||!isDcpValues(v.data.patch)||!isDcpRevision(v.data.version)||typeof v.data.checksum!=='string'||v.data.checksum.length>128))return send(res,400,{error:'Invalid draft request.'});
      if(input.kind==='approval'&&(Object.keys(v.data).some(k=>k!=='comment')||typeof v.data.comment!=='string'||v.data.comment.length>4000))return send(res,400,{error:"Invalid draft request."});
      if(input.kind==='import'&&(Object.keys(v.data).some(k=>k!=='mapping')||!v.data.mapping||typeof v.data.mapping!=='object'||Array.isArray(v.data.mapping)||Object.entries(v.data.mapping).some(([k,v])=>!/^[a-zA-Z][\w.-]{0,99}$/.test(k)||typeof v!=='string'||!/^\d{0,4}$/.test(v))))return send(res,400,{error:"Invalid draft request."});
    }
    const key=JSON.stringify([product,`$draft:${input.kind}:${JSON.stringify([input.pageId,input.recordId])}`]);
    const result=recordStore.handle(user,key,input.action,input.action==='load'?undefined:{...input,baseVersion:0});
    return send(res,result.status,result.body,{"Cache-Control":"no-store"});
  }

  if (pathname === "/records" && req.method === "GET") {
    const user = sessions.get(bearer(req));
    if (!user) return send(res, 401, { error: "Not signed in." });
    try { const scope=requestUrl.searchParams.get("scope"),product=JSON.parse(scope)[0],nav=applicationConfig.navigation(user,product);if(nav.status!==200)return send(res,nav.status,{error:nav.error});return send(res,200,{records:recordStore.list(user,scope)}); }
    catch { return send(res, 400, { error: "Invalid record scope." }); }
  }

  if (pathname.startsWith("/records/")) {
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });
    const match = pathname.match(/^\/records\/([^/]+)(?:\/(draft|discard|create))?$/);
    if (!match) return send(res, 404, { error: "Unknown record route." });
    let key;
    try { key = decodeURIComponent(match[1]); } catch { return send(res, 400, { error: "Invalid record key." }); }
    let recordScope;try{recordScope=JSON.parse(key);if(!Array.isArray(recordScope)||recordScope.length!==2||recordScope.some(v=>typeof v!=='string')||recordScope[1].startsWith('$draft:'))throw new Error();}catch{return send(res,400,{error:"Invalid record key."});}
    const recordAccess=applicationConfig.navigation(user,recordScope[0]);if(recordAccess.status!==200)return send(res,recordAccess.status,{error:recordAccess.error});
    const recordPage=recordScope[1].split(':')[1];if(['form','billing','consultation'].includes(recordScope[1].split(':')[0])&&!recordAccess.body.pages.some(p=>p.id===recordPage))return send(res,403,{error:"Draft page is not available."});
    if (!key || key.length > 300) return send(res, 400, { error: "Invalid record key." });
    const action = req.method === "GET" && !match[2] ? "load" : req.method === "PUT" ? (match[2] ?? "save") : null;
    if (!action) return send(res, 405, { error: "Method not allowed." });
    let body;
    if (action !== "load") {
      try { body = await readJson(req, 262_144); } catch { return send(res, 400, { error: "Invalid or oversized record." }); }
    }
    if (sessions.get(token) !== user) return send(res, 401, { error: "Session ended." });
    if(action==='create'){try{const destination=JSON.parse(body.destinationKey);if(!Array.isArray(destination)||destination.length!==2||destination[0]!==recordScope[0]||typeof destination[1]!=='string'||destination[1].startsWith('$draft:')||destination[1].split(':').slice(0,2).join(':')!==recordScope[1].split(':').slice(0,2).join(':'))throw new Error();}catch{return send(res,400,{error:"Invalid destination key."});}}
    try {
      if (["save", "create"].includes(action) && body?.values && typeof body.values === "object") {
        let definition;
        try { const logical = JSON.parse(key)[1]; if (logical.startsWith("form:")) definition = PAGE_REGISTRY[logical.split(":")[1]]; } catch { /* Custom product adapters validate their own schemas. */ }
        if (definition) {
          const fieldErrors = validateForm(getEntitySchema(definition.entity, definition.title), body.values);
          if (Object.keys(fieldErrors).length) return send(res, 422, { error: "Complete the highlighted fields.", fieldErrors });
        }
      }
      const result = recordStore.handle(user, key, action, body);
      return send(res, result.status, result.body);
    } catch {
      return send(res, 500, { error: "Could not persist record." });
    }
  }

  if (pathname === "/navigation" || pathname === "/localization") {
    const user = sessions.get(bearer(req));
    if (!user) return send(res, 401, {error:"Not signed in."});
    if (req.method !== "GET") return send(res, 405, {error:"Method not allowed."});
    const productId = requestUrl.searchParams.get("productId");
    const result = pathname === "/navigation" ? applicationConfig.navigation(user,productId) : applicationConfig.localization(user,productId,requestUrl.searchParams.get("language"));
    if (result.error) return send(res,result.status,{error:result.error});
    if(pathname==="/navigation"){
      const preferred=preferenceStore.read(user,productId).preferences.defaultModule;
      const module=result.body.nodes.find(node=>node.kind==='module'&&node.moduleId===preferred);
      if(module){
        const descendants=new Set([module.id]);let size;
        do{size=descendants.size;for(const node of result.body.nodes)if(descendants.has(node.parentId))descendants.add(node.id);}while(size!==descendants.size);
        const pages=result.body.nodes.filter(node=>descendants.has(node.id)&&node.pageId).map(node=>node.pageId);
        const page=pages.find(id=>id===preferred+'-dashboard')??pages[0];
        if(page){result.body={...result.body,defaultModule:preferred,defaultPageId:page};result.body.revision=createHash('sha256').update(JSON.stringify(result.body)).digest('hex').slice(0,24);}
      }
    }
    const etag = `"${result.body.revision}"`;
    const headers = {"Cache-Control":"private, no-cache",ETag:etag,Vary:"Authorization, Accept-Encoding"};
    if (req.headers["if-none-match"] === etag) {res.writeHead(304,{...CORS,...headers});return res.end();}
    if (/\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {res.writeHead(200,{...CORS,...headers,"Content-Type":"application/json; charset=utf-8","Content-Encoding":"gzip"});return res.end(gzipSync(JSON.stringify(result.body)));}
    return send(res,200,result.body,headers);
  }

  if(pathname==="/monitoring/events"||pathname==="/monitoring/incidents"||/^\/monitoring\/incidents\/[^/]+$/.test(pathname)){
    const user=sessions.get(bearer(req));if(!user)return send(res,401,{error:"Not signed in."});
    const productId=req.headers["x-product-id"]??"nexora";const nav=applicationConfig.navigation(user,productId);if(nav.status!==200)return send(res,nav.status,{error:nav.error});
    const id=pathname.split('/')[3];
    const result=pathname==="/monitoring/events"?monitoringStore.ingest(user,productId,await readJson(req).catch(()=>null),new Set(nav.body.pages.map(p=>p.id))):id?(req.method==="PATCH"?monitoringStore.update(user,productId,id,await readJson(req).catch(()=>null)):monitoringStore.detail(user,productId,id)):monitoringStore.list(user,productId,requestUrl.searchParams);
    return send(res,result.status,result.body,{"Cache-Control":"no-store",...(result.status===429?{"Retry-After":"60"}:{})});
  }

  if (pathname === "/documentation" || pathname === "/documentation/state") {
    const user=sessions.get(bearer(req));
    if(!user)return send(res,401,{error:"Not signed in."});
    const productId=req.headers["x-product-id"] ?? "nexora";
    const result=pathname==="/documentation"?documentationStore.query(user,productId,requestUrl.searchParams):documentationStore.write(user,productId,await readJson(req).catch(()=>null));
    return send(res,result.status,result.body,{"Cache-Control":"private, no-store"});
  }

  if (pathname === "/preferences" || pathname === "/preference-policy") {
    const user=sessions.get(bearer(req));
    if(!user)return send(res,401,{error:"Not signed in."});
    const productId=req.headers["x-product-id"] ?? requestUrl.searchParams.get("productId") ?? "nexora";
    const available=applicationConfig.navigation(user,productId);
    if(available.status!==200)return send(res,available.status,{error:available.error});
    if(pathname==="/preference-policy"&&!canManagePreferences(user))return send(res,403,{error:"Only a tenant administrator can manage preference policies."});
    if(req.method==="GET")return send(res,200,pathname==="/preferences"?preferenceStore.read(user,productId):preferenceStore.policy(user,productId));
    const body=await readJson(req).catch(()=>null);
    const result=pathname==="/preferences"?preferenceStore.write(user,productId,body):preferenceStore.writePolicy(user,productId,body);
    return send(res,result.status,result.body);
  }

  if (pathname === "/layouts") {
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });

    if (req.method === "GET") {
      return send(res, 200, { layouts: layouts[user.id] ?? {} });
    }

    if (req.method === "PUT") {
      let body;
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: "Malformed request body." });
      }
      const pageId = typeof body.pageId === "string" ? body.pageId : "";
      const layout = body.layout;
      if (!pageId || layout === null || typeof layout !== "object" || Array.isArray(layout)) {
        return send(res, 400, { error: "Expected { pageId: string, layout: object }." });
      }
      if (!Array.isArray(layout.columns)) {
        return send(res, 400, { error: "layout.columns must be an array." });
      }
      /* One page per request, merged into the user's map. Accepting the whole
         map instead would let a stale client wipe layouts saved from another
         tab between its own read and write. */
      layouts[user.id] = { ...(layouts[user.id] ?? {}), [pageId]: layout };
      try {
        saveLayouts();
      } catch (error) {
        console.error("[layouts] write failed:", error.message);
        return send(res, 500, { error: "Could not persist the layout." });
      }
      return send(res,204);
    }

    return send(res, 405, { error: `${req.method} not allowed on /layouts.` });
  }

  if (pathname === "/ai/policy") {
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });

    if (req.method === "GET") {
      /* tenantId comes from the SESSION, never from the request. A tenant id in
         a query string or a body is ignored -- accepting one would make tenant
         isolation a client-side assertion, which is not isolation. */
      const tenantId = user.tenantId;
      const policy = policies[tenantId];
      if (!policy) {
        /* No policy for this tenant is a DENIAL, not a default-open. An absent
           configuration must never be the permissive case. */
        return send(res, 200, {
          tenantId,
          global: { platform: { allowed: false } },
          modules: {}, pages: {}, useCases: {},
          note: "No policy is configured for this tenant; AI is denied at the platform gate.",
        });
      }
      return send(res, 200, { tenantId, ...policy });
    }

    if (req.method === "PUT") {
      /* Spec §6.4: "admin only" has nothing to check here -- this application
         has no authorization layer. Failing closed is the only honest answer;
         accepting writes from any signed-in session would look like it works. */
      return send(res, 403, {
        error: "Policy writes require an administrator.",
        detail: "No authorization layer exists in this demo API. See spec §6.4.",
      });
    }

    return send(res, 405, { error: `${req.method} not allowed on /ai/policy.` });
  }

  if (pathname === "/approvals" && req.method === "POST") {
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    let body;try{body=await readJson(req,256*1024);}catch{return send(res,413,{error:"Approval request is too large or invalid."});}
    if(sessions.get(token)!==user)return send(res,401,{error:"Your session ended."});
    try{const result=approvalStore.handle(user,body);return send(res,result.status,result.body);}
    catch{return send(res,500,{error:"Approval could not be confirmed. Retry the same action to recover its result."});}
  }

  if (pathname === "/imports" && req.method === "POST") {
    const token=bearer(req),user=sessions.get(token);if(!user)return send(res,401,{error:"Not signed in."});
    let body;try{body=await readJson(req,3*1024*1024);}catch{return send(res,413,{error:"Import exceeds the service request limit."});}
    if(sessions.get(token)!==user)return send(res,401,{error:"Your session ended."});
    try{const result=importStore.handle(user,body);return send(res,result.status,result.body);}
    catch{return send(res,500,{error:"Import status could not be confirmed. Resume the import to check completed rows."});}
  }

  if (pathname === "/record-panels" && req.method === "POST") {
    const token=bearer(req), user=sessions.get(token);
    if(!user)return send(res,401,{error:"Not signed in."});
    let body;try{body=await readJson(req,3*1024*1024);}catch{return send(res,413,{error:"Invalid request or attachment larger than 2 MB."});}
    if(sessions.get(token)!==user)return send(res,401,{error:"Your session ended."});
    if (!Array.isArray(body?.scope) || body.scope.length!==3 || body.scope.some(value=>typeof value!=="string"||!value||value.length>200)) return send(res,400,{error:"A product, page and saved record are required."});
    const knownRecord=(pageId,id)=>{
      if(typeof pageId!=="string"||typeof id!=="string"||!Object.hasOwn(PAGE_REGISTRY,pageId))return false;
      const page=PAGE_REGISTRY[pageId];if(!page)return false;
      const config=getWorklistConfig(pageId,page.title,page.entity);
      return rowsWithSaved(user,body.scope[0],pageId,config).some(row=>String(row[config.primaryKey])===id);
    };
    if(!knownRecord(body.scope[1],body.scope[2]))return send(res,404,{error:"Save or select an existing record before using these panels."});
    if(body.action==='link'&&!knownRecord(body.pageId,body.recordId))return send(res,404,{error:"That related record was not found on the selected page."});
    try{const result=recordPanelsStore.handle(user,body);return send(res,result.status,result.body);}
    catch{return send(res,500,{error:"Record panels could not be saved. Retry the operation."});}
  }

  if (pathname === "/personal-views" && req.method === "POST") {
    const user = sessions.get(bearer(req));
    if (!user) return send(res, 401, { error: "Not signed in." });
    const body = await readJson(req).catch(() => null);
    if (!body || typeof body !== "object") return send(res, 400, { error: "Invalid view request." });
    try { const result = workspaceStore.views(user, body); return send(res, result.status, result.body); }
    catch { return send(res, 500, { error: "Could not save personal views." }); }
  }

  if (pathname === "/worklists/archive" && req.method === "POST") {
    const user = sessions.get(bearer(req));
    if (!user) return send(res, 401, { error: "Not signed in." });
    const body = await readJson(req).catch(() => null);
    if (!body || typeof body.pageId !== "string" || !body.pageId || (body.productId !== undefined && typeof body.productId !== "string") || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100 || body.ids.some(id => typeof id !== "string")) return send(res, 400, { error: "Select 1–100 record IDs." });
    try {
      const config = getWorklistConfig(body.pageId, typeof body.title === "string" ? body.title : body.pageId, typeof body.entity === "string" ? body.entity : "record");
      const rows = rowsWithSaved(user, body.productId ?? "nexora", body.pageId, config);
      const results = workspaceStore.archive(user, body.productId ?? "nexora", body.pageId, [...new Set(body.ids)], rows, config.primaryKey);
      return send(res, 200, { results });
    } catch { return send(res, 500, { error: "Could not archive records." }); }
  }

  /* ---- worklist search --------------------------------------------------- */
  if (pathname === "/worklists/search") {
    if (req.method !== "POST") return send(res, 405, { error: `${req.method} not allowed on /worklists/search.` });
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });

    const body = await readJson(req).catch(() => null);
    const pageId = typeof body?.pageId === "string" ? body.pageId : "";
    if (!pageId) return send(res, 400, { error: "A search needs a pageId." });

    /* Re-partitioned here rather than trusted. A client that has been edited
       can put a patient name in safeFilters, and believing it would log the
       value in full. */
    const declared = { ...(body?.safeFilters ?? {}), ...(body?.sensitiveFilters ?? {}) };
    const { safe, sensitive } = partitionOnServer(declared);

    /* The generator keys off title and entity as well as pageId, so calling it
       with the id alone builds a DIFFERENT dataset — 88 generic rows instead of
       the 96 the client is showing. A search that disagrees with the table it
       filters is worse than no search, and this one silently returned zero for
       a customer that was on screen. The caller passes what it rendered with. */
    const title = typeof body?.title === "string" && body.title ? body.title : pageId;
    const entity = typeof body?.entity === "string" && body.entity ? body.entity : "record";

    let config;
    try {
      config = getWorklistConfig(pageId, title, entity);
    } catch {
      return send(res, 404, { error: "That worklist does not exist." });
    }

    const filters = { ...safe, ...sensitive };
    /* Cell edits applied before filtering, not after: a row edited into a
       status is a row that status now matches. Without this the store was
       written by PATCH and read by nobody, so the server's idea of a cell and
       the client's diverged permanently and every later edit looked like a
       conflict. */
    const product = typeof body.productId === "string" ? body.productId : "nexora";
    const edited = rowsWithSaved(user, product, pageId, config).filter(row => !workspaceStore.isArchived(user, product, pageId, String(row[config.primaryKey]))).map(row => {
      const held = cellEdits.get(JSON.stringify([user.tenantId, product, pageId, String(row[config.primaryKey])]));
      return held ? { ...row, ...held.values } : row;
    });
    const rows = edited.filter(row => Object.entries(filters).every(([key, value]) => matchesRow(row, key, String(value), body.queryMode)));
    const sort = body.sort;
    if (sort && config.columns.some(column => column.key === sort.key)) rows.sort((a,b) => {
      const left=a[sort.key], right=b[sort.key];
      const compared=typeof left === "number" && typeof right === "number" ? left-right : String(left ?? "").localeCompare(String(right ?? ""), undefined, {numeric:true});
      return (sort.direction === "desc" ? -compared : compared) || String(a[config.primaryKey]).localeCompare(String(b[config.primaryKey]));
    });

    console.log(`[search] ${user.email ?? user.id} tenant=${user.tenantId} page=${pageId} ${loggableFilters(safe, sensitive)} -> ${rows.length}/${config.rows.length}`);

    const limit = Math.max(1, Math.min(Math.floor(Number(body?.pageSize ?? body?.limit)) || 200, 500));
    const page = Math.max(1, Math.min(Math.floor(Number(body?.page)) || 1, Math.max(1, Math.ceil(rows.length / limit))));
    return send(res, 200, {
      pageId,
      total: rows.length,
      rows: rows.slice((page - 1) * limit, page * limit),
      page, pageSize: limit,
      /* Echoed so a client can show what was applied without holding it in a
         URL. Keys only for the sensitive half, for the same reason the log
         does: this response passes through the same proxies. */
      applied: { safe, sensitiveKeys: Object.keys(sensitive).sort() },
    });
  }

  /* ---- inline cell edits -------------------------------------------------- */
  /**
   * One cell, changed in place, with an answer for two people changing it at once.
   *
   * Compare-and-swap on the FIELD: the client sends the value it was editing
   * from, and the write is refused if the cell no longer says that. A version
   * stamp would be the other way to do it and needs one that exists on every
   * row — these are generated and only some carry an `updated` column, so the
   * value the user was looking at is both simpler and the thing they would
   * actually be surprised by.
   *
   * Refused, not merged and not overwritten. Last-write-wins loses somebody's
   * work silently, which is the one outcome nobody can detect afterwards; the
   * refusal carries the current value so the user is not left to reload and
   * compare by eye.
   *
   * Held in memory only. The rows are generated rather than stored, so this
   * keeps the edits beside them; a restart forgets both, which is honest for a
   * prototype and is what the hardening ledger says about persistence anyway.
   */
  if (pathname.startsWith("/worklists/") && pathname !== "/worklists/search" && req.method === "PATCH") {
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });

    const [, , pagePart, recordPart] = pathname.split("/");
    let pageId, recordId;
    try { pageId = decodeURIComponent(pagePart ?? ""); recordId = decodeURIComponent(recordPart ?? ""); }
    catch { return send(res, 400, {error:"Invalid record address."}); }
    if (!pageId || !recordId) return send(res, 400, { error: "An edit needs a page and a record." });

    const body = await readJson(req).catch(() => null);
    const column = typeof body?.column === "string" ? body.column : "";
    const value = typeof body?.value === "string" ? body.value : "";
    const seen = typeof body?.seen === "string" ? body.seen : "";
    if (!column) return send(res, 400, { error: "An edit needs a column." });

    const product = typeof body?.productId === "string" ? body.productId : "nexora";
    const key = JSON.stringify([user.tenantId, product, pageId, recordId]);
    const held = cellEdits.get(key);

    /* The row as generated, so a first edit has a stamp to compare against
       without anything having been written yet. */
    let original;
    try {
      const config = getWorklistConfig(pageId, typeof body?.title === "string" && body.title ? body.title : pageId, typeof body?.entity === "string" && body.entity ? body.entity : "record");
      original = rowsWithSaved(user, product, pageId, config).find((row) => String(row[config.primaryKey]) === recordId);
    } catch { original = undefined; }
    if (!original) return send(res, 404, { error: "That record is not on this list." });

    const current = held?.values?.[column] ?? String(original[column] ?? "");
    if (seen !== current) {
      /* By column and by record, never the values: an audit line that quotes a
         cell is a copy of the cell. */
      console.log(`[edit] ${user.email ?? user.id} REFUSED ${pageId}/${recordId}.${column} — stale`);
      return send(res, 409, {
        error: "Someone changed this while you were editing.",
        current: { column, value: current },
      });
    }

    cellEdits.set(key, { values: { ...(held?.values ?? {}), [column]: value } });
    console.log(`[edit] ${user.email ?? user.id} ${pageId}/${recordId}.${column}`);
    return send(res, 200, { column, value });
  }

  /* ---- export audit ------------------------------------------------------ */
  /**
   * A file left the application. This is the only record that it did.
   *
   * By COLUMN KEY and by count, never by value — the same rule the search log
   * keeps, and for a stronger reason: an audit that copied the exported rows
   * would be a second copy of exactly what the audit exists to govern.
   *
   * Re-derived here rather than trusted. A client that has been edited can
   * claim it exported nothing sensitive, and believing it would record a clean
   * line for the export that mattered most.
   */
  if (pathname === "/report-schedules") {
    const user=sessions.get(bearer(req));
    if(!user)return send(res,401,{error:"Not signed in."});
    const body=await readJson(req).catch(()=>null);
    if(!body || !reportAccess(user,body))return send(res,403,{error:"Report is not available for this account."});
    if(body.action==="list")return send(res,200,reportScheduler.list(user,body.productId,body.pageId));
    if(body.action==="create") {
      try {const id=reportScheduler.create(user,body);return send(res,201,{id});}
      catch {return send(res,400,{error:"Check the schedule name, frequency and start time."});}
    }
    const listings=reportScheduler.list(user,body.productId,body.pageId);
    if(body.action==="toggle" && typeof body.enabled==="boolean" && listings.schedules.some(row=>row.id===body.id)) {
      return send(res,200,{updated:reportScheduler.enabled(user,body.id,body.enabled)});
    }
    if(body.action==="retry" && listings.deliveries.some(row=>row.id===body.id)) {
      return send(res,200,{updated:reportScheduler.retry(user,body.id)});
    }
    if(body.action==="download" && listings.deliveries.some(row=>row.id===body.id)) {
      const held=reportScheduler.download(user,body.id);
      if(!held)return send(res,404,{error:"Report delivery is not ready."});
      auditStore.append(user,"report.download",200,{jobId:body.id,pageId:body.pageId,rows:reportRows.length});
      return send(res,200,{filename:`report-${body.id}.csv`,content:held.content});
    }
    return send(res,400,{error:"Unknown report schedule action."});
  }
  if (pathname === "/audit") {
    const user=sessions.get(bearer(req));
    if(!user)return send(res,401,{error:"Not signed in."});
    if(refuseAdminWrite(user))return send(res,403,refuseAdminWrite(user));
    return send(res,200,{events:auditStore.list(user.tenantId,{before:requestUrl.searchParams.get("before"),limit:requestUrl.searchParams.get("limit")})});
  }
  if (pathname === "/exports") {
    if (req.method !== "POST") return send(res, 405, { error: `${req.method} not allowed on /exports.` });
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });

    const body = await readJson(req).catch(() => null);
    const pageId = typeof body?.pageId === "string" ? body.pageId : "";
    const columns = Array.isArray(body?.columns) ? body.columns.filter((key) => typeof key === "string") : [];
    if (!pageId) return send(res, 400, { error: "An export record needs a pageId." });

    const declared = columns
      .map((key) => ({ key, classification: DATA_CLASSIFICATIONS[key] ?? "unclassified" }))
      .filter((note) => note.classification !== "operational");
    const rows = Number(body?.rows) || 0;
    const withheld = Array.isArray(body?.withheld) ? body.withheld.filter((key) => typeof key === "string") : [];
    /* A file and a printed sheet are different events. A review looking for the
       file that walked out of the building would otherwise never find it,
       because there was never a file. */
    const via = body?.via === "print" ? "print" : "file";

    res.auditContext.metadata={pageId,columns,rows:Math.max(0,Math.floor(rows)),withheld,via};
    const summary = declared.map((note) => `${note.key}:${note.classification}`).join(",") || "none";
    console.log(`[export] ${user.email ?? user.id} tenant=${user.tenantId} via=${via} page=${pageId} rows=${rows} columns=${columns.length} sensitive=[${summary}]${withheld.length ? ` withheld=[${withheld.join(",")}]` : ""}`);

    /* 202: recorded, and the file was written by the browser before this was
       ever called. Reporting 201 would imply this endpoint had a say. */
    return send(res, 202, { recorded: true, via, sensitiveColumns: declared.length });
  }

  /* ---- reference data ---------------------------------------------------- */
  if (pathname === "/reference") {
    if (req.method !== "GET") return send(res, 405, { error: `${req.method} not allowed on /reference.` });
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });
    const asked = (requestUrl.searchParams.get("keys") ?? "").split(",").map((key) => key.trim()).filter(Boolean);
    const keys = asked.length > 0 ? asked : Object.keys(REFERENCE_SOURCES);
    return send(res, 200, loadReferences(keys));
  }

  /* ---- saved views ------------------------------------------------------ */
  if (pathname === "/views" || pathname.startsWith("/views/")) {
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });

    if (pathname === "/views" && req.method === "POST") {
      const body = await readJson(req).catch(() => null);
      const pageId = typeof body?.pageId === "string" ? body.pageId : "";
      const filters = body?.filters && typeof body.filters === "object" ? body.filters : null;
      if (!pageId || !filters) return send(res, 400, { error: "A saved view needs a pageId and filters." });

      const id = newViewId();
      const view = {
        id,
        /* Stamped from the SESSION, never from the request body. A tenant a
           client can assert is not isolation. */
        tenantId: user.tenantId,
        createdBy: user.id,
        pageId,
        label: typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : "Saved view",
        filters,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + VIEW_TTL_MS).toISOString(),
      };
      savedViews[id] = view;
      saveViews();
      auditView("created", user, view);
      /* The id and nothing else. The caller builds the link; the filters stay
         here. */
      return send(res, 201, { id, label: view.label, expiresAt: view.expiresAt });
    }

    if (pathname.startsWith("/views/") && req.method === "GET") {
      const id = pathname.slice("/views/".length);
      const view = savedViews[id];
      /* One answer for "does not exist", "belongs to someone else" and "has
         expired". A 403 on another tenant's id confirms the id is real, which
         is how you enumerate them. */
      const missing = { error: "That saved view is not available." };
      if (!view || view.tenantId !== user.tenantId) return send(res, 404, missing);
      if (Date.parse(view.expiresAt) < Date.now()) {
        delete savedViews[id];
        saveViews();
        return send(res, 404, missing);
      }
      auditView("opened", user, view);
      return send(res, 200, { id: view.id, pageId: view.pageId, label: view.label, filters: view.filters, expiresAt: view.expiresAt });
    }

    return send(res, 405, { error: `${req.method} not allowed on ${pathname}.` });
  }

  if (pathname === "/ai/config" || pathname === "/ai/config/credential" || pathname === "/ai/config/credential/verify") {
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });
    const tenantId = user.tenantId;

    if (pathname === "/ai/config/credential/verify") {
      if (req.method !== "POST") return send(res, 405, { error: `${req.method} not allowed on /ai/config/credential/verify.` });
      const refusal = refuseAdminWrite(user);
      if (refusal) return send(res, 403, refusal);
      const held = credentials[tenantId];
      if (!held) return send(res, 409, { error: "No credential is configured for this tenant." });
      /* This reaches the provider, so it spends from the same budget. An admin
         action that bypassed the limit would be the obvious way round it. */
      const rateRefusal = refuseForRate(tenantId);
      if (rateRefusal) return send(res, rateRefusal.status, rateRefusal.body, { "Retry-After": String(rateRefusal.retryAfter) });
      admit(tenantId);
      if (!perUserLimiter.admit(user))return send(res,429,{error:"Rate limit reached."},{"Retry-After":"60"});
      if(credentialExpired(held))return send(res,403,{error:"Provider credential has expired. Rotate it before use."});
      auditStore.append(user,"ai.verify-attempt",202);
      const result = await callProvider(aiConfig[tenantId], held.secret, [{ role: "user", content: "Reply with the single word: ok" }]);
      recordTokens(tenantId, result.usage?.total_tokens);
      /* Recorded so a bad key is diagnosable from the admin screen without
         anyone reading the key back to check it by eye. */
      held.lastVerifiedAt = result.ok ? new Date().toISOString() : (held.lastVerifiedAt ?? null);
      held.lastError = result.ok ? null : `${result.error} ${result.detail ?? ""}`.trim();
      saveCredentials();
      return send(res, result.ok ? 200 : (result.status ?? 502), credentialStatus(tenantId));
    }

    if (pathname === "/ai/config/credential") {
      /* Authorization precedes validation everywhere below: a caller who may
         not write must not learn whether their body was well formed. */
      if (req.method === "GET") return send(res, 200, credentialStatus(tenantId, url.searchParams.get("scope") ?? undefined));

      const refusal = refuseAdminWrite(user);

      if (req.method === "PUT") {
        if (refusal) return send(res, 403, refusal);
        let body;
        try {
          body = await readJson(req);
        } catch {
          return send(res, 400, { error: "Malformed request body." });
        }
        /* `secret`, matching the client and the canary check. The OTHER path,
           PUT /ai/config, rejects any body carrying a `credential` key, so the
           two names cannot be confused into working on the wrong endpoint. */
        const secret = typeof body?.secret === "string" ? body.secret.trim() : "";
        if (!secret) return send(res, 400, { error: "A credential is required.", detail: 'Send { "secret": "..." }.' });
        if (secret.length < 16) return send(res, 400, { error: "That does not look like a provider key.", detail: "Expected at least 16 characters." });
        /* Validated against the adapters, so a typo cannot create a credential
           for a provider that does not exist and then look configured. */
        const scope = typeof body?.scope === "string" ? body.scope : undefined;
        if (scope && !/^speech:(mock|openai|deepgram|azure)$/.test(scope)) {
          return send(res, 400, { error: "Unknown credential scope.", detail: `${scope} is not a provider this gateway knows.` });
        }
        const storeKey = credentialKey(tenantId, scope);
        const existing = credentials[storeKey];
        // Re-entering the same secret must not renew its rotation deadline.
        if(existing?.secret===secret)return send(res,200,credentialStatus(tenantId,scope));
        credentials[storeKey] = {
          secret,
          hint: secret.slice(-4),
          fingerprint: fingerprintOf(secret),
          setBy: user.email ?? user.id,
          /* setAt is when a key was FIRST set for this tenant; rotatedAt moves
             on every replacement. Collapsing them would lose the distinction
             between "configured months ago" and "changed this morning", which
             is the one an incident actually turns on. */
          setAt: existing?.setAt ?? new Date().toISOString(),
          rotatedAt: existing ? new Date().toISOString() : null,
          lastVerifiedAt: null,
          lastError: null,
        };
        saveCredentials();
        /* The status, never the value and never an echo of the body. */
        console.log(`[ai] credential set for ${storeKey} by ${user.email ?? user.id} (ending ${secret.slice(-4)})`);
        return send(res, 200, credentialStatus(tenantId, scope));
      }

      if (req.method === "DELETE") {
        if (refusal) return send(res, 403, refusal);
        const scope = url.searchParams.get("scope") ?? undefined;
        delete credentials[credentialKey(tenantId, scope)];
        saveCredentials();
        console.log(`[ai] credential removed for ${credentialKey(tenantId, scope)} by ${user.email ?? user.id}`);
        return send(res,204);
      }
      return send(res, 405, { error: `${req.method} not allowed on /ai/config/credential.` });
    }

    if (req.method === "GET") {
      const stored = aiConfig[tenantId];
      if (!stored) {
        return send(res, 404, { error: `No AI configuration for tenant ${tenantId}.` });
      }
      /* tenantId from the session, credential from the function that cannot
         hold one. Spread order matters: `credential` last, so a stray field of
         that name in the JSON file could never survive into the response. */
            /* Each speech provider carries its own status object, built by the same
         function as the main credential — four characters and a fingerprint,
         never a value. */
      const speech = stored.speech
        ? { ...stored.speech, providers: (stored.speech.providers ?? []).map((sp) => ({ ...sp, credential: credentialStatus(tenantId, `speech:${sp.id}`) })) }
        : undefined;
      return send(res, 200, { ...stored, tenantId, ...(speech ? { speech } : {}), credential: credentialStatus(tenantId) });
    }

    if (req.method === "PUT") {
      /* Authorization precedes validation. A caller who may not write should
         not learn whether their body was well formed, so this returns 403 and
         the credential-key check below is never reached in the stand-in. It is
         kept because it is part of the contract a real service must honour. */
      const refusal = refuseAdminWrite(user);
      if (refusal) return send(res, 403, refusal);

      let body;
      try {
        body = await readJson(req);
      } catch {
        return send(res, 400, { error: "Malformed request body." });
      }
      if (body && Object.prototype.hasOwnProperty.call(body, "credential")) {
        return send(res, 400, {
          error: "A credential cannot be set through /ai/config.",
          detail: "Use PUT /ai/config/credential, so only one path ever handles a secret.",
        });
      }
      aiConfig[tenantId] = { ...(aiConfig[tenantId] ?? {}), ...body };
      saveAiConfig();
      console.log(`[ai] config updated for ${tenantId} by ${user.email ?? user.id}: ${Object.keys(body).join(", ")}`);
      return send(res,204);
    }

    return send(res, 405, { error: `${req.method} not allowed on /ai/config.` });
  }

  /* Dispatch. The client sends an assembled, redacted context and a promptId;
     it never sends prompt text and never holds a key.

     Note what is NOT trusted from the body: the prompt (resolved here from the
     id), the tenant (taken from the session), and the field count (capped here
     against the configured limit). What IS trusted is the field list, because
     the client already had that data on screen -- it is the user's own record,
     not an escalation. */
  if (pathname === "/ai/dispatch") {
    if (req.method !== "POST") return send(res, 405, { error: `${req.method} not allowed on /ai/dispatch.` });
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });
    const tenantId = user.tenantId;

    let body;
    try {
      body = await readJson(req);
    } catch {
      return send(res, 400, { error: "Malformed request body." });
    }

    /* Ahead of prompt and credential validation on purpose: see the limiter's
       header. A malformed request is still a request, and a caller who retries
       for free on every 400 is not limited at all. */
    const refusal = refuseForRate(tenantId);
    if (refusal) {
      console.log(`[ai] refused ${user.email ?? user.id}: ${refusal.body.error}`);
      return send(res, refusal.status, refusal.body, { "Retry-After": String(refusal.retryAfter) });
    }
    admit(tenantId);

    if (!perUserLimiter.admit(user))return send(res,429,{error:"Rate limit reached."},{"Retry-After":"60"});
    const system = PROMPT_TEXT[body?.promptId];
    if (!system) {
      return send(res, 400, { error: "Unknown prompt.", detail: `No prompt is registered as ${body?.promptId ?? "(none)"}.` });
    }
    const held = credentials[tenantId];
    if (!held) {
      return send(res, 409, { error: "No provider credential is configured.", detail: "An administrator must set one through PUT /ai/config/credential." });
    }

    if(credentialExpired(held))return send(res,403,{error:"Provider credential has expired. Rotate it before use."});
    const page=PAGE_REGISTRY[body.pageId];
    const policy=policies[tenantId];
    if(!page || !policy || !resolveAi(gatesForPage({...policy,tenantId},{pageId:page.id,module:page.module,build:page.ai},true),body.useCaseId).allowed)
      return send(res,403,{error:"AI access is disabled for this request."});
    let redactedFields;
    try {redactedFields=redactProviderContext(body);} catch {return send(res,403,{error:"AI context is not approved for this provider."});}
    const config = aiConfig[tenantId];
    const limit = config?.limits?.maxContextFields ?? 24;
    const fields = redactedFields.slice(0, limit);
    if (!fields.length) {
      return send(res, 400, { error: "Nothing to send.", detail: "The assembled context held no fields." });
    }

    const lines = fields.map((f) => `${String(f?.label ?? "").slice(0, 120)}: ${String(f?.value ?? "").slice(0, 600)}`);
    const userInput = typeof body?.userInput === "string" && body.userInput.trim() ? `\n\nThe user asks: ${body.userInput.trim().slice(0, 500)}` : "";
    res.auditContext.metadata={pageId:body.pageId,useCaseId:body.useCaseId,fieldKeys:fields.map(field=>field.key),provider:config?.provider?.id};
    auditStore.append(user,"ai.egress-attempt",202,res.auditContext.metadata);
    const result = await callProvider(config, held.secret, [
      { role: "system", content: system },
      { role: "user", content: `Page: ${String(body?.pageId ?? "unknown")}\n\nFields:\n${lines.join("\n")}${userInput}` },
    ]);

    /* Audit metadata only. The fields themselves are the user's record and are
       deliberately not logged here -- this process has no retention policy and
       no log rotation, so anything written is written forever. */
    console.log(`[ai] dispatch ${body.useCaseId} on ${body.pageId} by ${user.email ?? user.id}: ${result.ok ? "ok" : "failed"} (${fields.length} fields${result.usage ? `, ${result.usage.total_tokens} tokens` : ""})`);

    if(result.usage?.total_tokens)res.auditContext.metadata.tokens=result.usage.total_tokens;
    if (!result.ok) {
      held.lastError = `${result.error} ${result.detail ?? ""}`.trim();
      saveCredentials();
      return send(res, result.status ?? 502, { error: result.error, detail: result.detail });
    }
    held.lastVerifiedAt = new Date().toISOString();
    held.lastError = null;
    saveCredentials();
    /* The provider's own count, not an estimate of ours. */
    recordTokens(tenantId, result.usage?.total_tokens);
    return send(res, 200, { ok: true, text: result.text, model: result.model, usage: result.usage });
  }

  /* So the limit is inspectable without reading the process's memory, and so a
     future admin screen has something real to render. */
  if (pathname === "/ai/usage") {
    if (req.method !== "GET") return send(res, 405, { error: `${req.method} not allowed on /ai/usage.` });
    const token = bearer(req);
    const user = token ? sessions.get(token) : undefined;
    if (!user) return send(res, 401, { error: "Not signed in." });
    const tenantId = user.tenantId;
    const limits = limitsFor(tenantId);
    const now = Date.now();
    const inWindow = (recentRequests.get(tenantId) ?? []).filter((at) => now - at < 60_000).length;
    return send(res, 200, {
      tenantId,
      day: utcDay(),
      requestsLastMinute: inWindow,
      requestsPerMinute: limits.requestsPerMinute,
      tokensUsedToday: tokensUsedToday(tenantId),
      tokensPerDay: limits.tokensPerDay,
      /* Stated, because a configured value of 0 or a missing config resolves to
         the default rather than to "no limit". */
      limitsAreDefaults: !aiConfig[tenantId]?.limits,
    });
  }

  if (req.method === "GET" && pathname === "/health") {
    return send(res, 200, { ok: true, sessions: sessions.size, profiles: Object.keys(preferences).length, layouts: Object.keys(layouts).length, aiTenants: Object.keys(policies).length, aiConfigured: Object.keys(aiConfig).length });
  }

  send(res, 404, { error: `No route for ${req.method} ${pathname}.` });
  } catch {
    if(!res.headersSent)send(res,503,{error:"Service is temporarily unavailable."});
    else res.end();
  }
});

/* ---------------------------------------------------------------------------
   Speech gateway.

   Audio of a patient talking is the most sensitive thing this system handles,
   and two rules are built in rather than written down: NO AUDIO IS EVER WRITTEN
   TO DISK, and NO TRANSCRIPT TEXT IS EVER LOGGED. The audit line carries who,
   when, how long, how many bytes and which provider — everything needed to
   answer "who recorded this consultation" and nothing of what was said.

   The token arrives in the first message, not the query string. Browsers cannot
   set headers on a WebSocket handshake, and the usual workaround — ?token=... —
   puts a bearer token into every access log and proxy trace it passes through.
   SESSION_START carries it instead.
   --------------------------------------------------------------------------- */
const SPEECH_MAX_SECONDS = 30 * 60;
const speechSessions = new Map();

server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  if(req.headers.origin && !allowedOrigins.has(req.headers.origin)){socket.destroy();return;}
  const key = req.headers["sec-websocket-key"];
  if (pathname !== "/speech" || !key) { socket.destroy(); return; }

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
    "\r\n",
  ].join("\r\n"));

  const session = { id: randomBytes(8).toString("hex"), user: null, started: 0, bytes: 0, sequence: 0, index: 0, paused: false, language: "en", provider: null };
  speechSessions.set(session.id, session);

  const finish = (reason) => {
    if (!speechSessions.delete(session.id)) return;
    if (session.user) {
      const seconds = session.started ? Math.round((Date.now() - session.started) / 1000) : 0;
      /* Metadata only. Never session content. */
      console.log(`[speech] ${reason} session=${session.id} user=${session.user.email ?? session.user.id} provider=${session.provider?.id ?? "none"} lang=${session.language} ${seconds}s ${session.bytes} bytes ${session.sequence} segments`);
    }
  };

  const { send } = attachSocket(socket, {
    onMessage: (message, reply, close) => {
      if (message.type === "SESSION_START") {
        const user = message.token ? sessions.get(message.token) : undefined;
        if (!user) { reply({ type: "ERROR", error: "Not signed in." }); close(); return; }
        session.user = user;
        session.started = Date.now();
        session.language = message.language === "ar" ? "ar" : "en";
        session.mime = typeof message.mime === "string" ? message.mime : "audio/webm";

        const tenantConfig = aiConfig[user.tenantId] ?? {};
        const providers = (tenantConfig.speech?.providers ?? []).map((p) => ({
          ...p, credentialConfigured: Boolean(credentials[`${user.tenantId}:speech:${p.id}`]),
        }));
        session.provider = chooseProvider(providers, session.language);

        if (!session.provider) {
          reply({ type: "ERROR", error: "No speech provider is available for this language.", detail: "Enable one under AI Administration, or configure its credential." });
          close(); return;
        }
        const adapter = ADAPTERS[session.provider.id];
        reply({
          type: "SESSION_READY",
          sessionId: session.id,
          provider: { id: session.provider.id, label: adapter?.label ?? session.provider.id, model: session.provider.model ?? null },
          /* The UI shows this. A transcript from an unexercised adapter must
             never be mistaken for one from a provider that has actually run. */
          verified: adapter?.verified === true,
          language: session.language,
        });
        console.log(`[speech] start session=${session.id} user=${user.email ?? user.id} provider=${session.provider.id} lang=${session.language}`);
        return;
      }
      if (!session.user) { close(); return; }
      if (message.type === "PAUSE") { session.paused = true; reply({ type: "PAUSED" }); return; }
      if (message.type === "RESUME") { session.paused = false; reply({ type: "RESUMED" }); return; }
      if (message.type === "STOP") { reply({ type: "SESSION_ENDED", segments: session.sequence, seconds: Math.round((Date.now() - session.started) / 1000) }); finish("stop"); close(); return; }
    },

    onAudio: async (chunk, reply, close) => {
      if (!session.user || session.paused) return;
      session.bytes += chunk.length;
      if ((Date.now() - session.started) / 1000 > SPEECH_MAX_SECONDS) {
        reply({ type: "ERROR", error: "Session exceeded the maximum length." });
        finish("timeout"); close(); return;
      }
      /* Keyed to audio actually arriving, so a dead microphone still looks dead
         rather than producing a transcript out of nothing. */
      /* ONE BINARY MESSAGE IS ONE COMPLETE AUDIO FILE. The client records in
         takes rather than timeslices, because a MediaRecorder chunk after the
         first has no container header and is undecodable alone — posting those
         individually returns "corrupted or unsupported", which looks exactly
         like a broken microphone and is not. */
      const at = (Date.now() - session.started) / 1000;
      const sequence = session.index + 1;
      session.index += 1;
      session.sequence = sequence;

      if (session.provider.id === "openai") {
        auditStore.append(session.user,"speech.refused",403,{provider:"openai"});
        reply({type:"ERROR",error:"Clinical speech delivery requires an approved provider contract."});
        return;
      }

      if (session.provider.id !== "mock") {
        reply({ type: "ERROR", error: `The ${session.provider.id} adapter is declared but not implemented here.`, detail: "OpenAI and the built-in mock are the adapters that run." });
        return;
      }

      const line = mockSegment(session.index - 1, session.language);
      reply({ type: "TRANSCRIPT_PARTIAL", sequence, speaker: line.speaker, text: line.text.slice(0, Math.ceil(line.text.length * 0.6)) + "…" });
      setTimeout(() => {
        send({ type: "TRANSCRIPT_FINAL", sequence, speaker: line.speaker, text: line.text, startTime: Number(at.toFixed(2)), endTime: Number((at + 2.4).toFixed(2)) });
      }, 900);
    },

    onClose: () => finish("closed"),
  });
});

let shuttingDown=false;
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
  if(shuttingDown)return;shuttingDown=true;
  server.close(async()=>{try{await teleconsultStore.close();await qualityStore.close();await pharmacyStore.close();await tenantAdminStore.close();await medbandStore.close();await rcmReferenceStore.close();await surgisuiteStore.close();await medslotStore.close();process.exit(0);}catch{process.exit(1);}});
  setTimeout(()=>process.exit(1),10000).unref();
});

server.listen(PORT, HOST, () => {
  console.log(`Nexora demo auth API listening on ${HOST}:${PORT}`);
  console.log(`  accounts: ${ACCOUNTS.map((a) => a.username).join(", ")}  (password == username)`);
});
