# MedSlot scheduling module

Select **MedSlot** in the Library header. Its original twelve sidebar destinations are Dashboard, Book appointment, Calendar, Appointments, Patients, Resources & schedules, Services, Departments, Holidays, Notifications, Users & settings and Audit log. Patient and resource details retain their own route identity and survive refresh.

The read-only source is `reference/frontend/sheduler/medslot`. The imported frontend lives in `desktop-clients/packages/reference-medslot`, and its adapted original backend in `dummy-api/medslot-source`. Healthcare Enterprise and its production records are separate consumers and are not replaced by this import.

## User flow

1. Sign in through the shared Library host and select the permitted branch and MedSlot module.
2. Search for a patient or register with consent. Resolve duplicate hints before creating another record.
3. Select a service, review preparation and required resources, choose an available slot, enter visit details and book.
4. Open the appointment from Calendar or Appointments. Use permitted status, reschedule or duration commands; the API prevents conflicting resource or patient bookings.
5. Configure resources, weekly hours, blocks, services, departments, holidays, notification templates and booking rules with an authorized role.
6. Review audit history and simulated notification logs. Earlier appointment and rescheduling evidence remain linked.

The original page layouts, calendar modes, booking steps, compact fields, palette and source Hanken Grotesk font stack remain scoped to MedSlot. The shared enterprise header/sidebar replaces the duplicate standalone shell. The source Google Fonts stylesheet is retained; offline font parity is pending.

## Reusable components and preferences

Form controls, tables, cards, dialogs, focus restoration, localization and navigation use shared public library contracts. The import scripts reuse the common source transformations, copy inventory and scoped CSS generation. Effective host font/theme/radius, form/result scale, table presentation, shortcuts, motion, toast position and duration apply without introducing a second preference store. Facility wall-clock date/time values remain wall-clock values; displayed formats use host preferences.

English UI copy and all fourteen page guides are registered in the canonical backend catalogue. Arabic, Hindi and Malayalam now have complete MedSlot UI catalog coverage as translation drafts. Native-language and healthcare-domain review remains pending; these drafts are not approved translations.

## API, authority and persistence

`/reference-modules/medslot/api` delegates to the original Express scheduling services inside the existing demo API. The shared worker isolates each trusted tenant/application/branch partition and seeds synthetic records only into a new owned database. Frontend business data is fetched from that API, not embedded as mock responses. Test fixtures are isolated under `__fixtures__` and imported only by tests.

Roles are administrator, scheduler and mapped provider. Host identities cannot be modified by the source roster editor. Source roster credentials never authenticate into the Library. The named synthetic provider is mapped to its fictional resource on the server; other unmapped providers fail closed. Provider direct record reads and calendar filters are checked against that assignment. Actual provider provisioning is a host integration boundary.

Writes require durable idempotency keys; successful replies survive worker restart, changed key/payload reuse conflicts, and failed commands roll back. SQLite transactions and shared command serialization protect resource capacity and patient overlap checks. Source schedules are wrapped in an object command envelope to preserve the shared validation boundary.

Email/SMS/WhatsApp delivery is simulated **in the backend**, with `MOCK-` provider references. Templates, opt-ins and delivery evidence remain real module records. No external provider credentials or network transport are inherited. Booking notifications and reminders run inside the shared serialized command queue and database transaction. The owned reminder timer runs only while that demo partition is active, retains original lead-time/deduplication rules, and is stopped with its worker. An admin can explicitly run the same job with POST `/notifications/reminders/run`; this is simulated delivery, not a production cross-tenant job service.

## Validation boundary

See [delivery evidence](../releases/unreleased/medslot-reference-2026-10-02.md). Automated source-service and component tests are separate from browser acceptance. Deployment is complete only after both SurgiSuite and MedSlot pass the fresh staged candidate and public verification. Previous SurgiSuite artifacts cannot be relabeled as a build containing MedSlot.
