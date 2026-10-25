# Library restructure phase 7a — publishable packages

Status: **unreleased candidates; not published**. Date UTC: **25 October 2026**.
Branch: `restructure/phase-7a`; base: `1d3336df09a7e3287dde5d5648143217fb51730c`.
No commit, tag, push or deployment. Package versions: **0.1.0** for all twelve
libraries; private apps/tooling remain 0.0.0. Testing guide:
[1.0.0](../../testing/v1.0.0/PRE-COMMIT.md). Executor: Codex in the local server
worktree; hosted CI and human review are not claimed.

## Changes and user impact

Added per-package ESM/declaration builds using the existing TypeScript compiler,
preserved client directives and module worker URLs, copied CSS modules/fonts,
explicit typed export maps, restricted files, repository metadata, `UNLICENSED`
and GitHub Packages registry configuration. All **76** previous export entries
remain; **61** distinct imports found in demo source/CSS resolve to them. Internal
library dependencies are `^0.1.0`; host React/React DOM peers remain external.
The `patterns/testing` helper retains an optional Testing Library peer.

Changesets is the only added dev dependency. The all-package minor changeset was
applied with `npm run release:version`, generating twelve changelogs at 0.1.0.
Private packages are excluded from versioning/publication. Root scripts provide
manual version/build/pack/publish operations; the last requires an owner-supplied
token and has **not been run**. No token was created or supplied by this work.

Workspace tools select `pepbits-source`; installed consumers select compiled
exports, requiring no `transpilePackages` or TypeScript paths. UI behavior and
public API names are unchanged. The only library `src` edit is the isolated shell
browser fixture's source-resolution configuration. See
[Publishing](../../development/PUBLISHING.md), [packages](../../../packages/README.md)
and [phase 7a plan](../../architecture/PACKAGE-RESTRUCTURE-PLAN.md#phase-7a-status).

## Installation and compatibility

The tarballs are local installation artifacts, not registry releases. Hosts
continue to supply providers, adapters, effective preferences/tenant locks,
canonical catalogs and Tailwind styling; installed Tailwind scans `dist`.
Import optional reference-font CSS from the Next layout/Vite entry so the bundler
resolves its font URLs. CSS modules remain CSS side effects. Only ESM is emitted.

Two independent consumers under `/tmp/pepbits-phase7a/consumers` install all twelve
tarballs with no symlinks, workspace dependencies, aliases or TS paths. The
requested `$HOME/.cache/pepbits-phase7a/consumers` directory is read-only in this
sandbox; this path deviation is explicit. Their synthetic fixture uses tokens,
fonts, Button/FieldShell/Input, Card, a CSS-module LabelPreview, a page-template
workspace, shell/session/localization/preferences providers, data/AI/icon exports
and the XLSX module worker. The Next Server Component also directly imports a
client-marked UI component. Consumer node_modules are removed after each run.

## Data, errors and security

No data schemas, stored records, catalog sources, component permissions,
preference resolution or runtime retry/draft semantics change. Original font
licenses/provenance ship unchanged. Tarball file/content scans reject test/source
files, environment files, unexpected artifacts, known credential patterns and
absolute home paths; this is a packaging check, not a general security audit.
The install still reports the pre-existing four audit findings (one moderate,
three critical); no unrelated dependency remediation is included.

## Verification and limits

Final implementation digest: `865c739678a3254f838ddcef19f244e16f8b0c64a8b04c4567782a11bfb9c8c0` over 2108 files; scope and changed-file hashes are in [source identity](evidence/restructure-phase-7a-2026-10-25/source.json). Documentation is excluded from that digest.

| Required check | Exact local result |
| --- | --- |
| Root `npm install` | Exit 0; lockfile updated for versions/metadata and Changesets; four existing audit findings |
| Forced `npm run ci -- --concurrency=3` | **69/69 tasks, 0 cached; 6,753 passing tests, 4 existing skips; 362 passing files, 2 skipped files; 20/20 tooling tests**; 16m51.415s |
| Shell Chromium | **18/18**, one file; 11.75s; subsequent shell typecheck passes |
| Library build and `release:pack` | **12 tarballs**, 679 files, 965,416 bytes; no source tests, environment files, known credential patterns or absolute local paths detected |
| Package publication rehearsal | **12/12 `npm publish --dry-run`**, version 0.1.0, registry https://npm.pkg.github.com; no token |
| Next App Router webpack consumer | Production build + **11/11** Chromium checks pass, 19 seconds for build/render; all twelve final tarball integrities match |
| Vite React consumer | Typecheck/production build + **11/11** Chromium checks pass, 9 seconds for build/render; all twelve final tarball integrities match |
| Reports explicit production build + live mock API | **22 workflows, 49 routes**, zero page/console/HTTP errors and axe violations; 483 backend source files compared, zero mismatches |
| Documentation (required jiti invocation, plus Node) | **220 files** pass link/heading, testing inventory and release/evidence checks |
| Protected paths | Required git status output empty |

Both consumers have zero page/console errors or failed requests. CSS-module geometry, compiled utilities, tokens, an actual WOFF2 response and the XLSX module worker pass. Each app's node_modules is deleted; browser/server processes are stopped. Package sizes and SHA-256/integrity hashes are in [tarballs.json](evidence/restructure-phase-7a-2026-10-25/tarballs.json); production build logs and [consumer results](evidence/restructure-phase-7a-2026-10-25/consumers.json) are retained.

The four skips are the pre-existing MedBand/RCM browser-parity cases, not new exclusions. CI emits existing jsdom chart/navigation/act warnings. Sandbox shared-cache writes are refused, so no cache claim is made. The initial library build took about 26 seconds; this is not a controlled performance benchmark against another source.

Earlier attempts remain explicit: missing Vitest SSR source conditions (fixed), font CSS imported through Tailwind in Vite (entry import fixes asset rebasing), an overbroad absolute-path scan matching relative imports (fixed), a temporary cache override hiding Playwright's existing browser (explicit browser path), and reused consumer lockfiles retaining older local tarballs (fresh lockfiles plus all-package integrity assertions). After CI started, changes were limited to the standalone browser fixture resolver, consumer/release validation tooling and documentation; focused shell checks and the final artifact/consumer sequence cover them. No component implementation changed.

The [evidence summary](evidence/restructure-phase-7a-2026-10-25/verification.json)
records commands, counts, source hashes, earlier failures and final outcomes.
The [export inventory](evidence/restructure-phase-7a-2026-10-25/exports.json)
and [applied initial changeset](evidence/restructure-phase-7a-2026-10-25/initial-changeset.md)
retain the release inputs.

No GitHub registry authentication/publication, product repository migration,
deployed release, native executable, live production provider or native-speaker
acceptance is claimed. Browser consumer checks are local built artifacts; the
Reports check uses the unchanged fictional mock API and separately identified
source-matched runtime artifacts.

## Upgrade, rollback and publication

The owner must provide an appropriately scoped GitHub classic token and confirm
organization/SSO/package access before the later manual publication. Product
consumers then use read-scoped tokens, install reviewed versions and keep their
lockfiles. Follow the [manual workflow and rollback/deprecation instructions](../../development/PUBLISHING.md#manual-publication-by-the-owner).
Before publication, discard/rebuild candidate artifacts to replace them. After
publication, publish a corrected version, restore known-good consumer lockfiles
and deprecate faulty versions as authorized; do not overwrite a version.
Protected application/backend/deployment paths remain outside this change.
