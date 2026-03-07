import type { Response } from "express";
import type { ApiFailure, ApiSuccess } from "./types.js";

export function sendOk<T>(res: Response, data: T, meta?: Record<string, unknown>): Response<ApiSuccess<T>> {
  return res.json({ data, meta, error: null });
}

export function sendCreated<T>(res: Response, data: T, meta?: Record<string, unknown>): Response<ApiSuccess<T>> {
  return res.status(201).json({ data, meta, error: null });
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

export function sendFail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
  requestId?: string
): Response<ApiFailure> {
  return res.status(status).json({
    data: null,
    error: { code, message, details, requestId }
  });
}