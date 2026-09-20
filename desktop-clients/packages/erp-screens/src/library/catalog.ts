/** A searchable index of real exports. Names remain code identifiers in every locale. */
export const CATALOG_GROUPS = [
  {pageId:"form-controls",key:"forms"},
  {pageId:"date-components",key:"dates"},
  {pageId:"card-components",key:"cards"},
  {pageId:"table-components",key:"tables"},
  {pageId:"navigation-components",key:"navigation"},
  {pageId:"feedback-components",key:"feedback"},
  {pageId:"inline-components",key:"inline"},
  {pageId:"form-patterns",key:"formPatterns"},
  {pageId:"data-patterns",key:"dataPatterns"},
  {pageId:"billing-patterns",key:"billing"},
  {pageId:"localization",key:"localization"},
] as const;
export const CATALOG_ENTRIES = [
  {id:"TextDemo",group:"forms",components:["Input","SearchInput","Textarea","Highlight","ScannerInput","QuantityUnitField"],source:"form-controls.tsx, option-filter.tsx, scanner-input.tsx, quantity-unit-field.tsx"},
  {id:"ValidationDemo",group:"forms",components:["FieldShell","Input","FormErrorSummary"],source:"form-controls.tsx"},
  {id:"SelectDemo",group:"forms",components:["Select","SearchSelect","MultiSelect"],source:"form-controls.tsx, search-select.tsx"},
  {id:"ChoiceDemo",group:"forms",components:["Checkbox","Radio","Toggle","RangeInput","RadioGroup","RangeField"],source:"form-controls.tsx"},
  {id:"FileDemo",group:"forms",components:["FilePicker"],source:"form-controls.tsx"},
  {id:"ReferenceDemo",group:"forms",components:["ReferenceField","ReferenceDataWarning"],source:"reference-data.tsx"},
  {id:"DateDemo",group:"dates",components:["DateInput","TimeInput","DateTimeInput","MonthInput","WeekInput"],source:"date-time.tsx"},
  {id:"CalendarDemo",group:"dates",components:["Calendar","DateRangeInput"],source:"calendar.tsx, date-time.tsx"},
  {id:"CardsDemo",group:"cards",components:["Card","CardGrid","CardHeader","CardTitle","CardContent","CardFooter"],source:"card.tsx"},
  {id:"StatsDemo",group:"cards",components:["StatCard"],source:"stat-card.tsx"},
  {id:"StatusDemo",group:"cards",components:["Avatar","Badge","StatusBadge"],source:"avatar.tsx, badge.tsx"},
  {id:"ValuesDemo",group:"cards",components:["DataValue","DescriptionList"],source:"data-value.tsx"},
  {id:"TableDemo",group:"tables",components:["Table","TableHeader","TableBody","TableFooter","TableRow","TableHead","TableCell","TableCaption","TableContainer"],source:"table.tsx"},
  {id:"ButtonsDemo",group:"navigation",components:["Button","IconButton"],source:"button.tsx"},
  {id:"TabsDemo",group:"navigation",components:["Tabs","Segmented"],source:"tabs.tsx, segmented.tsx"},
  {id:"MenusDemo",group:"navigation",components:["DropdownSelect","ActionMenu","MenuButton","NavLink"],source:"dropdown.tsx, nav-link.tsx"},
  {id:"PaginationDemo",group:"navigation",components:["Pagination"],source:"pagination.tsx"},
  {id:"OverlaysDemo",group:"feedback",components:["Modal","Drawer","CenterRecordCard","ConfirmDialog","PrintDocument"],source:"overlay.tsx, print-document.tsx"},
  {id:"StatesDemo",group:"feedback",components:["EmptyState","ErrorState","AccessDenied","NotFoundState","ConflictState","SessionExpiredState","LoadingState"],source:"empty-state.tsx"},
  {id:"SkeletonsDemo",group:"feedback",components:["Skeleton","TableSkeleton","FormSkeleton","DashboardSkeleton"],source:"skeleton.tsx"},
  {id:"RecoveryDemo",group:"feedback",components:["RecoveryNotice"],source:"recovery-notice.tsx"},
  {id:"InlineDemo",group:"inline",components:["InlineEdit","InlineEditNumber","InlineEditSelect","InlineEditDate","InlineEditStatus"],source:"inline-edit.tsx"},
  {id:"FormDemo",group:"formPatterns",components:["Input","Select","Button"],source:"form-controls.tsx, button.tsx"},
  {id:"WorklistDemo",group:"dataPatterns",components:["DataTable"],source:"@pepbits/erp-screens: worklist/data-table.tsx"},
  {id:"BillingDemo",group:"billing",components:["Input","CardGrid","DescriptionList","DataValue"],source:"form-controls.tsx, card.tsx, data-value.tsx"},
  {id:"LocalizationDemo",group:"localization",components:["LocalizationProvider","LocalizedText","useLocalization"],source:"localization.tsx"},
] as const;
export type CatalogEntry = typeof CATALOG_ENTRIES[number];
export function filterCatalog(group: string | undefined, query: string) {
  const term = query.trim().toLowerCase();
  return CATALOG_ENTRIES.filter(entry => (!group || entry.group === group) && (!term || `${entry.id} ${entry.components.join(" ")} ${entry.source}`.toLowerCase().includes(term)));
}
