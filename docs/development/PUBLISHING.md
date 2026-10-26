# Publishing the PepBits library

All twelve **0.1.0 packages were published in phase 7b** to the `@pepbits` scope on
GitHub Packages (`https://npm.pkg.github.com`) from repository
`git@github.com:pepbits/pepbits-frontend-library.git`. The preparation and publication
records retain their original scope. Future publication remains a manual owner operation;
root test-site delivery is separate and opt-in.

## Build and installation contract

The publishable packages are `ai`, `components`, `data`, `i18n`, `icons`,
`page-engines`, `patterns`, `platform`, `preferences`, `shell`, `tokens` and `ui`.
Every manifest has repository/directory metadata, a restricted `files` list,
`UNLICENSED`, and the GitHub registry. Bundled fonts retain their OFL notices and
provenance. Private demo apps and `@pepbits/tsconfig` are never published;
`@pepbits/testing` is reserved and currently absent.

`npm run release:build` uses the existing TypeScript compiler through
[build-package.mjs](../../tooling/scripts/build-package.mjs), in Turbo dependency
order with concurrency three. Each module becomes ESM `.js` plus `.d.ts` under
`dist/`; no CommonJS output is provided. Public entrypoints and module workers
form the build roots. Tests and private browser fixtures are excluded. Relative
imports, directory barrels, declaration references and worker URLs resolve to
explicit `.js` files. Existing `"use client"` directives survive unchanged.
No source maps are shipped, avoiding references to unpublished source files.

All existing public subpaths remain, including i18n/preferences `./react`, AI
`./config`/`./client`/`./ui`, page-engine `./templates`, and tokens CSS/font paths.
The [export inventory](../releases/unreleased/evidence/restructure-phase-7a-2026-10-25/exports.json)
records every export and the demo import audit. JavaScript exports have `types`,
`import` and `default`; CSS/fonts have `default`. There are no new deep-source
imports. `@pepbits/patterns/testing` remains an opt-in test helper; test consumers
install its optional `@testing-library/react` peer. React 19+ is a host peer;
React DOM is a peer where used. React is optional for the pure i18n/preferences
entrypoints but required when using their React subpaths. Internal library
ranges are `^0.1.0`; third-party runtime dependencies retain their prior versions.

CSS and CSS modules are copied next to JavaScript, font URLs remain relative,
and `sideEffects: ["**/*.css"]` prevents CSS removal. Consumers need normal CSS
module support (Next App Router webpack and Vite React are verified), with no
`transpilePackages` or TypeScript compilation of dependencies. The host still
compiles Tailwind utilities and supplies its global styling. For a stylesheet
beside the consuming application's `node_modules`:

```css
@import "tailwindcss";
@import "@pepbits/tokens/tokens.css";
@source "./node_modules/@pepbits/ui/dist";
@source "./node_modules/@pepbits/components/dist";
@source "./node_modules/@pepbits/patterns/dist";
@source "./node_modules/@pepbits/page-engines/dist";
@source "./node_modules/@pepbits/shell/dist";
@source "./node_modules/@pepbits/ai/dist";
```

Adjust paths relative to the stylesheet. Tailwind v3 uses equivalent
`content` globs ending in `dist/**/*.js`. Import global token CSS in the Next
root layout or Vite entry. Import optional font CSS directly from that JavaScript
entry with `import "@pepbits/tokens/reference-fonts.css"`; this lets the bundler
resolve font assets before Tailwind/PostCSS processing. In the tested Vite setup,
putting font CSS inside a Tailwind CSS `@import` left relative URLs unresolved.
Hosts keep their existing preference, tenant-lock,
localization, session and adapter composition; packaging adds no persistence,
authorization, endpoint, catalog or component behavior.

## Workspace development

Root TypeScript `customConditions`, demo Next webpack configurations, and
Vite/Vitest client and SSR resolvers explicitly select `pepbits-source`.
The condition points to the existing `src` files, so direct tests and demo
hot reload see edits immediately, even while a package build replaces `dist`.
Workspace Tailwind continues scanning `src`. Do not enable this internal
condition in installed consumers: tarballs contain `dist`, not source.

