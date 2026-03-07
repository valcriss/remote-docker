import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../http/error.js";
import { sendFail } from "../http/response.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    sendFail(res, err.status, err.code, err.message, err.details, res.getHeader("x-request-id")?.toString());
    return;
  }

  if (err instanceof ZodError) {
    sendFail(res, 400, "ERR_VALIDATION", "Validation failed", err.flatten(), res.getHeader("x-request-id")?.toString());
    return;
  }

  console.error(JSON.stringify({ level: "error", message: "Unhandled error", err }));
  sendFail(res, 500, "ERR_INTERNAL", "Internal server error", undefined, res.getHeader("x-request-id")?.toString());
}