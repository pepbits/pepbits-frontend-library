# @pepbits/reference-reports

The Lumen Reports reference frontend imported as a reusable module for an existing host shell. All 19 source
page routes and their features are preserved: report library, report viewer (filters, range meter, drill-down
links, saved views, favourites, column picker, charts, paged/sorted table with totals, exports, print, email,
background runs, schedules), report builder with preview and delete, background jobs with stored result pages
and downloads, schedules (create, pause/resume, run now, delete, due processing), dashboards (create, edit,
widgets, share, delete), email-in simulation, API keys, and administration (roles and access matrix, users,
settings and rules, data sources, audit log, email outbox).

It is not an iframe, HTML injection, standalone app or nested shell: the module renders inside the host's page
frame, uses the host's authentication, navigation, theme, localisation and effective preferences, and talks to
its API only through the host adapter.

Source: `/home/pepadmin/pb/saas/reference/frontend/reports/lumen-reports` (read-only), pinned in
`docs/reference-import/SOURCE-INVENTORY.json` (reports `sourceDigest` `fb171a25…19134`). `src/lib/data/*` is
missing from that inventory (data-folder exclusion); its digests are recorded in
`dummy-api/reference-reports-fixtures.json` → `source.files`. Imported against base commit `a9703f1`.

## Public contract

```tsx
import { ReferenceReportsModule, REFERENCE_REPORTS_ROUTES } from '@pepbits/reference-reports';

<ReferenceReportsModule path="/reports/payer-mix" host={host} />
```

| Export | Purpose |
| --- | --- |
| `ReferenceReportsModule({ path, host }: ReferenceModuleProps)` | Module root. `path` is module-relative (`/`, `/reports/:id`, `/admin/audit?q=…`). |
| `REFERENCE_REPORTS_ROUTES: ReferenceRoute[]` | Every destination: 15 static routes plus dynamic exemplars (28 `/reports/:id`, `/builder/new`, 3 seeded `/dashboards/:id`). `/jobs/:id` ids exist only at run time. |
| `REPORTS_ROUTE_DEFINITIONS`, `matchReportsRoute`, `loaderPath` | Route → source file → loader map (below). |
| `REPORTS_NAVIGATION`, `visibleReportsNavigation` | Source sidebar entries as data for the host's own navigation (no module sidebar). |
| `createReportsClient`, `ApiError`, `toApiError` | The typed adapter over `host.request` / `host.fetch`. |
| `./styles.css` | The module stylesheet (also imported by the module root). |

Host requirements (`@pepbits/reference-host`):

- `host.request(path, init)` resolves JSON and rejects with an error carrying `status` and the parsed body
  (`details`, `body` or `data`) so `{ error, code, details }` survive. The viewer depends on `code:
  'ASYNC_REQUIRED'`, `TOO_MANY_JOBS`, `PAGE_DENIED`, `REPORT_DENIED`, `BUILDER_REDIRECT`, `INACTIVE`.
- `host.fetch` (optional) returns a `Response` for file downloads. Without it export/download buttons are
  disabled; background runs and on-screen reports still work.
- The module keeps the source's original `/api/...` paths; the host namespaces them to
  `/reference-modules/reports/api/...`.
- `host.scope` keys the whole module (`referenceScopeKey`): a tenant, application, branch, user or role change
  remounts it and drops in-flight results. Scope is routing metadata only; the server derives authority from the
  authenticated user.

## Routes, sources and loaders

Server components became client pages that call a loader endpoint returning exactly the props the source page
passed to its client component. `requirePagePerm` redirects become `navigate('/?denied=1')`, report denial
`/reports?denied=1`, a foreign builder report `/builder`; `notFound()` renders the ported not-found state.