Turbo already runs dependency builds before builds/tests. Typechecks and
runtime tests still check source; the library build separately checks declarations
against compiled dependency outputs. `npm run ci -- --concurrency=3` forces all
tasks. The extra twelve library builds took about 26 seconds in the initial
isolated build; consumer proofs are separate from routine CI.

## Version and inspect locally

Use Node 22+ and the repository's declared npm version. Heavy operations on this
shared server must hold `flock /home/pepadmin/.cache/pepbits-heavy.lock`.

1. Run `npm install` at the workspace root.
2. For a new library change, run `npx changeset`, select affected public packages
   and describe its consumer impact. The twelve libraries form a fixed version
   group. Private workspaces have `private: true` and Changesets disables their
   versioning/tagging; they are not temporarily ignored release candidates.
3. Run `npm run release:version`, review versions/changelogs and internal ranges,
   then `npm install` to synchronize the lockfile. Versioning neither commits nor
   publishes. The initial all-package minor changeset has already been applied:
   **do not apply it again**. Its original text is retained in release evidence.
4. Run the [testing guide](../testing/README.md) and source-appropriate checks.
5. Run `npm run release:pack`. It builds libraries and performs a publication
   rehearsal using **actual local `npm pack` tarballs**, without registry writes.
   It prints a temporary destination and writes `manifest.json` with sizes and
   integrity hashes. `RELEASE_PACK_DIR` selects an explicit directory. It rejects
   tests, source trees, environment files, unexpected files, credential patterns
   and absolute home paths. Pattern scanning supplements review; it cannot prove
   the absence of every possible secret.
6. Inspect each `tar -tzf` listing and perform `npm publish --dry-run` from each
   public package directory. Verify the registry, name and version. A dry run
   does not authenticate publication or prove registry permissions.

Changesets is the only new dev dependency; its fixed/private configuration is
based on the [Changesets configuration contract](https://changesets.dev/guide/config).

The reproducible consumer driver is
[verify-package-consumers.mjs](../../tooling/scripts/verify-package-consumers.mjs).
Supply `RELEASE_PACK_DIR` and optionally `CONSUMER_PROOF_DIR` (default
`$HOME/.cache/pepbits-phase7a/consumers`). Run under the shared lock, with
`LD_LIBRARY_PATH=$HOME/.local/opt/pw-libs/root/usr/lib/x86_64-linux-gnu` on this
server. If `XDG_CACHE_HOME` is overridden, also set
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright` to use the existing browser
installation. It installs all twelve tarballs into independent Next/Vite applications,
builds them, checks their production servers in Chromium, stops servers/browsers,
and deletes each consumer's `node_modules` in `finally`. The phase 7a sandbox
used `/tmp/pepbits-phase7a/consumers` because the requested home cache is read-only.

## Manual publication by the owner

Publication is intentionally **not performed in phase 7a**. The owner must supply
a GitHub personal access token (classic) with `write:packages`, repository/package
write access and any organization SSO authorization. Consumers need a classic
read token with `read:packages` and permission to the packages. GitHub associates
packages through the manifest repository URL; first publication is private.
Confirm organization access and repository linkage after publishing. See
[GitHub's npm registry guide](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
and [package permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages).

The root `.npmrc` contains only these settings, never an actual credential:

```ini
@pepbits:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

After reviewing the versioned source and local artifacts, provide `NPM_TOKEN`
through the server's secret environment (never a committed file, command argument
or retained log), then run:

```sh
flock /home/pepadmin/.cache/pepbits-heavy.lock npm run release:publish
```

