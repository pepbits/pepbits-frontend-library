"use client";
import React, { useState, useId } from "react";
import { DataTable } from "../worklist/data-table";
import { type DataColumn } from "@pepbits/erp-config";
import {useERP} from "@pepbits/erp-shell";
import { Plus } from "lucide-react";
import {
  QuantityUnitField, FormErrorSummary,RadioGroup,RangeField,ScannerInput, Highlight, Input, SearchInput, Textarea, Select, MultiSelect, Checkbox, Radio, Toggle, FilePicker, RangeInput, FieldShell,
  SearchSelect, ReferenceField, ReferenceDataWarning, Button, IconButton,
  DateInput, TimeInput, DateTimeInput, MonthInput, WeekInput, DateRangeInput, Calendar,
  Card, CardHeader, CardTitle, CardContent, CardFooter, CardGrid, StatCard, Avatar, Badge, StatusBadge,
  Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption, TableContainer,
  DataValue, DescriptionList, Tabs, Segmented, Pagination, DropdownSelect, ActionMenu, MenuButton, NavLink,
  PrintDocument, Modal, Drawer, CenterRecordCard, ConfirmDialog, EmptyState, ErrorState, AccessDenied, NotFoundState,
  ConflictState, SessionExpiredState, LoadingState, Skeleton, TableSkeleton, FormSkeleton, DashboardSkeleton,
  RecoveryNotice, failureFromError, InlineEdit, InlineEditNumber, InlineEditSelect, InlineEditDate, InlineEditStatus,
  LocalizedText, LocalizationProvider, useLocalization,
} from "@pepbits/ops-ui";

export function TextDemo() {
  const [quantityUnit, setQuantityUnit] = useState({quantity:"1",unit:"EA"});
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  return <div className="space-y-3">
    <QuantityUnitField label="Amount" quantityLabel="template.field.quantity" unitLabel="template.field.unit" value={quantityUnit} onChange={setQuantityUnit} options={[{value:"EA",label:"EA"},{value:"BOX",label:"BOX"}]} />
    <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />
    <Input label="Email" type="email" placeholder="Email" />
    <Input label="Password" type="password" autoComplete="new-password" />
    <Input label="Amount" type="number" min={0} />
    <SearchInput aria-label="Search" value={search} onChange={setSearch} onClear={() => setSearch("")} />
    <Highlight text="Example searchable record" query={search} />
    <ScannerInput label="devices.code" hint="devices.scanHint" onScan={async value => { setSearch(value); return true; }} />
    <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
  </div>;
}

export function ValidationDemo() {
  const {t} = useLocalization();
  const [value, setValue] = useState("");
  return <div className="space-y-3">
    <Input label="Name" required value={value} onChange={e => setValue(e.target.value)} error={!value.trim() ? "Required" : undefined} />
    <FormErrorSummary title={t("Required")} errors={value.trim()?[]:[{id:"name",label:t("Name"),message:t("Required")}]}/><Input label="Record ID" value="DEMO-001" readOnly />
    <Input label="Status" value={t("Disabled")} disabled />
    <FieldShell label="Progress" hint="catalog.fieldShellHint">{describedBy => <progress aria-label={t("Progress")} aria-describedby={describedBy} value={60} max={100} />}</FieldShell>
  </div>;
}

export function SelectDemo() {
  const [value, setValue] = useState("active");
  const [many, setMany] = useState<string[]>([]);
  const options = [{value:"active",label:"Active"},{value:"pending",label:"Pending"},{value:"inactive",label:"Inactive"}];
  return <div className="space-y-3">
    <Select label="Status" options={options} value={value} onChange={e => setValue(e.target.value)} />
    <SearchSelect label="Search" options={options} value={value} onChange={setValue} />
    <MultiSelect label="Filters" options={options} value={many} onChange={setMany} />
  </div>;
}

export function ChoiceDemo() {
  const groupName = useId();
  const {t} = useLocalization();
  const [checked, setChecked] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [choice, setChoice] = useState("active");
  const [amount, setAmount] = useState(40);
  return <div className="space-y-4">
    <Checkbox label="Select" checked={checked} onChange={e => setChecked(e.target.checked)} />
    <Checkbox label="Selected" indeterminate checked={false} readOnly />
    <fieldset className="space-y-2"><legend>{t("Status")}</legend>
      <Radio label="Active" name={groupName} checked={choice === "active"} onChange={() => setChoice("active")} />
      <Radio label="Inactive" name={groupName} checked={choice === "inactive"} onChange={() => setChoice("inactive")} />
    </fieldset>
    <RadioGroup label="Status" options={[{value:"active",label:"Active"},{value:"inactive",label:"Inactive"}]} value={choice} onChange={setChoice}/><RangeField label="Amount" min={0} max={100} value={amount} onChange={value=>setAmount(value??0)} disabled={!enabled}/><Toggle label="Enabled" checked={enabled} onChange={setEnabled} />
    <RangeInput label="Progress" min={0} max={100} value={amount} onChange={setAmount} unit="%" />
  </div>;
}

