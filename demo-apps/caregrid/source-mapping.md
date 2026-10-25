# CareGrid source mapping

Phase 8 note: original-tree paths below describe the historical import source at the recorded base. That tree is now retired; current runtime uses this demo and public root packages.

Phase 6e-5, base `5bbb13027d137ac31594ca9a1a3d47aac46653c9` (see the [delivery record](../../docs/releases/unreleased/restructure-phase-6e-5-2026-10-24.md) for the verified identity). `source/caregrid` is a read-only reference: its frontend was not edited, moved or reformatted, and its backend runs unchanged. [App guide](README.md), [feature contract](../../docs/features/caregrid-demo.md).

| Source file | Destination and treatment |
| --- | --- |
| `frontend/src/lib/api.ts` | `src/adapters/caregrid.ts`: configured base URL (no hardcoded origin), relative-path guard, structured `CaregridFailure` with server `detail`, abort support; no credential forwarding |
| `frontend/src/lib/live.tsx` | `src/modules/caregrid/live.tsx` on the new public `@pepbits/platform/event-stream`; notifications go to the shell toast path; `useCaregridQuery` adds abort/stale fencing |
| `frontend/src/lib/time.ts` | Pure facility-minute helpers in `time.ts`; display wording in `format.ts` through the effective preference formatters |
| `frontend/src/lib/meta.ts` | `labels.ts`; fixed hex kind/status colours replaced by semantic tokens and Badge tones |
| `frontend/src/components/ui/primitives.tsx` | Drawer/Modal/Empty/Skeleton/Avatar/Spinner → public Drawer, Modal, EmptyState, Skeleton, Avatar, RecoveryNotice; CareGrid glyphs, SegmentStrip and Meter stay in `ui.tsx`; Panel composes public Card |
| `frontend/src/components/ui/ResourcePicker.tsx` | Public `SearchSelect` with API options |
| `frontend/src/components/shell/AppShell.tsx` | Shared EnterpriseShell via ApplicationProviders chrome: sidebar/header/footer, quick Book page, header inbox (`chrome.tsx`), command palette with host record search, ScreenHost toasts, shell helper; `B` shortcut in `chrome.tsx` |
| `frontend/src/components/shell/helpContent.ts` | `help.ts`: per-page help, shell helper tours over `data-tour` anchors, help-center concepts |
| `frontend/src/components/booking/SlotPicker.tsx` | `booking/slot-picker.tsx`; public IconButton/Segmented; keyboard focus shows assignments; live revalidation of the selection |
| `frontend/src/components/booking/AppointmentDrawer.tsx` | `booking/appointment-drawer.tsx`; public Drawer/Modal/Button/Badge; role-gated commands |
| `frontend/src/app/page.tsx` | `pages/dashboard.tsx` (command center) |
| `frontend/src/app/book/page.tsx` | `pages/book.tsx`; public Input/Select/DateInput/TimeInput/SearchInput/Segmented/Avatar |
| `frontend/src/app/schedule/page.tsx` | `pages/schedule.tsx` composing the new public `ResourceRowTimeline` (`@pepbits/patterns/calendar`); quick booking drawer |
| `frontend/src/app/frontdesk/page.tsx` | `pages/frontdesk.tsx` composing public `WorkflowBoard` and Tabs |
| `frontend/src/app/exceptions/page.tsx` | `pages/exceptions.tsx` |
| `frontend/src/app/resources/page.tsx` | `pages/resources.tsx` (directory, 7-day load, weekly-hours editor) |
| `frontend/src/app/catalog/page.tsx` | `pages/catalog.tsx`; public CollectionView with effective result view/page size; client rule bounds mirror the API schema |
| `frontend/src/app/patients/page.tsx` | `pages/patients.tsx` |
| `frontend/src/app/pharmacy/page.tsx` | `pages/pharmacy.tsx` |
| `frontend/src/app/insights/page.tsx` | `pages/insights.tsx`; CollectionView for slot-length advice |
| `frontend/src/app/help/page.tsx` | `pages/help.tsx` |
| `frontend/src/app/layout.tsx`, `globals.css`, `tailwind.config.ts`, fonts | `src/app/layout.tsx`, `client.tsx`, `globals.css`; shared tokens and fonts; CareGrid washes/chips use semantic tokens |
| `backend/**` | Not copied. Run unchanged as the scheduling API; `scripts/integration.mjs` starts it with a temporary database |
| Tests | The source has none. CareGrid tests are new (see the delivery record) |

## Library additions used here

| Package export | Why it is generic |
| --- | --- |
| `@pepbits/platform/event-stream` | Server-Sent Events subscription with bounded reconnection, readiness event, stale-source fencing and a React hook |
| `@pepbits/patterns/calendar` `ResourceRowTimeline` | Horizontal resource rows with availability bands, overlap lanes, held lead/trail minutes, now line, grouped rows, pointer and keyboard creation |
| `@pepbits/shell` `CommandSearch` / ApplicationProviders `chrome` | Host record search in the shared command palette; optional quick pages, tours, header inbox and a frame wrapper for host live state |
| `@pepbits/icons` | 21 additional Lucide primitives for scheduling categories and resource kinds |

CareGrid wording, colours derived from API departments, lifecycle-to-board mapping, rule bounds and all API calls remain in this app.
