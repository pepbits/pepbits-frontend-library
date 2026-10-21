# @pepbits/registration-wizard

A host-agnostic React wizard that registers a healthcare organisation with a central platform. It keeps the visual design of the Orvia onboarding demo (`demo-pages/orvia-health-onboarding`, unchanged) but holds no catalogues, no mock data, no transport and no framework imports. Everything list-shaped, every action and the brand come from the host.

First consumer: the Healthcare registration website (Next 16, React 19, Tailwind 4), which vendors this package as a pinned npm archive and replaces its public organisation-registration page with it.

Status: implementation plus local component tests (see "Verification"). It has not been rendered in a real browser, connected to a real backend, published as an archive or deployed.

## Use

```tsx
"use client";
import { RegistrationWizard, type RegistrationHost } from "@pepbits/registration-wizard";

const host: RegistrationHost = {
  brand: { name: "Example Health", logo: (tone) => <MyLogo tone={tone} />, supportEmail: "help@example.org", homeHref: "/" },
  workspaceDomain: "health.example.org",
  lists: { facilityTypes, careSettings, specialties, administratorRoles, countries, states, districts, timeZones, currencies, offers },
  agreements: { baa: { version, href, label }, dpa: { version, href, label } },
  recommendedCareSettings, // optional
  documentTypeLabel,       // optional
  requestCode, verifyCode, uploadDocument, submit,
  draftKey: "example.registration.draft.v1", // optional
};

<RegistrationWizard host={host} initial={{ structure: "SINGLE", facilityTypes: ["HOSPITAL"] }} />;
```

`RegistrationWizard` renders a full-height page (brand rail, header, form, footer) and is marked `"use client"`. `initial` is applied only when no draft is restored. `resendDelaySeconds` (default 30) controls the code resend countdown.

## Host contract

All types are exported from the package entry (`src/types.ts`).

