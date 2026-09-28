"use client";
import React, { useMemo } from "react";
import { useSession } from "@pepbits/auth";
import { useERP, useProduct } from "@pepbits/erp-shell";
import {
  type PageDefinition,
} from "@pepbits/erp-config";
import { createClinicalTemplateAdapter } from "@pepbits/erp-data";
import { useNavigation, type NavigationTarget } from "@pepbits/platform-ports";
import { useProductRequest } from "../product-services";
import { ClinicalPatientWorkspace } from "./workspace";
import type { ClinicalView } from "./shared";
const patientPageByView: Record<ClinicalView, string> = {
  query: "allyvora-patient-query",
  record: "allyvora-patient-record",
  overview: "allyvora-patient-360",
};
const patientViewByPage: Record<string, ClinicalView | undefined> = {
  "allyvora-patient-query": "query",
  "allyvora-patient-record": "record",
  "allyvora-patient-360": "overview",
};
export function ClinicalLibraryPage({
  page,
  target,
}: {
  page: PageDefinition;
  target: NavigationTarget;
}) {
  const { user } = useSession(),
    { preferences, preferencePolicy, preferencesAvailable, updatePreference } =
      useERP(),
    product = useProduct(),
    request = useProductRequest(),
    navigation = useNavigation();
  const adapter = useMemo(
      () => createClinicalTemplateAdapter(request, product.id),
      [request, product.id],
    ),
    view = patientViewByPage[page.id];
  if (!view) return null;
  return (
    <div data-clinical-library={page.id}>
      <ClinicalPatientWorkspace
        adapter={adapter}
        scopeKey={JSON.stringify([
          user?.tenantId,
          product.id,
          user?.id,
          target,
        ])}
        initialPage={{ view, patientId: target.recordId, mode: target.mode }}
        preferences={preferences}
        preferencePolicy={preferencePolicy}
        preferencesAvailable={preferencesAvailable}
        onPreferenceChange={updatePreference}
        onOpen={(destination) =>
          navigation.openInNewContext({
            pageId: patientPageByView[destination.view],
            recordId: destination.patientId,
            mode: destination.mode,
          })
        }
      />
    </div>
  );
}
