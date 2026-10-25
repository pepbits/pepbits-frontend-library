# Page template demo data

`seed.csv` is the runtime source of initial records and related 360 rows. The API copies it once into each new tenant/application scope in the writable `clinical-templates.csv` snapshot.

`metadata.json` supplies schema/lookup configuration through the API. `patients.json` remains a test fixture only; editing it no longer changes runtime records.

See [the CSV storage guide](../../../docs/features/page-templates-csv.md) for columns, writes, migration, scope and integration limits.
