import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { type AuthedRequest, requireAdmin, requireAuth } from "../middleware/auth.js";
import { AppError } from "../http/error.js";
import { sendCreated, sendOk } from "../http/response.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { writeAuditLog } from "../services/audit.js";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["CONTAINER", "COMPOSE"]),
  description: z.string().optional(),
  image: z.string().optional(),
  composeYaml: z.string().optional(),
  ports: z.array(
    z.object({
      serviceName: z.string().min(1).default("default"),
      name: z.string(),
      port: z.number().int().positive(),
      protocol: z.literal("tcp").default("tcp"),
      exposure: z.enum(["INTERNAL", "FORWARDABLE"]).default("FORWARDABLE")
    })
  ).default([]),
  volumes: z.array(
    z.object({
      serviceName: z.string().min(1).default("default"),
      name: z.string(),
      mountPath: z.string(),
      mode: z.enum(["REMOTE_ONLY", "SYNC_BIDIRECTIONAL"]).default("REMOTE_ONLY"),
      defaultConflictPolicy: z.enum(["PREFER_LOCAL", "PREFER_REMOTE", "MANUAL"]).default("PREFER_REMOTE")
    })
  ).default([]),
  envVars: z.array(
    z.object({
      serviceName: z.string().min(1).default("default"),
      key: z.string().min(1),
      value: z.string()
    })
  ).default([])
});

const updateTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["CONTAINER", "COMPOSE"]),
  description: z.string().optional(),
  image: z.string().optional(),
  composeYaml: z.string().optional(),
  ports: z.array(
    z.object({
      serviceName: z.string().min(1).default("default"),
      name: z.string(),
      port: z.number().int().positive(),
      protocol: z.literal("tcp").default("tcp"),
      exposure: z.enum(["INTERNAL", "FORWARDABLE"]).default("FORWARDABLE")
    })
  ).default([]),
  volumes: z.array(
    z.object({
      serviceName: z.string().min(1).default("default"),
      name: z.string(),
      mountPath: z.string(),
      mode: z.enum(["REMOTE_ONLY", "SYNC_BIDIRECTIONAL"]).default("REMOTE_ONLY"),
      defaultConflictPolicy: z.enum(["PREFER_LOCAL", "PREFER_REMOTE", "MANUAL"]).default("PREFER_REMOTE")
    })
  ).default([]),
  envVars: z.array(
    z.object({
      serviceName: z.string().min(1).default("default"),
      key: z.string().min(1),
      value: z.string()
    })
  ).default([])
});

export const catalogRouter = Router();

catalogRouter.get("/templates", requireAuth, asyncHandler(async (_req, res) => {
  const templates = await prisma.catalogTemplate.findMany({
    include: { ports: true, volumes: true, envVars: true },
    orderBy: { createdAt: "desc" }
  });

  sendOk(res, templates, { count: templates.length });
}));

catalogRouter.post("/templates", requireAuth, requireAdmin, asyncHandler(async (req: AuthedRequest, res) => {
  const parsed = createTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
  }

  const payload = parsed.data;
  if (payload.type === "CONTAINER" && !payload.image) {
    throw new AppError(400, "ERR_CATALOG_IMAGE_REQUIRED", "Container templates require an image field.");
  }

  if (payload.type === "COMPOSE" && !payload.composeYaml) {
    throw new AppError(400, "ERR_CATALOG_COMPOSE_REQUIRED", "Compose templates require composeYaml.");
  }

  const created = await prisma.catalogTemplate.create({
    data: {
      name: payload.name,
      type: payload.type,
      description: payload.description,
      image: payload.image,
      composeYaml: payload.composeYaml,
      createdByUserId: req.auth!.sub,
      ports: {
        create: payload.ports.map((p) => ({
          serviceName: p.serviceName,
          name: p.name,
          port: p.port,
          protocol: p.protocol,
          exposure: p.exposure
        }))
      },
      volumes: {
        create: payload.volumes.map((v) => ({
          serviceName: v.serviceName,
          name: v.name,
          mountPath: v.mountPath,
          mode: v.mode,
          defaultConflictPolicy: v.defaultConflictPolicy
        }))
      },
      envVars: {
        create: payload.envVars.map((env) => ({
          serviceName: env.serviceName,
          key: env.key,
          value: env.value
        }))
      }
    },
    include: { ports: true, volumes: true, envVars: true }
  });

  await writeAuditLog({
    actorUserId: req.auth!.sub,
    action: "catalog.template.create",
    targetType: "catalogTemplate",
    targetId: created.id,
    details: { name: created.name, type: created.type }
  });

  sendCreated(res, created);
}));

catalogRouter.put("/templates/:id", requireAuth, requireAdmin, asyncHandler(async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const parsed = updateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
  }

  const exists = await prisma.catalogTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    throw new AppError(404, "ERR_TEMPLATE_NOT_FOUND", "Template not found.");
  }

  const payload = parsed.data;
  if (payload.type === "CONTAINER" && !payload.image) {
    throw new AppError(400, "ERR_CATALOG_IMAGE_REQUIRED", "Container templates require an image field.");
  }

  if (payload.type === "COMPOSE" && !payload.composeYaml) {
    throw new AppError(400, "ERR_CATALOG_COMPOSE_REQUIRED", "Compose templates require composeYaml.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.catalogTemplatePort.deleteMany({ where: { templateId: id } });
    await tx.catalogTemplateVolume.deleteMany({ where: { templateId: id } });
    await tx.catalogTemplateEnv.deleteMany({ where: { templateId: id } });

    return await tx.catalogTemplate.update({
      where: { id },
      data: {
        name: payload.name,
        type: payload.type,
        description: payload.description,
        image: payload.image,
        composeYaml: payload.composeYaml,
        ports: {
          create: payload.ports.map((p) => ({
            serviceName: p.serviceName,
            name: p.name,
            port: p.port,
            protocol: p.protocol,
            exposure: p.exposure
          }))
        },
        volumes: {
          create: payload.volumes.map((v) => ({
            serviceName: v.serviceName,
            name: v.name,
            mountPath: v.mountPath,
            mode: v.mode,
            defaultConflictPolicy: v.defaultConflictPolicy
          }))
        },
        envVars: {
          create: payload.envVars.map((env) => ({
            serviceName: env.serviceName,
            key: env.key,
            value: env.value
          }))
        }
      },
      include: { ports: true, volumes: true, envVars: true }
    });
  });

  await writeAuditLog({
    actorUserId: req.auth!.sub,
    action: "catalog.template.update",
    targetType: "catalogTemplate",
    targetId: updated.id,
    details: { name: updated.name, type: updated.type }
  });

  sendOk(res, updated);
}));

catalogRouter.delete("/templates/:id", requireAuth, requireAdmin, asyncHandler(async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const exists = await prisma.catalogTemplate.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!exists) {
    throw new AppError(404, "ERR_TEMPLATE_NOT_FOUND", "Template not found.");
  }

  const usageCount = await prisma.userInstance.count({ where: { templateId: id } });
  if (usageCount > 0) {
    throw new AppError(409, "ERR_TEMPLATE_IN_USE", "Template is currently used by existing instances and cannot be deleted.", { usageCount });
  }

  await prisma.catalogTemplate.delete({ where: { id } });

  await writeAuditLog({
    actorUserId: req.auth!.sub,
    action: "catalog.template.delete",
    targetType: "catalogTemplate",
    targetId: exists.id,
    details: { name: exists.name }
  });

  sendOk(res, { deleted: true });
}));
