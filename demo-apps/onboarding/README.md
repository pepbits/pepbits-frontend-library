# Onboarding demo (Orvia Health Cloud)

Private `@pepbits-demo/onboarding`, using Next.js 16.3.3, React 19.2 and Tailwind 4.1. Phase 6e-3 ports the Orvia Health Cloud onboarding demo (`demo-pages/orvia-health-onboarding`, unchanged): the product landing page, workspace (tenant) lookup, workspace sign-in with a 6-digit code and the multi-step organization registration. **Everything is a demonstration with fictional data.** Orvia, its workspaces, registrations, sign-in codes and references are invented; Orvia workspace access, codes and registrations are simulated; no messages are sent or real organizations verified. The enclosing host authenticates against the unchanged demo API. This is a local build/run, not a deployment.

## Run locally

From the repository root (on this shared machine, wrap builds and the whole API/server/browser session in `flock /home/pepadmin/.cache/pepbits-heavy.lock`; the integration launcher below owns that session):

```sh
npm install
# Start the unchanged API using its documented Node 24/runtime environment.
node mock-api/server.mjs
NEXT_PUBLIC_API_URL=http://localhost:3330 npm run dev -w @pepbits-demo/onboarding
```

Use the actual API port/origin from the [API guide](../../mock-api/README.md). Dev/start use port **3370**. Sign in through the shared login screen with a local fixture account from the API fixtures (credentials are not repeated here). The optional same-origin proxy accepts these settings in an ignored app `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=/api
ONBOARDING_API_URL=http://127.0.0.1:3330
```

The public URL is build-time configuration; `ONBOARDING_API_URL` is server-only and never appears in components. Scripts are `dev`, `build`, `start`, `typecheck`, `test` and `test:integration`:

```sh
NEXT_PUBLIC_API_URL=/api npm run build -w @pepbits-demo/onboarding
npm run typecheck -w @pepbits-demo/onboarding
npm test -w @pepbits-demo/onboarding
npm run test:integration -w @pepbits-demo/onboarding
```

Build before integration. The shared launcher (`tooling/scripts/run-demo-integration.mjs`) starts one demo API, one production Next server and Chromium on free loopback ports with temporary API storage, and cleans up on success, failure, cancellation or deadline. Set `ONBOARDING_API_NODE` to a Node 24 executable and, when generated API runtimes are absent, `ONBOARDING_RUNTIME_ARTIFACTS` to a source-identical API checkout (sources are compared before reuse). Optional receipts: `ONBOARDING_RESULT`, `ONBOARDING_IDENTITY`, `ONBOARDING_SCREENSHOT`; cancellation/deadline: `ONBOARDING_STOP_FILE`, `ONBOARDING_TIMEOUT_MS`; build output: `ONBOARDING_BUILD_DIR`. Chromium on this machine needs `LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu`.

## Structure and routes

| Path | Page | Source |
| --- | --- | --- |
| `/` | Landing: hero with interactive care pathway, facility explorer, compliance, how workspaces work | `app/page.tsx`, `components/landing/*` |
| `/workspace` | Find a workspace by address (debounced live lookup) or work email; recent and sample workspaces | `app/workspace/page.tsx`, `components/auth/WorkspaceFinder.tsx` |
| `/sign-in?ws=` (also `/login?ws=`) | Workspace sign-in: SSO notice, email/password, 6-digit code, password reset | `app/login/page.tsx`, `components/auth/LoginFlow.tsx` |
| `/register` (`?type=`, `?structure=network`) | Registration wizard: 6 steps, 7 for multi-facility networks, success screen | `app/register/page.tsx`, `components/register/*` |
| `/preferences` | Shared shell preferences page | — |
| anything else | Source not-found page | `app/not-found.tsx` |

`src/navigation.ts` defines one header module (Orvia onboarding) with three sidebar groups and the routes above. `src/renderer.tsx` registers one renderer per page kind through the public `createPageRenderer` registry; deep links and query parameters (`ws`, `type`, `structure`) survive navigation and refresh. `src/modules/orvia` holds the Orvia catalogue, rules and screens; `src/adapters` holds the API transport and the onboarding port. AI is off. Runtime code imports only public `@pepbits/*` exports. The [source map](source-mapping.md) lists every source file's destination.

