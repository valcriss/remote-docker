import { Router } from "express";
import { prisma } from "../prisma.js";
import { type AuthedRequest, requireAdmin, requireAuth } from "../middleware/auth.js";
import { sendOk } from "../http/response.js";
import { asyncHandler } from "../middleware/async-handler.js";

export const sessionRouter = Router();

sessionRouter.get("/me/session", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const session = await prisma.session.findFirst({ where: { userId: req.auth!.sub }, orderBy: { updatedAt: "desc" } });
  sendOk(res, session);
}));

sessionRouter.get("/admin/sessions", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const sessions = await prisma.session.findMany({
    include: { user: { select: { id: true, email: true, role: true } } },
    orderBy: { updatedAt: "desc" }
  });

  sendOk(res, sessions, { count: sessions.length });
}));