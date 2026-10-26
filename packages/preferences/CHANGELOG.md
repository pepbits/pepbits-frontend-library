# @pepbits/preferences

## 0.2.0

### Minor Changes

- Add the shared RecordForm engine and AllyVora reference presentation to RecordSectionLayout, with Single page, Tabs, Guided steps, Side steps and Accordion, retained mounted inputs, read-only mode and host-owned validation/actions. Add RecordSummaryBand and FormRulesDrawer. Add common form columns, summary, validation timing and unsaved-work preferences; reuse shared density, normalize legacy rail to scroll, and expose Forms with tenant-policy controls in Preferences.

  Include the unreleased shared ERP parity additions since 0.1.0 (60b1428): plain RecordPage/RecordSectionLayout appearance and configurable context width; worklist toolbar, leading context, creation wording, cell and row-editor composition; HierarchyPanel/HierarchyPanelProps, hierarchy icons and cellClassName; and typed TabularFieldRows/TabularFieldColumn with host-supplied totals and formatting. These came from 983c807, 174860e and 2c17992 and their merges. All twelve public packages remain a fixed version group. Hosts still own persistence, authorization and domain validation.

### Patch Changes

- Updated dependencies
  - @pepbits/i18n@0.2.0

## 0.1.0

### Minor Changes

- First packaged release: ESM JavaScript and TypeScript declarations, preserved public subpaths and client directives, CSS modules and licensed font assets. Hosts supply effective preferences, localization, Tailwind styling and application adapters. Prepared for manual GitHub Packages publication; no registry release has been made.

### Patch Changes

- Updated dependencies
  - @pepbits/i18n@0.1.0
