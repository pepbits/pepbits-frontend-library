# AllyVora Healthcare: patient registration

Patient registration and records for hospital front desks. Staff can register, find, view and edit patients, and an administrator can choose how the registration form is laid out for everyone.

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Express 4, TypeScript, SQLite (better-sqlite3)
- **Shared:** one package holds the form definition and every rule, used by both sides

All data, including reference lists and demo patients, lives in SQLite and is served by the Express API. Nothing is hard-coded in the frontend.

## Quick start

Requires Node.js 20.10 or later.

```bash
npm install        # installs all three workspaces
npm run dev        # API on :4000, web app on :3000
```

Open http://localhost:3000. On first start the API creates `backend/data/allyvora.db` and seeds organisations, branches, a user, all dropdown lists, PIN codes and 28 demo patients.

### Production

```bash
npm run build      # bundles the API and builds Next.js
npm start          # runs both in production mode
```

### Database

```bash
npm run seed       # seed an empty database
npm run db:reset   # drop everything and reseed
```

### Configuration

Copy `backend/.env.example` and `frontend/.env.example` to `.env` files as needed.

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | backend | `4000` | API port |
| `DB_PATH` | backend | `./data/allyvora.db` | SQLite file |
| `CORS_ORIGIN` | backend | `http://localhost:3000` | Allowed direct callers |
| `SEED_DEMO` | backend | `true` | Seed demo patients on first start |
| `API_URL` | frontend | `http://localhost:4000` | Where Next.js proxies `/api/*` |

The browser only talks to the Next.js origin; `next.config.mjs` proxies `/api/*` to Express, so there are no CORS issues in normal use.

## The two pages

### Patients (`/patients`)

One page with four modes, selected by the URL:

| URL | Mode |
| --- | --- |
| `/patients` | Patient register: search, quick views, filters, sorting, pagination |
| `/patients?mode=new` | Register a new patient |
| `/patients?mode=edit&id=12` | Edit a patient (add `&section=contact` to open a section) |
| `/patients?mode=view&id=12` | Patient record with activity history |

### Form layout (`/settings/layout`)

Choose one of five layouts, plus density, column count, the patient summary band, when problems are shown, and whether drafts are kept. A live preview uses the real form with a sample patient. Every change is recorded in a history you can restore from. The form also has a quick layout switcher in its own header.

## One form, five layouts

There is exactly one form controller (`PatientForm`) and one set of field components. The layouts only decide how sections are arranged:

| Layout | Arrangement |
| --- | --- |
| Single page | All sections stacked, section list follows your scroll |
| Tabs | One section at a time, status-aware tab bar |
| Guided steps | Step track; Next checks the current step before moving on |
| Side steps | Labelled vertical steps with one section open |
| Accordion | Sections fold open one at a time |

The nine sections are MRN, Personal, Contact, Address, Identity, Insurance, Clinical, Registration and Consent.

## Features

**Faster registration**

- Searchable dropdowns: type and press Tab to pick the best match. No separate "Find" buttons.
- Display name builds itself from title and name fields; edit it to override.
- PIN code fills in city, district and state.
- Consultant list narrows to the chosen department.
- Age shown as you enter date of birth; birth year, month or approximate age for patients who don't know their exact date.
- Sensible defaults (branch, nationality, self pay, outpatient, consent date).
- Keyboard: `⌘/Ctrl+S` save, `Alt+←/→` previous and next section, `⌘/Ctrl+K` search anywhere, `/` focus search, `N` new patient.

**Safer records**

- Fields appear only when they apply (insurance details for insured patients, guardian details when a guardian consents, and so on). Hidden values are never saved.
- Format checks for Aadhaar, PAN, passport, voter ID, driving licence, ABHA number and address, Indian mobile numbers, PIN codes and dates.
- Possible duplicate warning while typing (same mobile, name or date of birth), with links to the existing records.
- "Check form rules" lists every rule, what passes, what's missing, and jumps to the field.
- Errors show on section tabs and steps with counts; saving jumps to the first problem.
- Unsaved registrations are kept as a draft on the device and offered back.
- Two people editing the same patient can't overwrite each other: the second save is rejected with a clear message.
- Every create, change and status change is logged with who, when, and what changed. ID numbers are masked in the log.

**Patient summary band**

A wristband-style strip above the form fills in as you type: name, local-script name, age and sex, date of birth, blood group, mobile, an allergy stripe (red for known allergies) and the MRN with a barcode.

**Shell**

- Sidebar is collapsed by default, expands on hover or click (and can be kept open), and collapses again whenever a page loads. On phones it becomes a drawer.
- Header with breadcrumb, global search, branch switcher, theme (light, dark, match device) and user menu.
- Footer status bar with server connection status, tenant, organisation and branch, and the time.
- All pages are full width and responsive from phone to wide desktop.

## Project layout

```
packages/shared/src
  types.ts          Shared types
  definition.ts     Sections, fields, conditions, defaults
  engine.ts         Validation, visibility, progress, formatting, diffing
backend/src
  server.ts         Express app, security headers, graceful shutdown
  db.ts             Schema and connection
  seed.ts           Reference data and demo patients
  routes/index.ts   REST API
  repositories/     Patients, reference data, settings
frontend/src
  app/              Routes: /patients, /settings/layout
  components/shell  Sidebar, header, footer, command palette
  components/form   Field controls (combobox, segmented, switch, signature)
  components/patient-form
                    PatientForm, shared section parts, rules drawer, five layouts
  components/patients
                    Register, editor, record view, summary band
  components/settings
                    Layout setup page
  lib/              API client, app context, hooks
```

## API

All endpoints are under `/api`. Errors return `{ "message": "..." }`; validation errors (422) add `errors: { fieldId: message }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/session` | Signed-in user, organisation, branches |
| GET | `/lookups` | All dropdown lists |
| GET | `/branches/:id/mrn-preview` | Next MRN and numbering rule |
| GET | `/pincodes/:pin` | City, district and state for a PIN code |
| GET | `/patients` | List: `q`, `status`, `sex`, `payer`, `branchId`, `created`, `incomplete`, `sort`, `dir`, `page`, `pageSize` |
| GET | `/patients/stats` | Counts for the quick views |
| POST | `/patients/duplicates` | Possible duplicates for given name, DOB or mobile |
| GET | `/patients/:id` | One patient |
| GET | `/patients/:id/audit` | Activity history |
| POST | `/patients` | Create: `{ values }` |
| PUT | `/patients/:id` | Update: `{ values, version }` (409 if stale) |
| PATCH | `/patients/:id/status` | `{ status: "active" \| "inactive" }` |
| GET | `/settings/layout` | Current layout settings |
| PUT | `/settings/layout` | Save layout settings |
| GET | `/settings/layout/history` | Recent layout changes |

## Notes on the mock environment

- Sign-in is simulated: the API acts as the first seeded user. Send an `x-user-email` header to act as another user once more are added to the `users` table.
- MRNs follow each branch's rule (`KCH-2026-000025`, restarting every January) and are assigned inside a database transaction, so numbers are never reused.
