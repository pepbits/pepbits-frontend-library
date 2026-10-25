import { handle, readJson } from "@/server/http";
import { setCaseStatus } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
/** Body: { status: "Open" | "Closed", provisionalDiagnosis? } */
export const PATCH = handle(async (req: Request, { params }: Ctx) => setCaseStatus((await params).id, await readJson(req)));