export function FileDemo() {
  const [file, setFile] = useState<File | null>(null);
  return <div className="space-y-3"><FilePicker label="Choose file" onFile={setFile} accept=".csv,.txt" />
    <DataValue value={file?.name} /><p><LocalizedText message="catalog.fileHint" /></p></div>;
}

export function ReferenceDemo() {
  const [failed, setFailed] = useState(true);
  const [value, setValue] = useState("");
  return <div className="space-y-3">
    <ReferenceDataWarning failures={failed ? [{key:"status",code:"network"}] : []} labels={{status:"Status"}} onRetry={() => setFailed(false)} />
    <ReferenceField label="Status" state={failed ? "failed" : "ready"} value={value} onChange={setValue} options={[{value:"active",label:"Active"}]} />
    <Button onClick={() => setFailed(true)}><LocalizedText message="catalog.simulateFailure" /></Button>
  </div>;
}

export function DateDemo() {
  const [date, setDate] = useState("2026-09-09");
  const [time, setTime] = useState("09:30");
  const [dateTime, setDateTime] = useState("2026-09-09T09:30");
  const [month, setMonth] = useState("2026-09");
  const [week, setWeek] = useState("2026-W37");
  return <div className="space-y-3">
    <DateInput label="Date" value={date} onChange={e => setDate(e.target.value)} />
    <TimeInput label="Time" value={time} onChange={e => setTime(e.target.value)} />
    <DateTimeInput label="Date and time" value={dateTime} onChange={e => setDateTime(e.target.value)} />
    <MonthInput label="Month" value={month} onChange={e => setMonth(e.target.value)} />
    <WeekInput label="Week" value={week} onChange={e => setWeek(e.target.value)} />
  </div>;
}

export function CalendarDemo() {
  const [start, setStart] = useState("2026-09-09");
  const [end, setEnd] = useState("2026-09-20");
  return <div className="space-y-3"><DateRangeInput start={{label:"Start date",value:start,onChange:e => setStart(e.target.value)}} end={{label:"End date",value:end,onChange:e => setEnd(e.target.value)}} />
    <Calendar label="Date" value={start} onChange={setStart} max={end} />
  </div>;
}

export function CardsDemo() {
  const {format}=useERP();
  return <CardGrid columns={2}>
    <Card><CardHeader><CardTitle title="Summary" subtitle="catalog.sampleData" /></CardHeader><CardContent><DataValue value={1200} numeric format={format.number} /></CardContent><CardFooter><Badge tone="success"><LocalizedText message="Active"/></Badge></CardFooter></Card>
    <Card tone="muted" shadow="none"><CardContent><Avatar name="Demo User" /><DescriptionList items={[{id:"id",label:"Record ID",value:"DEMO-001"},{id:"status",label:"Status",value:<StatusBadge value="Pending"/>}]} /></CardContent></Card>
  </CardGrid>;
}

export function StatsDemo() {
  const {format}=useERP();
  return <CardGrid columns={2}><StatCard label="Total" value={format.number(1200)} trend={{direction:"up",delta:"+12%",comparedTo:"vs last month"}} />
    <StatCard label="Pending" value={format.number(24)} tone="inverse" trend={{direction:"down",delta:"-8%",comparedTo:"vs last month"}} /></CardGrid>;
}

