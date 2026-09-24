# Host-defined workspace modules

Applications may register stable module IDs in `ProductDefinition.modules` and place their own pages under those modules. The shared shell renders only the modules supplied by the host. The active page determines the selected module; choosing another module opens its registered dashboard or, if none exists, its first navigation leaf. A product with one module shows its name without a dropdown.

The host must build the product from the current authenticated navigation response, including tenant, branch and role scope. On a branch or access change it must replace the product and route to an allowed page. The shell falls back to the product default if a former module disappears. Rendering a menu never authorizes an API action; each backend command and query must validate its own current permissions.

The page route and application state belong to the browser tab. A new tab can open a copied URL but changes thereafter are independent. A host should revalidate navigation on focus and after access changes. Unsaved work needs a host-owned navigation guard. The shell does not persist clinical context or drafts.

This is a reusable presentation contract for Healthcare, ERP and School. It does not define those products' modules, permissions, clinical workflows, or backend policies. Validation: `erp-config` product tests and `erp-shell` context tests; host browser acceptance remains separate.
