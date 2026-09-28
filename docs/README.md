# Enterprise frontend documentation

This repository provides reusable desktop-first frontend pages and components for ERP, healthcare, school and other SaaS applications. Start here for user instructions, integration guidance, development rules and release evidence.

The documentation layout follows the [Pepbits framework documentation](https://github.com/pepbits/pepbits-framework/tree/769a4c0e267f15653ef0994bd8df7da2ef14fc42/docs). The frontend retains its own package versions, source history and deployment records. Java/Maven release identities from that repository do not apply here.

| What you need | Read |
| --- | --- |
| Understand the product and implemented feature families | [Feature catalog](features/README.md) |
| Use the Library and understand what changed | [Library user and integration guide](features/library-preferences.md) |
| Reuse the healthcare record presentation in other SaaS apps | [Record page components](architecture/record-page-components.md) |
| Follow settings from the API to a component | [Architecture and flows](architecture/library-preferences.md) |
| Know the mandatory component, preference and documentation rules | [Development rules](development/RULES.md) |
| Add or modify a feature | [Change workflow](development/README.md) |
| Run the current checks and understand their limits | [Testing guide](testing/README.md) |
| Find the current delivery and its actual publication state | [Unreleased delivery](releases/unreleased/README.md) |
| Understand versions, patches and release acceptance | [Versioning policy](releases/VERSIONING.md) |
| Reuse release, feature and evidence templates | [Documentation templates](releases/templates/README.md) |
| Find earlier illustrated guides and PDFs | [Reports index](reports/README.md) |

See the [shared documentation lifecycle](documentation/README.md) for new pages, impact receipts, translation revisions and review requirements.

## Structure

```text
docs/
  README.md
  architecture/             # Technical responsibilities and flows
  features/                 # User instructions, behavior and integration
  development/              # Rules and contribution workflow
  testing/
    current.json            # Active testing-document version
    v1.0.0/                 # Cases, matrix, instructions and route inventory
  releases/
    VERSIONING.md
    CHANGELOG.md
    templates/
    unreleased/             # Current working-tree scope, manifest and evidence
  reports/                  # Links to historical guides and PDFs
  tools/                    # Documentation validation
```

Existing guides remain at `desktop-clients/docs/`; their paths and screenshots are preserved. This index links to them rather than moving or duplicating them. The latest release record takes precedence over older deployment claims for the specific change it describes.

## Current status

As of 28 September 2026, the isolated [frontend test site](releases/unreleased/school-role-header-2026-09-28.md) is active at `https://frontend.test.pepbits.com` on release `20260928121228378-07561b3d`. Its School module selector provides Administrator, Teacher, Student, Parent, Librarian and Accountant views under server-enforced demo grants. The current release record retains exact local and public verification evidence. The [first deployment record](releases/unreleased/frontend-test-deployment-2026-09-28.md) preserves setup and prior-release evidence. This isolated site does not change the latest deployment on the two existing demo hosts, [DCP designer style](releases/unreleased/dcp-style-deployment-2026-09-12.md). See the [test-site runbook](../desktop-clients/docs/frontend-test-deployment.md) and [current delivery index](releases/unreleased/README.md). Historical hosted feature-browser failures remain in the [repository audit](releases/unreleased/documentation-audit-2026-09-13.md).

The Library inventory contains 159 destinations. The current immutable help patch is `2026-09-28-school-role-views`, with 468 page-guide registrations. The [generated backlog](documentation/backlog.json) records 1,572 existing authoring/native review issues: 168 inherited guide-authoring issues and 1,404 native translation reviews. These are individual review issues, not 1,572 missing pages. Automated validation and Claude-produced translations do not establish native-speaker approval. Native/domain review, physical-device integration and real production-service acceptance remain separate where documented.

As of 28 September 2026, a separate `2026-09-28-reference-modules` documentation release covers the Reports, ERP1, ERP2 and School reference frontend modules (152 pages). All 152 page guides are authored and source-reviewed against the actual ported route/page components and API contracts; see the [feature guide](features/reference-modules.md), the [guide audit](reference-import/GUIDE-REVIEW.md) and the [delivery record](releases/unreleased/reference-modules-2026-09-28.md). Native-speaker (Arabic/Hindi/Malayalam) translation review and full interactive browser acceptance for these 152 pages remain explicitly pending; the module import's own implementation/build/regression evidence is tracked separately in the delivery record, not in this documentation index.

Run `node docs/tools/check-docs.mjs` from the repository root to check documentation navigation, the active guide, inventory and release evidence. See [development rules](development/RULES.md) for when documentation must change.
