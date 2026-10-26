"use client";
import {CardGrid} from "@pepbits/components";
import {LocalizedText, useLocalization} from "@pepbits/i18n/react";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Copy, Eye, FileCheck2, History, LockKeyhole, MoreHorizontal, Pencil, RotateCcw, Save, Send, ShieldCheck, Sparkles } from "@pepbits/icons";
import {withSchemaLocalization, isFieldVisible, isFieldRequired, fieldOptions, updateFormValue, validateForm} from "../types";
import {localizeFieldError} from "@pepbits/i18n";





import {Button, IconButton} from "@pepbits/ui";
import {Badge} from "@pepbits/ui";
import {Card} from "@pepbits/components";
import {DateInput, Input, MultiSelect, Select, Textarea, Toggle} from "@pepbits/ui";
import {ActionMenu, MenuButton} from "@pepbits/components";
import {cn} from "@pepbits/ui";
import type {FormFieldSchema, PageDefinition} from "../types";
import { useNavigation } from "@pepbits/platform";
import type { NavigationTarget } from "@pepbits/platform";
import { useRecordEditor, RecordSaveStatus } from "../records/use-record-editor";
import { FormNavigationControl } from "./form-navigation";

import {usePreferences} from '@pepbits/preferences/react';
import {useScreenHost,useScreenDraftState,useFormatters} from '@pepbits/patterns/screen-host';
import type {EntitySchema,FormValues} from '../types';
import {useRecordHost} from '../records/use-record-editor';
export interface DynamicRecordFormProps {page:PageDefinition;target:NavigationTarget;schema:EntitySchema;initialValues?:FormValues}
function buildInitialValues(schema:EntitySchema,initial:FormValues={}) {
 const values:FormValues={};
 schema.sections.forEach(section=>section.fields.forEach(field=>{values[field.id]=field.defaultValue??(field.type==='multiselect'?[]:field.type==='toggle'?false:'');}));
 return {...values,...initial};
}

function FieldRenderer({ field, value, onChange, disabled, error }: { field: FormFieldSchema; value: string | number | boolean | string[]; onChange: (value: string | number | boolean | string[]) => void; disabled: boolean; error?: string }) {
  const { t } = useLocalization();
  const common = { label: field.labelKey ?? field.label, hint: field.helpKey ?? field.help, required: field.required, error: localizeFieldError(error,field.label,t), className: field.colSpan === 2 ? "md:col-span-2" : undefined };
  if (field.type === "textarea") return <Textarea {...common} value={String(value ?? "")} disabled={disabled} placeholder={field.placeholderKey ?? field.placeholder} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === "select") return <Select {...common} value={String(value ?? "")} disabled={disabled} options={field.options ?? []} onChange={(event) => onChange(event.target.value)} />;
  if (field.type === "multiselect") return <MultiSelect {...common} value={Array.isArray(value) ? value : []} disabled={disabled} options={field.options ?? []} onChange={onChange as (value: string[]) => void} />;
  if (field.type === "toggle") return <div className={field.colSpan === 2 ? "md:col-span-2" : undefined}><Toggle label={field.labelKey ?? field.label} description={field.helpKey ?? field.help} checked={Boolean(value)} disabled={disabled} onChange={onChange as (checked: boolean) => void} /></div>;
  if (field.type === "date") {
    return <DateInput {...common} value={String(value ?? "")} disabled={disabled} onChange={event => onChange(event.target.value)} />;
  }
  return <Input {...common} type={field.type === "phone" ? "tel" : field.type} value={String(value ?? "")} disabled={disabled} placeholder={field.placeholderKey ?? field.placeholder} prefix={field.prefix} suffix={field.suffix} onChange={(event) => onChange(field.type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} />;
}

export function DynamicRecordForm(props: DynamicRecordFormProps) {
  const {identity}=useRecordHost();
  const key = JSON.stringify([identity,props.page.id, props.target.mode, props.target.recordId]);
  return <RecordForm key={key} {...props} />;
}

