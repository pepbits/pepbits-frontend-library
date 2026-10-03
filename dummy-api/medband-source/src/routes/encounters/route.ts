import { handle, readJson } from "@/server/http";
import { createEncounter, listEncounters } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Optional filters: patientId, date (yyyy-mm-dd), status, counterId. */
export const GET = handle((req: Request) => {
  const p = new URL(req.url).searchParams;
  return {
    encounters: listEncounters({
      patientId: p.get("patientId") ?? undefined, date: p.get("date") ?? undefined,
      status: p.get("status") ?? undefined, counterId: p.get("counterId") ?? undefined,
    }),
  };
});

/** Create an encounter. All business rules are checked on the server. */
export const POST = handle(async (req: Request) => createEncounter(await readJson(req)));
