# Enterprise frontend

A desktop-first frontend framework for building ERP, healthcare, school, POS and other SaaS applications from reusable TypeScript components and configurable page templates. Applications share a consistent workspace, design system, preferences, localization and integration contracts while supplying their own business rules and backend services.

The repository includes a Next.js web shell, a Vite desktop shell with Tauri support, shared workspace packages and a demo API. It is a frontend foundation and working demonstration environment—not a complete production ERP or hospital system.

## What you can build

- **ERP and business applications:** customer, supplier, employee and item masters; sales and purchase orders; inventory, transport, accounting and finance interfaces.
- **Healthcare applications:** patient search, registration, master records, 360° views, triage, consultation, admission, billing and claims interfaces.
- **School and service applications:** student and resource records, appointments, bookings, fees, cases and worklists using the same page families.
- **POS and workstation workflows:** scanner-assisted record lookup, barcode labels, receipt/report printing and configurable output routing.

Domain-specific rules and production integrations belong to the application using the framework. A template provides the page structure and interaction contract; it does not establish clinical, financial or regulatory acceptance.

## Features at a glance

| Area | High-level capabilities |
| --- | --- |
| Reference application modules | Reports, ERP1, ERP2, six School role views and a separate Healthcare Suite imported from CarePoint; demo data and business simulations remain API-owned |
| Healthcare Suite revenue cycle | Nine API-backed workspaces for claims, exchange, remittances, patient finance, packages, synthetic DRG/day-case, accounting, commercial approvals and receivables; dedicated HTTP simulators and durable synthetic source/RCM state |
| Application workspace | Multi-module navigation, backend-defined menus, application and branch context, workspace tabs, record navigation, search and command navigation |
| Shared component library | Form fields, textboxes, selects, radio buttons, checkboxes, date/time controls, calendars, cards, card grids, tables, dialogs, drawers, tabs and recovery messages |
| Developer Library | Grouped component demonstrations, copyable TypeScript examples, template previews, integration guidance and a List of pages catalog |
| Page engines and templates | Master records, queries, worklists, orders, bookings, cases/encounters, financial transactions, billing, reports, dashboards, workflows, scheduling and 360° entity views |
| Record experiences | Create/view/edit flows, structured validation, table/card results, filters, columns, sorting, pagination and configurable detail presentation where supported |
| Related record panels | Shared attachments, comments, related records and activity panels for reuse across applications |
| CSV imports | File preview, column mapping, required-field/format/duplicate checks, error review, progress, partial results and failed-row retry |
| Approvals | Submission, configurable stages and approver roles, approve/reject/request-changes comments, filtered inboxes, bulk actions, history and requester notifications |
| Preferences and policies | Personal settings, tenant defaults, grouped administrator policies, locked settings, API-backed default module selection and effective preference resolution |
| Themes and presentation | Theme colors, typography, independent shell/form/result scaling, density, component radius, navigation placement and supported list/form presentation options |
| Localization | English, Arabic, Hindi and Malayalam catalogs; RTL support; localized navigation, page text, backend messages and preference-based date/time/number formatting |
| Errors and recovery | Localized network, timeout, permission, validation and session errors; appropriate recovery actions, incident references and retained unsaved values |
| Draft recovery | Shared scoped drafts, restore/discard actions, last-saved time, outdated/conflicting draft handling and tenant storage/retention/sensitive-field policies |
| Sentinel monitoring | Shared error/exception collection, structured incident details and a demo monitoring API contract |
| Documentation and help | Contextual page help, Documentation Center, guided-tour metadata, release/patch articles, change alerts, translation revisions and documentation impact checks |
| Exports and reports | Shared export/print foundations, PDF and spreadsheet workflows, report templates and documented scheduled-report integration boundaries |
| Barcode and QR library | Backend-generated barcode/QR artifacts, patient bands, specimen/item labels, payment-link QR demonstrations, print profiles, copies and print history |
| Device integration | Keyboard-wedge scanner input, record resolution, workstation routing, receipt/report jobs, device policies, simulated event automation and typed native connector contracts |
| Identity device demos | Card/EID reader, passport scanner and one-to-one biometric verification workflows with request expiry, cancellation, mismatch handling and manual review |
| AI integration foundations | Shared AI configuration, client/UI packages and provider, context, credential and egress checks; feature-specific readiness remains documented separately |
| DCP form designer | Visual sections and fields, dependent dropdowns/value sets, bounded CSV/XLSX staging, repeatable fields, preview, demo lifecycle, shared recovery and a separate typed backend v1 runtime adapter; production host integration remains pending |
| Quality and delivery | TypeScript checks, component/API/browser tests, localization and architecture gates, isolated deployment packaging, release identity checks and rollback support |

Capabilities apply to their supported components and page engines; not every page exposes every action. See the [feature catalog](docs/features/README.md) for behavior, integration contracts and completion boundaries.

## Page Library and healthcare designs

The Library includes configurable templates alongside more detailed reference designs. The template families cover simple and full master records, transaction lists, orders, appointments, resource booking, worklists, billing, claims, consultation, reports and entity summaries.

Healthcare designs include:

- **Worklist Query, Master Record – Main and 360 Data:** patient lookup, demographic records and related patient information.
- **Billing Clinic:** prescription/order-to-bill workflows, invoice view/edit, payments and insurance context through the demo API.
- **Clinical Triage and consultation variants:** structured clinical documentation, patient context, section rails, orders and handoff flows.
- **OP Registration:** patient selection and verification, visit context, coverage/consent, review/check-in and care/checkout in one workspace.
- **Emergency Registration:** arrival, triage, registration, ED care and disposition, including conditional pathway fields.
- **Inpatient Admission:** admission context, bed selection/reservation, verification and post-admission documentation sections.
- **Consultation Entry and v2:** reference layouts with shared fields, section navigation, note preview, demo signing/addenda and structured order entry in v2.

