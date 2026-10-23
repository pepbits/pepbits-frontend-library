# Developer Library source mapping

This is a recreation against the public library APIs, with the original workspace left intact. All paths below describe read-only reference sources.

| Original source under `desktop-clients/` | Showcase destination / boundary |
| --- | --- |
| `packages/erp-screens/src/library/catalog.ts`, `component-catalog.tsx`, `demos.tsx` | `src/catalog.ts`, `src/gallery.tsx`, and individual `src/examples` files; searchable groups, descriptions, reset and generated copyable source retained |
| `packages/erp-screens/src/library/reference-pages.tsx` | Foundations, policy playground and provider integration guide; shortcuts use the part-1 shell registry, full workspace demonstrations pending |
| `packages/erp-screens/src/page-library/` | Page engines area with fictional Item/Record definitions; product navigation launchers excluded |
| `packages/erp-screens/src/templates/template-library.tsx` and template demo | Selectable twelve engines and six views with fictional host definitions and adapter; product template catalog not copied |
| `scripts/library/generate-examples.mjs`, `scripts/templates/generate-example.ts` | `scripts/generate-snippets.mjs`; complete executable files are shown, with no handwritten code copy |
| `clinic-billing/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `clinical-triage/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `care-pages/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `op-consultation/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `comprehensive-consultation/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `clinical-consultation/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `op-registration/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `clinical-templates/library-page.tsx` | Healthcare demo later; product launcher excluded |
| `reference-modules/library-page.tsx` | Matching product demos later; no product module wrapper copied |
| `dcp-designer/library-page.tsx` | Replaced by public field and form-designer examples; original launcher excluded |
| `device-integrations/library-page.tsx` | Replaced by an in-memory device workflow and simulated platform connector; no native hardware |
| `identity-devices/library-page.tsx` | Replaced by generic subjects and simulated capture/manual review; product subjects remain host-owned |
| `label-printing/library-page.tsx` | Replaced by synthetic label artwork and compatible stock; product mappings excluded |

Primitive source-parity controls/dialog were excluded in phase 2 and are not recreated. Every currently exported primitive/component runtime identifier is checked against the example source. Higher-level screens exercise their child renderers and helpers through the composed engine; this does not claim every helper branch, workflow permission, template/view combination or server protocol has browser acceptance.
