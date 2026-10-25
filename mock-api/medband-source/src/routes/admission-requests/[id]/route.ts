import { handle, readJson } from "@/server/http";
import { updateAdmissionRequest } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
/** Body: { action: "authorize" | "deposit" | "reschedule" | "cancel", ... } */
export const PATCH = handle(async (req: Request, { params }: Ctx) => updateAdmissionRequest((await params).id, await readJson(req)));
