"use client";
import React from "react";
import {Button, Badge} from '@pepbits/ui';
import {Card, CardContent, DescriptionList, Modal, PrintDocument} from '@pepbits/components';

import { ClinicalPatientWorkspace } from "../clinical-templates/workspace";
import {
  registrationFieldValue,
  RegistrationPatientStrip,
  RegistrationPanel,
  rk,
} from "./components";

import { RegistrationActionDialog } from "./action-dialog";
import styles from "./registration.module.css";

import type { RegistrationWorkspaceProps } from "./workspace";
import type { useRegistrationController } from "./use-registration";
export function RegistrationDialogs({
  state,
  props,
}: {
  state: ReturnType<typeof useRegistrationController>;
  props: RegistrationWorkspaceProps;
}) {
  const {
    t,
    config,
    view,
    setView,
    setStep,
    filter,
    busy,
    setDirty,
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
    format,
    patients,
    active,
    disabled,
    selectPatient,
    command,
    ask,
  } = state;
  return (
    <>
      {dialog && view ? (
        <RegistrationActionDialog
          key={dialog.action}
          action={dialog.action}
          initial={dialog.payload}
          config={view.config}
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={(payload) => void command(dialog.action, payload)}
        />
      ) : null}
      {savedDraft ? (
        <Modal
          open
          title={rk("draftAvailable")}
          onClose={() => setSavedDraft(null)}
          footer={
            <>
              <Button onClick={() => setSavedDraft(null)}>
                {t(rk("close"))}
              </Button>
              <Button
                onClick={() => {
                  setView(savedDraft);
                  setSavedDraft(null);
                  ask("discard");
                }}
              >
                {t(rk("discard"))}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setView({
                    ...savedDraft,
                    record: {
                      ...savedDraft.record,
                      values: {
                        ...savedDraft.record.values,
                        identityName: false,
                        identityDob: false,
                        guardianVerified: false,
                        consentReviewed: false,
                      },
                    },
                  });
                  setSavedDraft(null);
                  setDirty(true);
                  setStep(1);
                }}
              >
                {t(rk("restore"))}
              </Button>
            </>
          }
        >
          <p>{t(rk("draftAvailable"))}</p>
          <p>{format.dateTime(savedDraft.record.updatedAt)}</p>
        </Modal>
      ) : null}
      {patientModal ? (
        <Modal
          open
          size="full"
          title={rk(patientModal === "new" ? "newPatient" : "editPatient")}
          onClose={() => setPatientModal(null)}
        >
          <ClinicalPatientWorkspace
            {...props}
            adapter={props.patients}
            initialPage={{
              view: "record",
              mode: patientModal,
              ...(patientModal === "edit" && view
                ? { patientId: view.patient.id }
                : {}),
            }}
            onOpen={(target) => {
              if (target.patientId) {
                setPatientModal(null);
                void selectPatient(target.patientId, undefined, true);
                patients.retry();
              }
            }}
          />
        </Modal>
      ) : null}
      {listing && entries ? (
        <Modal
          open
          size="xl"
          title={rk(listing)}
          onClose={() => setListing(null)}
          footer={
            view ? (
              <Button
                disabled={disabled}
                onClick={() => {
                  setListing(null);
                  ask("book");
                }}
              >
                {t(rk("book"))}
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-3">
            {listing === "worklist"
              ? entries.records.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="flex items-center justify-between">
                      <div>
                        {r.patientId} · {r.id}
                        <p>
                          {t(rk(r.status))} · {format.dateTime(r.updatedAt)}
                        </p>
                      </div>
                      <Button
                        onClick={() => void selectPatient(r.patientId, r.id)}
                      >
                        {t(rk("select"))}
                      </Button>
                    </CardContent>
                  </Card>
                ))
              : entries.appointments.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="flex items-center justify-between">
                      <div>
                        {a.patientId} · {format.date(a.date)} ·{" "}
                        {format.time(a.time)}
                        <p>
                          {
                            config.value!.providers.find(
                              (p) => p.id === a.provider,
                            )?.name
                          }
                        </p>
                        <Badge>
                          {t(
                            rk(
                              a.status === "booked"
                                ? "booked"
                                : a.status === "fulfilled"
                                  ? "completed"
                                  : "active",
                            ),
                          )}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => {
                          if (a.encounterId)
                            void selectPatient(a.patientId, a.encounterId);
                          else {
                            void selectPatient(
                              a.patientId,
                              undefined,
                              false,
                              a,
                            );
                          }
                        }}
                      >
                        {t(rk("select"))}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </Modal>
      ) : null}
      {documents && view ? (
        <PrintDocument>
          <h1>{t(rk("documents"))}</h1>
          <p>
            {view.patient.mrn} · {view.record.id}
          </p>
          {view.config.groups
            .filter((g) => ["consultation", "checkout"].includes(g.id))
            .map((g) => (
              <section key={g.id}>
                <h2>{t(g.title)}</h2>
                {g.fields
                  .filter((f) => view.record.values[f.id])
                  .map((f) => (
                    <p key={f.id}>
                      <strong>{t(f.label)}: </strong>
                      {registrationFieldValue(
                        f,
                        view.record.values[f.id],
                        view.config,
                        format,
                        t,
                      )}
                    </p>
                  ))}
              </section>
            ))}
          <p>{t(rk("demo"))}</p>
        </PrintDocument>
      ) : null}
      {documents && view ? (
        <Modal
          open
          size="xl"
          title={rk("documents")}
          onClose={() => setDocuments(false)}
          footer={
            <>
              <Button
                disabled={disabled}
                onClick={() =>
                  void command("document", {
                    format: props.preferences.exportFormat,
                  })
                }
              >
                {t(rk("export"))}
              </Button>
              <Button
                disabled={disabled}
                onClick={() => void command("document", { format: "print" })}
              >
                {t(rk("print"))}
              </Button>
            </>
          }
        >
          <div className={styles.document}>
            <RegistrationPatientStrip patient={view.patient} format={format} />
            <p>
              {view.record.id} · {format.date(view.config.today)}
            </p>
            {view.config.groups
              .filter((g) => ["consultation", "checkout"].includes(g.id))
              .map((g) => (
                <RegistrationPanel key={g.id} title={g.title}>
                  <DescriptionList
                    layout="stacked"
                    items={g.fields
                      .filter((f) => view.record.values[f.id])
                      .map((f) => ({
                        id: f.id,
                        label: f.label,
                        value: registrationFieldValue(
                          f,
                          view.record.values[f.id],
                          view.config,
                          format,
                          t,
                        ),
                      }))}
                  />
                </RegistrationPanel>
              ))}
            <p>{t(rk("demo"))}</p>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
