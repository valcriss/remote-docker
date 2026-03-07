import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { type AuthedRequest, requireAuth } from "../middleware/auth.js";
import type { AgentHub } from "../ws/agent-hub.js";
import { AppError } from "../http/error.js";
import { sendOk } from "../http/response.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { writeAuditLog } from "../services/audit.js";

const startSyncSchema = z.object({
  instanceVolumeId: z.string(),
  localPath: z.string().min(1),
  sshHost: z.string().min(1),
  sshPort: z.number().int().positive().max(65535).default(22),
  sshUsername: z.string().min(1),
  sshPassword: z.string().min(1).optional(),
  privateKeyPem: z.string().min(1).optional(),
  conflictPolicy: z.enum(["PREFER_LOCAL", "PREFER_REMOTE", "MANUAL"]).default("PREFER_REMOTE")
});

const stopSyncSchema = z.object({ syncId: z.string().min(1) });

export function createSyncRouter(hub: AgentHub): Router {
  const router = Router();

  router.post("/sync/start", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = startSyncSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
    }

    const payload = parsed.data;
    const volume = await prisma.userInstanceVolume.findUnique({ where: { id: payload.instanceVolumeId }, include: { instance: true } });
    if (!volume) {
      throw new AppError(404, "ERR_VOLUME_NOT_FOUND", "Instance volume not found.");
    }

    if (req.auth!.role !== "ADMIN" && volume.instance.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_VOLUME_FORBIDDEN", "You cannot start sync for this volume.");
    }

    const syncId = `sync-${volume.id}`;
    await prisma.userInstanceVolume.update({
      where: { id: volume.id },
      data: { localPath: payload.localPath, conflictPolicy: payload.conflictPolicy, mode: "SYNC_BIDIRECTIONAL" }
    });

    const sent = hub.sendToAgent(volume.instance.userId, {
      type: "SYNC_START",
      payload: {
        syncId,
        localPath: payload.localPath,
        remotePath: volume.serverPath,
        sshHost: payload.sshHost,
        sshPort: payload.sshPort,
        sshUsername: payload.sshUsername,
        sshPassword: payload.sshPassword,
        privateKeyPem: payload.privateKeyPem,
        conflictPolicy: payload.conflictPolicy
      }
    });

    if (!sent) {
      throw new AppError(409, "ERR_AGENT_OFFLINE", "Agent offline.");
    }

    await writeAuditLog({
      actorUserId: req.auth!.sub,
      action: "sync.start",
      targetType: "instanceVolume",
      targetId: volume.id,
      details: { syncId, sshHost: payload.sshHost }
    });

    sendOk(res, { success: true, syncId });
  }));

  router.post("/sync/stop", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = stopSyncSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
    }

    const sent = hub.sendToAgent(req.auth!.sub, { type: "SYNC_STOP", payload: { syncId: parsed.data.syncId } });
    if (!sent) {
      throw new AppError(409, "ERR_AGENT_OFFLINE", "Agent offline.");
    }

    await writeAuditLog({ actorUserId: req.auth!.sub, action: "sync.stop", targetType: "sync", targetId: parsed.data.syncId });
    sendOk(res, { success: true });
  }));

  return router;
}