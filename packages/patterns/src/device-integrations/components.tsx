"use client";
import React from "react";
import {Card,CardHeader,CardTitle,CardContent,Table,TableContainer,TableHeader,TableHead,TableRow,TableBody,TableCell,PrintDocument} from '@pepbits/components';
import {Button,Badge} from '@pepbits/ui';
import {useLocalization} from '@pepbits/i18n/react';
import type { IntegrationJob } from "@pepbits/data/device-integrations";
export function DeviceJobList({
  jobs,
  disabled,
  onAction,
  formatDate,
}: {
  jobs: IntegrationJob[];
  disabled: boolean;
  onAction: (job: IntegrationJob, action: "dispatch" | "cancel") => void;
  formatDate: (value: string) => string;
}) {
  const { t } = useLocalization();
  return (
    <Card>
      <CardHeader>
        <CardTitle title="devices.jobs" />
      </CardHeader>
      <CardContent>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("devices.record")}</TableHead>
                <TableHead>{t("devices.device")}</TableHead>
                <TableHead>{t("devices.status")}</TableHead>
                <TableHead>{t("devices.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    {j.title}
                    <p>{formatDate(j.createdAt)}</p>
                  </TableCell>
                  <TableCell>{j.deviceId}</TableCell>
                  <TableCell>
                    <Badge>{t("devices." + j.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        disabled={disabled || j.status !== "queued"}
                        onClick={() => onAction(j, "dispatch")}
                      >
                        {t("devices.dispatch")}
                      </Button>
                      <Button
                        disabled={disabled || j.status !== "queued"}
                        onClick={() => onAction(j, "cancel")}
                      >
                        {t("devices.cancel")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!jobs.length ? <p>{t("devices.empty")}</p> : null}
      </CardContent>
    </Card>
  );
}
export function DeviceDocument({ job }: { job: IntegrationJob }) {
  const { t } = useLocalization();
  return (
    <PrintDocument>
      {Array.from({ length: job.copies }, (_, i) => (
        <section key={i}>
          <h2>{job.title}</h2>
          {job.lines.map((line, n) => (
            <p key={n}>{t(line)}</p>
          ))}
        </section>
      ))}
    </PrintDocument>
  );
}
