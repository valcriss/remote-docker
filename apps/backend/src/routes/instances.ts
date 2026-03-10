import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { type AuthedRequest, requireAuth } from "../middleware/auth.js";
import type { ContainerOrchestrator } from "../orchestrator/types.js";
import type { AgentHub } from "../ws/agent-hub.js";
import { AppError } from "../http/error.js";
import { sendCreated, sendOk } from "../http/response.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { writeAuditLog } from "../services/audit.js";

const createInstanceSchema = z.object({
  templateId: z.string(),
  name: z.string().min(1),
  volumeOverrides: z.array(
    z.object({
      name: z.string(),
      localPath: z.string().optional(),
      mode: z.enum(["REMOTE_ONLY", "SYNC_BIDIRECTIONAL"]).optional(),
      conflictPolicy: z.enum(["PREFER_LOCAL", "PREFER_REMOTE", "MANUAL"]).optional()
    })
  ).default([])
});

export function createInstancesRouter(orchestrator: ContainerOrchestrator, hub: AgentHub): Router {
  const router = Router();

  router.get("/instances", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const where = req.auth!.role === "ADMIN" ? {} : { userId: req.auth!.sub };
    const instances = await prisma.userInstance.findMany({
      where,
      include: { template: true, ports: true, volumes: true },
      orderBy: { createdAt: "desc" }
    });

    const updates: Array<Promise<unknown>> = [];
    for (const instance of instances) {
      if (!instance.runtimeId) {
        continue;
      }

      const runtimeStatus = await orchestrator.getInstanceStatus(instance.runtimeId);
      if (runtimeStatus !== instance.status) {
        updates.push(prisma.userInstance.update({ where: { id: instance.id }, data: { status: runtimeStatus } }));
        instance.status = runtimeStatus;
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    sendOk(res, instances, { count: instances.length });
  }));

  router.post("/instances", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = createInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
    }

    const template = await prisma.catalogTemplate.findUnique({
      where: { id: parsed.data.templateId },
      include: { ports: true, volumes: true, envVars: true }
    });

    if (!template) {
      throw new AppError(404, "ERR_TEMPLATE_NOT_FOUND", "Template not found.");
    }

    const instance = await prisma.userInstance.create({
      data: {
        userId: req.auth!.sub,
        templateId: template.id,
        name: parsed.data.name,
        status: "DEPLOYING"
      }
    });

    const runtime = await orchestrator.startInstance({
      instanceId: instance.id,
      templateName: template.name,
      templateType: template.type,
      image: template.image,
      composeYaml: template.composeYaml,
      userId: req.auth!.sub,
      ports: template.ports.map((port: { serviceName: string; name: string; port: number }) => ({
        serviceName: (port as { serviceName?: string | null }).serviceName ?? "default",
        name: port.name,
        containerPort: port.port
      })),
      volumes: template.volumes.map((volume: { serviceName: string; name: string; mountPath: string }) => ({
        serviceName: (volume as { serviceName?: string | null }).serviceName ?? "default",
        name: volume.name,
        mountPath: volume.mountPath
      })),
      envVars: template.envVars.map((env: { serviceName: string; key: string; value: string }) => ({
        serviceName: (env as { serviceName?: string | null }).serviceName ?? "default",
        key: env.key,
        value: env.value
      }))
    });

    const overrides = new Map(parsed.data.volumeOverrides.map((v) => [v.name, v]));

    await prisma.$transaction([
      prisma.userInstance.update({ where: { id: instance.id }, data: { runtimeId: runtime.runtimeId, status: runtime.status } }),
      prisma.userInstancePort.createMany({
        data: runtime.ports.map((port) => ({
          instanceId: instance.id,
          serviceName: port.serviceName,
          name: port.name,
          hostPort: port.hostPort,
          remoteHost: port.remoteHost,
          remotePort: port.remotePort
        }))
      }),
      prisma.userInstanceVolume.createMany({
        data: runtime.volumes.map((volume) => {
          const match = overrides.get(volume.name);
          return {
            instanceId: instance.id,
            serviceName: volume.serviceName,
            name: volume.name,
            mountPath: volume.mountPath,
            serverPath: volume.serverPath,
            mode: match?.mode ?? "REMOTE_ONLY",
            conflictPolicy: match?.conflictPolicy ?? "PREFER_REMOTE",
            localPath: match?.localPath
          };
        })
      })
    ]);

    const created = await prisma.userInstance.findUnique({
      where: { id: instance.id },
      include: { template: true, ports: true, volumes: true }
    });

    await writeAuditLog({
      actorUserId: req.auth!.sub,
      action: "instance.create",
      targetType: "userInstance",
      targetId: instance.id,
      details: { templateId: template.id, runtimeId: runtime.runtimeId }
    });

    sendCreated(res, created);
  }));

  router.post("/instances/:id/restart", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const instance = await prisma.userInstance.findUnique({ where: { id } });
    if (!instance) {
      throw new AppError(404, "ERR_INSTANCE_NOT_FOUND", "Instance not found.");
    }

    if (req.auth!.role !== "ADMIN" && instance.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_INSTANCE_FORBIDDEN", "You cannot restart this instance.");
    }

    if (!instance.runtimeId) {
      throw new AppError(409, "ERR_INSTANCE_NO_RUNTIME", "Instance has no runtime id.");
    }

    await orchestrator.restartInstance(instance.runtimeId);

    const stoppedForwards = await prisma.portForward.findMany({
      where: { instanceId: instance.id, status: "STOPPED" }
    });

    for (const forward of stoppedForwards) {
      const sent = hub.sendToAgent(forward.userId, {
        type: "BIND_PORT",
        payload: {
          id: forward.id,
          localPort: forward.localPort,
          remoteHost: forward.remoteHost,
          remotePort: forward.remotePort
        }
      });

      await prisma.portForward.update({
        where: { id: forward.id },
        data: { status: sent ? "REQUESTED" : "AGENT_OFFLINE" }
      });
    }

    await prisma.userInstance.update({ where: { id: instance.id }, data: { status: "RUNNING" } });
    await writeAuditLog({ actorUserId: req.auth!.sub, action: "instance.restart", targetType: "userInstance", targetId: instance.id });
    sendOk(res, { success: true });
  }));

  router.post("/instances/:id/stop", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const instance = await prisma.userInstance.findUnique({ where: { id } });
    if (!instance) {
      throw new AppError(404, "ERR_INSTANCE_NOT_FOUND", "Instance not found.");
    }

    if (req.auth!.role !== "ADMIN" && instance.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_INSTANCE_FORBIDDEN", "You cannot stop this instance.");
    }

    if (!instance.runtimeId) {
      throw new AppError(409, "ERR_INSTANCE_NO_RUNTIME", "Instance has no runtime id.");
    }

    const forwards = await prisma.portForward.findMany({
      where: {
        instanceId: instance.id,
        status: { in: ["REQUESTED", "ACTIVE", "AGENT_OFFLINE", "STOPPING"] }
      }
    });

    await orchestrator.stopInstance(instance.runtimeId);
    await prisma.$transaction([
      prisma.userInstance.update({ where: { id: instance.id }, data: { status: "STOPPED" } }),
      prisma.portForward.updateMany({
        where: { id: { in: forwards.map((f: { id: string }) => f.id) } },
        data: { status: "STOPPED" }
      })
    ]);

    for (const forward of forwards) {
      hub.sendToAgent(forward.userId, { type: "UNBIND_PORT", payload: { id: forward.id } });
    }

    await writeAuditLog({ actorUserId: req.auth!.sub, action: "instance.stop", targetType: "userInstance", targetId: instance.id });
    sendOk(res, { success: true });
  }));

  router.delete("/instances/:id", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
    const id = String(req.params.id);
    const instance = await prisma.userInstance.findUnique({ where: { id } });
    if (!instance) {
      throw new AppError(404, "ERR_INSTANCE_NOT_FOUND", "Instance not found.");
    }

    if (req.auth!.role !== "ADMIN" && instance.userId !== req.auth!.sub) {
      throw new AppError(403, "ERR_INSTANCE_FORBIDDEN", "You cannot delete this instance.");
    }

    if (instance.status !== "STOPPED") {
      throw new AppError(409, "ERR_INSTANCE_NOT_STOPPED", "Only STOPPED instances can be deleted.");
    }

    const forwards = await prisma.portForward.findMany({
      where: { instanceId: instance.id, status: { in: ["REQUESTED", "ACTIVE", "AGENT_OFFLINE", "STOPPING"] } }
    });

    for (const forward of forwards) {
      hub.sendToAgent(forward.userId, { type: "UNBIND_PORT", payload: { id: forward.id } });
    }

    if (instance.runtimeId) {
      try {
        await orchestrator.removeInstance(instance.runtimeId);
      } catch (error) {
        console.warn(JSON.stringify({
          level: "warn",
          message: "instance.delete.runtimeCleanupFailed",
          instanceId: instance.id,
          runtimeId: instance.runtimeId,
          error: error instanceof Error ? error.message : String(error)
        }));
      }
    }

    await prisma.userInstance.delete({ where: { id: instance.id } });
    await writeAuditLog({ actorUserId: req.auth!.sub, action: "instance.delete", targetType: "userInstance", targetId: instance.id });
    sendOk(res, { deleted: true });
  }));

  return router;
}
