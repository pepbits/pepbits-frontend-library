# AllyVora patient pages — 26 October 2026

Status: **merged; served on the hub test instance (port 3510); owner approved commit and push**. Not deployed to the test site.

## Changes and user impact

AllyVora Patients create, edit and view now have their own pages and addresses instead of `?mode=` on the register:

| Page | Address |
| --- | --- |
| Patient register | `/allyvora-patients/patients` |
| Register a patient | `/allyvora-patients/patients/new` |
| Patient record | `/allyvora-patients/patients/<id>` |
| Edit patient | `/allyvora-patients/patients/<id>/edit` (`?section=` kept) |

Links inside the module (list rows, Edit, Save, Back, front-desk pages) use the new addresses. Old `?mode=new|edit|view&id=` links still open the matching page. An invalid patient number shows the not-found page. Forms, fields, preferences and data are unchanged.

## Verification

Node 24.21.0, worktree `feature/allyvora-dedicated-pages` from main `aaa505f`. Healthcare typecheck passed; healthcare vitest 1055 tests passed (module routes, workflows, navigation and app route tests updated for the new addresses); `check-boundaries.mjs` passed; docs check passed; `git diff --check` clean. `scripts/allyvora-flows.mjs` (new legacy-link flow HCD-AV-11) was syntax-checked only. Production build served on the hub test instance with the instance's mock API and AllyVora API; register, new, view, edit and a legacy `?mode=view` link rendered the right page after demo sign-in with no page errors. Full CI, live integration and test-site packaging were not run.