## Host, data and preferences

The public `ApplicationProviders` chain is SessionProvider → PreferenceHost → LocalizationProvider → ShellProvider/EnterpriseShell, the same host as healthcare and ERP: demo-API session (branch and role from the authenticated user), API preferences and tenant policy through one serialized update path, and the runtime localization catalog from the API. Signed-out visitors see the shared login screen.

**Data choice.** The unchanged demo API has no tenant directory, organization registration or Orvia workspace sign-in endpoint, and no draft kind for a registration form. The source kept these behind async seams; they stay behind `OnboardingPort` (`src/adapters/onboarding.ts`) with a fictional adapter: the five source sample workspaces, workspaces registered in this browser, recent workspaces and the registration draft live in device storage, scoped by the authenticated tenant and user (an isolation key, not authorization). Simulated latencies match the source. A real tenant, registration and identity service can replace the adapter without changing screens. The registration draft holds form fields only; the administrator password is never stored, and the draft is deleted after submission — as in the source. Save and exit flushes the current fields immediately; failed device storage keeps the form open with a warning. A failed workspace write does not report registration success. The demo's sign-in accepts any well-formed email, an 8+ character password and any 6-digit code, as the source did; it does not authenticate anything.

**Generic library use.** Step state, the stepper, progress and invalid-field focus use the new public `@pepbits/patterns/wizard`; the sign-in code uses the new public `@pepbits/ui` `OtpInput`. Buttons, inputs and selects compose public `SourceButton`/`SourceInput`/`SourceSelect`; segmented choices use the shared `Segmented` with presentation slots for the source indicator. Icons come from `@pepbits/icons`. Orvia-specific screens, catalogue, validation rules and the device draft stay in the demo.

**Preferences.** The Orvia design vocabulary (`src/modules/orvia/theme.css`) keeps the source utility names but maps them to the effective host theme: neutrals to the semantic surface/text/border tokens, the scrub brand family to the primary family, the dark brand rails to the sidebar tokens, radii to `--radius`, type to `--font-ui` and the form scale. Only the mint trace accent on the dark rails is fixed brand ink. The selected language and direction apply (logical spacing, mirrored arrow keys and icons; addresses, dial codes and standard names stay left-to-right), times and counts use the effective formatters, and the effective reduced-motion preference disables animations and smooth scrolling (the OS setting is honoured too). There are no custom keyboard shortcuts; arrow keys in radio groups/tabs and Escape on the mobile menu are standard widget behaviour. Table, page-size, export and record-navigation preferences do not apply to these pages.

**Localization.** Copy is wrapped for the runtime catalog. The protected canonical catalogs (`mock-api/config/localization`) contain no Orvia copy, so only generic strings that already exist there (for example Sign in, Back, Continue, Email) are translated; the rest stays readable English in every language until the backend catalog is extended. Automated Arabic checks are not native-speaker review.

## Completion boundary

All four source pages and the not-found page are ported with their workflows: care pathway and facility explorer interaction, address/email lookup, sign-in with SSO notice, code step and reset, and the full registration with smart defaults, per-step validation with focus on the first problem, error clearing, stepper jumps, facility rows, review/edit, agreements, device draft autosave/restore and the success screen. Differences from the source are deliberate and listed in the [source map](source-mapping.md): pages render inside the shared shell after the demo-API sign-in; colours, fonts and radii follow the host theme; Google-hosted fonts are replaced by the selected host font; the source footer/agreement links to `/legal/*` pages the source never shipped still lead to the not-found page. The source has no test files; the app's own tests are listed in the [delivery record](../../docs/releases/unreleased/restructure-phase-6e-3-2026-10-24.md). Exact pixel comparison with the source, native-speaker review, a real tenant/identity/registration backend and deployment are outside this phase.
