import type {RegistrationView} from '../../domain/op-registration';
import type {Formatters} from '@pepbits/i18n';
import type {ExportFormat} from '@pepbits/preferences';
import type {DataColumn} from '@pepbits/page-engines/types';
import { exportRows } from "@pepbits/page-engines/worklist";
/** Reuse the existing classified, formula-safe CSV/Excel export boundary. */
export function downloadRegistrationCharges(
  view: RegistrationView,
  format: Formatters,
  kind: ExportFormat,
  t: (key: string) => string,
) {
  const columns: DataColumn[] = [
    { key: "clinicInvoiceRef", label: t("registration.title") },
    { key: "mrn", label: t("template.clinical.mrn") },
    { key: "clinicServiceDescription", label: t("registration.service") },
    { key: "clinicNet", label: t("registration.amount"), type: "money" },
  ];
  const provider = view.config.providers.find(
    (p) => p.id === view.record.values.provider,
  );
  const lines = [
    ...(view.record.signedAt
      ? [{ label: "registration.consultation", price: provider?.fee ?? 0 }]
      : []),
    ...view.record.orders.filter((o) => o.status === "completed"),
  ];
  return exportRows(
    lines.map((line) => ({
      clinicInvoiceRef: view.record.id,
      mrn: view.patient.mrn,
      clinicServiceDescription: t(line.label),
      clinicNet: line.price,
    })),
    columns,
    format,
    kind,
    "op-registration-demo-" + view.record.id,
  );
}
