import { prisma } from "../prisma.js";

export async function writeAuditLog(input: {
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      details: input.details as any
    }
  });
}