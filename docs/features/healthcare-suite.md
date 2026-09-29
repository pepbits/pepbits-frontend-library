# Healthcare Suite reference module

Feature ID: CAREPOINT-REFERENCE. State: implementation and local acceptance complete; deployment verification is tracked in the delivery record. This guide describes the source-backed CarePoint design imported under a distinct header module. It does not claim production readiness or acceptance of every CarePoint business flow.

## Purpose and coverage

The module is named **Healthcare Suite** and has the stable ID `reference-healthcare-suite`; it is separate from the existing **Healthcare** module. It preserves the CarePoint page presentation and user interactions while connecting data operations through the host API boundary. The module covers the front office, patient registration, appointments, encounters, simulated payer approval and eRx workflows, billing, invoices, contract pricing and operational setup.

The imported module exposes 23 static destinations from 17 page templates, including a dashboard; appointment board; patient list, registration and record; encounter list, creation and detail; approvals; hospital and pharmacy billing; invoice worklist; and contract pricing. Fourteen metadata-driven master entities provide worklists and dynamic create/view/edit routes: facilities, departments, specialties, providers/staff, payers, TPAs, plans, networks, price lists, stock items, services, resources, resource schedules and resource blocks.

## User workflow

1. Sign in through the host's existing demo authentication, then choose **Healthcare Suite** from the module selector if it is available in the current navigation.
2. Open a page from its navigation group: Front office, Billing, Insurance & pricing, Catalog, Organization or Scheduling setup.
3. Search or filter records, open a supported worklist or form, and use available page actions. Patient search supports MRN, name, mobile, national ID and email. Appointment booking uses a free resource slot; guests without an MRN can be registered at check-in.
4. For a new encounter, select a patient or today's appointment, choose department/specialty/provider, then choose cash or insurance and request the demo eligibility result. Ordering can show simulated coverage, prior approval and eRx states. Billing displays held lines and payment state.
5. Review API validation or failure messages and retry supported operations. The host controls which module/pages are offered for the authenticated demo user.

The UI menu is presentation and navigation. The demo host authenticates the actor and module access; the Healthcare Suite adapter checks tenant, product, branch, module, facility and role on every request. Its read roles are enterprise-admin, admin, operations-analyst, operations, finance-manager, finance and read-only; write roles are enterprise-admin, admin, operations-analyst and operations. This is the current demo policy only, not a production permission model. A visible route or client-supplied scope is not authorization. The module accepts host navigation through `ReferenceHealthcareSuiteModule({ path, host })`, with `HEALTHCARE_SUITE_NAV` and `healthcareSuiteRoutes` exports. It uses host preferences, including theme, density, direction, locale and format settings where supported. The source CarePoint shell (AppShell, Header and Sidebar) is replaced by the host shell; page and component layouts are retained. The original CarePoint README itself documents no authentication; identity and navigation come from the host integration.

## API and data boundary

The CarePoint source frontend has no mock data stores: it requests data and mutations through `/api`, with Next.js proxying requests to the NestJS API. That source API uses CSV tables as demo storage. The import preserves this boundary: page actions use the configured API contract, and browser-side mock data is not a substitute for API state. Demo CSV data and simulated business decisions are source-backed demo behavior.

The source API includes session/dashboard/health, generic masters and lookups, patients, appointments/scheduling, eligibility, encounters/orders, approvals, pricing/catalog/contracts, billing and invoices. The source API README documents `400 { message, fields }` field validation responses. A consuming host needs an API implementing the imported client contract and must enforce identity, scope and action authorization on every request.

Payer eligibility, prior approval and eRx behavior in the source API are simulations. There is no real payer connection, electronic prescribing service, claim submission, or production healthcare integration. The imported adapter keeps partitioned mutations in memory for the API process lifetime; restarting it reloads synthetic CSV fixtures. It is a demo data service, not a production backend.

## Compatibility and acceptance

The source is retained unchanged and identified by the [source inventory](../reference-import/healthcare-suite/SOURCE-INVENTORY.json). All 23 static destinations and five dynamic routes have passed authenticated browser checks, including patient registration, provider-slot booking, linked encounter check-in, catalog ordering/signing and paid invoice creation. This acceptance covers the documented fictional demo flow, not every possible source scenario. The source-reviewed English in-app guide inventory contains 23 authored entries in [PAGE-GUIDES.json](../reference-import/healthcare-suite/PAGE-GUIDES.json). Implementation-specific route coverage, tests and limitations belong in the [unreleased delivery record](../releases/unreleased/healthcare-suite-2026-09-29.md). Browser/business-flow acceptance, production API authorization, real payer/eRx/claims integration, publication and deployment remain separate evidence.
