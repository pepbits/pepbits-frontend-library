# AllyVora Quality reference module

This import adds **AllyVora Quality** to the shared frontend header without replacing the existing Healthcare, diagnostic, Teleconsult, ERP, School or Reports modules. The sidebar preserves the source order and groups:

| Group | Destinations |
| --- | --- |
| Overview | Dashboard |
| Performance | Indicators, Turnaround times, Event Pulse |
| Assurance | Verification, Validation |
| Reporting | Reports, Schedules, Submissions |
| Administration | Authorities, Users and roles, Audit trail |

Two actual-record detail routes and a report designer are available through their worklists. They do not add invented record IDs or extra items to the sidebar. Users and Audit appear only for authorized roles.

## User flow

1. Sign in to the test application and choose AllyVora Quality in the header.
2. Choose a sidebar destination, month and facility. Read the API-backed values, definitions and record history.
3. For a quality result, resolve blocking validation findings, provide a reason when correcting values, then submit it. A different actor verifies it, and a separate permitted actor approves it.
4. In Reports, select a template or open the designer; choose actual months and facilities, preview, record a run, export CSV or print.
5. Configure a schedule or prepare a submission. Review the frozen checksum and approval history before simulated transmission. No regulator, email server or SFTP destination is contacted.
6. Use Audit trail to inspect changes and verify the hash chain. Refresh a stale result before resubmitting an edit.

All 15 destinations have versioned in-app guides. Draft translations and automated checks do not establish native-speaker or clinical/domain approval.

## Reusable host contract

`@pepbits/reference-quality` keeps source-specific charts, indicator bands, report sections and specialized page composition, while forms, cards, tables and overlays adapt shared primitives. `ReferenceHostProvider` supplies navigation, authenticated transport and effective preferences. The reusable `LocalizationAliasProvider` maps imported presentation labels to canonical host keys within this module; it preserves inputs, record values and sibling module labels. The frontend stores no seeded business data or independent Quality sign-in token.

The single demo service exposes `/reference-modules/quality`. Source SQLite services remain authoritative for demonstration quantities, review decisions and report content. A server-derived tenant/application/branch hash identifies the isolated worker/database. Source credentials and client role headers cannot authorize a request. Trusted workspace identities are represented in the source directory for actor attribution; editing that projection is blocked. Directory creation does not grant shared sign-in, module availability or workspace permissions.

The source has 32 illustrative indicators, 13 turnaround definitions, nine validation rules, eight report templates and five fictional facilities per demo partition. The supplied sample database, WAL, SHM and logs are excluded; only an absent partition gets the deterministic seed. Restarting retains changes. Mutations and audit evidence share a serialized transaction. Idempotency keys retain retry results and reject a changed payload with the same key; result versions reject stale edits. Correction events must belong to the same transaction and facility and replace an effective event; projections and turnaround analysis exclude superseded events.

## Preferences and permission configuration

Host configuration controls module/page grants and tenant/branch access. The Quality directory presents the original admin, quality manager, data steward, verifier, approver and viewer permissions. Host roles map to those permissions server-side. Theme, typography, radii, density, direction, localized labels and date/number presentation follow the common preference host and its locks. Source schedules retain Gulf Standard Time as their business schedule zone.

Indicator definitions, targets, thresholds, rule parameters, report designs, authorities and schedules are maintained through the authorized source APIs within each isolated branch. The module selector is a navigation control, not authorization.

## Failure and completion boundary

Shared controls preserve supported drafts across recoverable failures; server field messages explain blocked actions. Result state, role and separation-of-duties checks execute server-side even if a caller bypasses the page. Error responses, replay conflicts and stale versions must be resolved rather than overwritten.

Quality indicators and named programmes are **illustrative**, not official current regulatory requirements. Authority delivery is **simulated**. Scheduled workers serialize due work while active and reconcile after reopening; a dedicated continuously available production scheduler and real clinical EventPulse connector require a separately governed integration. This import does not connect to Healthcare Enterprise production records or grant clinical/financial privileges. Native executable testing and native-language/domain acceptance remain separate.

See [source provenance](../reference-import/QUALITY-SOURCE.json) and the [dated delivery record](../releases/unreleased/quality-reference-2026-10-01.md) for exact validation and deployment evidence.
