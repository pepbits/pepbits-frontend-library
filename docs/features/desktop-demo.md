# Independent desktop demo

Feature ID: DSK. State: web-mode desktop host implemented with the copied Tauri host; **native executable not built or tested**. [Delivery record](../releases/unreleased/restructure-phase-6e-7-2026-10-24.md), [test guide 1.0.0](../testing/v1.0.0/PRE-COMMIT.md). Local verification only; all data is fictional.

## User problem and outcome

The original desktop shell (`desktop-clients/apps/desktop`) wrapped the whole product catalogue in an MDI workspace and a Tauri window. `@pepbits-demo/desktop` rebuilds that host from public packages: the full shell with tabs, split view, floating frames, unsaved-change guards and separate native windows, around demo-owned pages over the unchanged demo API. The [app guide](../../demo-apps/desktop/README.md) explains setup and routes; the [source mapping](../../demo-apps/desktop/source-mapping.md) lists every original responsibility.

## User and administrator flows

1. Start the demo API and the app (`npm run dev -w @pepbits-demo/desktop`, port 3410), then sign in with a local fixture account through the shared login screen. Branch and role come from the authenticated session.
2. Opening `/` selects the effective preferred module's home; explicit deep links retain their destination. The Desktop workspace page shows the runtime (browser or Tauri window), whether separate windows are available, the record layout preference and open/split/separate document counts, with shortcuts to records, a new customer, library examples and preferences.
3. Open Customer Master, search and open a row: the record opens in its own tab and the address follows it. Edit and Save writes the demo API record store; required email and address must be completed the first time. A failed save keeps typed values.
4. Open two records and choose Tab options → Split with the last document. Swap the panes, resize them or Make full screen. Close other tabs from the same menu.
5. Type in a record and close its tab, or switch to Human Resources: the workspace asks before discarding unsaved work. Cancel keeps the value.
6. In Preferences, turn off Open records in tabs to show one document at a time, or turn on Floating windows to arrange documents as movable frames with a taskbar. Tenant locks disable managed controls.
7. In the Tauri runtime, Tab options → Open in its own window moves the document into a native window; closing that window returns it. In a browser this action is not offered.
8. Human Resources → Employee Worklist opens read-only employee records. Library examples shows shared components with fictional values in the current formatting and direction.
9. Administrators enable AI only by building with `VITE_AI_ENABLED=true`; the assistant then appears on Customer Master with two explicit use cases. Server policy and credentials stay with the API.

## Integration and failure behaviour

`ApplicationProviders` composes session, accepted preferences and policy (one serialized writer), the runtime catalog and the shell; its new opt-in `workspace` option adds the document workspace and detached-window mode. The desktop supplies its product catalogue, routes, page renderers, a Tauri window port (null in browsers) and an optional AI wrapper. Data adapters use the configured authenticated transport over `/worklists/search`, `/layouts`, `/personal-views`, `/views`, `/exports`, `/worklists/{page}/{id}` and `/records/{key}` with product id `nexora`; the API base URL is `VITE_API_URL`. There is no other-demo import and no frontend data fallback.

Missing configuration shows an alert. Unknown addresses show not-found. A load failure shows a retryable notice. Record saves use the shared editor's versions and operation identity; the API owns validation and authority. A detached-window key for another tenant is refused, and an unreadable key shows an error.

Created customers can reopen their generated URL through the saved-record store even when absent from the generated worklist; shared `ResourceScope`/`useFetch` supplies that read's cancellation and retry lifecycle. The unchanged worklist and saved-record store are separate datasets, so list synchronization after saving is outside this demo's contract. Cancelling a guarded address-driven module change restores the active address as well as retaining edits. A mounted policy refresh replaces conflicting settings and disables the managed control.

Product repositories supply their own definitions and renderers to the same host. For example, inside their configured `WindowPortProvider`:

```tsx
import {ApplicationProviders} from '@pepbits/shell/application-providers';
import {createPageRenderer} from '@pepbits/page-engines/renderer';

// All variables here are supplied by the product, using its own public API adapters.
const ProductPage = createPageRenderer({renderers: productRenderers});
<ApplicationProviders apiBaseUrl={apiBaseUrl} productId={product.id}
  brand={brand} productForRole={productForRole} navigation={navigation}
  workspace={{render: target => <ProductPage page={product.pages[target.pageId]} target={target}/>}}/>;
```

## Compatibility, localization and accessibility

Effective preferences (theme, typography, density, radius, table settings, formatting, motion, shortcuts, tabs and floating windows) come from the host. The canonical API catalog localizes shared UI; desktop-owned wording falls back to English. The route matrix renders every route under default, Arabic RTL, reduced motion and a locked preference with jsdom axe (contrast excluded); the browser check runs full-document axe including contrast. Automated checks do not establish assistive-technology or language acceptance.

Inline edit buttons announce the column label and the displayed, preference-formatted value, including rich cell content; opening the editor still uses the raw value. To change language, open Preferences → Language & help, then select the language.

## Acceptance and limitations

| ID | Contract and verification |
| --- | --- |
| DSK-01 | Shared sign-in and provider chain against the demo API; configuration alert without a base URL |
| DSK-02 | Eleven route patterns render through the page-engines registry under four profiles with no axe violations; address round-trips |
| DSK-03 | Worklist → record tab → edit/save over HTTP; create and saved-record reload; failed-save retention and explicit retry |
| DSK-04 | Split, swap, one pane; close others; dirty-close and module-switch confirmation, including cancelled address changes; floating frames |
| DSK-05 | Tauri window port (original three cases plus three) with the Tauri API mocked; detach offered only with an available port; detached single-document and foreign-tenant modes |
| DSK-06 | Preferences single update path, locks and Arabic RTL over the runtime catalog |
| DSK-07 | AI off by default; configured assistant uses the API policy routes |
| DSK-08 | `vite build`, typecheck, forced root CI, shell Chromium, documentation and protected-path checks |

Not verified: a native Tauri build or run, native child windows and native WebDriver lifecycle (the original `detach-smoke` example is retained, not run), native Sentinel panic forwarding, the original product catalogues inside this host, deployment, and human accessibility/language review.

## Operations and support

Use Node 24 for the API. The integration launcher owns temporary storage and stops its API, preview server and browser on success, failure, cancellation or deadline. Keep credentials and tokens out of receipts. Removing this app does not change the original desktop, its deployment or the API.