| Route | Source | Loader | Page component |
| --- | --- | --- | --- |
| `/login` | `app/login/page.tsx`, `LoginForm.tsx` | `/api/page/login` | `LoginBoundaryPage` — delegated host sign-in boundary; no password form. `?next=` continues to a module path. |
| `/` | `app/(app)/page.tsx` | `/api/page/overview` | `OverviewPage` |
| `/reports` | `reports/page.tsx` + `ReportLibrary.tsx` | `/api/page/reports` | `LibraryPage` |
| `/reports/:id` | `reports/[id]/page.tsx` + `ReportViewer.tsx`, `FilterBar.tsx`, `dialogs.tsx`, `Charts.tsx` | `/api/page/reports/:id` | `ReportPage` |
| `/builder` | `builder/page.tsx` + `DeleteDefinitionButton.tsx` | `/api/page/builder` | `BuilderListPage` (reports.build) |
| `/builder/:id` (`new`) | `builder/[id]/page.tsx` + `ReportBuilder.tsx` | `/api/page/builder/:id` | `BuilderEditPage` (reports.build) |
| `/dashboards` | `dashboards/page.tsx` + `NewDashboardButton.tsx` | `/api/page/dashboards` | `DashboardsPage` |
| `/dashboards/:id` | `dashboards/[id]/page.tsx` + `DashboardView.tsx` | `/api/page/dashboards/:id` | `DashboardPage` |
| `/jobs` | `jobs/page.tsx` + `JobsTable.tsx` | `/api/page/jobs` | `JobsPage` |
| `/jobs/:id` | `jobs/[id]/page.tsx` + `JobResults.tsx` | `/api/page/jobs/:id` | `JobPage` (re-reads every 2.5 s while queued/running) |
| `/schedules` | `schedules/page.tsx` + `SchedulesPanel.tsx` | `/api/page/schedules` | `SchedulesPage` |
| `/email-in` | `email-in/page.tsx` + `EmailInPanel.tsx` | `/api/page/email-in` | `EmailInPage` |
| `/api-keys` | `api-keys/page.tsx` + `ApiKeysPanel.tsx` | `/api/page/api-keys` | `ApiKeysPage` |
| `/admin/access` | `admin/access/page.tsx` + `AccessControl.tsx` | `/api/page/admin/access` | `AdminAccessPage` (admin.access) |
| `/admin/users` | `admin/users/page.tsx` + `UsersAdmin.tsx` | `/api/page/admin/users` | `AdminUsersPage` (admin.users) |
| `/admin/settings` | `admin/settings/page.tsx` + `SettingsForm.tsx` | `/api/page/admin/settings` | `AdminSettingsPage` (admin.settings) |
| `/admin/sources` | `admin/sources/page.tsx` | `/api/page/admin/sources` | `AdminSourcesPage` (admin.sources) |
| `/admin/audit` | `admin/audit/page.tsx` | `/api/page/admin/audit?q=&action=` | `AdminAuditPage` (audit.view) |
| `/admin/outbox` | `admin/outbox/page.tsx` | `/api/page/admin/outbox` | `AdminOutboxPage` (audit.view) |

`(app)/layout.tsx` → `/api/session` (user, roles, accessible reports, organisation). `(app)/error.tsx` and
`not-found.tsx` → `pages/common.tsx`. Shell components: `Sidebar`/`Header` user menu/sign-out/`Footer` frame are
replaced by the host shell; the header's report search (`CommandPalette`, opened with Ctrl/⌘+Shift+K because
the host owns ⌘K) and background-job indicator, and the footer's time-zone/synthetic-data note, are kept as
module content (`shell/ModuleBar.tsx`).

Source `components/ui/*` became bridges over `@pepbits/ops-ui` (`ui/primitives.tsx`: Button, Card, Badge,
Input/Select/Textarea/Toggle/Checkbox/MultiSelect, Modal; `ui/DataTable.tsx`: Table, Pagination; `SearchInput`,
`ActionMenu`, `ConfirmDialog` replace ad-hoc menus and `window.confirm`). Charts stay specialised SVG
(CMP-04: no shared chart primitive) with token colours, `<title>` per mark and accessible names.
`lib/types.ts` and `lib/engine/expression.ts` are verbatim copies; `lib/dates.ts` is a luxon-free port.

## Preferences and policy

