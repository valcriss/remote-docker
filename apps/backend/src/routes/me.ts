import { Router } from "express";
import { prisma } from "../prisma.js";
import { type AuthedRequest, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { sendOk } from "../http/response.js";

export const meRouter = Router();

meRouter.get("/session", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const session = await prisma.session.findFirst({ where: { userId: req.auth!.sub }, orderBy: { updatedAt: "desc" } });
  sendOk(res, session);
}));

meRouter.get("/instances", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const instances = await prisma.userInstance.findMany({
    where: { userId: req.auth!.sub },
    include: { template: true, ports: true, volumes: true },
    orderBy: { createdAt: "desc" }
  });
  sendOk(res, instances, { count: instances.length });
}));

meRouter.get("/forwards", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const forwards = await prisma.portForward.findMany({ where: { userId: req.auth!.sub }, orderBy: { createdAt: "desc" } });
  sendOk(res, forwards, { count: forwards.length });
}));

meRouter.get("/dashboard", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const userId = req.auth!.sub;

  const [session, instances, forwards, templates, recentAudit] = await Promise.all([
    prisma.session.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.userInstance.findMany({ where: { userId }, select: { id: true, status: true } }),
    prisma.portForward.findMany({ where: { userId }, select: { id: true, status: true } }),
    prisma.catalogTemplate.count(),
    prisma.auditLog.findMany({ where: { actorUserId: userId }, orderBy: { createdAt: "desc" }, take: 10 })
  ]);

  const byStatus = (values: Array<{ status: string }>) =>
    values.reduce<Record<string, number>>((acc, value) => {
      acc[value.status] = (acc[value.status] ?? 0) + 1;
      return acc;
    }, {});

  sendOk(res, {
    session,
    counts: {
      instances: instances.length,
      forwards: forwards.length,
      catalogTemplates: templates
    },
    statusBreakdown: {
      instances: byStatus(instances),
      forwards: byStatus(forwards)
    },
    recentAudit
  });
}));