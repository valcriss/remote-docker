import "dotenv/config";
import http from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { createInstancesRouter } from "./routes/instances.js";
import { createObservabilityRouter } from "./routes/observability.js";
import { sessionRouter } from "./routes/sessions.js";
import { createForwardsRouter } from "./routes/forwards.js";
import { createSyncRouter } from "./routes/sync.js";
import { createOrchestrator } from "./orchestrator/index.js";
import { setupWebSockets } from "./ws/server.js";
import { ensureBootstrapAdmin } from "./bootstrap/admin.js";
import { requestContext } from "./middleware/request-context.js";
import { errorHandler } from "./middleware/error-handler.js";
import { openApiSpec } from "./docs/openapi.js";
import { meRouter } from "./routes/me.js";
import { adminRouter } from "./routes/admin.js";
import { sendOk } from "./http/response.js";

const port = Number(process.env.PORT ?? 4000);
const orchestrator = createOrchestrator(process.env.ORCHESTRATOR_MODE);
const app = express();
const frontendDistPath = process.env.FRONTEND_DIST_PATH ?? resolve(process.cwd(), "apps/frontend/dist");
const hasFrontendDist = existsSync(frontendDistPath);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(requestContext);

app.get("/health", (_req, res) => {
  sendOk(res, { status: "ok" });
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

app.use("/api/auth", authRouter);

app.use("/api/me", meRouter);
app.use("/api/admin", adminRouter);

const server = http.createServer(app);
const hub = setupWebSockets(server);

app.use("/api/catalog", catalogRouter);
app.use("/api", createInstancesRouter(orchestrator, hub));
app.use("/api", createObservabilityRouter(orchestrator));
app.use("/api", sessionRouter);
app.use("/api", createForwardsRouter(hub));
app.use("/api", createSyncRouter(hub));

if (hasFrontendDist) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/docs" || req.path === "/openapi.json" || req.path === "/health") {
      return next();
    }

    return res.sendFile(resolve(frontendDistPath, "index.html"));
  });
}

app.use(errorHandler);

await ensureBootstrapAdmin();
server.listen(port, () => {
  console.log(JSON.stringify({ level: "info", message: "Backend listening", url: `http://localhost:${port}` }));
});
