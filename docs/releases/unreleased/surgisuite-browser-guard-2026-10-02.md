# SurgiSuite browser identity guard correction

Prepared 2 October 2026. Status: verification correction tested; staged browser acceptance and deployment pending.

The normal-terminal diagnostic `login-reproduction-7uzr5rpp` confirmed HTTP 200 at host sign-in, one visible module selector, an unmounted login form, and no browser, console or request errors. The earlier staged Origin correction therefore resolved sign-in. The next test aborted when the shared API-target guard interpreted `/api/reference-modules/surgisuite/api/auth/me` as a different API, although its host and root API path matched the intended staged API.

The verification harness now compares parsed URL origins and exact paths. It permits the known Quality and SurgiSuite identity endpoints only for GET on the expected API origin and root path. Module login/logout, unknown namespaces, unrelated hosts, wrong API prefixes and user-info URLs remain rejected. The guard forwards requests to the actual API; no business response is mocked or replaced. The application selector, login flow, permissions and timeout are unchanged.

Three suite-registry/API-target tests pass, including the new negative cases. Twelve private operator safeguards pass. Resume validation hashes all 2,309 retained artifact files and permits only the two explicitly reviewed E2E verification-file changes; it rejects product-source edits and unreviewed verification hashes. The accepted build identity remains `65dbb2db1ec3736c6e0fed2fc1b75a4857ebb1d45dad79f68ed7d50d2e75f5c9`; the verification source identity is `6898a81749c1682105f8fa18806286c0a272d6c9a89aa858b467421cc77c60cd`. The original build receipt and failed browser evidence are preserved.

The agent attempted the corrected staged reproduction, but loopback socket creation returned EPERM before browser startup. This is not a passing runtime test. The operator can rerun `reproduce-staged-login.py` in the existing private deployment directory to capture login diagnostics and execute the original full SurgiSuite suite using the retained build. `deploy.py --resume-browser` subsequently executes all staged and public gates. Neither command bypasses acceptance or declares the site deployed before final verification.

Application product sources and compiled artifacts were not changed for this correction. Runtime acceptance, full public verification and deployment remain pending. Earlier [SurgiSuite implementation evidence](surgisuite-reference-2026-10-02.md) retains its original scope and source identity.
