# Repository working rules

For code, design, feature or integration changes, read [development rules](docs/development/RULES.md) and the [current testing guide](docs/testing/README.md). For documentation work, start at [docs/README.md](docs/README.md). More specific directory instructions still apply.

- Reuse shared UI components and typed page engines. Keep the shell, application state, data adapters and primitives within their established package boundaries.
- Apply effective preferences and tenant locks to every applicable page/control. Do not bypass them with local state, hardcoded formatting or fixed presentation values.
- Use canonical backend localization catalogs and regenerate fallbacks/examples when their sources change.
- Keep user help, feature guides, test cases and release evidence aligned with changed behavior. Follow the feature/release templates and preserve historical evidence.
- Validate documentation with `node docs/tools/check-docs.mjs`. Run implementation checks appropriate to the actual change; a documentation-only edit does not require repeating the full runtime suite.
- Record exact test scope and source identity. Do not describe a local build, mocked test or browser-rendered desktop shell as a deployed release, production integration or native executable test.
- Respect the user's task scope and existing authorization. These rules do not add a separate approval requirement. Do not discard unrelated working-tree changes or publish merely to complete a documentation record.

- The root npm workspace owns build/run/CI/deployment tooling. `mock-api/` must import no frontend modules, including relative paths.
- `source/` and `demo-pages/` remain protected original inputs. The phase 8 owner authorization retires the former shell tree; no additional protected-path approval is introduced for root tooling.
- Test-site packaging is local verification. Deployment, publication, commits and pushes require the task’s explicit scope. See [service and receiver contracts](docs/development/TEST-SITE.md).
