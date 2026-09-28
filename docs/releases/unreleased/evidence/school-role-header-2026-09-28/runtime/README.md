# Isolated School role-header deployment runtime evidence

This folder contains the deployment and runtime checks for frontend release
`20260928121228378-07561b3d`, built from source
`9c3cea72e624dccb454cfd60fd2d0a34b774a69b` for both frontend and API. It was activated only on the
isolated `frontend.test.pepbits.com` site. The previous release remains
available as rollback target `20260928110944214-b5bb610f`.

The candidate API passed health, navigation, localization and all six School
role-view checks before activation. After activation, all three isolated units
were active; the web and desktop-browser release identities matched the new
release, and public HTTPS release identity plus `/api/health` passed with
ordinary DNS and certificate validation. No rollback was triggered. The
separate public role/browser and 152-page regression results are tracked by the
parent deployment record.

- [Source and package identity](source.json)
- [Candidate preparation result](prepare.json)
- [Activation and backup receipt](activation.json)
- [Active local/public runtime checks](active-runtime-check.json)
- [School role API checks](api-role-check.json)

The evidence contains no credentials, private keys, response bodies or session
tokens. Existing ERP, School and healthcare services and gateway TLS/DNS
configuration were not changed.