export function TableDemo() {
  const {t} = useLocalization();
  const {preferences,preferencePolicy,preferencesAvailable,updatePreference,format} = useERP();
  const [bordered, setBordered] = useState(true);

  return <div className="space-y-3">
    <Toggle label="catalog.striped" disabled={!preferencesAvailable||preferencePolicy.rules.zebraStripes?.locked} checked={preferences.zebraStripes} onChange={value=>updatePreference("zebraStripes",value)}/><Toggle label="catalog.bordered" checked={bordered} onChange={setBordered}/><Toggle label="Compact" disabled={!preferencesAvailable||preferencePolicy.rules.density?.locked} checked={preferences.density === "compact"} onChange={value=>updatePreference("density",value?"compact":"comfortable")}/>
    <TableContainer><Table striped={preferences.zebraStripes} bordered={bordered} stickyHeader={preferences.stickyTableHeader} density={preferences.density} className="w-full">
      <TableCaption>{t("catalog.sampleData")}</TableCaption>
      <TableHeader><TableRow><TableHead className="p-3">{t("Name")}</TableHead><TableHead className="p-3">{t("Amount")}</TableHead><TableHead className="p-3">{t("Status")}</TableHead></TableRow></TableHeader>
      <TableBody>{[120,240,360].map((amount,i) => <TableRow key={i}><TableCell className="p-3">{`DEMO-00${i+1}`}</TableCell><TableCell className="p-3"><DataValue value={amount} numeric format={format.money} /></TableCell><TableCell className="p-3"><StatusBadge value={i === 1 ? "Pending" : "Active"}/></TableCell></TableRow>)}</TableBody>
      <TableFooter><TableRow><TableCell className="p-3">{t("Total")}</TableCell><TableCell className="p-3" colSpan={2}>{format.money(720)}</TableCell></TableRow></TableFooter>
    </Table></TableContainer>
  </div>;
}

export function ValuesDemo() {
  const {format} = useERP();
  return <DescriptionList layout="stacked" items={[
    {id:"money",label:"Amount",value:<DataValue value={12345.67} numeric format={format.money}/>},
    {id:"empty",label:"Notes",value:<DataValue value={null}/>},
    {id:"date",label:"Date",value:<DataValue value="2026-09-09" format={format.date}/>},
    {id:"status",label:"Status",value:<StatusBadge value="Active"/>},
  ]}/>;
}

export function ButtonsDemo() {
  const {t} = useLocalization();
  const [count, setCount] = useState(0);
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">
    {(["primary","secondary","outline","ghost","success","danger"] as const).map(variant => <Button key={variant} variant={variant} onClick={() => setCount(count+1)}>{variant}</Button>)}
    <IconButton label="Add" onClick={() => setCount(count+1)}><Plus className="size-4"/></IconButton>
    <Button disabled>{t("Disabled")}</Button><Button loading>{t("Loading…")}</Button>
    </div><output aria-live="polite">{t("catalog.actionCount",{count})}</output></div>;
}

export function TabsDemo() {
  const {t} = useLocalization();
  const [tab, setTab] = useState("summary");
  const [view, setView] = useState("table");
  return <div className="space-y-3">
    <Tabs items={[{id:"summary",label:"Summary"},{id:"details",label:"Details"}]} value={tab} onChange={setTab}/>
    <p>{t(tab === "summary" ? "Summary" : "Details")}</p>
    <Segmented label="View" options={[{value:"table",label:"Table"},{value:"cards",label:"Cards"}]} value={view} onChange={setView}/>
    <Badge>{view === "table" ? "Table" : "Cards"}</Badge>
  </div>;
}

export function MenusDemo() {
  const {t} = useLocalization();
  const [value, setValue] = useState("active");
  const [count, setCount] = useState(0);
  return <div className="space-y-3">
    <DropdownSelect label="Status" value={value} options={[{value:"active",label:"Active"},{value:"pending",label:"Pending"}]} onChange={setValue}/>
    <ActionMenu trigger={<Button>{t("Actions")}</Button>}>{close => <MenuButton label="Add" onClick={() => {setCount(count+1);close();}}/>}</ActionMenu>
    <NavLink onClick={() => setCount(count+1)}>{t("Open")}</NavLink>
    <output aria-live="polite">{t("catalog.actionCount",{count})}</output>
  </div>;
}

export function PaginationDemo() {
  const {t} = useLocalization();
  const [page,setPage] = useState(1);
  const {preferences,preferencePolicy,preferencesAvailable,updatePreference} = useERP();
  const pageSize=preferences.pageSize;
  return <div className="space-y-3"><p>{t("catalog.pageNumber",{page})}</p><Pagination pageSizeDisabled={!preferencesAvailable||preferencePolicy.rules.pageSize?.locked} page={Math.min(page,Math.ceil(125/pageSize))} pageSize={pageSize} total={125} onPageChange={setPage} onPageSizeChange={size => {updatePreference("pageSize",size);setPage(1);}}/></div>;
}

