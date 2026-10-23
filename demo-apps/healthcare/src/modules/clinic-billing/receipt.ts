import {clinicBalance} from '../../domain/clinic-billing';
import type {ClinicBillingView} from '../../domain/clinic-billing';
import type {Formatters} from '@pepbits/i18n';
import type {ExportFormat} from '@pepbits/preferences';
import type {DataColumn} from '@pepbits/page-engines/types';
import { exportRows } from "@pepbits/page-engines/worklist";
/** Reuses the shared classified, formula-safe CSV/Excel exporter. */
export function downloadClinicInvoice(
  data: ClinicBillingView,
  id: string,
  format: Formatters,
  kind: ExportFormat,
  t: (key: string) => string,
) {
  const invoice = data.state.invoices.find((i) => i.id === id);
  if (!invoice) return;
  const columns: DataColumn[] = [
    { key: "clinicInvoiceRef", label: t("template.clinic.invoice") },
    { key: "mrn", label: t("template.clinical.mrn") },
    { key: "status", label: t("template.clinic.status") },
    { key: "clinicServiceDescription", label: t("template.clinic.service") },
    {
      key: "clinicQuantity",
      label: t("template.clinic.quantity"),
      type: "number",
    },
    { key: "clinicNet", label: t("template.clinic.net"), type: "money" },
    { key: "clinicTax", label: t("template.clinic.tax"), type: "money" },
    {
      key: "clinicInsuranceShare",
      label: t("template.clinic.insurer"),
      type: "money",
    },
    {
      key: "clinicPatientShare",
      label: t("template.clinic.patientShare"),
      type: "money",
    },
  ];
  return exportRows(
    invoice.lines.map((l) => ({
      clinicInvoiceRef: invoice.id,
      mrn: data.patient.mrn,
      status: t(
        "template.clinic.status." +
          (invoice.status === "void"
            ? "void"
            : clinicBalance(data.state, invoice) === 0
              ? "paid"
              : "issued"),
      ),
      clinicServiceDescription: t(l.label),
      clinicQuantity: l.quantity,
      clinicNet: l.net / 100,
      clinicTax: l.tax / 100,
      clinicInsuranceShare: l.insurance / 100,
      clinicPatientShare: l.patient / 100,
    })),
    columns,
    format,
    kind,
    "clinic-demo-" + invoice.id,
  );
}