| Preference | Where it applies |
| --- | --- |
| `pageSize` + tenant lock/allowed values | Initial page size of the viewer and stored-result pages; a preference/policy change resets it; locked → size control disabled and handler guarded (`useManagedPageSize`). The organisation "Rows per page" setting now only drives API pulls. |
| `density`, `zebraStripes`, `stickyTableHeader`, `wrapCellText` | Every table via ops-ui `Table` and the host `PresentationProvider`. |
| `currencyCode`, `numberLocale`, `decimalPlaces`, `dateFormat`, `timeFormat`, `currencyDisplay`, `negativeStyle`, `language` | All displayed values via `createFormatters(host.preferences)` (`useReportFormat`). Instants are shown in the organisation's reporting time zone, as in the source. Native date/time inputs keep ISO values. |
| `exportFormat` (+ lock/allowed values) | Export menu, background and schedule dialogs list the preferred format first; a locked or restricted policy hides other formats. Server actions still decide what the role may export. |
| `keyboardShortcuts`, `showKeyboardHints` | The module search shortcut is bound only while enabled and detached otherwise. |
| `reducedMotion` | `data-reduced-motion` on the module root stops animations/transitions (plus `prefers-reduced-motion`). |
| `toastPosition`, `toastDuration`, `toastStyle`, `maxVisibleToasts` | Module toasts. |
| `loadingSkeletons` | Loading states use ops-ui skeletons or a plain status. |
| Theme, font, `cornerRadius`, form/result/shell scales | `reports.css` uses only semantic tokens, `--font-ui`, `--radius`, `--fs-scale`/`--fs-form`/`--fs-result`/`--fs-shell`, all scoped under `.lumen-reports` (no global resets). The `button { font, color: inherit }` reset is wrapped in `:where()` so it never outweighs an ops-ui variant class (e.g. primary buttons' white text) by specificity, regardless of stylesheet load order. |

No source `localStorage` preference exists; none was added. Human text passes through `useLocalization().t`
(or ops-ui components that translate their string props) with the English source string as the stable key;
canonical catalog entries are left to the integration owner.

## API inventory (demo store)

Implemented by `dummy-api/reference-reports-store.mjs` (`createReferenceReportsStore().handle(user, scope,
{ method, path, query, body, headers })` → `{ status, body }` or `{ status, headers, body: Buffer }` for files).
Paths may include the `/reference-modules/reports` prefix. Error bodies keep the source shape
`{ error, code?, details? }`.

The store also exports `authenticateApiKey(secret)` for `/api/v1/...` BI pulls, which have no host session: it
looks the raw `lmn_…` secret up across every tenant/application/branch partition by hash and returns the
trusted `{ user, scope }` the key was created under, or `null` for an unrecognised, revoked (deleted) or
disallowed (deactivated owner) key. Nothing is taken from client-supplied scope. A router with no bearer
session calls this only for `/api/v1/...` paths, before its normal session resolution, then passes the result
into `handle` (which still forwards the request's own key header into the matched route — the BI routes keep
authenticating by key alone, as the source does). Role and permissions are read live at call time, not cached
from key creation.

A host role with no `roleMap` option that is not in `DEFAULT_ROLE_MAP` is denied (403 `UNKNOWN_ROLE`) the first
time that user is provisioned, instead of silently receiving the Analyst default; a user with no role at all
still gets Analyst. A configured `roleMap` owns authorization for every role it returns, known or not.

| Method | Path | Source contract | Purpose |
| --- | --- | --- | --- |
| GET | `/api/session` | `(app)/layout.tsx` | Shell context: user, roles, accessible reports, organisation |
| GET | `/api/page/overview` | `(app)/page.tsx` | Overview loader |
| GET | `/api/page/login` | `login/page.tsx` | Delegated sign-in boundary (organisation name only) |
| GET | `/api/page/reports` | `(app)/reports/page.tsx` | Report library loader |
| GET | `/api/page/reports/:id` | `(app)/reports/[id]/page.tsx` | Report viewer loader |
| GET | `/api/page/builder` | `(app)/builder/page.tsx` | Custom report list loader |
| GET | `/api/page/builder/:id` | `(app)/builder/[id]/page.tsx` | Builder loader (id "new" for a new report) |
| GET | `/api/page/dashboards` | `(app)/dashboards/page.tsx` | Dashboard list loader |
| GET | `/api/page/dashboards/:id` | `(app)/dashboards/[id]/page.tsx` | Dashboard loader |
| GET | `/api/page/jobs` | `(app)/jobs/page.tsx` | My reports loader |
| GET | `/api/page/jobs/:id` | `(app)/jobs/[id]/page.tsx` | Background result loader |
| GET | `/api/page/schedules` | `(app)/schedules/page.tsx` | Schedules loader |
| GET | `/api/page/email-in` | `(app)/email-in/page.tsx` | Email requests loader |
| GET | `/api/page/api-keys` | `(app)/api-keys/page.tsx` | API keys loader |
| GET | `/api/page/admin/access` | `(app)/admin/access/page.tsx` | Roles and access loader (admin.access) |
| GET | `/api/page/admin/users` | `(app)/admin/users/page.tsx` | Users loader (admin.users) |
| GET | `/api/page/admin/settings` | `(app)/admin/settings/page.tsx` | Settings loader (admin.settings) |
| GET | `/api/page/admin/sources` | `(app)/admin/sources/page.tsx` | Data sources loader (admin.sources) |
| GET | `/api/page/admin/audit` | `(app)/admin/audit/page.tsx` | Audit loader, ?q=&action= (audit.view) |
| GET | `/api/page/admin/outbox` | `(app)/admin/outbox/page.tsx` | Outbox loader (audit.view) |
| GET | `/api/account/keys` | `api/account/keys/route.ts` | List own API keys (no hashes) |
| POST | `/api/account/keys` | `api/account/keys/route.ts` | Create API key; secret returned once |
| DELETE | `/api/account/keys/:id` | `api/account/keys/[id]/route.ts` | Revoke API key |
| PUT | `/api/admin/grants` | `api/admin/grants/route.ts` | Replace report grants for a role |
| PUT | `/api/admin/roles` | `api/admin/roles/route.ts` | Create or update a role |
| DELETE | `/api/admin/roles` | `api/admin/roles/route.ts` | Delete a role, ?id= |
| PUT | `/api/admin/settings` | `api/admin/settings/route.ts` | Replace settings |
| GET | `/api/admin/users` | `api/admin/users/route.ts` | List users |
| POST | `/api/admin/users` | `api/admin/users/route.ts` | Create user (directory record; no sign-in) |
| PATCH | `/api/admin/users/:id` | `api/admin/users/[id]/route.ts` | Update user roles, branches, activation |
| POST | `/api/auth/login` | `api/auth/login/route.ts` | Delegated to the host: 410 HOST_AUTH |
| POST | `/api/auth/logout` | `api/auth/logout/route.ts` | Delegated to the host: 410 HOST_AUTH |
| POST | `/api/builder/preview` | `api/builder/preview/route.ts` | Preview an unsaved definition (25 rows) |
| POST | `/api/cron` | `api/cron/route.ts` | Process due schedules (administrator) |
| GET | `/api/dashboards` | `api/dashboards/route.ts` | List visible dashboards |
| POST | `/api/dashboards` | `api/dashboards/route.ts` | Create dashboard |
| PUT | `/api/dashboards/:id` | `api/dashboards/[id]/route.ts` | Save dashboard and widgets |
| DELETE | `/api/dashboards/:id` | `api/dashboards/[id]/route.ts` | Delete dashboard |
| POST | `/api/definitions` | `api/definitions/route.ts` | Create custom report |
| PUT | `/api/definitions/:id` | `api/definitions/[id]/route.ts` | Update custom report |
| DELETE | `/api/definitions/:id` | `api/definitions/[id]/route.ts` | Delete custom report |
| GET | `/api/downloads/:token` | `api/downloads/[token]/route.ts` | Signed link download (owner, recipient or admin) |
| POST | `/api/email-in/simulate` | `api/email-in/simulate/route.ts` | Simulate an inbound email request |
| POST | `/api/favorites` | `api/favorites/route.ts` | Toggle favorite |
| POST | `/api/inbound-email` | `api/inbound-email/route.ts` | Inbound webhook; requires X-Inbound-Secret and a configured secret |
| GET | `/api/jobs` | `api/jobs/route.ts` | List jobs, ?all=1 (admin) &active=1 |
| POST | `/api/jobs` | `api/jobs/route.ts` | Queue background report |
| GET | `/api/jobs/:id` | `api/jobs/[id]/route.ts` | Job status |
| DELETE | `/api/jobs/:id` | `api/jobs/[id]/route.ts` | Cancel job |
| GET | `/api/jobs/:id/results` | `api/jobs/[id]/results/route.ts` | Page through stored result |
| GET | `/api/jobs/:id/download` | `api/jobs/[id]/download/route.ts` | Download job file |
| POST | `/api/reports/:id/run` | `api/reports/[id]/run/route.ts` | Run report on screen |
| POST | `/api/reports/:id/export` | `api/reports/[id]/export/route.ts` | Export CSV/XLSX/JSON |
| GET | `/api/reports/:id/views` | `api/reports/[id]/views/route.ts` | List saved views |
| POST | `/api/reports/:id/views` | `api/reports/[id]/views/route.ts` | Save view |
| PATCH | `/api/schedules/:id` | `api/schedules/[id]/route.ts` | Pause, resume or edit schedule |
| DELETE | `/api/schedules/:id` | `api/schedules/[id]/route.ts` | Delete schedule |
| POST | `/api/schedules/:id/run` | `api/schedules/[id]/run/route.ts` | Run schedule now |
| GET | `/api/schedules` | `api/schedules/route.ts` | List schedules |
| POST | `/api/schedules` | `api/schedules/route.ts` | Create schedule |
| GET | `/api/v1/reports` | `api/v1/reports/route.ts` | BI catalogue; API key in X-Reports-Api-Key or Authorization: Bearer lmn_… |
| GET | `/api/v1/reports/:id` | `api/v1/reports/[id]/route.ts` | BI data pull (json or ?format=csv); API key |
| DELETE | `/api/views/:id` | `api/views/[id]/route.ts` | Delete saved view |

Store behaviour: state is partitioned by tenant (from the trusted user), application and branch (from
router-validated scope); favourites, personal views, API keys and jobs are further keyed by user. Report
definitions, role views, dashboards, schedules, grants and settings are shared within the partition. The host
user is provisioned into the partition on first request with roles from `DEFAULT_ROLE_MAP`
(`enterprise-admin` → Administrator, `finance-manager` → Finance manager, `operations-analyst` → Operations
manager, anything else → Analyst) or an injected `roleMap`; administrators can then change roles, branches and
activation. The seven fictional Lumen directory users, dashboards, schedule, grants, settings and favourites come
from `dummy-api/reference-reports-fixtures.json`. Every endpoint re-checks role permissions, per-report actions,
branch row scope and masking (`data.unmask`), validates input (zod rules ported to a small validator), records
audit entries, and applies the source limits (on-screen guard, per-user and server job limits, recipient
domains, email-in auth and rate limits, retention).

Dependency replacements: luxon → Intl-based calendar maths; zod → `Validator`; exceljs → a minimal
dependency-free XLSX (SpreadsheetML in a stored ZIP) with formula-injection neutralisation; nodemailer → outbox
record; fs job files → in-memory result pages; `setInterval` scheduler and worker → request-driven steps.

## Verification (this working tree, 28 September 2026)

- `node --test dummy-api/reference-reports-store.test.mjs` (Node 24.21.0): 19 tests, 19 passed. Adds coverage
  for `authenticateApiKey` (cross-partition lookup, no client scope, live role grants, revoked/deactivated
  rejection) and the unknown-host-role denial.
- Vitest 3.2.7 (jsdom), this worktree's own `desktop-clients/node_modules` (workspace-linked, no alias
  config needed): `src/routes.test.ts` (5) and `src/module.test.tsx` (17), 22 passed. Adds coverage for the
  page-size policy's `allowedValues` restriction and a tenant lock that starts after the report is already
  mounted. The module tests render the public component with a host adapter backed by the real demo store.
