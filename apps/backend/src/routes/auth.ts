import { z } from "zod";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { signJwt, type AuthedRequest, requireAuth } from "../middleware/auth.js";
import { hashPassword } from "../utils/password.js";
import { AppError } from "../http/error.js";
import { sendCreated, sendOk } from "../http/response.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { writeAuditLog } from "../services/audit.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["USER", "ADMIN"]).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
  }

  const payload = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: payload.email } });
  if (existing) {
    throw new AppError(409, "ERR_AUTH_EMAIL_EXISTS", "An account already exists for this email.");
  }

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      passwordHash: hashPassword(payload.password),
      role: payload.role ?? "USER"
    }
  });

  await writeAuditLog({ actorUserId: user.id, action: "auth.register", targetType: "user", targetId: user.id });

  const token = signJwt({ sub: user.id, role: user.role, email: user.email });
  sendCreated(res, { token, user: { id: user.id, email: user.email, role: user.role } });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(400, "ERR_VALIDATION", "Validation failed", parsed.error.flatten());
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.passwordHash !== hashPassword(parsed.data.password)) {
    throw new AppError(401, "ERR_AUTH_INVALID_CREDENTIALS", "Invalid email or password.");
  }

  const token = signJwt({ sub: user.id, role: user.role, email: user.email });
  sendOk(res, { token, user: { id: user.id, email: user.email, role: user.role } });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
  if (!user) {
    throw new AppError(404, "ERR_USER_NOT_FOUND", "Authenticated user was not found.");
  }

  sendOk(res, { id: user.id, email: user.email, role: user.role });
}));