"use client";
import { useEffect, useRef, useState } from "react";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { ApiError, useApiClient } from "../../lib/api";
import { cx } from "../../lib/cx";
import { todayIso } from "../../lib/format";
import type { RecordDto, ResourceDef } from "../../lib/types";
import { Icon } from "../../lib/icons";
import { useAction } from "../../lib/useAction";
import { FieldInput } from "../form/FieldInput";
import { useApp } from "../shell/context";
import { SourceButton } from "../ui/controls";
import { SideDrawer } from "../ui/dialog";
import { useToast } from "../ui/Toast";

/** Slide-over form for a new record (the shared Drawer). Fields that the system derives are left out. */
export function CreatePanel({ res, onClose, onCreated }: { res: ResourceDef; onClose: () => void; onCreated: (r: RecordDto) => void }) {
  const { scopeInfo, actor } = useApp();
  const toast = useToast();
  const client = useApiClient();
  const { t } = useLocalization();
  const fields = res.fields.filter((f) => !f.readonly);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    const inScope = scopeInfo.branches;
    if (fields.some((f) => f.key === "branch")) v.branch = inScope.length === 1 ? inScope[0] : inScope.includes(actor.homeBranch ?? "") ? actor.homeBranch : inScope[0];
    for (const f of fields) {
      if (f.type === "date" && ["receivedOn", "serviceDate", "admittedOn"].includes(f.key)) v[f.key] = todayIso();
      if (f.type === "lines" || f.type === "tags") v[f.key] = [];
      if (f.key === "assignee") v.assignee = actor.id;
      if (f.key === "level" && f.type === "number") v.level = 1;
    }
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => { root.current?.querySelector<HTMLElement>("input,select,textarea,[role=combobox]")?.focus(); }, []);

  const submit = () => run(async () => {
    setErrors({});
    try {
      const out = await client.post<RecordDto>(`/records/${res.key}`, { values });
      const label = res.statuses.find((s) => s.key === out.status)?.label.toLowerCase() ?? out.status;
      toast({ tone: "success", title: t("{value0} created", { value0: out.ref }), detail: t("New {value0} saved as {value1}.", { value0: res.singular, value1: label }) });
      onCreated(out);
    } catch (e) {
      const err = e as ApiError;
      setErrors(err.fieldErrors ?? {});
      toast({ tone: "error", title: "Not created", detail: err.message });
    }
  });

  const initial = res.statuses.find((s) => s.key === res.initial)?.label.toLowerCase() ?? res.initial;
  return (
    <SideDrawer open onClose={onClose} busy={busy} icon={<Icon name={res.icon} className="h-5 w-5" />} title={t("New {value0}", { value0: res.singular })}
      subtitle={t("Starts as {value0}. Reference {value1}-… is assigned on save.", { value0: initial, value1: res.prefix })}
      footer={<>
        <span className="mr-auto text-[11.5px] text-muted"><span className="text-madder-500">*</span> <LocalizedText message="required" /></span>
        <SourceButton className="btn-quiet" onClick={onClose} disabled={busy}><LocalizedText message="Cancel" /></SourceButton>
        <SourceButton className="btn-primary" onClick={submit} disabled={busy}>{busy ? t("Saving…") : t("Create {value0}", { value0: res.singular })}</SourceButton>
      </>}>
      <div ref={root} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {fields.map((f) => (
              <div key={f.key} className={cx((f.span === 2 || f.type === "textarea" || f.type === "lines") && "col-span-2")}>
                <label className="field-label" htmlFor={`new-${f.key}`}>{f.label}{f.required && <span className="text-madder-500">*</span>}</label>
                <FieldInput id={`new-${f.key}`} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} invalid={!!errors[f.key]} />
                {errors[f.key] ? <p className="field-error">{errors[f.key]}</p> : f.help && <p className="field-help">{f.help}</p>}
              </div>
            ))}
          </div>
          <SourceButton type="submit" className="hidden" tabIndex={-1} aria-hidden />
        </form>
      </div>
    </SideDrawer>
  );
}
