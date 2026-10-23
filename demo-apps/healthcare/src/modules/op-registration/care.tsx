"use client";
import React from "react";
import {Button, Badge} from '@pepbits/ui';
import {DescriptionList, Tabs, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableContainer} from '@pepbits/components';
import {useLocalization} from '@pepbits/i18n/react';
import {registrationLedger, type RegistrationView} from '../../domain/op-registration';
import {type Formatters} from '@pepbits/i18n';
import { RegistrationFields, RegistrationPanel, rk } from "./components";
import styles from "./registration.module.css";
export interface CareProps {
  view: RegistrationView;
  tab: string;
  onTab: (tab: string) => void;
  format: Formatters;
  change: (key: string, value: string | boolean) => void;
  busy: boolean;
  errors: Record<string, string>;
  act: (
    action: string,
    payload?: Record<string, string | number | boolean>,
  ) => void;
  ask: (
    action: string,
    payload?: Record<string, string | number | boolean>,
  ) => void;
}
export function RegistrationCare({
  view,
  tab,
  onTab,
  format,
  change,
  busy,
  errors,
  act,
  ask,
}: CareProps) {
  const { t } = useLocalization(),
    { record, config } = view,
    v = record.values,
    closed = record.status === "completed",
    disabled = busy || !config.canWrite,
    ledger = registrationLedger(record, config);
  const button = (
    label: string,
    action: string,
    payload?: Record<string, string | number | boolean>,
    immediate = false,
  ) => (
    <Button
      disabled={disabled}
      onClick={() => (immediate ? act(action, payload) : ask(action, payload))}
    >
      {t(rk(label))}
    </Button>
  );
  const money = (
    <DescriptionList
      items={(["gross", "patient", "payer", "paid", "balance"] as const).map(
        (id) => ({
          id,
          label: rk(
            (
              { patient: "patientShare", payer: "payerShare" } as Record<
                string,
                string
              >
            )[id] ?? id,
          ),
          value: format.money(ledger[id]),
        }),
      )}
    />
  );
  return (
    <RegistrationPanel title={rk("care")}>
      <Tabs
        className={styles.tabs}
        value={tab}
        onChange={onTab}
        items={[
          "overview",
          "nursing",
          "consultation",
          "orders",
          "billing",
          "checkout",
        ].map((id) => ({ id, label: rk(id) }))}
      />
      {tab === "overview" ? (
        <>
          <h2 className="text-xl font-bold">{record.id}</h2>
          <Badge tone={closed ? "success" : "brand"}>
            {t(rk(record.status))}
          </Badge>
          {money}
          <div className="flex gap-2">
            {!closed ? button("call", "call", {}, true) : null}
            <Button
              onClick={() =>
                onTab(
                  v.nursingDone || v.routing === "direct"
                    ? "consultation"
                    : "nursing",
                )
              }
            >
              {t(rk("continue"))}
            </Button>
          </div>
          <RegistrationTimeline record={record} format={format} />
        </>
      ) : null}
      {tab === "nursing" ? (
        <>
          <RegistrationFields
            group="nursing"
            config={config}
            values={v}
            onChange={change}
            disabled={disabled || closed}
            errors={errors}
          />
          <Button
            disabled={disabled || closed}
            variant="primary"
            onClick={() => act("nursing")}
          >
            {t(rk("save"))}
          </Button>
          {v.nursingDone ? (
            <Badge tone="success">{t(rk("nursingDone"))}</Badge>
          ) : null}
        </>
      ) : null}
      {tab === "consultation" ? (
        <>
          {v.treatment === "deferred" ? (
            <div className={styles.notice}>
              {t(rk("consentRequired"))}
              {button("resolveConsent", "resolve-consent")}
            </div>
          ) : null}
          {record.signedAt ? (
            <div className={styles.notice}>
              {t(rk("signed"))} · {record.signedBy} ·{" "}
              {format.dateTime(record.signedAt)}
            </div>
          ) : null}
          <RegistrationFields
            group="consultation"
            config={config}
            values={v}
            onChange={change}
            disabled={disabled || closed || !!record.signedAt}
            errors={errors}
          />
          <div className="flex gap-2">
            {!record.signedAt && !closed ? (
              <>
                <Button disabled={disabled} onClick={() => act("save")}>
                  {t(rk("saveDraft"))}
                </Button>
                {button("sign", "sign")}
              </>
            ) : (
              button("addendum", "addendum")
            )}
            {!closed ? button("addOrder", "order-add") : null}
          </div>
          {record.addenda.map((a, index) => (
            <div className={styles.notice} key={index}>
              <p>{a.text}</p>
              <small>
                {a.actor} · {format.dateTime(a.at)}
              </small>
            </div>
          ))}
        </>
      ) : null}
      {tab === "orders" ? (
        <>
          <p className={styles.note}>{t(rk("demo"))}</p>
          {!closed ? button("addOrder", "order-add") : null}
          <TableContainer>
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  {["service", "active", "amount", "continue"].map((id) => (
                    <TableHead className="text-start" key={id}>
                      {t(rk(id))}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <strong>{t(o.label)}</strong>
                      <p className={styles.note}>{o.note}</p>
                      <small>{o.tracking}</small>
                    </TableCell>
                    <TableCell>
                      <Badge>{t(rk(o.status))}</Badge>
                    </TableCell>
                    <TableCell>{format.money(o.price)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {o.status === "ordered" && !closed
                          ? button(
                              "start",
                              "order-start",
                              { orderId: o.id },
                              true,
                            )
                          : null}
                        {o.status === "started"
                          ? button("finish", "order-complete", {
                              orderId: o.id,
                              category: o.category,
                            })
                          : null}
                        {["ordered", "started"].includes(o.status) && !closed
                          ? button("cancelOrder", "order-cancel", {
                              orderId: o.id,
                            })
                          : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {!record.orders.length ? <p>{t(rk("empty"))}</p> : null}
        </>
      ) : null}
      {tab === "billing" ? (
        <>
          {money}
          <div>{button("discount", "discount")}</div>
          <p className={styles.note}>{t(rk("ledgerNote"))}</p>
          {ledger.balance > 0 ? button("payment", "payment") : null}
          {record.payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3"
            >
              <div>
                {format.money(p.amount)} · {t(rk(p.method))}
                <p className={styles.note}>
                  {format.dateTime(p.at)} {p.reason}
                </p>
              </div>
              {p.reversed ? (
                <Badge>{t(rk("reverse"))}</Badge>
              ) : (
                button("reverse", "reverse", { paymentId: p.id })
              )}
            </div>
          ))}
          <RegistrationPanel title={rk("claim")}>
            <Badge>{t(rk(String(v.claim || "claimDraft")))}</Badge>
            <div className="flex flex-wrap gap-2">
              {button("buildClaim", "claim", { stage: "draft" }, true)}
              {button("validateClaim", "claim", { stage: "validate" }, true)}
              {button("submitClaim", "claim", { stage: "submit" })}
            </div>
            <p className={styles.note}>{t(rk("demo"))}</p>
          </RegistrationPanel>
        </>
      ) : null}
      {tab === "checkout" ? (
        <>
          <RegistrationFields
            group="checkout"
            config={config}
            values={v}
            onChange={change}
            disabled={disabled || closed}
            errors={errors}
          />
          <div className="flex flex-wrap gap-2">
            {!closed && !v.followupAppointment
              ? button("bookFollowup", "book-followup")
              : null}
            {v.followupAppointment ? (
              <Badge>{String(v.followupAppointment)}</Badge>
            ) : null}
            {!closed ? (
              <Button disabled={disabled} onClick={() => act("save")}>
                {t(rk("save"))}
              </Button>
            ) : null}
          </div>
          <p className={styles.note}>{t(rk("completeRequired"))}</p>
        </>
      ) : null}
    </RegistrationPanel>
  );
}
export function RegistrationTimeline({
  record,
  format,
}: {
  record: RegistrationView["record"];
  format: Formatters;
}) {
  const { t } = useLocalization();
  return (
    <section className="space-y-4">
      <h3 className="font-bold">{t(rk("historyTitle"))}</h3>
      <div className={styles.timeline}>
        {record.events.slice(0, 10).map((event, index) => (
          <div key={index}>
            <strong>{t(event.key)}</strong>
            <p className={styles.note}>
              {event.actor} · {format.dateTime(event.at)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
