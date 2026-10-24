import {SourceControlsDemo} from './examples/source-controls';
import {DeviceIntegrationsDemo} from "./examples/device-integrations";
import {IdentityDevicesDemo} from "./examples/identity-devices";
import {LabelPrintingDemo} from "./examples/label-printing";
import {FormDesignerDemo} from "./examples/form-designer";
import {SpreadsheetDemo} from "./examples/spreadsheet";
import React from "react";
import {useDemoPolicy} from "./demo-state";
import {ShellWorkspaceDemo} from "./examples/shell-workspace";
import {ShellMdiDemo} from "./examples/shell-mdi";
import {ShellDetachedDemo} from "./examples/shell-detached";
import {ShellCommandDemo} from "./examples/shell-command";
import {ShellDocumentationDemo} from "./examples/shell-documentation";
import {ShellHelpDemo} from "./examples/shell-help";
import {ShellToastsDemo} from "./examples/shell-toasts";
import {ShellSessionDemo} from "./examples/shell-session";
import {ShellPreferencesDemo} from "./examples/shell-preferences";
import {ShellLoginDemo} from "./examples/shell-login";
import {AiActionsDemo} from "./examples/ai-actions";
import {AiTransparencyDemo} from "./examples/ai-transparency";
import {AiAdministrationDemo} from "./examples/ai-administration";
function SessionExample(){const {expireSession}=useDemoPolicy();return React.createElement(ShellSessionDemo,{expireSession});}
import {PanelsDemo} from "./examples/panels";
import {DraftCenterDemo} from "./examples/draft-center";
import {ControlStatesDemo} from "./examples/control-states";
import type {ComponentType} from "react";
import type {AreaId} from "./areas";
import {TextDemo} from "./examples/text";
import {ValidationDemo} from "./examples/validation";
import {SelectDemo} from "./examples/select";
import {ChoiceDemo} from "./examples/choice";
import {FileDemo} from "./examples/file";
import {ReferenceDemo} from "./examples/reference";
import {DateDemo} from "./examples/date";
import {CalendarDemo} from "./examples/calendar";
import {CardsDemo} from "./examples/cards";
import {StatsDemo} from "./examples/stats";
import {ValuesDemo} from "./examples/values";
import {ButtonsDemo} from "./examples/buttons";
import {MenusDemo} from "./examples/menus";
import {OverlaysDemo} from "./examples/overlays";
import {StatusDemo} from "./examples/status";
import {StatesDemo} from "./examples/states";
import {SkeletonsDemo} from "./examples/skeletons";
import {RecoveryDemo} from "./examples/recovery";
import {InlineDemo} from "./examples/inline";
import {LocalizationDemo} from "./examples/localization";
import {TokensDemo} from "./examples/tokens";
import {IconsDemo} from "./examples/icons";
import {FormattersDemo} from "./examples/formatters";
import {TableDemo} from "./examples/table";
import {TabsDemo} from "./examples/tabs";
import {UtilitiesDemo} from "./examples/utilities";
import {PreferencesDemo} from "./examples/preferences";
import {LifecycleDemo} from "./examples/lifecycle";
import {TransferDemo} from "./examples/transfer";
import {DcpDemo} from "./examples/dcp";
import {ApprovalsDemo} from "./examples/approvals";
import {DraftsDemo} from "./examples/drafts";
import {ImportsDemo} from "./examples/imports";
import {OptionsDemo} from "./examples/options";
import {WorklistDemo} from "./examples/worklist";
import {RecordDemo} from "./examples/record";
import {FormDemo} from "./examples/form";
import {TemplatesDemo} from "./examples/templates";
import {RendererDemo} from "./examples/renderer";

