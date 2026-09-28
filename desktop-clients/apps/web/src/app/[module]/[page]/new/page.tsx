import { PageRenderer } from "@pepbits/erp-screens";
import { resolvePage } from "../resolve";

export default async function NewRecordPage({ params }: { params: Promise<{ module: string; page: string }> }) {
  const { module, page } = await params;
  resolvePage(module, page, "/new");
  return <PageRenderer target={{ ...(module.startsWith("reference-school") ? {moduleId:module} : {}), pageId: page, mode: "new" }} showTabPreferences={false} />;
}
