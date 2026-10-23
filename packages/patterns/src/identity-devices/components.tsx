"use client";
import React from "react";
import {Card,CardHeader,CardTitle,CardContent,DescriptionList,Table,TableContainer,TableHeader,TableHead,TableRow,TableBody,TableCell} from '@pepbits/components';
import {Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type { IdentityAttempt } from "@pepbits/data/identity-devices";
export function IdentityResultPanel({
  attempt,
  date,
}: {
  attempt?: IdentityAttempt;
  date: (value: string) => string;
}) {
  const { t } = useLocalization();
  return (
    <Card>
      <CardHeader>
        <CardTitle title="identity.result" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p>{t("identity.notAuthentication")}</p>
        {attempt ? (
          <>
            <Badge>{t("identity." + attempt.status)}</Badge>
            <DescriptionList
              items={[
                {
                  id: "reference",
                  label: "identity.reference",
                  value: attempt.id,
                },
                {
                  id: "subject",
                  label: "identity.patient",
                  value: attempt.subjectId,
                },
                {
                  id: "expires",
                  label: "identity.expires",
                  value: date(attempt.expiresAt),
                },
              ]}
            />
            {attempt.document ? (
              <DescriptionList
                items={[
                  {
                    id: "document",
                    label: "identity.document",
                    value: attempt.document.reference,
                  },
                  {
                    id: "name",
                    label: "identity.name",
                    value: attempt.document.name,
                  },
                  {
                    id: "dob",
                    label: "identity.dob",
                    value: date(attempt.document.birthDate),
                  },
                  {
                    id: "expiry",
                    label: "identity.documentExpiry",
                    value: date(attempt.document.expiry),
                  },
                ]}
              />
            ) : null}
          </>
        ) : (
          <p>{t("identity.empty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
export function IdentityHistory({
  attempts,
  date,
}: {
  attempts: IdentityAttempt[];
  date: (value: string) => string;
}) {
  const { t } = useLocalization();
  return (
    <Card>
      <CardHeader>
        <CardTitle title="identity.history" />
      </CardHeader>
      <CardContent>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("identity.patient")}</TableHead>
                <TableHead>{t("identity.device")}</TableHead>
                <TableHead>{t("identity.result")}</TableHead>
                <TableHead>{t("identity.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.subjectId}</TableCell>
                  <TableCell>{a.deviceId}</TableCell>
                  <TableCell>{t("identity." + a.status)}</TableCell>
                  <TableCell>{date(a.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
