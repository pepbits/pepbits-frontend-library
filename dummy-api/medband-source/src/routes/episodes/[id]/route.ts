import { handle, readJson } from "@/server/http";
import { setEpisodeStatus } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };
/** Body: { status: "Active" | "On hold" | "Closed" }. Closing an episode closes its open cases. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => setEpisodeStatus((await params).id, await readJson(req)));