| Member | Purpose |
| --- | --- |
| `brand` | `name`, optional `logo` (node, or `(tone: "light" \| "dark") => node`; the rail is dark), optional `supportEmail`, optional `homeHref` (plain link for the logo, "Save and exit" and "Back to home"; hidden when absent), optional `secondaryLink` (`{ label, href }` shown in the header, e.g. a returning applicant's status page). |
| `workspaceDomain` | Shown as `{slug}.{workspaceDomain}`. |
| `lists.*` | `facilityTypes`, `careSettings`, `specialties`, `administratorRoles`, `countries` (with optional `callingCode`), `states(country)`, `districts(country, state)`, `timeZones(country)`, `currencies(country)` (optional `primary` flag), `offers(country)`. Each returns `Promise<Option[]>`-shaped data with stable `code`s; names are display only. |
| `agreements` | `baa` and `dpa`: `{ version, href, label }`. |
| `recommendedCareSettings?(facilityTypes)` | Optional mapping used once to pre-select care settings. Without it nothing is pre-selected. |
| `documentTypeLabel?(type)` | Optional label for a document type code; otherwise the code is shown in readable form. |
| `requestCode(email)` / `verifyCode(email, code)` | Email ownership check after **Submit**. `email` is the administrator email, trimmed and lower-cased. |
| `uploadDocument(type, file)` | Called once per document type the selected offer lists. |
| `submit(data)` | Receives the `RegistrationData` payload and returns `{ reference, message? }`. |
| `draftKey?` | localStorage key for the form draft. Default `pepbits.registration.draft.v1`. |

**Errors.** Any host function may throw an `Error` or a plain object with `message`, optional `code` and optional `field`. A `field` is a dotted path such as `profile.timeZone`, `form.slug`, `facilities[1].beds` or `administrator.email`; wrapper prefixes (`form.`, `request.`) are ignored and unique leaf names are matched. A recognised field opens its step and shows the message next to the control (it stays until that value changes); anything else appears in the alert banner. `resolveFieldPath` is exported for host tests.

**Lists.** Each list loads independently with its own loading state and **Try again** on failure; one failed list never blocks the page. Successful results are cached per key for the life of the wizard. Unknown codes in a restored draft or prefill are dropped once the list loads.

## Flow and data

Steps: organisation type → organisation details → facilities (networks only) → clinical scope → workspace and administrator → review. After **Submit registration**: 6-digit email code → documents (only when the selected offer lists document types) → `submit` → success screen with the receipt reference and message.

`RegistrationData` (exported, with `emptyRegistration`) holds exactly:

- `structure` (`SINGLE` | `NETWORK`), `facilityTypes` (≥ 1 code)
- `profile`: `legalName`, `displayName` (optional), `licenceNumber`, `taxId` (optional), `country`, `state`/`district` (required only when the host returns entries for that level), `city`, `address`, `postalCode` (optional), `phone` (optional; digits, spaces, `( ) -`, at most 30 characters with the calling code), `website` (optional host such as `example.org`), `timeZone` (from the country's list; auto-selected when there is exactly one, cleared when it is not valid for a newly chosen country), `currency` (from the country's list; the `primary` entry is pre-selected), `beds` (1–100000, required only for a SINGLE structure that includes `HOSPITAL`)
- `facilities` (NETWORK only, 2–50 rows of `name`, `type`, `city`, `beds` — beds required for `HOSPITAL`; the first row starts as the head office)
- `careSettings` (optional), `specialties` (optional)
- `workspace`: `slug` (`^[a-z][a-z0-9-]{1,46}[a-z0-9]$`, not `admin`, `platform`, `www`, `api`, `auth`, `registration` or `mail`; suggested from the display or legal name), `offerId` (required, from the country's offers)
- `administrator`: `fullName` (first and last), `role`, `email`, `mobile` (≥ 6 digits)
- `agreements`: `terms`, `baa`, `dpa` (required), `productUpdates` (optional), and the accepted `termsVersion` (from the offer), `baaVersion` and `dpaVersion`, filled at submit time

The payload passed to `submit` is trimmed, drops facilities for SINGLE, clears beds where they do not apply and lower-cases the email (`toSubmission`). Choosing another plan clears the terms acceptance. `validateStep(stepId, data, context)` is exported; `context` carries the loaded list codes so the same rules can run in host tests.

**Documents** must be PDF, PNG or JPEG and at most 2 MB (`validateDocumentFile`, checked before upload). The host must validate again on the server.

**Storage.** Only form fields are autosaved to localStorage (600 ms debounce) and the draft is removed after a successful submit. Verification codes, tokens, sessions, uploads and stage state are never stored. A restored draft is rebuilt field by field, so anything else in it is ignored.

## Styling

Components use Tailwind utility classes. `src/styles.css` is a Tailwind 4 source file (not precompiled):

```css
@import "tailwindcss";
@import "@pepbits/registration-wizard/styles.css";
@source "../node_modules/@pepbits/registration-wizard/src"; /* path from the host stylesheet */
```

It adds an `@theme` with the Orvia tokens (`paper`, `mint`, `signal`, `caution`, `caution-soft`, `scrub-50…900`, `ink-50…900`, `--font-display`, animations `fade-in`, `fade-up`, `step-in`, `trace`, `shake`, `pop`, `ring` with keyframes), a default `--font-sans` stack that a host theme overrides, the utilities `bg-chart-grid`, `origin-fill-center`, `scrollbar-thin`, `scrollbar-none`, `pt-safe` and `pb-safe`, and base rules scoped to `.pb-registration`, the wizard root (paper background, ink text, font, focus ring, selection colour). There are no `html`/`body` rules. The colour names are added to the host theme, so a host that already defines `ink`, `paper` or `signal` colours should check for clashes. To use a host font, set `--font-sans` and/or `--font-display` (for example with `next/font` variables).

## Accessibility

Labelled controls with `aria-invalid` and `aria-describedby` error text; focus moves to the step heading on navigation and to the first invalid control on failure; single-choice tiles are a `radiogroup` with arrow keys; multi-choice tiles are toggle buttons; the progress bar exposes value and text; the code input supports paste, arrows and backspace; status messages use `role="status"`/`role="alert"`. All animation and transition durations collapse under `prefers-reduced-motion` inside `.pb-registration`. The layout is single-column with sticky header/footer on mobile and a brand rail from `lg`. Times use the browser locale (`Intl.DateTimeFormat(undefined, …)`); numbers use the default locale.

## Not included

- No catalogues, countries, plans, roles or other list data; no mock submission or workspace directory; no fixtures in the public entry (synthetic fixtures live only in `src/test-support` for tests).
- Removed from the Orvia demo: modules/standards/integrations step, EMRAM target, administrator password and strength meter, MFA choice, data-residency region, landing and sign-in pages.
- No workspace-address availability check before submit; the host reports a taken address as a field error on submit.
- Copy is English only and not connected to the repository localization catalogs.

## Repository rules that do not apply

This is a public, pre-tenant, owner-branded page that is vendored into a separate application, not a tenant-workspace screen of the ERP shells. The following rules are deliberately not followed, and the related checks report this package:

- **CMP-01 / `verify:form-controls`.** The package uses native `<select>`, `<input type="checkbox">` and `<input type="file">` (wrapped once in `src/ui`) instead of `@pepbits/ops-ui`. ops-ui depends on the ERP token stylesheet and its own visual language; the owner asked for the Orvia design, and the consumer must not need ops-ui or the ERP tokens. The native elements keep platform accessibility and mobile pickers.
- **`verify:parity` (`@source` in apps/web and apps/desktop).** Neither ERP app renders this package, so it is not added to their stylesheets; doing so would inject the Orvia theme colours and animation names into both apps. The consumer's own Tailwind build sources it, as described above.
- **PREF-01…07 (tenant preferences, managed settings, preference-controlled formatting, radius tokens, shortcuts).** There is no tenant, user or preference host before registration. The wizard uses fixed Orvia tokens and the browser locale.
- **Shared draft service.** There is no tenant scope for a server draft; the device-local draft holds form fields only and is described to the user as saved on this device.

## Verification

From `desktop-clients`:

```bash
npx tsc -p packages/registration-wizard --noEmit
npx vitest run packages/registration-wizard
```

The tests use a synthetic fake host (`src/test-support/fake-host.ts`) and cover each step's rules, list loading and retry, time-zone and currency behaviour, the code and documents stages, host field errors, draft contents and the submit payload. They run in jsdom; no browser journey or real backend has been exercised.
