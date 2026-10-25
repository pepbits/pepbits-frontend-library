import { handle, readJson } from "@/server/http";
import { createEpisode } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = handle(async (req: Request) => createEpisode(await readJson(req)));
