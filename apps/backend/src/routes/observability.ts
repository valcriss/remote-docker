import { Router } from "express";
import { prisma } from "../prisma.js";
import type { ContainerOrchestrator } from "../orchestrator/types.js";
import { type AuthedRequest, requireAuth } from "../middleware/auth.js";
import { AppError } from "../http/error.js";
import { sendOk } from "../http/response.js";
import { asyncHandler } from "../middleware/async-handler.js";

export function createObservabilityRouter(orchestrator: ContainerOrchestrator): Router {
  const router = Router();

  router.get("/instances/:id/logs", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const instance = await prisma.userInstance.findUnique({ where: { id } });
    if (!instance) {
      throw new AppError(404, "ERR_INSTANCE_NOT_FOUND", "Instance not found.");
    }

    if (req.auth!.role !== "ADMIN" && instance.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_INSTANCE_FORBIDDEN", "You cannot read logs for this instance.");
    }

    if (!instance.runtimeId) {
      sendOk(res, { lines: [] });
      return;
    }

    const lines = await orchestrator.getLogs(instance.runtimeId, 200);
    sendOk(res, { lines }, { lineCount: lines.length });
  }));

  router.get("/volumes", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const volumes = await orchestrator.listServerVolumes(req.auth!.sub);
    sendOk(res, volumes, { count: volumes.length });
  }));

  return router;
}