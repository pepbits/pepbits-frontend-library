# Independent CareGrid demo

Feature ID: CGD. State: all eleven source screens ported to an independent app with local verification. [Delivery record](../releases/unreleased/restructure-phase-6e-5-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; all scheduling data is fictional and this is **not clinical acceptance, a production integration or a deployment**.

## User problem and outcome

CareGrid books every resource a service needs, minute by minute, across a fictional healthcare network. It now runs as its own Next.js app built from public library packages, against the unchanged CareGrid scheduling API and the shared demo host API. The [app guide](../../demo-apps/caregrid/README.md) explains setup and routes; the [source mapping](../../demo-apps/caregrid/source-mapping.md) lists the treatment of every source file.

## User and administrator flows

1. Start both backends and the app, then sign in with a local fixture account through the shared login screen. The command center shows today's counts, arrivals by hour, utilization by resource kind, decisions needed, next patients, busiest resources and the service mix. The header shows the live connection, the reschedule-queue shortcut and notifications.
2. Book: choose or register a patient, choose a service (search or category), pick a day and time — "Next available" jumps to the earliest — review the reserved resources and book. Switch to Urgent to use reserved time, or Repeat to book a course. If nothing fits, add the patient to the waitlist. A taken time reports the server's nearest alternatives and keeps the selection.
3. Schedule board: choose a day, department and resource kind; zoom or show 24 hours. Open a booking to confirm, check in, start, complete, mark no-show, undo, move or cancel it. Click inside working time on an empty row, or use the row's add button with the keyboard, to book that resource.
4. Front desk: follow today's flow from Expected to Finished with one button per step, or move a card with its accessible Move to control; only valid lifecycle moves are sent. The Waitlist tab opens a preselected booking; the Reminders tab shows today's and tomorrow's outbox.
5. Availability and blocks: choose a resource, reason, dates and repetition; the impact preview lists affected bookings before saving. Work the reschedule queue through ranked suggestions, keep an original time, or fix all automatically. Add or remove facility holidays.
6. Resources: select a resource to see its week, blocks and services, then edit weekly working windows (split, overnight, alternate weeks, reserved urgent/walk-in time). Saving queues bookings outside the new hours.
7. Service catalog, patients, pharmacy desk, insights and help: edit service rules within API bounds; review patient visits and book from the profile; serve the pharmacy queue and watch counter load; apply slot-length advice and review utilization; search concepts and screen guides. `?` opens the page helper; `Ctrl K` searches pages, patients, services and resources; `B` opens booking.
8. Preferences: language, presentation, formatting, motion, shortcuts and helper switches follow the shared accepted update path, tenant locks and allowed values.

## Integration and failure behaviour

ApplicationProviders composes session, preferences, runtime localization and shell; its optional chrome adds the quick Book page, contextual tours, the header inbox, command-palette record search and one live-state wrapper shared by the header and page. The scheduling transport takes a configured base URL and forwards no credential. The Server-Sent Events stream reconnects with a bounded delay; events and reconnection trigger HTTP re-reads only. Live resource refreshes preserve unsaved weekly-hours edits. Reference-data and queue-suggestion failures show recovery with retry. Failed commands keep the selection and report the server message; bookings and moves are revalidated by the server. Mounted drafts are not durable.

## Compatibility, localization and accessibility

Four-profile tests cover default, Arabic RTL, reduced motion and locked density for every destination and deep link, with jsdom axe (contrast disabled). The real-HTTP driver includes full-document Chromium axe including contrast; its final execution and production-build acceptance are pending the shared heavy-check lock. Canonical catalogs contain no CareGrid keys and were not changed, so CareGrid copy remains English inside a translated, mirrored shell; this needs backend catalog authoring and human review. Timelines, the flow board and day strips show complete days; ordinary result tables follow the effective result view and page size. UI write gating is not authorization: the unchanged scheduling API has none (PREF-08).

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| CGD-01 | Shared sign-in/provider chain, preferences page, navigation, branches and roles; four retained host preference cases |
| CGD-02 | Eleven destinations and nine deep-link variants render API data under four profiles; the shared preferences route has the same four-profile coverage with no jsdom axe violations |
| CGD-03 | Booking: single slot, conflict alternatives, course, waitlist, read-only gating |
| CGD-04 | Schedule board and appointment drawer commands, move, cancel reason, keyboard quick booking, day navigation |
| CGD-05 | Front-desk lifecycle commands, accessible board moves, invalid-move refusal, waitlist and reminders |
| CGD-06 | Blocks with impact preview, reschedule queue suggestions, fix-all and holidays |
| CGD-07 | Weekly hours, service rules, slot-length advice, pharmacy desk, patients and help search |
| CGD-08 | Live stream status, notification toasts and inbox, schedule-change re-reads, command-palette record search, preference-bound `B` shortcut |
| CGD-09 | Real local HTTP workflows against the unchanged scheduling and host APIs, full-document Chromium axe, forced root CI and production build |

Remaining: no source pixel comparison; CareGrid catalog keys and human language review; server-side authorization for the scheduling API (a backend change, out of scope); durable drafts. The source has no automated tests to port.

## Operations and support

Run the scheduling API per its README (Node 20/22) and the host API per its README (Node 24). The integration wrapper owns its temporary scheduling database and stops every service it starts. Keep credentials out of receipts. Removing the app does not affect the original CareGrid source or the backends.
