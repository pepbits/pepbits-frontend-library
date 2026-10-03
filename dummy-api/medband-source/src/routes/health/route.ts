import { handle } from "@/server/http";
import { getMaster } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle(() => ({ status: "ok", departments: getMaster().departments.length, time: new Date().toISOString() }));
