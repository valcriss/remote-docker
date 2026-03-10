import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { type AuthedRequest, requireAuth } from "../middleware/auth.js";
import type { AgentHub } from "../ws/agent-hub.js";
import { AppError } from "../http/error.js";
import { sendCreated, sendOk } from "../http/response.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { writeAuditLog } from "../services/audit.js";

const createForwardSchema = z.object({
  instanceId: z.string(),
  serviceName: z.string().min(1).optional(),
  portName: z.string(),
  localPort: z.number().int().min(1).max(65535)
});

export function createForwardsRouter(hub: AgentHub): Router {
  const router = Router();

  router.get("/forwards", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const forwards = await prisma.portForward.findMany({
      where: req.auth!.role === "ADMIN" ? {} : { userId: req.auth!.sub },
      orderBy: { createdAt: "desc" }
    });
    sendOk(res, forwards, { count: forwards.length });
  }));

  router.post("/forwards", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createForwardSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
    }

    const instance = await prisma.userInstance.findUnique({ where: { id: parsed.data.instanceId }, include: { ports: true } });
    if (!instance) {
      throw new AppError(404, "ERR_INSTANCE_NOT_FOUND", "Instance not found.");
    }

    if (req.auth!.role !== "ADMIN" && instance.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_INSTANCE_FORBIDDEN", "You cannot create a forward for this instance.");
    }

    const targetPort = instance.ports.find((port: { name: string; serviceName: string; hostPort: number; remoteHost: string }) =>
      port.name === parsed.data.portName &&
      (parsed.data.serviceName ? (port as { serviceName?: string | null }).serviceName === parsed.data.serviceName : true)
    );

    if (!targetPort) {
      throw new AppError(404, "ERR_FORWARD_TARGET_NOT_FOUND", "Requested service/port does not exist on this instance.");
    }

    if (targetPort.hostPort <= 0) {
      throw new AppError(409, "ERR_FORWARD_PORT_NOT_PUBLISHED", "Target port is not published on host yet. Retry in a few seconds.");
    }

    const forward = await prisma.portForward.create({
      data: {
        userId: instance.userId,
        instanceId: instance.id,
        localPort: parsed.data.localPort,
        remoteHost: targetPort.remoteHost,
        remotePort: targetPort.hostPort,
        status: "REQUESTED"
      }
    });

    console.log(JSON.stringify({
      level: "info",
      message: "forward.create.requested",
      forwardId: forward.id,
      userId: instance.userId,
      localPort: forward.localPort,
      remoteHost: forward.remoteHost,
      remotePort: forward.remotePort
    }));

    const commandSent = hub.sendToAgent(instance.userId, {
      type: "BIND_PORT",
      payload: { id: forward.id, localPort: forward.localPort, remoteHost: forward.remoteHost, remotePort: forward.remotePort }
    });

    console.log(JSON.stringify({
      level: commandSent ? "info" : "warn",
      message: "forward.bind.dispatch",
      forwardId: forward.id,
      userId: instance.userId,
      sent: commandSent
    }));

    if (!commandSent) {
      await prisma.portForward.update({ where: { id: forward.id }, data: { status: "AGENT_OFFLINE" } });
      throw new AppError(409, "ERR_AGENT_OFFLINE", "Agent is offline. Forward saved as AGENT_OFFLINE.", { forwardId: forward.id });
    }

    await writeAuditLog({ actorUserId: req.auth!.sub, action: "forward.create", targetType: "portForward", targetId: forward.id });
    sendCreated(res, forward);
  }));

  router.post("/forwards/:id/stop", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const forward = await prisma.portForward.findUnique({ where: { id } });
    if (!forward) {
      throw new AppError(404, "ERR_FORWARD_NOT_FOUND", "Forward not found.");
    }

    if (req.auth!.role !== "ADMIN" && forward.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_FORWARD_FORBIDDEN", "You cannot stop this forward.");
    }

    // Best-effort stop: mark STOPPED immediately to avoid stale STOPPING states.
    await prisma.portForward.update({ where: { id: forward.id }, data: { status: "STOPPED" } });

    const sent = hub.sendToAgent(forward.userId, { type: "UNBIND_PORT", payload: { id: forward.id } });
    console.log(JSON.stringify({
      level: sent ? "info" : "warn",
      message: "forward.unbind.dispatch",
      forwardId: forward.id,
      userId: forward.userId,
      sent
    }));

    await writeAuditLog({ actorUserId: req.auth!.sub, action: "forward.stop", targetType: "portForward", targetId: forward.id });
    sendOk(res, { success: true, note: sent ? "Unbind dispatched to agent." : "Agent offline. Marked as stopped." });
  }));

  router.delete("/forwards/:id", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const forward = await prisma.portForward.findUnique({ where: { id } });
    if (!forward) {
      throw new AppError(404, "ERR_FORWARD_NOT_FOUND", "Forward not found.");
    }

    if (req.auth!.role !== "ADMIN" && forward.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_FORWARD_FORBIDDEN", "You cannot delete this forward.");
    }

    if (forward.status !== "STOPPED") {
      throw new AppError(409, "ERR_FORWARD_NOT_STOPPED", "Only STOPPED forwards can be deleted.");
    }

    await prisma.portForward.delete({ where: { id: forward.id } });
    await writeAuditLog({ actorUserId: req.auth!.sub, action: "forward.delete", targetType: "portForward", targetId: forward.id });
    sendOk(res, { deleted: true });
  }));

  return router;
}
