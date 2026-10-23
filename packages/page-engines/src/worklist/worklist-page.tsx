"use client";
import {PresentationProvider} from '@pepbits/components';
import {usePreferences} from '@pepbits/preferences/react';
import {useScreenHost,useFormatters} from '@pepbits/patterns/screen-host';
import type {WorklistPageProps} from './types';
import {RecoveryNotice, failureFromError} from "@pepbits/components";
import {reportOperationFailure} from "@pepbits/platform/monitoring";
import {Card} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";
import {Modal} from "@pepbits/components";
import { ApprovalWorkspace } from "@pepbits/patterns/approvals";


import { CsvImportDialog } from "@pepbits/patterns/imports";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {flushSync} from 'react-dom';
import { Archive, Columns3, Download, FilterX, Grid2X2, ListFilter, MoreHorizontal, Plus, Printer, RefreshCw, Rows3, Save, Settings2, Star, Upload } from "@pepbits/icons";
import { PersonalViews, type PersonalViewLayout } from "./personal-views";

import { useNavigation } from "@pepbits/platform";

import {Button, IconButton, Segmented} from "@pepbits/ui";
import {ConfirmDialog, ConflictState, classifyFailure, type Failure, type ReferenceResponse, ErrorState} from "@pepbits/components";
import {SearchInput} from "@pepbits/ui";
import {Badge} from "@pepbits/ui";
import {ActionMenu, MenuButton} from "@pepbits/components";
import {EmptyState} from "@pepbits/components";
import {Pagination} from "@pepbits/components";
import { useColumnLayout } from "./use-column-layout";


import { exportRows } from "./export-rows";

import { FilterBar } from "./filter-bar";
import { searchWorklist } from "./search-request";
import { DataTable } from "./data-table";
import { CardGrid } from "./card-grid";
import { ColumnManager } from "./column-manager";
import { RecordPreview } from "./record-preview";
import {storableFilters, partitionFilters, exportAudit, reviewExport} from "../types";
import type {DataColumn, EgressVia, ExportReview, PageDefinition, FilterDefinition, WorklistConfig} from "../types";
import type {ResultView} from "@pepbits/preferences";
import {cn} from "@pepbits/ui";

function valueText(value: string | number | boolean) { return String(value).toLowerCase(); }

type Row = Record<string, string | number | boolean>;
type SavedFilters = { search: string; filters: Record<string, string> };

/* Filters are written at the point of the user's action, not from an effect on
   [search, filters]: an effect fires on the page-change reset too, and would
   save page A's filters under page B's key for one render before the reset
   landed. Last write wins, but the transient wrong write is still a bug. */
/* Filtered on the way IN as well as out: whatever is on disk may have been
   written by a build from before this rule existed. */
