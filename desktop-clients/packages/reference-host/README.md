# Reference module host

`@pepbits/reference-host` is the shared adapter contract for the four reference modules. It does not create another application shell, authenticate users, generate records, or store preferences.

Import `ReferenceHost`, `ReferenceModuleProps`, and `referenceScopeKey` from the public package. A module accepts `{path, host}`; `path` is its original route, including any dynamic record ID and query string. The host supplies authenticated tenant, application, branch, user, and role metadata; effective `UserPreferences`; typed `request<T>`; optional raw `fetch` for downloads; and navigation functions. Scope metadata is never API authorization: the server independently checks the session, application, branch, and role.

Mount modules inside the existing `LocalizationProvider` and semantic token theme. Import `@pepbits/reference-host/styles.css` in the host stylesheet before Tailwind source directives, and include the module source directories in Tailwind's content scan. The provider applies presentation preferences, language direction, density, motion, font scales, and corner radius. Theme colors and the selected font family come from the host's semantic token variables. `preferenceHost` exposes managed preference policy and the host's update callback; modules must not create a second preference store.

`request` must reject unsuccessful responses and return parsed API data. `fetch` preserves response headers and binary bodies. Both must attach authenticated host transport credentials and route to the configured API, without embedding fictional fixtures in the frontend. The library integration namespaces calls under `/reference-modules/{reports|erp1|erp2|school}`; another host can use its own compatible API implementation. Reject external URLs from module API paths.

Use `referenceScopeKey(host.scope)` as the module boundary key when identity, application, branch, roles, or module changes. Scope changes dispose the old module, clear transient UI, and reload API state. `ReferenceLink` preserves the real host URL for modified clicks while normal clicks call `navigate` with the original module path. `hrefFor` supplies that host URL; `openInNewContext` handles explicit new-window actions.

This package also exposes host navigation hooks and preference-aware formatting. These are module adapters, not replacements for the existing shell's authentication, navigation, localization, or persistence.
