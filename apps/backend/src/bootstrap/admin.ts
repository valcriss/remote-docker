import { prisma } from "../prisma.js";
import { hashPassword } from "../utils/password.js";

const defaultEmail = "admin@example.com";
const defaultPassword = "password123";

export async function ensureBootstrapAdmin(): Promise<void> {
  const enabled = (process.env.BOOTSTRAP_ADMIN_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return;
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? defaultEmail;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? defaultPassword;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    }
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      role: "ADMIN"
    }
  });

  if (email === defaultEmail && password === defaultPassword) {
    console.warn("[bootstrap] Default admin created with insecure default password. Override BOOTSTRAP_ADMIN_PASSWORD.");
  }
}