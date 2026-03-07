import { randomUUID } from "node:crypto";
import type { NextFunction, Response } from "express";
import type { AuthedRequest } from "./auth.js";

export function requestContext(req: AuthedRequest, res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  const startedAt = Date.now();

  res.setHeader("x-request-id", req.requestId);
  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(JSON.stringify({
      level: "info",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      actorUserId: req.auth?.sub ?? null
    }));
  });

  next();
}