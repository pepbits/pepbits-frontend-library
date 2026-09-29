/** Explicit runtime requirements. A new root .mjs must be a suite or helper. */
export const suites = {
  browser: ['a11y.e2e.mjs', 'ai-dispatch.e2e.mjs', 'export.e2e.mjs', 'inline-conflict.e2e.mjs', 'phi-safety.e2e.mjs', 'print.e2e.mjs', 'saved-view.e2e.mjs', 'search-post.e2e.mjs', 'workspace.e2e.mjs'],
  features: ['dcp-host-runtime.mjs','dcp-enterprise.mjs','dcp-csv-options.mjs','dcp-value-sets.mjs','dcp-dependent-dropdowns.mjs','dcp-designer.mjs','care-pages.mjs','identity-devices.mjs','device-integrations.mjs','label-printing.mjs','op-registration.mjs','unified-help.mjs','page-library.mjs','own-settings.mjs','comprehensive-consultation.mjs','op-consultation.mjs','clinical-consultation.mjs','clinical-triage.mjs','clinic-billing.mjs','library-preferences.ts','clinical-templates.ts','page-templates.ts','component-library.mjs','draft-center.mjs','drafts.mjs','recovery.mjs','sentinel.mjs','documentation.mjs','preference-policy.mjs','scheduled-reports.mjs','spreadsheet-policy.mjs','language-loading.mjs','records.mjs','workflows.mjs','record-panels.mjs','imports.mjs','approvals.mjs','localization.mjs','page-body-localization.mjs','localization-formatting.mjs','backend-messages.mjs','localization-exports.mjs','shared-components.mjs'],
  navigation: ['backend-navigation.mjs','reference-modules.mjs','school-role-header.mjs','healthcare-suite.mjs'],
  product: ['product-starter.mjs'],
  native: ['tauri-native.mjs','native-localization.mjs','native-sentinel.mjs'],
};
export const helpers = ['run.mjs','harness.mjs','a11y.mjs','suites.mjs','managed-api.mjs'];
export function validateSuites(files) {
  const declared=[...helpers,...Object.values(suites).flat()];
  const missing=declared.filter(file=>!files.includes(file));
  const unknown=files.filter(file=>file.endsWith('.mjs')&&!declared.includes(file));
  const duplicate=declared.filter((file,index)=>declared.indexOf(file)!==index);
  if(missing.length||unknown.length||duplicate.length)throw new Error(`Suite registry mismatch: missing=[${missing}] unregistered=[${unknown}] duplicate=[${duplicate}]`);
}
