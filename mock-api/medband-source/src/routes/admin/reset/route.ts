import { handle } from "@/server/http";
import { resetDemo } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Rebuilds the database from the seed. Demo only; remove before production use. */
export const POST = handle(() => resetDemo());
