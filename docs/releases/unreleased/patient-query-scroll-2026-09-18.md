# Patient Query cursor scrolling — 18 September 2026

The existing Patient Query layout now supports an opt-in production host contract. Set
`metadata.queryCapabilities.infiniteScroll` to `true` to fetch twenty records initially,
then append the next twenty when the result sentinel enters the viewport. The keyboard
**Load more patients** button uses the same API request. Existing adapters keep their
preference-controlled numbered pagination. The twenty-record transport batch is fixed
for the cursor host and does not change the saved table page-size preference.

## Flow and recovery

Enter a criterion and select Search. The initial unfiltered registry is not fetched.
Scroll through table or cards to append results; the status reports the number loaded,
not an invented total. The next request starts only after the previous one settles.
A failed additional page keeps all loaded rows and offers Retry for the same cursor.
Clear, new criteria, branch/adapter changes and unmount abort outstanding requests;
late responses cannot replace the active result. Duplicate patient IDs appear once.

## API and configuration

`ClinicalTemplateAdapter.search(filters, {signal?})` accepts an optional AbortSignal.
The cursor adapter supplies `page`, `pageSize`, `hasMore` and rows; healthcare translates
sequential page numbers to the server's `after` cursor. The renderer never creates
patient records or infers that an approximate count is the registry size.

`metadata.searchFields` is an optional allowlist of UI criteria. When present, only
advertised fields appear, and submitted presets are filtered by that list. Additional
name, email, address, date-range, reference, registration, verification and insurance
criteria appear inside the existing More filters area. `searchOptions` provides API
values/labels for reference and enum selectors. Omitted metadata preserves legacy
controls. The server must still enforce DCP, tenant and organization/branch permissions;
UI visibility is not authorization. Healthcare owns real PostgreSQL matching/indexes.

No browser storage receives patient rows or search criteria. Existing presentation,
preview, density, locale and keyboard preferences remain in effect. English, Arabic,
Hindi and Malayalam copy and offline catalogs were updated; native-speaker review is
pending. No patient-record or consent layout is changed by this library increment.

## Verification and completion boundary

Base source: `fb1eccb3f3ba5a250b55fd83c23a2f798f017d96` plus this working tree.
Node 24.21.0. Local component/hook tests cover sequential append, duplicate identities,
concurrent observer callbacks, stale responses, cancellation, additional-page recovery,
metadata fields, twenty-record transport and the keyboard fallback. The healthcare
adapter's four Node tests include externally cancelled requests without cursor advance.
All frontend packages typecheck. Template/library examples and localization fallbacks
were regenerated. See the final change receipt for the working-tree source hashes.

These are synthetic local checks, not authenticated live patient acceptance. The
healthcare consumer must package these sources and run its own build/browser/API checks.
No frontend demo, native executable or healthcare deployment is claimed here.
