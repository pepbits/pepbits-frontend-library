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

As of 13 September 2026, the latest recorded demo release is `20260912002147213-851cb66e`, containing the DCP designer style update on both sites. See the [verified deployment](releases/unreleased/dcp-style-deployment-2026-09-12.md) and [current delivery index](releases/unreleased/README.md). The local release symlink was checked during this documentation audit; no fresh deployment or public browser run is claimed. Full hosted feature-browser acceptance remains unsuccessful in the recorded follow-up. The [repository documentation audit](releases/unreleased/documentation-audit-2026-09-13.md) lists corrected guides, validation coverage and remaining gaps.

The Library inventory contains 159 destinations. Runtime documentation covers 316 page registrations: 148 authored workflow guides and 168 inherited reference-only guides. The [generated backlog](documentation/backlog.json) records 1,116 authoring/translation-review items. These comprise 168 authoring issues, 504 incomplete translation entries and 444 current translations awaiting native review. They are individual issues, not 1,116 missing pages. The field/tour translation gaps on Customer Master, Patient Master, Preferences and Documentation Center are now filled in the local catalogs; all 148 authored guides have complete catalog coverage in Arabic, Hindi and Malayalam. Native approval is still pending. See the [review completion record](releases/unreleased/documentation-translation-review-2026-09-11.md). Native/domain review, physical-device integration and production-service acceptance remain explicitly pending where documented. Automated validation does not certify those reviews.

Run `node docs/tools/check-docs.mjs` from the repository root to check documentation navigation, the active guide, inventory and release evidence. See [development rules](development/RULES.md) for when documentation must change.
