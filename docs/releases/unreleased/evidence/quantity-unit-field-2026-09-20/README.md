# Quantity/unit component verification

Local automated library checks, 20 September 2026. These are component/unit/build checks, not real application inventory end-to-end evidence. No healthcare INV acceptance case is marked passed.

Run from `desktop-clients` with Node 24.21.0 and the existing installed lockfile:

```sh
./node_modules/.bin/vitest run packages/ops-ui/src/quantity-unit-field.test.tsx
npm test -- --maxWorkers=2 --minWorkers=1
npm run typecheck
npm run build
npm run verify:form-controls
npm run verify:shared-components
npm run verify:localization
npm run verify:library
npm run verify:library-preferences
npm run verify:documentation
node ../docs/tools/check-docs.mjs
node --test ../docs/tools/documentation-contracts.test.mjs
```

`all-tests.log` retains the first full-suite failure for the missing catalog registration. `all-tests-final.log` is the successful complete rerun (1,676 tests). `documentation.log` retains the gate failure; catalog receipts were subsequently refreshed and the remaining failure is the unchanged header/shell-host receipts. `source-hashes.json` records the checked implementation and runnable example. No hosted CI, live API, browser, native, screen-reader, publication, consumer pin or deployment claim is made.

The later `documentation-repaired.log` and `doc-links-repaired.log` record successful gates after the explicit shell source-history review. Earlier failure logs remain unchanged. There are still 1,116 inherited authoring/native-review backlog items; passing the ordinary gate does not clear strict release acceptance.
