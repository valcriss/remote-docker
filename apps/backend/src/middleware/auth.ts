import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";
import { AppError } from "../http/error.js";

type UserRole = "USER" | "ADMIN";

export interface AuthContext {
  sub: string;
  role: UserRole;
  email: string;
}

export interface AuthedRequest extends Request {
  auth?: AuthContext;
  requestId?: string;
}

const secret = process.env.JWT_SECRET ?? "dev-secret";

export function signJwt(payload: AuthContext): string {
  return jwt.sign(payload, secret, { expiresIn: "12h" });
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith("Bearer ")) {
    next(new AppError(401, "ERR_AUTH_MISSING_TOKEN", "Missing bearer token"));
    return;
  }

  const token = raw.slice("Bearer ".length);
  try {
    req.auth = jwt.verify(token, secret) as AuthContext;
    next();
  } catch {
    next(new AppError(401, "ERR_AUTH_INVALID_TOKEN", "Invalid token"));
  }
}

export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction): void {
  if (req.auth?.role !== "ADMIN") {
    next(new AppError(403, "ERR_AUTH_ADMIN_REQUIRED", "Admin role required"));
    return;
  }
  next();
}