export function OverlaysDemo() {
  const {t} = useLocalization();
  const [open,setOpen] = useState<string|null>(null);
  const [confirmed,setConfirmed] = useState(false);
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">
    {["Modal","Drawer","CenterRecordCard","ConfirmDialog","PrintDocument"].map(name => <Button key={name} onClick={() => setOpen(name)}>{name}</Button>)}
    </div>
    <Modal open={open === "Modal"} onClose={() => setOpen(null)} title="Details" footer={<Button onClick={() => setOpen(null)}>{t("Close")}</Button>}><Input label="Name"/></Modal>
    <Drawer open={open === "Drawer"} onClose={() => setOpen(null)} title="Details"><Input label="Notes"/></Drawer>
    <CenterRecordCard open={open === "CenterRecordCard"} onClose={() => setOpen(null)} title="Summary"><DataValue value="DEMO-001"/></CenterRecordCard>
    {open === "PrintDocument" ? <><PrintDocument><h1>{t("Summary")}</h1><DataValue value="DEMO-001"/></PrintDocument><Modal open title="Summary" onClose={()=>setOpen(null)} footer={<Button onClick={()=>window.print()}>{t("Print")}</Button>}><DataValue value="DEMO-001"/></Modal></> : null}
    <ConfirmDialog open={open === "ConfirmDialog"} title="Confirm" message="catalog.confirmDemo" onConfirm={() => {setConfirmed(true);setOpen(null);}} onCancel={() => setOpen(null)}/>
    {confirmed ? <p role="status">{t("catalog.confirmed")}</p> : null}
  </div>;
}

export function StatusDemo() {
  return <div className="flex flex-wrap items-center gap-3"><Avatar name="Demo User" size="lg"/>
    {(["neutral","brand","success","warning","danger","info","violet"] as const).map(tone => <Badge key={tone} tone={tone}>{tone}</Badge>)}
    <StatusBadge value="Approved"/><StatusBadge value={false}/></div>;
}

export function StatesDemo() {
  const {t} = useLocalization();
  const [state,setState] = useState("empty");
  const [count,setCount] = useState(0);
  const action = () => setCount(count+1);
  return <div className="space-y-3">
    <Select label="Status" value={state} onChange={e => setState(e.target.value)} options={[{value:"empty",label:"EmptyState"},{value:"error",label:"ErrorState"},{value:"denied",label:"AccessDenied"},{value:"missing",label:"NotFoundState"},{value:"conflict",label:"ConflictState"},{value:"session",label:"SessionExpiredState"},{value:"loading",label:"LoadingState"}]}/>
    {state === "empty" ? <EmptyState/> : state === "error" ? <ErrorState onRetry={action} referenceId="DEMO-001"/> : state === "denied" ? <AccessDenied/> : state === "missing" ? <NotFoundState/> : state === "conflict" ? <ConflictState onReload={action}/> : state === "session" ? <SessionExpiredState onSignIn={action}/> : <LoadingState/>}
    <output aria-live="polite">{t("catalog.actionCount",{count})}</output>
  </div>;
}

export function SkeletonsDemo() {
  const [view,setView] = useState("table");
  return <div className="space-y-3"><Select label="View" value={view} onChange={e => setView(e.target.value)} options={[{value:"table",label:"TableSkeleton"},{value:"form",label:"FormSkeleton"},{value:"dashboard",label:"DashboardSkeleton"}]}/>
    <Skeleton className="h-6 w-32"/>{view === "table" ? <TableSkeleton rows={3}/> : view === "form" ? <FormSkeleton/> : <DashboardSkeleton/>}
  </div>;
}

export function RecoveryDemo() {
  const {t} = useLocalization();
  const [failed,setFailed] = useState(true);
  const [value,setValue] = useState("");
  return <div className="space-y-3"><Input label="Notes" value={value} onChange={e => setValue(e.target.value)}/>
    {failed ? <RecoveryNotice failure={failureFromError({status:408,reference:"DEMO-001"})} preservesValues onRetry={() => setFailed(false)}/> : <p role="status">{t("catalog.recovered")}</p>}
    <Button onClick={() => setFailed(true)}>{t("catalog.simulateFailure")}</Button>
  </div>;
}

export function InlineDemo() {
  const {format}=useERP();
  const {t} = useLocalization();
  const [name,setName] = useState("DEMO-001");
  const [amount,setAmount] = useState(100);
  const [status,setStatus] = useState("active");
  const [date,setDate] = useState("2026-09-09");
  const options = [{value:"active",label:"Active"},{value:"pending",label:"Pending"}];
  return <DescriptionList layout="stacked" items={[
    {id:"name",label:"Name",value:<InlineEdit label="Name" value={name} onCommit={setName} validate={next => next.trim() ? null : t("Required")}/>},
    {id:"amount",label:"Amount",value:<InlineEditNumber label="Amount" value={amount} display={format.number(amount)} min={0} onCommit={setAmount}/>},
    {id:"select",label:"Select",value:<InlineEditSelect label="Select" value={status} options={options} onCommit={setStatus}/>},
    {id:"date",label:"Date",value:<InlineEditDate label="Date" value={date} display={format.date(date)} onCommit={setDate}/>},
    {id:"status",label:"Status",value:<InlineEditStatus label="Status" value={status} options={options} onCommit={setStatus} allowedTransitions={{active:["pending"],pending:["active"]}}/>},
  ]}/>;
}