export interface Example {id:string;area:AreaId;title:string;description:string;exports:string[];render:ComponentType}
export const examples:Example[]=[
{id:"source-controls",area:"ui",title:"Native controls",description:"Fictional fields and an in-memory lookup; changes disappear on reload.",exports:["AsyncLookup","SourceButton","SourceInput","SourceSelect","SourceTextarea","SourceDateInput"],render:SourceControlsDemo},
{"id": "device-integrations", "area": "patterns", "title": "Device Integrations", "description": "Explore a fictional workflow with explicit in-memory adapters.", "exports": ["DeviceIntegrationWorkspace"],render:DeviceIntegrationsDemo},
{"id": "identity-devices", "area": "patterns", "title": "Identity Devices", "description": "Explore a fictional workflow with explicit in-memory adapters.", "exports": ["IdentityDeviceWorkspace"],render:IdentityDevicesDemo},
{"id": "label-printing", "area": "patterns", "title": "Label Printing", "description": "Explore a fictional workflow with explicit in-memory adapters.", "exports": ["LabelPrintingWorkspace"],render:LabelPrintingDemo},
{"id": "form-designer", "area": "patterns", "title": "Form Designer", "description": "Explore a fictional workflow with explicit in-memory adapters.", "exports": ["DcpDesignerWorkspace"],render:FormDesignerDemo},
{"id": "spreadsheet", "area": "patterns", "title": "Spreadsheet", "description": "Explore a fictional workflow with explicit in-memory adapters.", "exports": ["SpreadsheetPage"],render:SpreadsheetDemo},
{"id":"text","area":"ui","title":"Text","exports":["Highlight", "Input", "QuantityUnitField", "ScannerInput", "SearchInput", "Textarea"],"description":"catalog.example.TextDemo",render:TextDemo},
{"id":"validation","area":"ui","title":"Validation","exports":["FieldShell", "FormErrorSummary", "Input", "useLocalization"],"description":"catalog.example.ValidationDemo",render:ValidationDemo},
{"id":"select","area":"ui","title":"Select","exports":["MultiSelect", "SearchSelect", "Select"],"description":"catalog.example.SelectDemo",render:SelectDemo},
{"id":"choice","area":"ui","title":"Choice","exports":["Checkbox", "Radio", "RadioGroup", "RangeField", "RangeInput", "Select", "SignaturePad", "Toggle", "useLocalization"],"description":"catalog.example.ChoiceDemo",render:ChoiceDemo},
{"id":"file","area":"ui","title":"File","exports":["DataValue", "FilePicker", "LocalizedText"],"description":"catalog.example.FileDemo",render:FileDemo},
{"id":"reference","area":"components","title":"Reference","exports":["Button", "LocalizedText", "ReferenceDataWarning", "ReferenceField"],"description":"catalog.example.ReferenceDemo",render:ReferenceDemo},
{"id":"date","area":"ui","title":"Date","exports":["DateInput", "DateTimeInput", "MonthInput", "TimeInput", "WeekInput"],"description":"catalog.example.DateDemo",render:DateDemo},
{"id":"calendar","area":"components","title":"Calendar","exports":["Calendar", "DateRangeInput", "useLocalization"],"description":"catalog.example.CalendarDemo",render:CalendarDemo},
{"id":"cards","area":"components","title":"Cards","exports":["Avatar", "Badge", "Card", "CardContent", "CardFooter", "CardGrid", "CardHeader", "CardTitle", "DataValue", "DescriptionList", "LocalizedText", "StatusBadge", "useFormatters"],"description":"catalog.example.CardsDemo",render:CardsDemo},
{"id":"stats","area":"components","title":"Stats","exports":["Card", "CardGrid", "StatCard", "Sparkline", "LineChart", "DonutChart", "BarChart", "GroupedBarChart", "HorizontalBars", "ProgressRing", "useFormatters"],"description":"catalog.example.StatsDemo",render:StatsDemo},
{"id":"values","area":"components","title":"Values","exports":["DataValue", "DescriptionList", "StatusBadge", "useFormatters"],"description":"catalog.example.ValuesDemo",render:ValuesDemo},
{"id":"buttons","area":"ui","title":"Buttons","exports":["Button", "IconButton", "Plus", "useLocalization"],"description":"catalog.example.ButtonsDemo",render:ButtonsDemo},
{"id":"menus","area":"components","title":"Menus","exports":["ActionMenu", "Button", "DropdownSelect", "MenuButton", "NavLink", "useLocalization"],"description":"catalog.example.MenusDemo",render:MenusDemo},
{"id":"overlays","area":"components","title":"Overlays","exports":["Button", "CenterRecordCard", "ConfirmDialog", "DataValue", "Drawer", "Input", "Modal", "PrintDocument", "SourceDialog", "useLocalization"],"description":"catalog.example.OverlaysDemo",render:OverlaysDemo},
{"id":"status","area":"ui","title":"Status","exports":["Avatar", "Badge", "StatusBadge"],"description":"catalog.example.StatusDemo",render:StatusDemo},
{"id":"states","area":"components","title":"States","exports":["AccessDenied", "ConflictState", "EmptyState", "ErrorState", "LoadingState", "NotFoundState", "Select", "SessionExpiredState", "useLocalization"],"description":"catalog.example.StatesDemo",render:StatesDemo},
{"id":"skeletons","area":"ui","title":"Skeletons","exports":["DashboardSkeleton", "FormSkeleton", "Select", "Skeleton", "TableSkeleton"],"description":"catalog.example.SkeletonsDemo",render:SkeletonsDemo},
{"id":"recovery","area":"components","title":"Recovery","exports":["Button", "Input", "RecoveryNotice", "failureFromError", "useLocalization"],"description":"catalog.example.RecoveryDemo",render:RecoveryDemo},
{"id":"inline","area":"components","title":"Inline","exports":["DescriptionList", "InlineEdit", "InlineEditDate", "InlineEditNumber", "InlineEditSelect", "InlineEditStatus", "Select", "useFormatters", "useLocalization"],"description":"catalog.example.InlineDemo",render:InlineDemo},
{"id":"localization","area":"foundations","title":"Localization","exports":["DataValue", "Input", "LocalizationAliasProvider", "LocalizationProvider", "LocalizedText", "StatusBadge", "useFormatters", "useLocalization"],"description":"catalog.example.LocalizationDemo",render:LocalizationDemo},
{"id":"tokens","area":"foundations","title":"Tokens","exports":["TOKEN_NAMES", "tokenVar", "usePreferences"],"description":"Inspect shared foundations under the effective theme, language and format settings.",render:TokensDemo},
{"id":"icons","area":"foundations","title":"Icons","exports":[],"description":"Inspect shared foundations under the effective theme, language and format settings.",render:IconsDemo},
{"id":"formatters","area":"foundations","title":"Formatters","exports":["DescriptionList", "createFormatters", "directionOf", "formatOptionsFrom", "useLocalization", "usePreferences"],"description":"Inspect shared foundations under the effective theme, language and format settings.",render:FormattersDemo},
{"id":"table","area":"components","title":"Table","exports":["DataValue", "Pagination", "PresentationProvider", "Table", "TableBody", "TableCaption", "TableCell", "TableContainer", "TableFooter", "TableHead", "TableHeader", "TableRow", "presentationFromPreferences", "useFormatters", "usePreference", "usePreferences", "usePresentationPreferences"],"description":"Compose shared presentation with host-owned state and recovery callbacks.",render:TableDemo},
{"id":"tabs","area":"components","title":"Tabs","exports":["Segmented", "Tabs", "usePreference"],"description":"Compose shared presentation with host-owned state and recovery callbacks.",render:TabsDemo},
{"id":"utilities","area":"ui","title":"Utilities","exports":["classifyFailure", "cn", "filterOptions", "formatCompact", "initialsOf", "inputClass", "isRetryable", "nextEnabledIndex", "referenceFor", "referenceStateOf", "statusTone", "washFor"],"description":"Try controlled values, keyboard interaction and validation states.",render:UtilitiesDemo},
{"id":"preferences","area":"playground","title":"Preferences","exports":["Select", "usePreference"],"description":"The disabled control and the central update guard both respect tenant policy.",render:PreferencesDemo},
{"id":"lifecycle","area":"patterns","title":"Lifecycle","exports":["LifecycleApi", "LifecycleConfigurationPage", "LifecycleMetadataResult", "LifecycleVersionDetail", "createMemoryRecordAdapter", "emptyLifecycleDefinition"],"description":"Explore a fictional workflow with explicit in-memory adapters.",render:LifecycleDemo},
{"id":"transfer","area":"patterns","title":"Transfer","exports":["MasterTransferPanel", "MasterTransferPort", "PricingExpressionInput", "createMemoryRecordAdapter"],"description":"Explore a fictional workflow with explicit in-memory adapters.",render:TransferDemo},
{"id":"dcp","area":"patterns","title":"Dcp","exports":["DcpRuntimeField", "DcpRuntimeFields", "DcpRuntimeView", "DcpSectionFields", "DcpValues", "dcpWritablePatch"],"description":"Explore a fictional workflow with explicit in-memory adapters.",render:DcpDemo},
{"id":"approvals","area":"patterns","title":"Approvals","exports":["ApprovalAdapter", "ApprovalData", "ApprovalWorkspace", "DraftHost", "RecordApproval", "createMemoryDraftAdapter", "createMemoryRecordAdapter"],"description":"Explore a fictional workflow with explicit in-memory adapters.",render:ApprovalsDemo},
{"id":"drafts","area":"patterns","title":"Drafts","exports":["Button", "DraftHost", "DraftRecovery", "Input", "createMemoryDraftAdapter", "useSharedDraft"],"description":"Explore a fictional workflow with explicit in-memory adapters.",render:DraftsDemo},
{"id":"imports","area":"patterns","title":"Imports","exports":["Button", "CsvImportDialog", "CsvOptionsEditor", "DraftHost", "ImportAdapter", "ImportJob", "createMemoryDraftAdapter", "createMemoryRecordAdapter"],"description":"Explore a fictional workflow with explicit in-memory adapters.",render:ImportsDemo},
{"id":"options","area":"patterns","title":"Options","exports":["CsvOptionsEditor"],"description":"Explore a fictional workflow with explicit in-memory adapters.",render:OptionsDemo},
{"id":"worklist","area":"page-engines","title":"Worklist","exports":["WorklistAdapter", "WorklistPage"],"description":"Supply typed definitions and adapters to the shared engine.",render:WorklistDemo},
{"id":"record","area":"page-engines","title":"Record","exports":["FileQuestion", "Icon", "Input", "RecordActionBar", "RecordIdentity", "RecordNotice", "RecordPage", "RecordSectionCard", "RecordSectionLayout"],"description":"Supply typed definitions and adapters to the shared engine.",render:RecordDemo},
{"id":"form","area":"page-engines","title":"Form","exports":["DynamicRecordForm", "RecordAdapterProvider", "createMemoryRecordAdapter"],"description":"Supply typed definitions and adapters to the shared engine.",render:FormDemo},
{"id":"templates","area":"page-engines","title":"Templates","exports":["PageTemplateAdapter", "PageTemplateWorkspace", "Select", "createMemoryRecordAdapter"],"description":"Supply typed definitions and adapters to the shared engine.",render:TemplatesDemo},
{"id":"renderer","area":"page-engines","title":"Renderer","exports":["Input", "Select", "SkeletonFor", "UnsupportedPage", "createPageRenderer"],"description":"Supply typed definitions and adapters to the shared engine.",render:RendererDemo}
,{"id": "control-states", "area": "ui", "title": "Control states", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "Checkbox", "DateInput", "DateRangeInput", "DateTimeInput", "FilePicker", "Input", "MonthInput", "MultiSelect", "OtpInput", "QuantityUnitField", "Radio", "RadioGroup", "RangeField", "RangeInput", "ScannerInput", "SearchSelect", "Select", "Textarea", "TimeInput", "Toggle", "WeekInput", "usePreference"],render:ControlStatesDemo}
,{"id": "draft-center", "area": "patterns", "title": "Draft recovery center", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "DraftCenterAdapter", "DraftCenterItem", "DraftHost", "DraftRecoveryCenter", "createMemoryDraftAdapter"],render:DraftCenterDemo}
,{"id": "panels", "area": "page-engines", "title": "Record panels", "description": "Explore fictional values through public controls and host adapters.", "exports": ["RecordAdapterProvider", "RecordPanels", "RecordPanelsAdapter", "RecordPanelsPanel", "createMemoryRecordAdapter"],render:PanelsDemo}
,
{"id": "shell-workspace", "area": "shell", "title": "Workspace tabs and split canvas", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "useNavigation", "useWorkspace", "useSplit", "documentFromTarget", "useShell", "usePreferences"],render:ShellWorkspaceDemo}
,
{"id": "shell-mdi", "area": "shell", "title": "MDI windows", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Toggle", "usePreference"],render:ShellMdiDemo}
,
{"id": "shell-detached", "area": "shell", "title": "Detached window port", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "useWorkspace", "useDetachedIn", "usePreferences", "documentFromTarget", "useShell", "useWindowPort"],render:ShellDetachedDemo}
,
{"id": "shell-command", "area": "shell", "title": "Command palette", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "useShell"],render:ShellCommandDemo}
,
{"id": "shell-documentation", "area": "shell", "title": "Documentation drawer", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "useShell", "usePreferences"],render:ShellDocumentationDemo}
,
{"id": "shell-help", "area": "shell", "title": "Help and tours", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "useShell", "usePreferences"],render:ShellHelpDemo}
,
{"id": "shell-toasts", "area": "shell", "title": "Toasts", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "useScreenHost"],render:ShellToastsDemo}
,
{"id": "shell-session", "area": "shell", "title": "Session lock", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button"],render:SessionExample}
,
{"id": "shell-preferences", "area": "shell", "title": "Preferences page", "description": "Explore fictional values through public controls and host adapters.", "exports": ["PreferencesPage"],render:ShellPreferencesDemo}
,
{"id": "shell-login", "area": "shell", "title": "Login", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Button", "useSession", "LoginScreen"],render:ShellLoginDemo}
,
{"id": "ai-actions", "area": "ai", "title": "AI sources and actions", "description": "Explore fictional values through public controls and host adapters.", "exports": ["Input", "useScreenHost", "useAiHost"],render:AiActionsDemo}
,
{"id": "ai-transparency", "area": "ai", "title": "AI transparency", "description": "Explore fictional values through public controls and host adapters.", "exports": ["TransparencyPanel", "useAiHost", "useAssistant"],render:AiTransparencyDemo}
,
{"id": "ai-administration", "area": "ai", "title": "AI administration", "description": "Explore fictional values through public controls and host adapters.", "exports": ["AiAdministration", "useAiHost"],render:AiAdministrationDemo}
];