function RecordForm({page,target,schema:definition,initialValues}:DynamicRecordFormProps) {
  const {preferences}=usePreferences(),{t}=useLocalization(),format=useFormatters(),host=useScreenHost();
  const toast=useCallback((notice:{title:string;message?:string;type:"success"|"error"|"warning"|"info"})=>host.notify([t(notice.title),notice.message&&t(notice.message)].filter(Boolean).join(" — "),{tone:notice.type}),[host.notify,t]);
  const navigation = useNavigation();
  const schema = useMemo(() => { const value=definition; return page.titleKey ? withSchemaLocalization(value) : value; }, [definition,page.titleKey]);
  const initial = useMemo(() => buildInitialValues(schema,initialValues), [schema,initialValues]);
  const record = useRecordEditor(`form:${page.id}:${target.recordId ?? "new"}`, initial, !target.recordId && target.mode === "new" ? `form:${page.id}:` : undefined);
  const { editor, values, lastSaved, dirty } = record;
  const setValues = editor.update;

  /* Offer this page to the assistant, on the same contract the worklist uses:
     the page publishes what it already holds and learns nothing about AI. The
     record is what was loaded; form-values is what is on screen NOW, so a draft
     the user has typed but not saved is what a use case reading form-values
     sees. The use case still decides which keys of either may be read. */
  useEffect(()=>host.publishSources?.([{id:`form:${page.id}`,sources:{'page-record':record.baseline,'form-values':values}}]),[host.publishSources,page.id,record.baseline,values]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useScreenDraftState("form:section", schema.sections[0]!.id);
  const saving = record.busy;
  const isFocused = host.document.focused;
  const mode = target.mode ?? (page.kind === "form" ? "edit" : "view");
  const disabled = !host.can(mode==="new"?"create":"edit",page) || mode === "view" || !record.ready || record.loading || !!record.recovery;
  const activeIndex = schema.sections.findIndex((section) => section.id === activeSection);
  const section = schema.sections[activeIndex] ?? schema.sections[0]!;

  const completion = useMemo(() => Object.fromEntries(schema.sections.map((item) => {
    const relevant = item.fields.filter((field) => isFieldRequired(field, values));
    const done = relevant.filter((field) => {
      const value = values[field.id];
      return Array.isArray(value) ? value.length > 0 : value !== "" && value !== null && value !== undefined;
    }).length;
    return [item.id, relevant.length ? Math.round((done / relevant.length) * 100) : 100];
  })), [schema.sections, values]);

  const validate = useCallback(() => {
    const next = validateForm(schema, values);
    setErrors(next);
    if (Object.keys(next).length) {
      const firstSection = schema.sections.find((item) => item.fields.some((field) => next[field.id]));
      if (firstSection) setActiveSection(firstSection.id);
      toast({ title: "Complete required fields", message: t(Object.keys(next).length===1?"{count} field need attention.":"{count} fields need attention.", {count:Object.keys(next).length}), type: "warning" });
      return false;
    }
    return true;
  }, [schema.sections, toast, values]);

  useEffect(() => {
    const first = schema.sections.find(section => section.fields.some(field => record.fieldErrors[field.id]));
    if(first) setActiveSection(first.id);
  }, [record.fieldErrors, schema]);

  const save = useCallback(async () => {
    if (disabled || !validate()) return;
    if (await editor.save()) {
      toast({ title: "Changes saved", message: "The record service confirmed the save.", type: "success" });
      const savedKey = editor.snapshot().recordKey;
      if (savedKey && mode === "new") {
        const savedId = (JSON.parse(savedKey)[1] as string).slice(`form:${page.id}:`.length);
        navigation.open({ pageId: page.id, mode: "edit", recordId: savedId, title: `${schema.singular} • Edit` });
      }
    }
  }, [disabled, editor, toast, validate, mode, navigation, page.id, schema.singular]);

  useEffect(() => {
    if(!preferences.keyboardShortcuts)return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "s" && !disabled && isFocused) { event.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, isFocused, save,preferences.keyboardShortcuts]);

  const update = (field: string, value: string | number | boolean | string[]) => {
    setValues((previous) => updateFormValue(schema, previous, field, value));
    if (errors[field]) setErrors((previous) => { const next = { ...previous }; delete next[field]; return next; });
  };

  return (
    <div className="flex w-full flex-col gap-3" style={{ "--fs-scale": "var(--fs-form)" } as React.CSSProperties}>
      <Card className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={mode === "view" ? "neutral" : mode === "new" ? "brand" : "warning"}>{mode === "new" ? <LocalizedText message="ui.new.record.9ce90410" /> : mode.toUpperCase()}</Badge><span className="text-[length:calc(10px*var(--fs-scale))] font-extrabold">{target.recordId ?? (mode === "new" ? "Code generated on save" : schema.singular)}</span><span className="h-4 w-px bg-[var(--border)]" />{lastSaved ? <span className="flex items-center gap-1 text-[length:calc(8.5px*var(--fs-scale))] font-semibold text-[var(--text-muted)]"><Clock3 className="size-3" /><LocalizedText message="ui.last.saved.304ad2c0" />{" "}{format.time(new Date(lastSaved))}</span> : null}{saving ? <Badge tone="brand"><LocalizedText message="ui.saving.23e39291" /></Badge> : dirty ? <Badge tone="warning"><LocalizedText message="ui.unsaved.changes.a710c2b9" /></Badge> : lastSaved ? <Badge tone="success"><CheckCircle2 className="size-3" /><LocalizedText message="ui.saved.b5c120b3" /></Badge> : <Badge tone="neutral">{mode === "new" ? <LocalizedText message="ui.not.saved.22b3467c" /> : <LocalizedText message="ui.no.changes.c699aa00" />}</Badge>}</div>
        <div data-tour="form-actions" className="flex items-center gap-1.5">
          {/* The inline surface for this page kind. Renders nothing unless
              record.explain survived every gate, so it is safe to place
              unconditionally -- the component asks the shared engine
              rather than deciding for itself. */}
          {host.renderInlineAction?.({useCaseId:"record.explain", label:"Explain", })}
          {mode === "view" ? <Button disabled={!host.can("edit",page)} variant="primary" leftIcon={<Pencil className="size-3.5" />} onClick={() => navigation.open({ pageId: page.id, mode: "edit", recordId: target.recordId, title: `${schema.singular} • Edit` })}><LocalizedText message="ui.edit.464c4ffd" /></Button> : <><Button variant="ghost" leftIcon={<RotateCcw className="size-3.5" />} disabled={!dirty || saving} onClick={() => void editor.discard()}><LocalizedText message="ui.discard.eb1a70e3" /></Button><Button variant="secondary" leftIcon={<Save className="size-3.5" />} disabled={disabled || saving} onClick={() => void editor.saveDraft()}><LocalizedText message="ui.save.draft.3de10010" /></Button><Button variant="primary" leftIcon={<FileCheck2 className="size-3.5" />} loading={saving} disabled={disabled || !!record.error} onClick={save}><LocalizedText message="ui.save.1509f561" /></Button></>}
          <ActionMenu trigger={<IconButton label="ui.more.record.actions.bfe19e93"><MoreHorizontal className="size-4" /></IconButton>}>
            {(close) => <><MenuButton icon={<Copy className="size-3.5" />} label="Duplicate record" onClick={close} /><MenuButton icon={<History className="size-3.5" />} label="View audit history" onClick={close} /><MenuButton icon={<Send className="size-3.5" />} label="Submit for approval" onClick={() => { toast({ title: "Submitted for approval", message: "The record was routed to the configured approval workflow.", type: "info" }); close(); }} /></>}
          </ActionMenu>
        </div>
      </Card>

      <RecordSaveStatus editor={editor} />

      <Card className="min-h-[590px] overflow-hidden">
        {preferences.formNavigation !== "scroll" ? <div data-tour="form-nav"><FormNavigationControl type={preferences.formNavigation} sections={schema.sections} activeId={activeSection} onChange={setActiveSection} completion={completion} /></div> : null}
        <div className={cn("flex min-h-[540px]", preferences.formNavigation === "scroll" && "lg:flex-row")}>
          {preferences.formNavigation === "scroll" ? <div data-tour="form-nav" className="flex shrink-0"><FormNavigationControl type="rail" sections={schema.sections} activeId={activeSection} onChange={setActiveSection} completion={completion} /></div> : null}
          <div className="min-w-0 flex-1">
            <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
              <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[length:calc(11px*var(--fs-scale))] font-black text-[var(--primary-strong)]">{activeIndex + 1}</span><div><h2 className="text-[length:calc(14px*var(--fs-scale))] font-black tracking-[-.02em]">{<LocalizedText message={section.titleKey ?? section.title} />}</h2><p className="mt-0.5 text-[length:calc(10px*var(--fs-scale))] text-[var(--text-muted)]">{<LocalizedText message={section.descriptionKey ?? section.description} />}</p></div></div></div><div className="hidden items-center gap-2 lg:flex"><Badge tone="neutral">{section.fields.length}{" "}<LocalizedText message="ui.fields.bfe5d697" /></Badge><Badge tone={completion[section.id] === 100 ? "success" : "warning"}>{completion[section.id]}<LocalizedText message="ui.complete.fe9543cf" /></Badge></div></div>
            </div>

            <div className="p-5">
              <div data-tour="form-body" className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {section.fields.filter(field => isFieldVisible(field, values)).map((field) => <FieldRenderer key={field.id} field={{...field, required:isFieldRequired(field,values), options:fieldOptions(field,values)}} value={values[field.id]??""} disabled={disabled} error={errors[field.id] ?? record.fieldErrors[field.id]} onChange={(value) => update(field.id, value)} />)}
              </div>

              <CardGrid className="mt-6 gap-3 lg:grid-cols-3">
                <Card shadow="none" tone="muted" radius="xl" className="flex items-start gap-3 p-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--success-ink)]" /><div><div className="text-[length:calc(10px*var(--fs-scale))] font-extrabold"><LocalizedText message="ui.policy.aware.db50d120" /></div><div className="mt-1 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.visible.and.editable.fields.can.be.controlled.by.role.br.a623600c" /></div></div></Card>
                <Card shadow="none" tone="muted" radius="xl" className="flex items-start gap-3 p-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" /><div><div className="text-[length:calc(10px*var(--fs-scale))] font-extrabold"><LocalizedText message="ui.schema.driven.681609f3" /></div><div className="mt-1 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.rail.tabs.and.wizard.render.the.same.section.and.field.d.8726fb58" /></div></div></Card>
                <Card shadow="none" tone="muted" radius="xl" className="flex items-start gap-3 p-3"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-[var(--warning-ink)]" /><div><div className="text-[length:calc(10px*var(--fs-scale))] font-extrabold"><LocalizedText message="ui.audit.protected.bdca2f73" /></div><div className="mt-1 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><LocalizedText message="ui.sensitive.changes.should.be.versioned.and.submitted.with.d2c8dec6" /></div></div></Card>
              </CardGrid>
            </div>
          </div>

          <aside className="hidden w-64 shrink-0 border-l border-[var(--border)] bg-[var(--surface-2)] p-4 2xl:block">
            <div className="text-[length:calc(9px*var(--fs-scale))] font-black uppercase tracking-[.12em] text-[var(--text-subtle)]"><LocalizedText message="ui.record.summary.8507711f" /></div>
            <Card shadow="none" radius="xl" className="mt-3 p-3"><div className="text-[length:calc(8.5px*var(--fs-scale))] font-bold uppercase tracking-[.08em] text-[var(--text-subtle)]"><LocalizedText message="ui.overall.completion.73f1bc7e" /></div><div className="mt-2 flex items-end justify-between"><span className="text-[length:calc(22px*var(--fs-scale))] font-black tracking-[-.04em]">{Math.round(Object.values(completion).reduce((sum, item) => sum + item, 0) / schema.sections.length)}%</span><Badge tone="brand">{schema.sections.length}{" "}<LocalizedText message="ui.sections.4697ef32" /></Badge></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.round(Object.values(completion).reduce((sum, item) => sum + item, 0) / schema.sections.length)}%` }} /></div></Card>
            <div className="mt-3 space-y-2">{schema.sections.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface)]"><span className={cn("flex size-5 items-center justify-center rounded-md text-[length:calc(8px*var(--fs-scale))] font-black", item.id === activeSection ? "bg-[var(--primary-fill)] text-white" : "bg-[var(--surface-3)]")}>{index + 1}</span><span className="min-w-0 flex-1 truncate text-[length:calc(9.5px*var(--fs-scale))] font-bold">{<LocalizedText message={item.titleKey ?? item.title} />}</span><span className="text-[length:calc(8.5px*var(--fs-scale))] font-bold text-[var(--text-muted)]">{completion[item.id]}%</span></button>)}</div>
            <div className="mt-4 rounded-xl border border-dashed border-[var(--border-strong)] p-3 text-[length:calc(9px*var(--fs-scale))] leading-relaxed text-[var(--text-muted)]"><b className="text-[var(--text)]"><LocalizedText message="ui.form.mode.657dd0c2" /></b> {preferences.formNavigation}<LocalizedText message="ui.change.it.in.my.preferences.the.record.schema.and.data.r.0074fc14" /></div>
          </aside>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <Button variant="ghost" leftIcon={<ArrowLeft className="size-3.5" />} disabled={activeIndex === 0} onClick={() => setActiveSection(schema.sections[activeIndex - 1]!.id)}><LocalizedText message="ui.previous.a57b08a4" /></Button>
          <div className="text-[length:calc(9px*var(--fs-scale))] font-semibold text-[var(--text-muted)]"><LocalizedText message="ui.section.dfca5da5" />{" "}{activeIndex + 1}{" "}<LocalizedText message="ui.of.28391d3b" />{" "}{schema.sections.length} • {preferences.formNavigation}{" "}<LocalizedText message="ui.navigation.d70d5a79" /></div>
          {activeIndex < schema.sections.length - 1 ? <Button variant="secondary" rightIcon={<ArrowRight className="size-3.5" />} onClick={() => setActiveSection(schema.sections[activeIndex + 1]!.id)}><LocalizedText message="ui.next.1ff57a29" /></Button> : disabled ? <Button variant="secondary" leftIcon={<Eye className="size-3.5" />}><LocalizedText message="ui.review.complete.73e01b91" /></Button> : <Button variant="primary" leftIcon={<Save className="size-3.5" />} loading={saving} onClick={save}><LocalizedText message="ui.save.record.0ad417a9" /></Button>}
        </div>
      </Card>
    </div>
  );
}
