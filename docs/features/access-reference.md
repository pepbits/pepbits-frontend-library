# Tenant Admin and MedBand reference modules

Select **Tenant Admin** or **MedBand Patient Access** in the shared header. Each opens an independent source workspace inside the existing shell. Tenant Admin preserves thirty configuration pages plus Overview, Approvals inbox and Activity log. MedBand preserves Today, patient search/registration/record, encounters, admission queue/request and episodes/cases.

## Shared components and navigation

The packages use the host's authenticated navigation, reusable UI components, effective preferences, language, direction, typography, theme, density, formatting and managed settings. Original source layouts and workflows are retained inside scoped styles; duplicate source headers/sidebars are replaced by the shared shell. Dynamic record identifiers and queries remain linked to the actual API records.

## API and demonstration data

Business records and reference definitions come from `/reference-modules/tenant-admin` and `/reference-modules/medband`. The original services run in private worker partitions with persisted SQLite through Node's built-in driver. No public source listener, browser actor selector or frontend business fixture establishes identity or supplies data. Seed records are fictional and created only during an owned initial bootstrap. Existing stores are not silently reset on startup or schema mismatch.

Tenant/application/branch scope and role come from the authenticated host. The worker projects the signed-in actor; source directory entries remain historical references. Reset, source login, user switching and arbitrary seed endpoints are blocked. Each successful command, source history and durable retry result commits atomically. Failed validation rolls back; changed content with an existing operation key conflicts. Supported local form values are not durable clinical drafts.

## Configuration governance

Tenant configuration editors may create/update/submit; approvers decide versions. The source prevents deciding a version its actor created or submitted. Pending and approved versions are immutable, row versions reject stale writes, and future changes create new revisions. Effective dates, branch override locks, references and pricing bounds remain checked by the original backend. Simple reference records retain active/inactive behavior. This demonstration configuration does not publish live platform grants, change Healthcare Enterprise settings or adopt real payer/bank contracts.

## Patient access

MedBand loads masters and patient/episode/case/encounter data from bootstrap before rendering. Counter settings remain browser workstation preferences within authenticated scope; the API checks allowed visit types. Encounters retain the Episode → Case → Encounter relationship, governed follow-ups, admission-request linkage, emergency paths, coverage checks and exclusive occupied beds. Reception, admissions, clinician, administrator and viewer roles have separate server guards. Source clinician/financial rules are illustrative; recorded authorization/deposit evidence does not contact a payer or bank.

## How to verify and recover

Open the desired header module, choose a sidebar destination and inspect an actual record. Create a synthetic record through a permitted form and verify its persisted history. A lost-response retry must retain its operation key. For a stale row, reload and review the current version before retrying. Review unsaved work before changing branch. Permission or unavailable-service errors must remain visible rather than falling back to browser fixtures.

See [delivery status and validation](../releases/unreleased/access-reference-2026-10-01.md). Native-language/domain review, native executable validation and live provider integration are separate acceptance activities.