The script refuses a missing token, builds/packs/validates all twelve packages,
and publishes tarballs in dependency order to the explicit GitHub registry.
This command is the registry-writing step. It neither commits, tags nor pushes.
If publication stops midway, record successful versions, inspect the remaining
artifacts and publish only the missing tarballs; rerunning the full script would
encounter already published versions. Never overwrite or silently relabel a
published version. Keep tokens out of evidence, and remove them from the session
when finished.

## Developer quick start for product apps

Products already migrated (Platform Enterprise, Healthcare, ERP, School) have this set up; a developer only supplies a token. For a new app:

1. Create a GitHub personal access token (classic) with `read:packages`; your account needs access to the `pepbits` organisation. Never commit it.
2. Add an `.npmrc` beside the app's `package.json`:

   ```ini
   @pepbits:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
   ```

3. `export NPM_TOKEN=<token>` and install the packages you need, for example `npm install @pepbits/ui @pepbits/components @pepbits/tokens @pepbits/shell @pepbits/patterns @pepbits/page-engines @pepbits/i18n @pepbits/preferences`.
4. Add `@pepbits/tokens/tokens.css` and the Tailwind `@source` lines from [the installation contract](#build-and-installation-contract) to the global stylesheet. Next.js App Router and Vite React need no `transpilePackages`.
5. Compose the shell, preferences/tenant locks and localization once in the host, as the product hosts do (`frontend/packages/healthcare-ui`, `erp-host`, `education-host` in the product repositories). Working examples using only public exports are in [`demo-apps/`](../../demo-apps/README.md), e.g. [`demo-apps/healthcare`](../../demo-apps/healthcare/README.md).

CI supplies the token from a secret (Jenkins credential `pepbits-npm-read-token`). Shared-package changes reach products only when a new version is published; products stay on the version pinned in their lockfile until they upgrade.

## Product consumers and rollback

A product uses the same `.npmrc` with its read-only token supplied as `NPM_TOKEN`,
then installs the published versions, for example:

```sh
npm install @pepbits/tokens@0.1.0 @pepbits/ui@0.1.0 @pepbits/components@0.1.0
```

Pin the reviewed set in the product lockfile. These 0.1.0 versions are now published for authorized consumers. Phase 7a tarballs
were local proof; phase 7b publication and each product migration have their own records.

For a faulty later release, restore the consumer's last known-good dependency
versions and lockfile, reinstall and rebuild. Publish a corrected version through
a new changeset. When authorized by the owner, deprecate the bad version with a
clear replacement message (repeat for affected packages):

```sh
npm deprecate @pepbits/ui@0.1.0 "Use the reviewed replacement version" --registry=https://npm.pkg.github.com
```

That deprecation command is illustrative; do not deprecate the published 0.1.0 version
without an actual defect, replacement and owner authorization.
Deprecation warns future installers; it does not remove installed code. Package
access, any deletion/restoration and org policies remain owner operations. There
are no data migrations or preference resets to roll back in phase 7a. Failed
builds/packs stop before publication; existing component error/retry/draft
semantics are unchanged. Exact local results and limits are in the
[phase 7a release record](../releases/unreleased/restructure-phase-7a-2026-10-25.md).

## Phase 8 registry-only consumers

The twelve 0.1.0 packages are published (phase 7b). Root `npm ci` links local workspaces and does not fetch GitHub Packages, so it requires no `NPM_TOKEN`. The root `release:pack` remains a library publication rehearsal; it does not recreate old product source archives. Former source snapshot packers live in the product repositories and are retired by their registry migrations. Their historical hashes remain evidence. Platform-owned packages retain their separate release pipeline. All four products (Platform Enterprise, Healthcare, ERP and School) install the published packages, so no consumer depends on the removed workspace. See [phase 8 operations](TEST-SITE.md).

## 0.2.0 local preparation

The [record form release record](../releases/unreleased/record-form-engine-2026-10-26.md) covers the new fixed-group changeset, versioned manifests/changelogs, lockfile and twelve local tarballs. Published 0.1.0 remains available; this task does not publish 0.2.0. Apply the backend preference migration and catalog update alongside a future product upgrade.
