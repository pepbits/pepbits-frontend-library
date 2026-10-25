import { handle, readJson } from "@/server/http";
import { createAdmissionRequest, listAdmissionRequests } from "@/server/services";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = handle((req: Request) => ({
  admissionRequests: listAdmissionRequests({ status: new URL(req.url).searchParams.get("status") ?? undefined }),
}));
export const POST = handle(async (req: Request) => createAdmissionRequest(await readJson(req)));
