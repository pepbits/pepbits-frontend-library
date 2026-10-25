import { handle, readJson } from "@/server/http";
import { setEncounterStatus } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
/** Body: { status, counterId? }. Completing an inpatient stay is the discharge and frees the bed. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => setEncounterStatus((await params).id, await readJson(req)));
