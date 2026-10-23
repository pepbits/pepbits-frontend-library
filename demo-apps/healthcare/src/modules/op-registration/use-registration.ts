"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {useLocalization} from '@pepbits/i18n/react';
import {createFormatters} from '@pepbits/i18n';
import {registrationErrors, type RegistrationView, type RegistrationCommand, type RegistrationRecord, type RegistrationAppointment} from '../../domain/op-registration';
import {type UserPreferences} from '@pepbits/preferences';
import {ClinicalRequestFailure} from '../../adapters/clinical-templates';
import { useClinicalLoad } from "../clinical-templates/shared";
import { rk } from "./components";
import { downloadRegistrationCharges } from "./receipt";
import type { RegistrationWorkspaceProps } from "./workspace";
export function useRegistrationController(props: RegistrationWorkspaceProps) {
  const { t, language } = useLocalization(),
    config = useClinicalLoad(() => props.adapter.config(), [props.adapter]);
  const [view, setView] = useState<RegistrationView | null>(null),
    [step, setStep] = useState(1),
    [tab, setTab] = useState("overview"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState<unknown>(null),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState(""),
    [patientModal, setPatientModal] = useState<"new" | "edit" | null>(null),
    [savedDraft, setSavedDraft] = useState<RegistrationView | null>(null),
    [listing, setListing] = useState<"appointments" | "worklist" | null>(null),
    [entries, setEntries] = useState<{
      records: RegistrationRecord[];
      appointments: RegistrationAppointment[];
    } | null>(null),
    [dialog, setDialog] = useState<{
      action: string;
      payload: Record<string, string | number | boolean>;
    } | null>(null),
    [documents, setDocuments] = useState(false);
  const lock = useRef(false),
    pending = useRef<RegistrationCommand | null>(null),
    content = useRef<HTMLDivElement>(null);
  const format = useMemo(
    () =>
      createFormatters({
        ...props.preferences,
        ...(config.value
          ? {
              currencyCode: config.value
                .currency as UserPreferences["currencyCode"],
            }
          : {}),
        language: language as UserPreferences["language"],
      }),
    [props.preferences, language, config.value?.currency],
  );
  const pageSize = props.preferences.pageSize;
  const patients = useClinicalLoad(
    () => props.patients.search({ q: query, page, pageSize }),
    [props.patients, query, page, pageSize],
  );
  useEffect(() => {
    setPage(1);
  }, [pageSize]);
  useEffect(() => {
    if (!dirty && !pending.current) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, error]);
  useEffect(() => {if(props.patientId)void selectPatient(props.patientId);},[props.patientId]);
  const active = view?.record.status !== "draft" && !!view;
  const disabled =
    busy || !config.value?.canWrite || props.preferencesAvailable === false;
  const change = (key: string, value: string | boolean) => {
    if (disabled || pending.current) return;
    setView((current) => {
      if (!current) return current;
      const values = { ...current.record.values, [key]: value };
      if (key === "template") {
        const template = current.config.templates.find((x) => x.id === value),
          provider = current.config.providers.find(
            (p) => p.id === template?.provider,
          );
        if (template && provider)
          Object.assign(values, {
            provider: provider.id,
            clinic: provider.room,
            purpose: t(template.purpose),
            reason: "",
            eligibility: "not-checked",
            authorization:
              template.id === "physiotherapy" ? "pending" : "not-required",
          });
      }
      if (key === "provider") {
        values.clinic =
          current.config.providers.find((p) => p.id === value)?.room ?? "";
        values.eligibility = "not-checked";
      }
      return { ...current, record: { ...current.record, values } };
    });
    setDirty(true);
    setErrors({});
    setNotice("");
  };
  async function selectPatient(
    id: string,
    recordId?: string,
    force = false,
    appointment?: RegistrationAppointment,
  ) {
    if (lock.current) return;
    if ((dirty || pending.current) && !force) {
      setError(null);
      setErrors({ form: rk("unsaved") });
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const loaded = await props.adapter.load(id, recordId);
      pending.current = null;
      setDirty(false);
      setErrors({});
      if (appointment && loaded.record.status === "draft") {
        loaded.record.values = {
          ...loaded.record.values,
          source: "appointment",
          appointmentId: appointment.id,
          provider: appointment.provider,
          clinic:
            loaded.config.providers.find((p) => p.id === appointment.provider)
              ?.room ?? "",
          reason: appointment.reason,
        };
      }
      if (loaded.record.id && loaded.record.status === "draft") {
        setSavedDraft(loaded);
        setView(null);
        setStep(1);
      } else {
        setView(loaded);
        setStep(loaded.record.status === "draft" ? 1 : 5);
      }
      setListing(null);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function move(next: number) {
    if (active) {
      setStep(5);
      return;
    }
    if (next > 1 && !view) {
      setErrors({ form: rk("verifyHint") });
      return;
    }
    if (view && next > step) {
      const invalid = registrationErrors(
        view.record.values,
        view.config,
        next - 1,
      );
      if (Object.keys(invalid).length) {
        setErrors(invalid);
        return;
      }
    }
    setErrors({});
    setStep(next);
    requestAnimationFrame(() => {
      if (content.current) content.current.scrollTop = 0;
    });
  }
  async function command(
    action: string,
    payload: Record<string, string | number | boolean> = {},
  ) {
    if (
      !view ||
      disabled ||
      lock.current ||
      (pending.current && pending.current.action !== action)
    )
      return;
    const input = pending.current ?? {
      action,
      patientId: view.record.patientId,
      ...(view.record.id ? { id: view.record.id } : {}),
      version: view.record.version,
      values: view.record.values,
      payload,
      operationId: crypto.randomUUID(),
    };
    pending.current = input;
    lock.current = true;
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const saved = await props.adapter.command(input);
      setView(saved);
      setDirty(false);
      pending.current = null;
      setDialog(null);
      setNotice(rk("savedNotice"));
      if (saved.record.status !== "draft") setStep(5);
      if (action === "document") {
        if (payload.format === "print") window.print();
        else
          downloadRegistrationCharges(
            saved,
            format,
            props.preferences.exportFormat,
            t,
          );
      }
      if (action === "discard") {
        setSavedDraft(null);
        setView(null);
        setStep(1);
      }
    } catch (e) {
      setError(e);
      if (e instanceof ClinicalRequestFailure) {
        setErrors(e.fieldErrors);
        if ([400, 403, 404, 409, 422].includes(e.status))
          pending.current = null;
      }
      setDialog(null);
      requestAnimationFrame(() => {
        if (content.current) content.current.scrollTop = 0;
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function openList(kind: "appointments" | "worklist") {
    if (lock.current) return;
    setBusy(true);
    setError(null);
    try {
      setEntries(await props.adapter.worklist());
      setListing(kind);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const ask = (
    action: string,
    payload: Record<string, string | number | boolean> = {},
  ) => setDialog({ action, payload });

  return {
    t,
    config,
    view,
    setView,
    step,
    setStep,
    tab,
    setTab,
    query,
    setQuery,
    page,
    setPage,
    filter,
    setFilter,
    busy,
    dirty,
    setDirty,
    error,
    errors,
    notice,
    setNotice,
    patientModal,
    setPatientModal,
    savedDraft,
    setSavedDraft,
    listing,
    setListing,
    entries,
    dialog,
    setDialog,
    documents,
    setDocuments,
    pending,
    content,
    format,
    pageSize,
    patients,
    active,
    disabled,
    change,
    selectPatient,
    move,
    command,
    openList,
    ask,
  };
}
