import { createApp } from "./app.js";
import { DB_PATH, db } from "./db/index.js";
import { seedIfEmpty } from "./db/seed.js";

seedIfEmpty();
const port = Number(process.env.PORT ?? 4000);
const server = createApp().listen(port, () => console.log(`Phial API listening on http://localhost:${port} (db: ${DB_PATH})`));

const shutdown = () => { server.close(() => { db.close(); process.exit(0); }); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
