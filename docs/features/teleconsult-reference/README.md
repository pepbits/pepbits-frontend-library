# Teleconsult reference modules

The `teleconsult-01` source is imported as two header modules in the shared frontend library. Implementation, unit tests and local browser acceptance are complete. Both modules are deployed and verified on [the isolated test site](https://frontend.test.pepbits.com); this import does not establish a live clinical service.

| Header module | Source workspace | Pages |
| --- | --- | --- |
| Teleconsult Provider | Clinic Desk, with server-granted Doctor/Nurse modes | Today, Schedule, Patients, Visit notes, Consultation |
| Teleconsult Patient | CareCall | Welcome, Registration, Home, Book a visit, My health, Visit, Visit summary |

The existing header and collapsible sidebar select each module. The nine static pages appear in their respective menus. Consultation, visit and summary routes open actual record identifiers from the worklists. CareCall retains its phone layout and bottom navigation inside the host, with an internal scroller and room for the shared header, footer, notices and desktop tabs.

## Use the modules

1. Sign in to the demo, open the header module selector and choose Teleconsult Provider or Teleconsult Patient. Module access comes from the authenticated navigation response.
2. In Provider, choose Doctor or Nurse only if the API grants that mode. Open a booked or waiting appointment from Today, Schedule or Visit notes. A Nurse completes triage and hands over; a Doctor reviews the encounter and signs the visit.
3. In Patient, Home and My health show the selected authorized beneficiary. An ordinary patient account cannot switch to another identity; the demo administrator can select among granted fictional patients.
4. Book a visit using symptoms, clinician, available time and an enabled visit mode. Wait for current advice from the API before continuing; changed answers discard older advice. Failed advice offers Retry. Suggestions are clearly labelled as a simulation.
5. Join a booked visit and review the summary after Doctor signing. Before signing, the summary displays a waiting state. Print uses the shared document surface and an explicit synthetic-data disclaimer.

Patient registration is an administrator demonstration flow, enabled only by the resolved branch setting and trusted session grant. It is not an unauthenticated patient-enrolment service. Dedicated demo roles are `teleconsult-doctor`, `teleconsult-nurse` and `teleconsult-patient`; fixture sign-in uses the account name as its password. These are fictional accounts, not real deployment credentials.

## Shared integration and configuration

`@pepbits/reference-teleconsult` uses the authenticated Reference Host transport, common form controls, language and formatting preferences. Provider and Patient connect to one durable demo API through separately authorized namespaces. State is isolated by trusted tenant, application and selected branch. A module change remounts the workspace and cancels outstanding requests.

Settings live in `dummy-api/config/teleconsult/nexora.json`. Tenant defaults and explicit branch overrides govern clinic hours, slot intervals and duration limits, visit modes, patient booking, administrator registration, recording and simulation controls. Sessions publish their resolved settings; missing or inconsistent settings are errors, not permissive defaults. Configuration cannot grant another patient identity, permit Nurse signing, bypass immutable signed records or disable recording consent.

The prototype's browser identity and unrestricted role chooser are replaced with server-granted sessions. Mutation commands require idempotency keys; encounter edits and signing require the current version. An unknown-outcome retry reuses its operation key. Version conflicts preserve unsaved edits, require explicit resolution and never overwrite signed history. API field, role, ownership and state checks remain authoritative even when a caller bypasses the UI.

Authenticated polling supplies device and transcript frames. There is no token in a URL or unauthenticated event stream. Booking advice, scheduling checks, simulated readings, scribe and decision support originate in the API. The browser holds presentation and local drafts, not a second business-data simulation.

## Demonstration boundary

All seeded patients and staff are fictional. Remote media, device readings, transcript, decision support and scribe output are simulated. Local camera/microphone access requires browser permission; no media is transmitted to another participant. This reference module creates no live prescription, clinical order, patient bill or stock posting.

A live telehealth service still requires identity integration, consent/privacy and clinical governance, media signalling, secure attachment handling, approved knowledge sources, external adapters and jurisdiction-specific acceptance. CareCall intentionally keeps its original light palette; source accent contrast in other themes, native-language/domain review, physical-device integration and native Tauri acceptance remain separate. Provider note printing retains the source browser-print behavior; Patient summary printing uses the shared document surface.

## Validation

The complete frontend regression run passed 2,114 tests in 178 files. API regression passed 320 general tests and 33 clinical tests; the 41 Teleconsult API tests are included in that scope, not additional to it. Both production browser builds passed. Local browser acceptance covers the two selectors, nine sidebar destinations, three record routes, Doctor signing, own-patient summary and role denials. Twenty-one separate checks cover four-language layout/direction, phone and bottom-navigation fit at 1,000/800/600 pixel heights and a synthetic PDF through the shared print surface.

The [source provenance](../../reference-import/TELECONSULT-SOURCE.json) identifies the original reference files. The [release record](../../releases/unreleased/teleconsult-reference-2026-10-01.md) records test evidence, source identity and accepted public activation; local builds, mock API tests and browser-rendered desktop output are distinct from production integration and a native executable.
