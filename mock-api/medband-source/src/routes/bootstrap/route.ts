import { handle } from "@/server/http";
import { bootstrap } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Reference data plus every record the front desk works with. */
export const GET = handle(() => bootstrap());
