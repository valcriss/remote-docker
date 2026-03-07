import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { sendOk } from "../http/response.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/sessions", asyncHandler(async (_req, res) => {
  const sessions = await prisma.session.findMany({
    include: { user: { select: { id: true, email: true, role: true } } },
    orderBy: { updatedAt: "desc" }
  });
  sendOk(res, sessions, { count: sessions.length });
}));

adminRouter.get("/users", asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  sendOk(res, users, { count: users.length });
}));

adminRouter.get("/audit", asyncHandler(async (_req, res) => {
  const audit = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  sendOk(res, audit, { count: audit.length });
}));

adminRouter.get("/dashboard", asyncHandler(async (_req, res) => {
  const [onlineSessions, totalSessions, totalUsers, totalInstances, totalForwards, errors] = await Promise.all([
    prisma.session.count({ where: { status: "ONLINE" } }),
    prisma.session.count(),
    prisma.user.count(),
    prisma.userInstance.count(),
    prisma.portForward.count(),
    prisma.portForward.count({ where: { status: { in: ["AGENT_OFFLINE", "ERROR"] } } })
  ]);

  sendOk(res, {
    sessions: { online: onlineSessions, total: totalSessions },
    users: totalUsers,
    instances: totalInstances,
    forwards: { total: totalForwards, problematic: errors }
  });
}));