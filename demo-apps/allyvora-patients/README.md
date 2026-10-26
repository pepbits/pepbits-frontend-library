# AllyVora patient registration demo

Private `@pepbits-demo/allyvora-patients`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6e-6 ports **AllyVora patient registration** from `source/allyvora-patients`: the patient register, registration, record view, editing and the administrator's form-layout designer. All patients, numbers and organisations are **fictional demonstration data**. This is a local build/run, not a deployment or clinical acceptance.

## Run locally

Two unchanged APIs are involved:

- the shared demo API (`mock-api`, Node 24) for sign-in, preferences/tenant policy and runtime localization catalogs, as in the healthcare and ERP demos;
- AllyVora's own Express + SQLite API (`source/allyvora-patients/backend`) for patients, reference lists, MRN numbering and the organisation form layout.

```sh
npm install                                    # repository root
(cd source/allyvora-patients && npm ci -w backend && cd backend && node scripts/build.mjs)
PORT=4000 DB_PATH=/tmp/allyvora-demo.db node source/allyvora-patients/backend/dist/server.js
node mock-api/server.mjs                      # Node 24; see mock-api/README.md
```

Then create an ignored `demo-apps/allyvora-patients/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
ALLYVORA_HOST_API_URL=http://127.0.0.1:3200
NEXT_PUBLIC_ALLYVORA_API_URL=/allyvora-api
ALLYVORA_API_URL=http://127.0.0.1:4000
```

and run `npm run dev -w @pepbits-demo/allyvora-patients` (port **3400**). `NEXT_PUBLIC_*` values are build-time configuration; `ALLYVORA_HOST_API_URL` and `ALLYVORA_API_URL` are server-only origins for the two same-origin proxy routes (`/api/*` and `/allyvora-api/*` → `<origin>/api/*`). `NEXT_PUBLIC_ALLYVORA_API_URL` may instead name the AllyVora API's own `/api` URL when its `CORS_ORIGIN` allows the app; it defaults to the `/allyvora-api` proxy. Components never build URLs. Fixture credentials stay in the API fixtures and are omitted here.

Scripts are `dev`, `build`, `start`, `typecheck`, `test` and `test:integration`:

```sh
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/allyvora-patients
npm run typecheck -w @pepbits-demo/allyvora-patients
npm test -w @pepbits-demo/allyvora-patients
npm run test:integration -w @pepbits-demo/allyvora-patients
```

On this shared machine, run builds, CI, browser checks and the entire integration script through `flock /home/pepadmin/.cache/pepbits-heavy.lock <command>`. For manual development, hold the lock around one shell that owns both APIs and Next, and stop all three before releasing it; do not acquire the same lock separately for each server. The integration script automates this lifecycle. Build before integration. `scripts/integration.mjs` starts the shared demo API, builds and starts the unchanged AllyVora API with a temporary database, starts the production Next server and runs Chromium (`scripts/smoke.mjs`) on free loopback ports. It stops every service on success, failure, signal, stop file or deadline. Set `ALLYVORA_HOST_API_NODE` to a Node 24 executable; `ALLYVORA_RUNTIME_ARTIFACTS` may name a source-identical shared API checkout whose generated runtimes are reused after comparing every tracked `mock-api` file. Optional receipts: `ALLYVORA_RESULT`, `ALLYVORA_IDENTITY`, `ALLYVORA_SCREENSHOT`; cancellation: `ALLYVORA_STOP_FILE`, `ALLYVORA_TIMEOUT_MS` (30-minute default); build output: `ALLYVORA_BUILD_DIR`. Chromium on this machine needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

## Structure and routes

`src/navigation.ts` defines one header module with Patients (Patient register, Register a patient) and Configuration (Form layout), plus the shared Preferences page. `src/renderer.tsx` registers two page kinds with the public page renderer. `src/modules/registration` holds the AllyVora-specific context, form, layouts, register, record view, editor and layout designer; `src/adapters/allyvora.ts` is the typed HTTP adapter. The [source mapping](source-mapping.md) lists each source file's destination. Runtime code imports only public `@pepbits/*` exports and the read-only source form package `@allyvora/shared`.

Source URLs are kept, so deep links and refresh work:

| URL | Page |
| --- | --- |
| `/patients` | Register: quick views with counts, search (`q`), sex/payer/branch filters, sort and paging, all in the URL |
| `/patients?mode=new` | Register a new patient (add `&section=` to open a section) |
| `/patients?mode=edit&id=12` | Edit a patient (add `&section=contact` to open a section) |
| `/patients?mode=view&id=12` | Patient record with missing details and activity history |
| `/settings/layout` | Organisation form layout designer with live preview |
| `/preferences` | Shared preferences page |

`/` opens the register. Unknown paths show not found; malformed record IDs fall back to the register.

## Host, data and preferences

The public ApplicationProviders chain (SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider/EnterpriseShell) uses the shared demo API under the existing `nexora` product id: fixture sign-in, one serialized preference update path with tenant locks, and runtime catalogs. AllyVora strings are not in the protected canonical catalogs, so they remain readable English; Arabic switches direction and shared copy.

The unchanged AllyVora API has simulated sign-in: it acts as its first seeded user. Audit entries therefore name that user, not the shell user; the register says so. Shell role checks gate the UI only (PREF-08): registration actions for `enterprise-admin`, `admin`, `operations-analyst` and `finance-manager`; layout changes for `enterprise-admin` and `admin`. The AllyVora API itself does not enforce roles.

Effective theme, fonts/scales, radius, density of shared tables, result view (table/cards), page size, date/time formatting, reduced motion and keyboard-shortcut enablement apply. The organisation layout setting (arrangement, form density, columns, summary band, when problems show, drafts) is an administrator setting stored by AllyVora's API, as in the source. Shortcuts: Ctrl/⌘+S save, Alt+←/→ previous/next section, `/` focus search, `N` new patient; they are bound only while shortcuts are enabled. Ctrl/⌘+K remains the shell's page palette.

Unsaved new registrations are kept **in memory while the registration module remains mounted** and offered back; nothing is written to browser storage (the source used local storage). Failed saves keep the typed values; 422 field errors return to their fields; a stale save (409) is explained and keeps the edit. This memory is cleared by reload, sign-out, identity/branch changes or navigation to Preferences/unknown routes. No durable draft service is used: the shared `/drafts` API has no registration contract.

## Completion boundary

Both source pages and all four patient modes are implemented, with the following form features: five layouts, nine sections, conditional fields, searchable dropdowns with type-and-Tab, derived display name, PIN code autofill, department-filtered consultants, age hints, duplicate warnings, form rules drawer, error summaries with section jumps, signature capture, wristband summary band, record view with gaps and masked audit history, status change, layout designer with history and preview.

Adapted or deferred: global patient search, recent patients and layout actions in the command palette (the shared palette lists pages; a shell extension point is needed); the source header branch switcher (branch is chosen in the form); footer server-connection status; drafts and branch choice surviving reload (session memory only, by design); pointer-only signature capture without a keyboard alternative besides the paper-form option; exact source pixel styling. See the [delivery record](../../docs/releases/unreleased/restructure-phase-6e-6-2026-10-24.md) for exact checks.

The root integration launcher now builds the backend in disposable staging without writing into `source/`. Both this standalone app and the healthcare module can use the self-contained backend included in the [schema 2 test-site archive](../../docs/development/TEST-SITE.md#allyvora-patients-backend-in-schema-2). Standalone UI URLs and behavior are unchanged.
