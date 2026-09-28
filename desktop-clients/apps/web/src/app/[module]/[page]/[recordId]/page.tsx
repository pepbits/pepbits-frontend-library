import { REFERENCE_PAGE_BY_ID } from "@pepbits/erp-config";
import { PageRenderer } from "@pepbits/erp-screens";
import { resolvePage } from "../resolve";

export default async function ViewRecordPage({ params }: { params: Promise<{ module: string; page: string; recordId: string }> }) {
  const { module, page, recordId } = await params;
  resolvePage(module, page, `/${REFERENCE_PAGE_BY_ID[page] ? encodeURIComponent(recordId) : recordId}`);
  return <PageRenderer target={{ pageId: page, mode: "view", recordId }} showTabPreferences={false} />;
}
