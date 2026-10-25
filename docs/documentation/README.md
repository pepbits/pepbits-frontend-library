# Shared page documentation lifecycle

Help, the documentation drawer, Documentation Center and Page Library guides use `DocumentationArticle` and the same authenticated `/documentation` API. Page Help opens its documentation tab by default; tours also come from the API. Public TypeScript examples remain bundled code, separate from guide prose. The application requests its compiled release and the effective preferred language; server navigation access controls which pages can be read. Existing offline/error recovery and mixed-language warnings remain.

## Adding a page

1. Register the page in the normal typed registry and backend navigation.
2. Run `node docs/tools/documentation-lifecycle.mjs register PAGE_ID NEW_RELEASE_ID` under Node 24. This copies the current release into a new patch snapshot, adds the [guide template](page-guide.template.json), and updates the backend documentation release pointer (hosts must adopt it explicitly). Existing snapshots are preserved.
3. Replace every placeholder with verified instructions, validations, permission/preference behavior, recovery and integration details. Add field metadata and stable `data-tour` targets where relevant. Set `status: authored` only after workflow review. An unfinished new reference guide fails the lifecycle check; existing reference-only guides are listed as historical backlog.
4. Translate the article’s titles, paragraphs, fields and tour steps in canonical backend catalogs. Register revision records with `translations`; complete translations before `translation-sync PAGE_ID LANGUAGE`.
5. Review source impact receipts, run the checks below and have the PR reviewed. Registering a draft does not certify its accuracy.

## Modifying a page or shared component

`impact.json` tracks source fingerprints and affected page IDs. A `*` mapping means every registered page; unmapped renderers, shared UI, application hosts, backend adapters and localization changes are conservatively assigned to all pages. Explicit billing/clinical source families identify their consumers. This can over-report impact; it must not silently ignore a shared change.

A changed source, deleted source, missing receipt or changed mapping fails verification. Run `snapshot "specific explanation"` to create/update reviewable receipts. Inspect every affected page. For a content change, add a new release snapshot and set the receipt’s `disposition` to `updated`, with `guideHashes` containing each affected guide’s SHA-256. `node docs/tools/documentation-lifecycle.mjs receipt SOURCE_PATH updated "reason"` records these hashes after the guides have been updated. For presentation/infrastructure-only edits, retain `no-content-impact` with an accurate explanation. Deleted files keep a removal receipt.

Receipts are declarations for PR review, not proof that a human reviewed them. CI checks fingerprints and explanations; repository administrators must enforce required status checks and PR approval through branch protection. These settings cannot be established by editing this repository alone.

CI also compares historical release snapshots against the PR base/push-before SHA. Changing or deleting an old release fails. Create a new snapshot instead. Local checks compare against HEAD by default; use `DOCS_BASE_SHA` to select another comparison base.

## Translation revisions and native review

`mock-api/config/documentation/translation-revisions.json` records source and translated-content hashes per product/release/page/language. The API returns `sourceHash`, `translationHash`, `translationStatus` and `reviewStatus`. Source or translated-text drift makes an existing translation outdated and resets its effective review status to pending. Missing text is explicitly incomplete; the UI warns about fallback/mixed content and outdated translations.

`translations` only initializes missing records as pending and never overwrites existing stale/approved records. `translation-sync PAGE_ID LANGUAGE` requires complete translated content, refreshes hashes and clears review evidence. To prepare a native review packet:

```sh
node docs/tools/documentation-lifecycle.mjs packet billing-clinic ml > /tmp/billing-ml-review.json
```

After an actual review, record the reviewer, ISO review date and an auditable `reviewEvidence` reference in that translation record. Reviewed status requires matching hashes and all three evidence fields. Automated generation cannot supply native-speaker approval. Product-specific documentation can store independent revision records under its product ID; shared records use `default`.

## Checks and release acceptance

```sh
node docs/tools/documentation-lifecycle.mjs check
node --test docs/tools/documentation-contracts.test.mjs
node docs/tools/documentation-lifecycle.mjs report
node docs/tools/documentation-lifecycle.mjs check --strict
```

Normal checks protect new-page registration, source-impact receipts, translation drift and history. They run in CI through root `npm run ci:gates`. Strict release acceptance additionally rejects every outstanding authoring/translation-review item. It currently fails intentionally: see the [explicit backlog](backlog.json). It is not wired as a universal merge blocker because that would prevent all work until the inherited backlog is reviewed. Publishing a fully authored/native-reviewed release requires clearing that backlog and passing strict acceptance.

The existing guide validator checks guide structure and change links; browser tests verify contextual and catalog articles in four languages. Tour targets need page-specific browser acceptance, especially when fields are conditional; a static target string cannot prove the element is visible or that the instructions are correct. Links and repository release evidence are checked with `node docs/tools/check-docs.mjs`.

## Remaining human work

There are 168 inherited reference-only guides and pending native reviews across the catalog. The report lists each page/language separately; it does not mark boilerplate as a completed workflow. Domain owners must provide/verify those instructions, and native reviewers must verify terminology. Current automated multilingual checks establish matching API content and direction, not language quality. Branch protection and any external reviewer assignment remain administrative work, not completed configuration.

## Current catalog review — 13 September 2026

Regenerating the backlog and checking the current snapshot yields 316 page registrations: 148 authored guides and 168 reference-only guides. The 1,116 backlog entries comprise 168 guide-authoring issues, 504 incomplete reference-guide translations and 444 authored-guide translations awaiting native review. Earlier dated audit records retain their original counts. The [current repository audit](../releases/unreleased/documentation-audit-2026-09-13.md) records the validation and remaining boundaries. A current translation hash is not native-speaker approval.