Page Library screens reuse the host shell rather than embedding the reference HTML's sidebar. Applicable preferences and tenant locks flow through shared components. Some configurable examples use in-memory adapters; detailed API-backed pages use their documented endpoints and demo storage. Consult the feature guide before treating an example as a durable business workflow.

## Architecture

```text
Application shell and authenticated context
    → Backend navigation + typed page definitions
    → Shared page engines and feature workspaces
    → Shared UI components + effective preferences + localization
    → Typed data adapters
    → Demo API or application-owned production services
```

| Location | Responsibility |
| --- | --- |
| `desktop-clients/apps/web` | Next.js web application |
| `desktop-clients/apps/desktop` | Vite desktop-browser shell and Tauri integration |
| `desktop-clients/packages/ops-ui` | Reusable UI primitives and presentation foundations |
| `desktop-clients/packages/erp-config` | Typed definitions, navigation, preferences and localization contracts |
| `desktop-clients/packages/erp-data` | Data adapters and API integration |
| `desktop-clients/packages/erp-screens` | Shared screens, feature workspaces and page engines |
| `desktop-clients/packages/erp-shell` | Application shell and shared shell behavior |
| `desktop-clients/packages/workspace-core` | Workspace state and navigation foundations |
| `desktop-clients/packages/platform-ports` | Platform and device connector abstractions |
| `dummy-api` | Demo authentication, configuration, synthetic data and feature endpoints |
| `demo-pages` | Original design references; application pages are implemented through shared components |
| `docs` | Feature guides, architecture, development rules, testing and release evidence |

Canonical language catalogs live in `dummy-api/config/localization/shared/`; generated client fallbacks support the frontend. Navigation labels use stable menu/message identifiers. Many demo feature endpoints read CSV/JSON fixtures and persist scoped changes; storage behavior is feature-specific.

The isolated [frontend test site](https://frontend.test.pepbits.com) runs RCM release `20260929122358894-3da821b0` from source `4fec17b5b482732d3e418879c8a3450108a6515f`. Public RCM, original Suite and School checks passed (53/53, 49/49 and 28/28); see the [delivery record](docs/releases/unreleased/healthcare-suite-rcm-2026-09-29.md) for evidence and synthetic integration limits.

The `@pepbits/*` packages are private workspace packages. They are not automatically available from a public package registry.

## Integrating another application

1. Choose an existing page engine or reference layout that matches the workflow.
2. Define its fields, sections, actions and navigation using the established typed configuration.
3. Reuse shared components; add a shared primitive when a required control does not exist.
4. Inject an authenticated data adapter that calls your application's backend. Keep business validation, authorization and trusted tenant/user scope on the server.
5. Supply effective preferences, tenant policy and localization through the host contracts.
6. Register page help and translated messages, add relevant tests and document integration boundaries.

For physical devices, implement the appropriate platform connector and backend job contract. Browser print requests and simulated acknowledgements do not prove physical printing. Identity-reader demonstrations do not authenticate a real patient or connect to a government identity service.

## Local development

Use **Node.js 24 or newer**. Native Tauri development also requires the platform-specific Rust and system build prerequisites.

From the repository root:

```bash
cd desktop-clients
npm ci
npm run dev:stack       # demo API and web shell
# Alternatively:
# npm run dev:all       # demo API and both frontend shells
```

Default development ports are web `3100`, desktop browser `3101` and demo API `3200`. Use the fictional accounts shown on the demo login screen. Configure API URLs and deployment settings according to the [workspace README](desktop-clients/README.md) and [deployment guide](desktop-clients/docs/deployment.md).

Common verification commands:

```bash
# From desktop-clients:
npm run typecheck
npm test
npm run test:api
npm run ci             # full local pipeline; browser journeys are separate

# From the repository root:
node docs/tools/check-docs.mjs
```

Follow the [testing guide](docs/testing/README.md) for the appropriate scope and isolated API/browser setup. A browser-rendered desktop shell is not evidence of a tested native executable.

## Demo sites and delivery status

- [Web demo](https://front-design.pepbits.com)
- [Desktop-browser demo](https://desktop.front-design.pepbits.com)

Latest recorded demo release: `20260912002147213-851cb66e` (DCP designer layout). The [13 September documentation audit](docs/releases/unreleased/documentation-audit-2026-09-13.md) records remaining documentation and hosted-test gaps.

Use the [delivery records](docs/releases/unreleased/README.md) to identify the source, deployment and checks for a particular change. Local builds, remote CI, public deployment and production acceptance are recorded separately.

Production identity, payer/payment gateways, clinical systems, real device SDKs, scheduled delivery, durable audit infrastructure and AI integrations require their documented application-specific configuration and acceptance. Native-speaker terminology review remains separate from automated catalog checks. Use synthetic data in the demo environment.

## Documentation and contribution rules

Start with the **[documentation index](docs/README.md)**.

- [Feature and user guides](docs/features/README.md)
- [Architecture and integration flows](docs/architecture/README.md)
- [Developer and agent rules](AGENTS.md)
- [Component, preference and documentation rules](docs/development/RULES.md)
- [Development workflow](docs/development/README.md)
- [Testing and acceptance](docs/testing/README.md)
- [Documentation lifecycle](docs/documentation/README.md)
- [Release and delivery evidence](docs/releases/unreleased/README.md)
- [Illustrated handbook and PDF](desktop-clients/docs/handbook/README.md)

Changes should reuse established package boundaries, honor effective preferences and tenant locks, update canonical translations and keep page help, examples, tests and release evidence aligned with the behavior delivered.
