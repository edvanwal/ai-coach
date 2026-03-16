import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma leest DATABASE_URL zelf uit env (PostgreSQL/Neon in productie,
// dezelfde URL lokaal als je tegen dezelfde database wilt werken).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
