# Backend-owned demo contracts

These files own the fake backend's validators, clinical types, policies and fictional data.
They have no frontend dependencies and are not published as UI packages. Update them with
API behavior/tests. Do not import demo apps or UI packages here.

[Provenance](provenance.json) records each original source path and SHA-256 at the phase 8
base commit. Relative imports were rewritten. Navigation is the original serializable
catalog (including its JSON icon metadata), with no React/icon runtime. Sentinel contains
only the event sanitizer. Page templates retain type contracts only, and documentation retains its release pointer; unused presentation catalogs/types are omitted. The server-only icon type is opaque. Historical source names
in provenance identify origins; they are not runtime dependencies.