- TypeScript (`tsc --noEmit`, strict, repo `tsconfig.base.json`) over `src` including tests: no errors.
- `node scripts/verify-form-controls.mjs` and `node scripts/verify-shared-components.mjs` (from
  `desktop-clients`): no offenders under `packages/reference-reports` (both gates also scan sibling reference
  packages owned elsewhere; their unrelated failures are out of this package's scope).

The shared frontend suite passed 1,850 tests before the authenticated download addition. The HTTP boundary test also
passes generated-key, revocation, inbound-secret, application, branch and trusted-role checks. Final host builds
and browser evidence are recorded separately in the import release evidence.

## Limitations

- Fictional in-memory demo: no database, restart loses state; no email is sent (outbox records `not_sent`); no
  background scheduler (administrator "Process due schedules now" or "Run now"); jobs advance per request.
- Signed links open the authenticated module route `/downloads/:token`. The outbox converts only known
  module download links into host links; mail text remains escaped. The Download action uses the injected
  host fetch, preserving owner/recipient/admin checks, branch scope, signature and expiry validation.
  This small host adaptation supplements the 19 original page routes without adding another shell.
- BI endpoints (`/api/v1/...`) accept a generated API key in `X-Reports-Api-Key` or bearer authorization.
  The router resolves the trusted key owner and application/branch scope; client tenant headers do not grant
  authority. `/api/inbound-email` uses `X-Inbound-Secret`, configured through
  `REFERENCE_REPORTS_INBOUND_SECRET`, and a server-configured trusted identity.
- User passwords in the Users screen are validated for contract parity but never stored; sign-in is the host's.
- The organisation locale/currency settings label exports; on-screen formatting follows each user's preferences.
- Print uses `window.print()`; the module hides its own controls, the host shell controls its chrome.
- Labels pass through canonical English/Arabic/Hindi/Malayalam catalogs. Machine translation coverage is
  checked for keys and placeholders; native terminology review remains pending.
