import { paramsToFilters } from "@/lib/search";
import { handle, readJson } from "@/server/http";
import { registerPatient, searchPatients } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Search patients. See filtersToParams() in src/lib/search.ts for the query parameters. */
export const GET = handle((req: Request) => ({ patients: searchPatients(paramsToFilters(new URL(req.url).searchParams)) }));

/** Register a patient, with any insurance coverages. */
export const POST = handle(async (req: Request) => registerPatient(await readJson(req)));
