import express from "express";
import { migrate } from "./db.js";
import { errorHandler } from "./lib/http.js";
import { requireAuth } from "./middleware/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { resourcesRouter } from "./routes/resources.js";
import { servicesRouter } from "./routes/services.js";
import { holidaysRouter } from "./routes/holidays.js";
import { patientsRouter } from "./routes/patients.js";
import { appointmentsRouter, availabilityRouter } from "./routes/appointments.js";
import { notificationsRouter } from "./routes/notifications.js";
import { adminRouter } from "./routes/admin.js";

migrate();

export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
// PHI must never be cached by browsers or proxies.
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", requireAuth);
app.use("/api", catalogRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/services", servicesRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api", adminRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

