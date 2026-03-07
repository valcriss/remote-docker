import crypto from "node:crypto";

export function hashPassword(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}