export function FormDemo() {
  const {t} = useLocalization();
  const [name,setName] = useState("");
  const [status,setStatus] = useState("active");
  const [saved,setSaved] = useState(false);
  return <form className="space-y-3" onSubmit={e => {e.preventDefault();setSaved(true);}}>
    <Input label="Name" required value={name} onChange={e => {setName(e.target.value);setSaved(false);}}/>
    <Select label="Status" options={[{value:"active",label:"Active"},{value:"pending",label:"Pending"}]} value={status} onChange={e => {setStatus(e.target.value);setSaved(false);}}/>
    <Button type="submit" variant="primary">{t("Save")}</Button>
    {saved ? <p role="status">{t("catalog.savedLocally")}</p> : null}
  </form>;
}

export function BillingDemo() {
  const {format} = useERP();
  const [quantity,setQuantity] = useState(2);
  const [price,setPrice] = useState(100);
  return <div className="space-y-3"><CardGrid columns={2}>
    <Input label="Quantity" type="number" min={0} value={quantity} onChange={e => setQuantity(Math.max(0,Number(e.target.value)))}/>
    <Input label="Unit price" type="number" min={0} step="0.01" value={price} onChange={e => setPrice(Math.max(0,Number(e.target.value)))}/>
    </CardGrid><DescriptionList items={[{id:"total",label:"Total",value:<DataValue value={price*quantity} numeric format={format.money}/>}]}/>
    <p><LocalizedText message="catalog.billingHint"/></p>
  </div>;
}

export function LocalizationDemo() {
  const locale = useLocalization();
  const {format} = useERP();
  return <LocalizationProvider value={locale}><div dir={locale.direction} className="space-y-3"><LocalizedText message="catalog.localizationHint"/>
    <Input label="Name"/><StatusBadge value="Active"/><DataValue value={1234.5} format={format.number}/></div></LocalizationProvider>;
}

export function WorklistDemo() {
  const {t} = useLocalization();
  const [rows,setRows] = useState([{id:"DEMO-001",name:"Example A",amount:120,status:"Active"},{id:"DEMO-002",name:"Example B",amount:240,status:"Pending"}]);
  const [selected,setSelected] = useState<string[]>([]);
  const [sort,setSort] = useState<{key:string;direction:"asc"|"desc"}|null>(null);
  const [preview,setPreview] = useState<string|null>(null);
  const columns: DataColumn[] = [{key:"name",label:"Name",type:"text",sortable:true,editable:true},{key:"amount",label:"Amount",type:"money",sortable:true,editable:true},{key:"status",label:"Status",type:"status",sortable:true}];
  const {format,preferences} = useERP();
  const sorted = [...rows].sort((a,b) => {
    if(!sort) return 0;
    const left=a[sort.key as keyof typeof a],right=b[sort.key as keyof typeof b];
    return (typeof left === "number" && typeof right === "number" ? left-right : String(left).localeCompare(String(right))) * (sort.direction === "asc" ? 1 : -1);
  });
  return <div className="space-y-3"><DataTable rows={sorted} columns={columns} primaryKey="id" displayKey="name" selected={selected}
    onToggle={id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current,id])}
    onToggleAll={() => setSelected(selected.length === rows.length ? [] : rows.map(row => row.id))}
    sort={sort} onSort={column => setSort({key:column.key,direction:sort?.key === column.key && sort.direction === "asc" ? "desc" : "asc"})}
    onPreview={row => setPreview(String(row.name))} onView={row => setPreview(String(row.name))} onEdit={row => setPreview(String(row.name))}
    onCellCommit={(row,column,next) => setRows(current => current.map(item => item.id === row.id ? {...item,[column.key]:column.type === "money" ? Number(next) : next} : item))}
    density={preferences.density} format={format} zebra={preferences.zebraStripes} stickyHeader={preferences.stickyTableHeader} wrap={preferences.wrapCellText}/>
    <Modal open={preview !== null} onClose={() => setPreview(null)} title="Details"><DataValue value={preview}/><p>{t("catalog.sampleData")}</p></Modal>
  </div>;
}
