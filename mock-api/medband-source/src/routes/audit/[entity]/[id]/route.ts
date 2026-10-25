import { handle } from "@/server/http";
import { auditTrail } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ entity: string; id: string }> };
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { entity, id } = await params;
  return { entries: auditTrail(entity, id) };
});
