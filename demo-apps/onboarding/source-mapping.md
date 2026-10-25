# Onboarding source mapping

Phase 8 note: original-tree paths below describe the historical import source at the recorded base. That tree is now retired; current runtime uses this demo and public root packages.

Phase 6e-3, base `5bbb130` (`main`, healthcare and ERP merged). The source `demo-pages/orvia-health-onboarding` is a read-only reference and is unchanged. [App guide](README.md), [feature contract](../../docs/features/onboarding-demo.md) and [delivery record](../../docs/releases/unreleased/restructure-phase-6e-3-2026-10-24.md) state verification and limits.

| Source | Destination and treatment |
| --- | --- |
| `src/app/layout.tsx`, `globals.css`, `tailwind.config.ts` | App `layout.tsx`/`globals.css` and `src/modules/orvia/theme.css`: the source colour, font and animation names are registered, then mapped to the effective host theme, `--radius`, `--font-ui` and the form scale inside `.orvia`. Google fonts are replaced by the host font preference. |
| `src/app/icon.svg` | Copied unchanged as the static brand favicon in `src/app/icon.svg`; browser icon artwork is not a preference-controlled page surface |
| `next.config.mjs` security headers | Same headers in `next.config.ts` |
| `src/app/page.tsx` + `components/landing/{Hero,CarePathway,FacilityExplorer,Compliance,HowWorkspaces,SiteHeader}` | `src/modules/orvia/landing/*`, route `/`. Care pathway keys follow reading direction, times use the effective time format, the header watches the shell scroll container. |
| `src/app/workspace/page.tsx`, `components/auth/{AuthShell,WorkspaceFinder}` | `src/modules/orvia/auth/{AuthShell,WorkspaceFinder}.tsx`, route `/workspace`. Superseded address/email lookups are aborted and late results ignored; a failed lookup keeps the typed value for retry. |
| `src/app/login/page.tsx`, `components/auth/LoginFlow.tsx` | `src/modules/orvia/auth/SignInFlow.tsx`, route `/sign-in?ws=` (source `/login?ws=` accepted). Credential, code and reset steps call the onboarding port; failures keep typed values. The 6-digit code uses public `@pepbits/ui` `OtpInput`. |
| `src/app/register/page.tsx`, `components/register/RegisterWizard.tsx`, `Stepper.tsx` | `src/modules/orvia/register/RegisterWizard.tsx`, route `/register`. Generic step state, stepper, progress and invalid-field focus moved to public `@pepbits/patterns/wizard` (the plan's `registration-wizard` → `patterns/wizard`); Orvia smart defaults, notices, draft and submission stay in the demo. |
| `components/register/steps/*`, `Section.tsx`, `SuccessScreen.tsx`, `types.ts` | `src/modules/orvia/register/**`, same seven steps, fields, defaults and copy |
| `components/ui/{Button,Field,Choice,PasswordInput}` | `src/modules/orvia/ui/*`: Orvia presentation over public `SourceButton`/`SourceInput`/`SourceSelect` and `Segmented` (additive presentation slots); logical (RTL-safe) spacing |
| `components/ui/OtpInput.tsx` | Generic: public `@pepbits/ui` `OtpInput` (new); Orvia classes passed as slots |
| `components/brand/{Logo,CatalogIcon}` | `src/modules/orvia/ui/{Logo,CatalogIcon}.tsx`; Lucide icons through `@pepbits/icons` (seven primitives added) |
| `src/app/not-found.tsx` | `OrviaNotFound` in `src/modules/orvia/pages.tsx`, rendered for unknown paths |
| `src/lib/brand.ts`, `catalog.ts`, `password.ts` | `src/modules/orvia/` unchanged fictional data and rules |
| `src/lib/registration.ts` | `src/modules/orvia/registration.ts`, same model, steps and validation |
| `src/lib/workspaces.ts` | Address/slug/initial helpers in `src/modules/orvia/workspaces.ts`; directory, recent and registered workspaces behind `OnboardingPort` in `src/adapters/onboarding.ts` |
| `src/lib/api.ts` (`submitRegistration` mock) and `LoginFlow` credential/verify seams | `OnboardingPort.submitRegistration`, `signIn`, `verifySignInCode`, `requestPasswordReset`; fictional adapter with the source latencies |
| `localStorage` keys `orvia.registered`, `orvia.recent`, `orvia.registration.draft.v1` | Device store keys `pepbits-demo.onboarding.<tenant>.<user>.{registered,recent,registration-draft}` behind `DeviceStore`; the password is never stored |
| Desktop `registration-wizard` package (not this source) | Not imported. Its host contract (lists, offers, documents, email code) differs; only the generic stepper/wizard responsibility is realised in `@pepbits/patterns/wizard`. |

## Deliberate differences

- Pages render inside the shared shell after the demo-API sign-in (same host as the other demos), so the source's full-viewport layouts fill the shell content area instead of the window and do not repeat a `main` landmark.
- Colours follow the host theme (brand teal becomes the theme primary; dark rails use the sidebar tokens); radii, font family and type scale follow preferences. Layout, copy, interactions and workflow order are retained.
- Visual-only text that would have failed contrast on the host palette uses the next darker neutral (`ink-500` instead of `ink-400`); review cards use `h2` under the page `h1`.
- Save and exit flushes pending draft fields immediately. Blocked/full device storage shows a recoverable warning and retains the form; registration reports success only after the fictional workspace is saved.
- The source footer and agreement links point to `/legal/*` pages the source never provided; they still lead to the not-found page.
- Copy is wrapped for the runtime catalog; the protected canonical catalogs have no Orvia keys, so most copy stays English.

The source has **no test files**, so there is nothing to port; the app adds its own route, workflow, adapter, rule and provider tests (counts in the delivery record).
