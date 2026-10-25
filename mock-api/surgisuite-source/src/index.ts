import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { HttpError, requireAuth } from "./auth.js";
import { seed } from "./seed.js";
import { authRouter, mastersRouter } from "./routes/masters.js";
import { casesRouter } from "./routes/cases.js";
import { opsRouter } from "./routes/ops.js";

const PORT = Number(process.env.PORT ?? 4000);
const ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";



export const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: ORIGIN.split(","), credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", requireAuth);
app.use("/api", mastersRouter);
app.use("/api/cases", casesRouter);
app.use("/api", opsRouter);

app.use((_req, _res, next) => next(new HttpError(404, "Not found.")));
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.details as object) });
  const e = err as { code?: string; message?: string };
  if (e?.code?.startsWith?.("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "That record conflicts with existing data." });
  console.error(err);
  res.status(500).json({ error: "Something failed on the server. Check the server log." });
});

