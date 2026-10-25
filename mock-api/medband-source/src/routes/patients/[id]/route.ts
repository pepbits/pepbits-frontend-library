import { handle, readJson } from "@/server/http";
import { getPatientRecord, updatePatient } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** The full record: patient, episodes, cases, encounters and admission requests. */
export const GET = handle(async (_req: Request, { params }: Ctx) => getPatientRecord((await params).id));
export const PATCH = handle(async (req: Request, { params }: Ctx) => updatePatient((await params).id, await readJson(req)));
