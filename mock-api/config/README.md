# Application menus and languages

These files are the dummy backend's application configuration. They are separate
from private user preferences and record data.

- `navigation/nexora.json`: Nexora modules, sections, groups, pages, ordering, and roles.
- `navigation/ledger.json`: the small finance product's navigation.
- `localization/shared/{en,ar,hi,ml}.json`: shared messages, menu keys, page-title
  keys, schema field keys, and worklist column keys.
- `localization/products/<product>/{en,ar,hi,ml}.json`: product overrides.

Edit these JSON files and restart the dummy API. Clients pick up the new validated
snapshot on reload/sign-in. No frontend rebuild is needed for changes to supported
menus or translations. This release loads all four dictionaries at sign-in so
switching language in Preferences does not need another request or remount pages.
Responses support gzip and private ETag revalidation.

Run with the repository-supported Node version:

```sh
node mock-api/check-application-config.mjs --strict-navigation
node --test mock-api/application-config.test.mjs mock-api/application-config-http.test.mjs
```

`NEXORA_CONFIG_DIR` can point to an isolated copy of this entire configuration tree.
Invalid files reject API startup. This prevents a partially validated menu snapshot
from replacing a working configuration. Keep the previous files for rollback.

## Change a menu

Find the entry by stable `id`, for example `menu.finance.customer-master`.
Change `order` to reorder siblings, or `parentId` to move the entry to an existing
section/group. Its `pageId` must remain a page the frontend supports. Removing an
entry removes it from the sidebar; remove/restrict its `pages` entry too when the
page should no longer be available through command search or direct navigation.
A page cannot be removed while nodes still reference it. `roles` on a page defines
its availability in the returned page registry. Data APIs retain their own checks.

Module icon names are allowlisted against installed frontend icons; unknown icons
use a safe fallback. IDs, routes, and permission roles are never translated.

## Change a page label

Example contents of `localization/products/nexora/ar.json`:

```json
{
  "schemaVersion": 1,
  "messages": {
    "menu.finance.customer-master.label": "العملاء",
    "page.customer-master.title": "سجل العملاء",
    "field.customer.legalName.label": "اسم المؤسسة",
    "column.customer-master.id.label": "معرف العميل",
    "Save": "حفظ"
  }
}
```

The menu and page have separate keys. This allows different menu entries to open
the same screen. Common controls still accept legacy English source keys, such as
`Save`, while the stable-key migration proceeds. The frontend's bundled catalogs
remain a compatibility fallback for standalone controls and older copy.

Keep named placeholders such as `{count}` unchanged in every translation. All
locale entries must have an English baseline. Put tenant/user data in the existing
data services, not in translation dictionaries.

## Coverage and limits

The checker verifies file schemas, parents, cycles, defaults, English baselines,
and placeholder parity. `--strict-navigation` also requires translated labels
for every returned navigation entry and module short label. It reports page-title
and catalog entries that need review. Text equal to English is reported for review;
technical terms may intentionally remain equal.

All seeded navigation labels and page titles currently have translations in
Arabic, Hindi, and Malayalam. These translations still need native-speaker review.
The page-body catalog pass also covers schema hints, placeholders, controls,
dialogs and shared screen copy. The old combined-shell static JSX scanner is retired.
Update the owning demo fallback generator and run its current localization/profile tests
when canonical catalogs change; see the root testing guide. Historical page-body catalog
coverage remains evidence with its original source identity.


The API returns translation data, not page components. New screen implementations
still require frontend code. The initial catalogs are prefetched for four languages;
namespace loading is a later optimization if product catalogs grow further.
