# Orvia Health Cloud: onboarding

Landing page, workspace (tenant) lookup, sign-in with MFA, and a multi-step
organization registration for a multi-tenant healthcare SaaS.
Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
```

Node 18.18+ (Node 20 or 22 recommended).

## Routes

| Route        | Screen                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| `/`          | Product landing: care pathway, facility explorer, compliance, workspaces |
| `/workspace` | Find a workspace by address (live lookup) or by work email             |
| `/login?ws=` | Sign in to a workspace: SSO, password, 6-digit code, password reset    |
| `/register`  | Registration wizard (6 steps, 7 for multi-facility networks)           |

Deep links: `/register?type=hospital` (or clinic, pharmacy, laboratory,
radiology, homecare, telehealth) and `/register?structure=network` pre-fill step 1.

Sample workspaces for testing sign-in: `stmarys`, `alnoor`, `cityrx`, `apexdx`, `demo`.
Workspaces you register are added to the lookup on the same browser.

## Where things live

```
src/
  app/                    routes, layout, fonts, icon
  components/
    landing/              hero, care pathway, facility explorer, compliance
    auth/                 split layout, workspace finder, sign-in flow
    register/             wizard, stepper, success screen
      steps/              one file per registration step
    ui/                   Button, Field/Input/Select, choice tiles, OTP, password
  lib/
    brand.ts              product name and domain: rename here
    catalog.ts            facility types, care settings, specialties, modules,
                          standards, health authority integrations, countries
    registration.ts       form model, steps, validation rules
    workspaces.ts         tenant directory (mock)
    api.ts                registration submit (mock)
    password.ts           password rules
```

## Connecting your backend

Everything that would call a server is isolated and already async:

- `lib/api.ts` → `submitRegistration(data)`: POST the `RegistrationData` object.
- `lib/workspaces.ts` → `lookupWorkspace(slug)`, `lookupByEmail(email)`,
  `isSlugTaken(slug)`: replace with your tenant service.
- `components/auth/LoginFlow.tsx` → the `onCredentials` and `verify` functions:
  call your auth endpoints and redirect to the dashboard on success.
- Agreement links point to `/legal/terms`, `/legal/baa` and `/legal/dpa`; add those pages.

## Behaviour worth knowing

- Registration drafts autosave to `localStorage` on this device. The password is
  never stored, and the draft is deleted after submission.
- Modules, care settings and local integrations are pre-selected from the
  facility types and country chosen earlier; people can change everything.
- Choosing a country fills in time zone, currency, dial code and suggested data
  residency region.
- Errors appear next to the field when someone presses Continue and disappear as
  they fix them; focus moves to the first problem.
- Keyboard: every control is reachable; segmented controls, tabs and the care
  pathway use arrow keys. Motion is reduced when the OS asks for it.
- Security headers are set in `next.config.mjs`. Add a Content-Security-Policy
  that fits your deployment.
