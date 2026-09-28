import { PageRenderer } from "@pepbits/erp-screens";
import { resolvePage } from "../../resolve";

export default async function EditRecordPage({ params }: { params: Promise<{ module: string; page: string; recordId: string }> }) {
  const { module, page, recordId } = await params;
  resolvePage(module, page, `/${recordId}/edit`);
  return <PageRenderer target={{ ...(module.startsWith("reference-school") ? {moduleId:module} : {}), pageId: page, mode: "edit", recordId }} showTabPreferences={false} />;
}
