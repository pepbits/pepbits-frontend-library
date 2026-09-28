# Frontend test-site deployment evidence

This directory contains sanitized evidence from the isolated deployment of
`20260928110944214-b5bb610f` at `https://frontend.test.pepbits.com`.

The public HTTPS browser run passed: 152 static destinations, six dynamic URLs,
four module-header choices and four representative rendered pages; the results
contain no errors. The three read-only healthcare checks also passed, with no
writes, API failures or page errors. The 35 route/runtime smoke checks passed
directly against `tools02` and through the HTTPS gateway; these are two paths
through the same checks, not 70 separate cases. DNS override testing kept
certificate verification enabled.

See [public browser results](public-browser/results.json), [browser log](public-browser.log),
[healthcare results](healthcare-browser/results.json), [healthcare log](healthcare-browser.log),
[gateway verification](gateway-verification.json), [direct runtime summary](tools02-runtime-check.json),
[public runtime summary](public-runtime-check.json), and [renewal-hook check](gateway-activation-renewal.log).
The check sources are [public browser](public-browser.mjs) and
[healthcare browser](public-healthcare-browser.mjs). Representative screenshots are
retained in the `public-browser/` and `healthcare-browser/` subdirectories.

Do not add `.confg/server/frontend-test-20260928/runtime-operations.md`,
TLS private keys, credentials, raw private host files or session tokens here.
Private operator facts stay on the deployment host.