function readFilters(pageId: string, definitions:FilterDefinition[]): SavedFilters | null {
  try {
    const raw = window.localStorage.getItem(`pepbits-filters:${pageId}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedFilters;
    return { search: "", filters: storableFilters(definitions, saved.filters ?? {}) };
  } catch { return null; }
}

/**
 * The same allowlist that guards the URL guards this.
 *
 * localStorage is not a safer place than a query string — it is unencrypted, it
 * survives logout, and it outlives the session that was authorised to see the
 * value. §17.7 asks for the minimum to be kept there.
 *
 * `search` is dropped outright, and `query` is classified phi for the same
 * reason: both are free-text boxes a user can type anything into, which makes
 * them the single most likely place for a personal name to arrive by accident.
 * That is exactly what a browser check found here — the search box was blanked
 * while the same text went on reaching disk as filters.query.
 */
function writeFilters(pageId: string, saved: SavedFilters, definitions:FilterDefinition[]) {
  const safe = { search: "", filters: storableFilters(definitions, saved.filters ?? {}) };
  try { window.localStorage.setItem(`pepbits-filters:${pageId}`, JSON.stringify(safe)); } catch { /* storage unavailable */ }
}
function clearFilters(pageId: string) {
  try { window.localStorage.removeItem(`pepbits-filters:${pageId}`); } catch { /* storage unavailable */ }
}

const PENDING_VIEW = "pepbits-pending-view";

/**
 * The handoff from a saved view.
 *
 * A view exists to carry the filters a URL may NOT, so they cannot ride in the
 * redirect that opens the worklist. sessionStorage is the only channel between
 * two routes of one tab — and it is a web store rather than memory, so this
 * TAKES: the entry is removed before it is used, and a personal name does not
 * sit in a store for the life of the tab.
 *
 * Removed even when it is not for this page. The handoff is a one-shot for the
 * redirect that immediately follows, so an entry arriving anywhere else was
 * never going to be consumed as intended, and keeping PHI on the chance that it
 * might be is the wrong way round.
 *
 * Nothing read this at all until it was noticed in a browser: the view resolved,
 * the redirect landed, and the worklist showed every row unfiltered while the
 * name it was filtered by stayed in the store.
 */
function takePendingView(pageId: string): Record<string, string> | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(PENDING_VIEW);
    if (raw !== null) window.sessionStorage.removeItem(PENDING_VIEW);
  } catch { return null; }
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as { pageId?: string; filters?: Record<string, string> };
    if (pending.pageId !== pageId || !pending.filters) return null;
    return pending.filters;
  } catch { return null; }
}

/* "smart" matches every whitespace-separated token somewhere in the ROW, so
   "north active" finds a northern record whose status is Active even though no
   single cell contains both words. The other two modes test each cell alone. */
function rowMatches(row: Row, term: string, mode: "contains" | "starts-with" | "smart"): boolean {
  const values = Object.values(row).map(valueText);
  if (mode === "smart") { const hay = values.join(" "); return term.split(/\s+/).every((token) => hay.includes(token)); }
  if (mode === "starts-with") return values.some((value) => value.startsWith(term));
  return values.some((value) => value.includes(term));
}

export function WorklistPage(props:WorklistPageProps) {
 const {preferences}=usePreferences();
 return <PresentationProvider value={preferences}><WorklistContent key={JSON.stringify([props.adapter.identity,props.page.id])} {...props}/></PresentationProvider>;
}
function WorklistContent({page,config,adapter,imports,approvals,onReturn,onPreferences,personalViews=true,rowClick='preview'}:WorklistPageProps) {
 const {t}=useLocalization(),{preferences,isLocked,allowedValues,update}=usePreferences(),format=useFormatters();
 const [printedAt,setPrintedAt]=useState<Date|null>(null);
 useEffect(()=>{
   setPrintedAt(new Date());
   // Server and first client render agree; native printing gets a fresh timestamp.
   const beforePrint=()=>flushSync(()=>setPrintedAt(new Date()));
   window.addEventListener('beforeprint',beforePrint);
   return ()=>window.removeEventListener('beforeprint',beforePrint);
 },[]);
 const host=useScreenHost(),navigation=useNavigation(),authedFetch=adapter.request;
 const toast=useCallback((notice:{title:string;message?:string;type:'success'|'error'|'warning'|'info'})=>host.notify([t(notice.title),notice.message&&t(notice.message)].filter(Boolean).join(' — '),{tone:notice.type}),[host.notify,t]);
 const product={id:adapter.applicationId},user=adapter.actor;
 const canEdit=host.can('edit',page),canExport=host.can('export',page),canArchive=host.can('archive',page);
 const definitions=useMemo(()=>[...config.basicFilters,...config.advancedFilters],[config.basicFilters,config.advancedFilters]);
 const classificationFor=useCallback((key:string)=>definitions.find(filter=>filter.key===key)?.classification??'unclassified',[definitions]);
  const explicitView = useRef(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [approvalOpen,setApprovalOpen]=useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pendingEgress, setPendingEgress] = useState<{ rows: Row[]; what: string; review: ExportReview; via: EgressVia } | null>(null);

  /**
   * The lists the server owns, and which of them failed.
   *
   * `branch` is a reference list, not a fixed set of options. An empty branch
   * dropdown means "this tenant has no branches" or "the branch service is
   * down" — identical on screen, opposite in meaning, one a setup task and one
   * an incident. The bar can only tell them apart if the failure travels with
   * the data.
   *
   * A failed FETCH leaves this null and the bar falls back to the config's own
   * options: no information about the lists is not the same as information that
   * they are broken.
   */
  const [reference, setReference] = useState<ReferenceResponse | null>(null);
  const loadReference = useCallback(() => {
    if(!adapter.referenceKeys)return;
    void authedFetch(`/reference?keys=${encodeURIComponent([...new Set(Object.values(adapter.referenceKeys))].join(","))}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setReference((body as ReferenceResponse | null) ?? null))
      .catch(() => setReference(null));
  }, [authedFetch,adapter.referenceKeys]);
  useEffect(() => loadReference(), [loadReference]);
  const [selected, setSelected] = useState<string[]>([]);
  const [previewRow, setPreviewRow] = useState<Record<string, string | number | boolean> | null>(null);
  const [columnOpen, setColumnOpen] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const defaults = useMemo(() => config.columns.filter((column) => column.defaultVisible !== false).map((column) => column.key), [config.columns]);
  /* Column visibility and sort live in whichever store columnLayoutScope names
     -- this browser, or the account. Everything below is unaware of which. */
  const { visibleKeys, setVisibleKeys, sort, setSort, reset: resetLayout } =
    useColumnLayout(page.id, preferences.columnLayoutScope, config.columns, defaults, adapter);

  useEffect(() => {
    /* Every worklist shares this one component instance, so a page change must
       reset what the previous page left behind -- and, when remembering, restore
       what THIS page had. */
    /* A saved view wins over whatever this page remembered: it is an explicit
       act, and the point of following the link is to see what it holds.
       Restored by KEY: anything this page declares as a filter goes back to the
       filter bar it was typed into, and only a key the page has no filter for
       falls through to the search box above. Routing everything to the search
       box instead put a value typed in the keyword field back somewhere else,
       which filters the same rows and still reads as the wrong answer. */
    const pending = takePendingView(page.id);
    if (pending) {
      explicitView.current = true;
      const declared = new Set([...config.basicFilters, ...config.advancedFilters].map((filter) => filter.key));
      const restored: Record<string, string> = {};
      let restoredSearch = "";
      for (const [key, value] of Object.entries(pending)) {
        if (declared.has(key)) restored[key] = value;
        else if (key === "query") restoredSearch = value;
      }
      setSearch(restoredSearch);
      setFilters(restored);
    } else {
      const saved = preferences.rememberFilters ? readFilters(page.id,definitions) : null;
      setSearch(saved?.search ?? "");
      setFilters(saved?.filters ?? {});
    }
    setPageNumber(1);
    setSelected([]);
  }, [config.advancedFilters, config.basicFilters, page.id, preferences.rememberFilters,definitions]);

  const persist = (nextSearch: string, nextFilters: Record<string, string>) => {
    if (preferences.rememberFilters) writeFilters(page.id, { search: nextSearch, filters: nextFilters },definitions);
  };

  const pageSize = preferences.pageSize;
  /**
   * Corrections made in the table, by record id and column.
   *
   * Held here rather than written through, because these rows are generated in
   * the client and there is no server copy to write to yet. What that means for
   * the framework's §20 conflict model is that it is unexercised, not absent:
   * InlineEdit surfaces a rejected write and keeps the typed value, and the day
   * these rows come from an API with a version on them, the rejection has
   * somewhere to come from.
   */
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  useEffect(() => { setEdits({}); }, [page.id]);

  /**
   * The answer to two people editing one cell.
   *
   * The gap analysis raised this against inline editing and said the decision
   * had to be made before the component was written rather than after. It was
   * written first and the decision is being made now: the write is REFUSED, not
   * merged and not overwritten. Last-write-wins loses somebody's work silently,
   * which is the one outcome nobody can detect afterwards.
   */
  const [conflict, setConflict] = useState<{ id: string; key: string; label: string; theirs: string; mine: string } | null>(null);
  useEffect(() => { setConflict(null); }, [page.id]);

  /* Definitions, from the worklist config plus the classification registry.
     The config says what a filter IS on screen; the registry says what it
     HOLDS, and only the second decides where the value may go. */
  const toDefinitions = useCallback(
    (source: WorklistConfig["basicFilters"]): FilterDefinition[] =>
      source.map((filter) => ({ ...filter, classification: classificationFor(filter.key) })),
    [classificationFor],
  );
  const basicDefinitions = useMemo(() => toDefinitions(config.basicFilters), [config.basicFilters, toDefinitions]);
  const advancedDefinitions = useMemo(() => toDefinitions(config.advancedFilters), [config.advancedFilters, toDefinitions]);
  /**
   * What is being held back, INCLUDING the search box above the bar.
   *
   * That box is separate state and is not one of the config's filters, so it
   * was not reaching the share decision at all: someone could type a name into
   * it and still be offered a copy-link. It is free text a user can type
   * anything into, which is exactly why `query` is classified phi — and the
   * decision has to see it.
   */
  const sensitiveFilterKeys = useMemo(() => {
    const everything = { ...filters, ...(search.trim() ? { query: search } : {}) };
    return partitionFilters(
      [...basicDefinitions, ...advancedDefinitions, { key: "query", label: "Search", type: "text", classification: classificationFor("query") }],
      everything,
    ).sensitiveKeys.sort();
  }, [basicDefinitions, advancedDefinitions, filters, search]);

  /* The sharing branch. A view holds the filters a URL may not, so the link is
     an opaque id and the values stay on the server. */
  const createSavedView = useCallback(async () => {
    try {
      const response = await authedFetch("/views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId: page.id, label: `${page.title} — filtered`, filters: { ...filters, ...(search.trim() ? { query: search } : {}) } }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const view = (await response.json()) as { id: string };
      const link = `${window.location.origin}/view/${view.id}`;
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      toast({ title: "Saved view created", message: `${view.id} — the link carries no filter values.`, type: "success" });
    } catch (error) { reportOperationFailure();
      /* Through the mapper, so a 403 on a saved view reads as a refusal rather
         than as a broken service — and the reference gives support something to
         trace, since the detail never reaches the screen. */
      const status = Number(error instanceof Error ? error.message : NaN);
      const failure = classifyFailure(Number.isFinite(status) ? { status } : { networkError: true });
      toast({ title: failure.title, message: `${failure.description} Reference: ${failure.reference}`, type: "error" });
    }
  }, [filters, search, page.id, page.title, toast, authedFetch]);

  // Server results are authoritative; a failed request remains visible as an error.
  const [remote, setRemote] = useState<{ rows: Row[]; total: number } | null>(null);
  const [searchFailure, setSearchFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const searchGeneration = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const runSearch = useCallback(async () => {
    const generation = ++searchGeneration.current;
    requestAbort.current?.abort();
    const controller = new AbortController(); requestAbort.current = controller;
    setLoading(true); setSearchFailure(null);
    const everything = { ...filters, ...(search.trim() ? { query: search } : {}) };
    const result = await searchWorklist(
      { pageId: page.id, title: page.title, entity: page.entity ?? "record", productId: product.id,
        page: pageNumber, pageSize, sort, queryMode: preferences.globalSearchMode,
        definitions: [...basicDefinitions, ...advancedDefinitions, { key: "query", label: "Search", type: "text", classification: classificationFor("query") }], filters: everything },
      (path, init) => authedFetch(path, { ...init, signal: controller.signal }),
    );
    if (generation !== searchGeneration.current) return;
    setLoading(false);
    if (result.ok) {
      setRemote({ rows: (result.rows ?? []) as Row[], total: result.total ?? 0 });
      setSelected(previous => previous.filter(id => result.rows?.some(row => String(row[config.primaryKey]) === id)));
      if (result.page && result.page !== pageNumber) setPageNumber(result.page);
    } else { setRemote(null); setSearchFailure(result.failure ?? null); }
  }, [authedFetch, filters, search, page.id, page.title, page.entity, product.id, pageNumber, pageSize, sort, preferences.globalSearchMode, basicDefinitions, advancedDefinitions, config.primaryKey]);
  useEffect(() => {
    setLoading(true); setRemote(null); setSearchFailure(null);
    const timer = setTimeout(() => void runSearch(), 200);
    return () => { clearTimeout(timer); searchGeneration.current++; requestAbort.current?.abort(); };
  }, [runSearch, refresh]);
  useEffect(() => { setSelected([]); }, [page.id, filters, search, sort, pageNumber, pageSize]);
  const results = remote?.rows ?? [];
  const total = remote?.total ?? 0;
  const pageRows = results.map(row => {
    const applied = edits[String(row[config.primaryKey])];
    return applied ? { ...row, ...applied } : row;
  });
  const visibleColumns = visibleKeys.map((key) => config.columns.find((column) => column.key === key)).filter(Boolean) as DataColumn[];
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const changeFilter = (key: string, value: string) => { const next = { ...filters, [key]: value }; setFilters(next); persist(search, next); setPageNumber(1); };
  const reset = () => { setFilters({}); setSearch(""); clearFilters(page.id); setPageNumber(1); toast({ title: "Filters reset", message: "The default worklist view has been restored.", type: "info" }); };
  const toggle = (id: string) => setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  const toggleAll = () => {
    const ids = pageRows.map((row) => String(row[config.primaryKey]));
    const all = ids.every((id) => selected.includes(id));
    setSelected((previous) => all ? previous.filter((id) => !ids.includes(id)) : Array.from(new Set([...previous, ...ids])));
  };
  const toggleSort = (column: DataColumn) => {
    if (!column.sortable) return;
    setSort((previous) => previous?.key === column.key ? { key: column.key, direction: previous.direction === "asc" ? "desc" : "asc" } : { key: column.key, direction: "asc" });
    setPageNumber(1);
  };
  /* On web, openInNewContext is window.open -- so every View click spawned a
     browser tab whether the user wanted one or not. `open` navigates in place.
     On desktop both members append an MDI tab, so this reads as "reuse the
     matching tab" vs "always a new one", which is the same intent. */
  const openRecord = (target: Parameters<typeof navigation.open>[0]) =>
    preferences.openRecordsIn === "same-tab" ? navigation.open(target) : navigation.openInNewContext(target);
  const selectedRows = useMemo(()=>pageRows.filter((row) => selected.includes(String(row[config.primaryKey]))),[results,edits,selected,config.primaryKey]);

  /* Offer the selection to the assistant. Publishing is all this page does --
     it hands over rows it is already showing, and the use case decides which
     columns of them may be read. The page never learns what AI does with it,
     and the assistant never reaches in here for more. */
  useEffect(()=>host.publishSources?.([{id:`worklist:${page.id}`,sources:{"worklist-selection":selectedRows}}]),[host.publishSources,page.id,selectedRows]);
  /**
   * A file is the one destination this application cannot take back.
   *
   * No retention rule reaches it, no revocation does, and nobody is asked again
   * when it is forwarded. So a column that identifies a person, or says
   * something clinical, is exported — a ward list with the names removed is not
   * a ward list, and the person exporting is already reading it on screen — but
   * only after being told what the file will hold, and the export is recorded
   * by column key afterwards. Values never reach the audit; see exportAudit.
   */
  const [exportFailure,setExportFailure]=useState<{failure:Failure;retry:()=>void;downloaded:boolean}|null>(null);
  const writeExport = (rows: Row[], what: string) => {
    setExportFailure(null);
    try {
      const { filename, review } = exportRows(rows, visibleColumns.map(column=>({...column,label:t(column.labelKey ?? column.label)})), format, preferences.exportFormat, page.id);
      const audit=async()=>{
        try {
          const response=await authedFetch('/exports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(exportAudit(page.id,review,rows.length))});
          if(!response.ok)throw {status:response.status,reference:response.headers.get('X-Sentinel-Reference')};
          if(mounted.current)setExportFailure(null);
        } catch(error) {if(mounted.current)setExportFailure({failure:failureFromError(error),retry:()=>void audit(),downloaded:true});}
      };
      void audit();
      toast({title:'Export ready',message:`${rows.length} ${what} saved as ${filename}.`,type:'success'});
    } catch(error) {
      reportOperationFailure();setExportFailure({failure:{...failureFromError(error),title:"recovery.exportTitle",description:"recovery.exportFailed"},retry:()=>writeExport(rows,what),downloaded:false});
    }
  };

  const doExport = (rows: Row[], what: string) => {
    if (!canExport) return;
    if (!rows.length) { toast({ title: "Nothing to export", message: "No records match the current view.", type: "warning" }); return; }
    const review = reviewExport(visibleColumns);
    if (!review.silent) { setPendingEgress({ rows, what, review, via: "file" }); return; }
    writeExport(rows, what);
  };

  /**
   * Paper is a document too, and the one that cannot be recalled at all.
   *
   * Two paths reach it and they need different controls. This one is deliberate
   * and is governed exactly like an export — the same review, the same
   * confirmation. The other is Ctrl+P, which no script can intercept: a
   * `beforeprint` handler runs but cannot cancel the print, so what governs it
   * is the print stylesheet (which refuses a class outright) and the banner
   * below (which is in the document before anyone asks). The listener records.
   */
  const doPrint = (rows: Row[]) => {
    if (!canExport) return;
    const review = reviewExport(visibleColumns);
    if (!review.silent) { setPendingEgress({ rows, what: "records", review, via: "print" }); return; }
    window.print();
  };

  /* The same review the confirmation uses, so the banner cannot describe a
     different sheet from the one the dialog described. */
  const printReview = useMemo(() => reviewExport(visibleColumns), [visibleColumns]);

  const latestPrint = useRef({ pageId: page.id, columns: visibleColumns, rows: 0 });
  latestPrint.current = { pageId: page.id, columns: visibleColumns, rows: pageRows.length };

  useEffect(() => {
    /* Read through a ref so the listener is bound once. Re-subscribing on every
       filter keystroke would be harmless and is still the kind of churn that
       hides a leak later. */
    const record = () => {
      const { pageId, columns, rows } = latestPrint.current;
      void authedFetch("/exports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(exportAudit(pageId, reviewExport(columns), rows, "print")),
      }).catch(() => { /* the sheet is already printing; nothing here can stop it */ });
    };
    window.addEventListener("beforeprint", record);
    return () => window.removeEventListener("beforeprint", record);
  }, []);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFailures, setBulkFailures] = useState<Array<{id: string; error: string}>>([]);
  const bulkLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const archive = async () => {
    if (!canArchive || bulkLock.current || loading || !selected.length) return;
    bulkLock.current = true;
    const generation = searchGeneration.current;
    setBulkBusy(true); setConfirmArchive(false);
    const ids = [...selected];
    try {
      const response = await authedFetch("/worklists/archive", { method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({productId:product.id,pageId:page.id,title:page.title,entity:page.entity,ids}) });
      if (!response.ok) throw new Error("Archive failed. Your selection is retained; try again.");
      const body = await response.json() as { results: Array<{id:string;ok:boolean;error?:string}> };
      if (!Array.isArray(body.results) || ids.some(id => !body.results.some(item => item.id === id))) throw new Error("The service did not confirm every selected record.");
      if (!mounted.current) return;
      const failures = body.results.filter(item => !item.ok).map(item => ({id:item.id,error:item.error ?? "Could not archive"}));
      setBulkFailures(failures); if (generation === searchGeneration.current) setSelected(failures.map(item => item.id));
      toast({title: failures.length ? "Some records were not archived" : "Records archived", message:`${ids.length-failures.length} archived; ${failures.length} need attention.`,type:failures.length ? "warning" : "success"});
      setRefresh(value => value + 1);
    } catch (error) { reportOperationFailure(); if (mounted.current) setBulkFailures(ids.map(id => ({id,error:(error as Error).message}))); }
    finally { bulkLock.current = false; if (mounted.current) setBulkBusy(false); }
  };
  const applyPersonalView = (layout: PersonalViewLayout) => {
    const {query = "", ...rest} = layout.filters;
    const columns = layout.columns.filter(key => config.columns.some(column => column.key === key));
    setSearch(query); setFilters(rest); persist(query, rest); setVisibleKeys(columns.length ? columns : defaults);
    setSort(layout.sort && config.columns.some(column => column.key === layout.sort?.key) ? layout.sort : null);
    const size = ([10, 20, 50, 100] as const).find(size => size === layout.pageSize) ?? 20;
    update({pageSize:size}); setPageNumber(1); setSelected([]);
  };
  const view = (row: Record<string, string | number | boolean>) => { setPreviewRow(null); openRecord({ pageId: page.id, mode: "view", recordId: String(row[config.primaryKey]), title: `${String(row[config.displayKey])} • View` }); };
  const edit = (row: Record<string, string | number | boolean>) => { if (!canEdit) return; setPreviewRow(null); openRecord({ pageId: page.id, mode: "edit", recordId: String(row[config.primaryKey]), title: `${String(row[config.displayKey])} • Edit` }); };

  return (
    <div className="flex w-full flex-col gap-3">
      {exportFailure?<div>{exportFailure.downloaded?<p role="status"><LocalizedText message="recovery.exportAudit" /></p>:null}<RecoveryNotice sessionRestored={adapter.sessionAvailable ?? false} failure={exportFailure.failure} onRetry={exportFailure.retry} onReturn={()=>setExportFailure(null)}/></div>:null}
      {bulkFailures.length ? <div role="alert" className="rounded-lg border border-[var(--border)] p-3 text-sm"><b><LocalizedText message="ui.archive.results.f0345b60" /></b>{bulkFailures.map(item => <div key={item.id}>{item.id}: {item.error}</div>)}</div> : null}

      {/* A printed sheet has no headers, no footers and no provenance: found on
          a desk, it is an anonymous list of persons. This says whose it is,
          when it was taken and what is on it — and it lives in the document at
          all times, hidden on screen, because a banner added by script when
          printing begins would be absent from the print that script never saw.
          See tokens.css for why Ctrl+P cannot be intercepted. */}
      <div className="print-only mb-3 border-b-2 border-black pb-2 text-black">
        <div className="text-[11px] font-black uppercase tracking-[.14em]"><LocalizedText message={page.title} /></div>
        <div className="mt-1 text-[9px] leading-relaxed"><LocalizedText message="ui.printed.by.c16730e3" />{" "}{user?.name ?? "an unidentified user"}{user?.email ? ` (${user.email})` : ""}{" "}<LocalizedText message="ui.tenant.b34b287f" />{" "}{user?.tenantId ?? "unknown"}{printedAt?<> · <time dateTime={printedAt.toISOString()}>{format.dateTime(printedAt)}</time></>:null} · {pageRows.length}{" "}<LocalizedText message="ui.records.a94e7bcf" /></div>
        {printReview.declared.length ? (
          <div className="mt-1 text-[9px] font-bold leading-relaxed"><LocalizedText message="ui.contains.2eaecb3d" />{" "}{printReview.declared.map((note) => note.label).join(", ")}.
            {printReview.declared.some((note) => note.classification === "phi") ? " Person-identifying information — handle under the tenant's retention policy." : ""}
          </div>
        ) : null}
      </div>      <Card className="flex flex-wrap items-center gap-2 p-2.5">
        <div data-tour="search" className="min-w-[240px] flex-1 lg:max-w-xl"><SearchInput value={search} onChange={(value) => { setSearch(value); persist(value, filters); setPageNumber(1); }} className="w-full" placeholder={t("Search {page} by ID, name or any visible value…",{page:t(page.title)})} /></div>
        <Button disabled={!host.can("create",page)} data-tour="new" variant="primary" leftIcon={<Plus className="size-3.5" />} onClick={() => openRecord({ pageId: page.id, mode: "new", title: `New ${page.title.replace(/ (Master|Worklist)$/i, "")}` })}><LocalizedText message="ui.new.18fdd549" /></Button>
        <div className="hidden h-7 w-px bg-[var(--border)] md:block" />
        {personalViews && <PersonalViews request={authedFetch} key={`${product.id}:${page.id}`} productId={product.id} pageId={page.id}
          layout={{ filters: {...filters,...(search ? {query:search} : {})},columns:visibleKeys,sort,pageSize }}
          onApply={applyPersonalView} allowDefault={() => !explicitView.current} onShare={createSavedView} />}
        <div className="ml-auto flex items-center gap-1">
            {/* Was two IconButtons in a bordered box, which is a segmented
                control drawn by hand: no group name, no radio semantics, and
                two tab stops where there should be one. */}
            <fieldset disabled={isLocked("resultView")} data-tour="view" className="m-0 border-0 p-0">
              <Segmented
                label="Result view"
                value={preferences.resultView}
                onChange={(next) => update({resultView:next as ResultView})}
                options={[
                  { value: "table", label: "Table view", disabled:allowedValues("resultView")!==undefined&&!allowedValues("resultView")!.includes("table"), icon: <Rows3 className="size-3.5" />, iconOnly: true },
                  { value: "cards", label: "Card grid view", disabled:allowedValues("resultView")!==undefined&&!allowedValues("resultView")!.includes("cards"), icon: <Grid2X2 className="size-3.5" />, iconOnly: true },
                ]}
              />
            </fieldset>
          <IconButton data-tour="columns" label="ui.choose.columns.61b55093" onClick={() => setColumnOpen(true)}><Columns3 className="size-4" /></IconButton>
          <IconButton label="ui.refresh.results.04cc9c1a" disabled={loading || bulkBusy} onClick={() => { setEdits({}); setRefresh(value => value + 1); }}><RefreshCw className="size-4" /></IconButton>
          {!!approvals?<Button onClick={()=>setApprovalOpen(true)}><LocalizedText message="ui.approval.inbox.a670f0ac" /></Button>:null}
          <ActionMenu trigger={<IconButton label="ui.more.worklist.actions.e02a7587"><MoreHorizontal className="size-4" /></IconButton>}>
            {(close) => <>{canExport ? <MenuButton icon={<Download className="size-3.5" />} label={t("Export visible records ({format})",{format:preferences.exportFormat.toUpperCase()})} onClick={() => { doExport(pageRows, "current page — records"); close(); }} /> : null}{canExport ? <MenuButton icon={<Printer className="size-3.5" />} label="Print this list" onClick={() => { doPrint(pageRows); close(); }} /> : null}{imports?.definition && host.can("create",page) ? <MenuButton icon={<Upload className="size-3.5" />} label="Import records" onClick={() => { setImportOpen(true); close(); }} /> : null}{onPreferences?<MenuButton icon={<Settings2 className="size-3.5" />} label="Page preferences" onClick={() => { onPreferences(); close(); }} />:null}</>}
          </ActionMenu>
        </div>
      </Card>

        {/* The shared bar, driven by the classification registry. It replaces a
            panel that rendered the same controls with no idea what any of them
            held — which is how a personal name reached localStorage. */}
        <div data-tour="filters">
          <FilterBar
            reference={reference ?? undefined}
            referenceKeys={adapter.referenceKeys}
            onRetryReference={loadReference}
            definitions={basicDefinitions}
            advanced={advancedDefinitions}
            values={filters}
            sensitiveKeys={sensitiveFilterKeys}
            onChange={changeFilter}
            onApply={() => void runSearch()}
            onReset={reset}
            onCopyLink={() => { void navigator.clipboard?.writeText(window.location.href); toast({ title: "Link copied", message: "It carries only the filters that may travel in a URL.", type: "success" }); }}
            onSaveView={() => void createSavedView()}
          />
        </div>

      {selected.length ? <div className="animate-slide-up flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[color-mix(in_srgb,var(--primary)_25%,var(--border))] bg-[var(--primary-soft)] px-3 py-2"><Badge tone="brand">{selected.length}{" "}<LocalizedText message="ui.selected.d7cbbb68" /></Badge><span className="text-[length:calc(9.5px*var(--fs-scale))] font-semibold text-[var(--text-muted)]"><LocalizedText message="ui.selection.applies.to.this.page.only.failed.records.stay.6c13991d" /></span><div className="ml-auto flex gap-1.5"><Button size="xs" variant="secondary" leftIcon={<Archive className="size-3" />} disabled={!canArchive || bulkBusy || loading} onClick={() => preferences.confirmBulkActions ? setConfirmArchive(true) : archive()}><LocalizedText message="ui.archive.66f4804e" /></Button><Button size="xs" variant="secondary" leftIcon={<Download className="size-3" />} disabled={!canExport} onClick={() => doExport(selectedRows, "selected records")}><LocalizedText message="ui.export.36648955" /></Button>{host.renderInlineAction?.({useCaseId:"worklist.summarise-selection",label:t("Summarise")})}<Button size="xs" variant="ghost" leftIcon={<FilterX className="size-3" />} onClick={() => setSelected([])}><LocalizedText message="ui.clear.83b12c22" /></Button></div></div> : null}

      <Card as="section" className="min-h-[420px] overflow-hidden">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
          <div className="flex items-center gap-2"><ListFilter className="size-3.5 text-[var(--primary)]" /><span className="text-[length:calc(10.5px*var(--fs-scale))] font-extrabold"><LocalizedText message="ui.results.219c4a6c" /></span><Badge tone="neutral">{total}{" "}<LocalizedText message="ui.records.a94e7bcf" /></Badge>{activeFilterCount || search ? <Badge tone="brand"><LocalizedText message="ui.filtered.0ba993b3" /></Badge> : null}</div>
          <div className="flex items-center gap-2 text-[length:calc(8.5px*var(--fs-scale))] font-semibold text-[var(--text-muted)]"><span><LocalizedText message="ui.view.1d016dda" />{" "}<b className="text-[var(--text)]">{t(preferences.resultView === "table" ? "Table" : "Card grid")}</b></span><span className="h-3 w-px bg-[var(--border)]" /><span><LocalizedText message="ui.preview.75954c5f" />{" "}<b className="text-[var(--text)]">{t(preferences.previewMode.replaceAll("-", " "))}</b></span></div>
        </div>
        {/* A failed search is a failure, not an empty result: "no records found"
            for a service that is down sends someone to re-check filters that
            were never the problem. */}
        {conflict ? (
          /* Above the table rather than in place of it: one cell lost a race and
             the other ninety-five rows are fine. Replacing the list would be a
             bigger claim than the failure supports. */
          <div className="mb-3"><ConflictState
            title={t("{field} was changed by someone else",{field:t(conflict.label)})}
            description={t('You typed "{mine}". It now says "{theirs}". Your change was not saved.',{mine:conflict.mine,theirs:conflict.theirs})}
            detail={`Record ${conflict.id}`}
            onReload={() => {
              setEdits((current) => ({ ...current, [conflict.id]: { ...current[conflict.id], [conflict.key]: conflict.theirs } }));
              setConflict(null);
            }}
            action={<Button variant="ghost" onClick={() => setConflict(null)}><LocalizedText message="ui.dismiss.48845bff" /></Button>}
          /></div>
        ) : null}
        {searchFailure ? (
          <RecoveryNotice sessionRestored={adapter.sessionAvailable ?? false} failure={searchFailure} onRetry={()=>void runSearch()} onReturn={onReturn} />
        ) : loading ? <div role="status" className="p-6"><LocalizedText message="ui.loading.results.cf2c6389" /></div> : pageRows.length ? preferences.resultView === "table" ? (
          <DataTable onRowOpen={rowClick==='open'?view:undefined}
            onCellCommit={canEdit ? async (row, column, next) => {
              const id = String(row[config.primaryKey]);
              /* What this browser believes the cell says — the local edit if
                 there is one, otherwise what the row was generated with. That
                 is the value the user was editing FROM, which is the thing the
                 server compares against. */
              const seen = String(edits[id]?.[column.key] ?? row[column.key] ?? "");
              const response = await authedFetch(`/worklists/${encodeURIComponent(page.id)}/${encodeURIComponent(id)}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ productId: product.id, column: column.key, value: next, seen, title: page.title, entity: page.entity }),
              }).catch(() => null);

              if (response?.status === 409) {
                const body = (await response.json().catch(() => null)) as { current?: { value?: string } } | null;
                setConflict({ id, key: column.key, label: column.label, theirs: String(body?.current?.value ?? ""), mine: next });
                return;
              }
              if (!response?.ok) {
                const failure = classifyFailure(response ? { status: response.status } : { networkError: true });
                toast({ type: "error", title: failure.title, message: `${failure.description} Reference: ${failure.reference}` });
                return;
              }
              setEdits({}); setRefresh(value => value + 1);
              toast({ type: "success", title: `${column.label} updated`, message: `${id} · ${next}` });
            } : undefined}
            rows={pageRows} columns={visibleColumns} primaryKey={config.primaryKey} displayKey={config.displayKey} selected={selected} onToggle={toggle} onToggleAll={toggleAll} sort={sort} onSort={toggleSort} onPreview={setPreviewRow} onView={view} onEdit={edit} canEdit={canEdit} density={preferences.density} format={format} stickyHeader={preferences.stickyTableHeader} zebra={preferences.zebraStripes} wrap={preferences.wrapCellText} />
        ) : (
          <CardGrid rows={pageRows} columns={visibleColumns} primaryKey={config.primaryKey} displayKey={config.displayKey} selected={selected} onToggle={toggle} onPreview={setPreviewRow} onView={view} onEdit={edit} canEdit={canEdit} density={preferences.density} format={format} />
        ) : <EmptyState action={<Button variant="secondary" onClick={reset}><LocalizedText message="ui.clear.filters.7179ea00" /></Button>} />}
        <Pagination allowedPageSizes={allowedValues("pageSize")} pageSizeDisabled={isLocked("pageSize")} page={pageNumber} pageSize={pageSize} total={total} onPageChange={setPageNumber} onPageSizeChange={(size) => { update({pageSize:size}); setPageNumber(1); }} />
      </Card>

      <Modal open={approvalOpen} onClose={()=>setApprovalOpen(false)} title="Approval inbox" size="xl">{approvalOpen&&approvals?<ApprovalWorkspace {...approvals} productId={product.id} actorId={user?.id} pageId={page.id} onReturn={()=>setApprovalOpen(false)}/>:null}</Modal>
      {imports?<CsvImportDialog {...imports} open={importOpen} onClose={()=>setImportOpen(false)} page={page} productId={product.id} onImported={()=>setRefresh(value=>value+1)} />:null}
      <ColumnManager open={columnOpen} onClose={() => setColumnOpen(false)} columns={config.columns} visibleKeys={visibleKeys} onChange={setVisibleKeys} onReset={resetLayout} />
      <ConfirmDialog open={confirmArchive} title={t("Archive {count} records?",{count:selected.length})} message={<><LocalizedText message="ui.they.will.be.excluded.from.this.worklist.records.that.ca.46f15d6e" /><br /><br /><LocalizedText message="ui.turn.off.06f0e210" />{" "}<b><LocalizedText message="ui.confirm.bulk.actions.5c64ae13" /></b><LocalizedText message="ui.in.my.preferences.to.skip.this.prompt.0e1972b0" /></>} confirmLabel="ui.archive.66f4804e" tone="danger" onConfirm={archive} onCancel={() => setConfirmArchive(false)} />
      <ConfirmDialog
        open={pendingEgress !== null}
        title={pendingEgress?.via === "print"
          ? `Print ${pendingEgress?.rows.length ?? 0} records?`
          : `Export ${pendingEgress?.rows.length ?? 0} records to a file?`}
        confirmLabel={pendingEgress?.via === "print" ? "Print" : "Export"}
        message={<>
          {pendingEgress?.review.declared.length ? (
            <><LocalizedText message="ui.the.b344d80e" />{" "}{pendingEgress.via === "print" ? <LocalizedText message="ui.printout.c05892a2" /> : "file"}{" "}<LocalizedText message="ui.will.contain.8ae754fa" />{" "}<b>{pendingEgress.review.declared.map((note) => note.label).join(", ")}</b>.
              {" "}<LocalizedText message="ui.once.d88f6d83" />{" "}{pendingEgress.via === "print" ? <LocalizedText message="ui.printed.dda3af6e" /> : "saved"}{" "}<LocalizedText message="ui.it.is.outside.this.application.no.retention.rule.reaches.b3c815a5" />{" "}{pendingEgress.via === "print" ? <LocalizedText message="ui.carried.out.of.the.building.fe624e77" /> : <LocalizedText message="ui.forwarded.8e12cac1" />}.<br /><br /></>
          ) : null}
          {pendingEgress?.review.withheld.length ? (
            <><LocalizedText message="ui.held.back.300ea402" />{" "}<b>{pendingEgress.review.withheld.map((note) => note.label).join(", ")}</b><LocalizedText message="ui.nothing.of.that.kind.leaves.as.a.document.487773f4" /><br /><br /></>
          ) : null}{" "}<LocalizedText message="ui.this.is.recorded.against.your.account.by.column.never.by.72dc14ba" /></>}
        onConfirm={() => {
          const pending = pendingEgress;
          setPendingEgress(null);
          if (!pending||!canExport) return;
          if (pending.via === "print") window.print();
          else writeExport(pending.rows, pending.what);
        }}
        onCancel={() => setPendingEgress(null)}
      />
      <RecordPreview canEdit={canEdit} row={previewRow} config={config} onClose={() => setPreviewRow(null)} onView={() => previewRow && view(previewRow)} onEdit={() => previewRow && edit(previewRow)} />
    </div>
  );
}
