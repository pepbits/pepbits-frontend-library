import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./lib/http.js";
import { clinical } from "./routes/clinical.js";
import { commerce } from "./routes/commerce.js";
import { insight } from "./routes/insight.js";
import { inventory } from "./routes/inventory.js";
import { people } from "./routes/people.js";
import { revenue } from "./routes/rcm.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","), credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  if (process.env.NODE_ENV !== "test" && process.env.PHARMACY_HOST_MODE !== "1") app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  const api = express.Router();
  api.use(insight, clinical, inventory, commerce, revenue, people);
  app.use("/api", api);
  app.use((_req, res) => res.status(404).json({ error: { code: "not_found", message: "No such endpoint." } }));
  app.use(errorHandler);
  return app;
}
