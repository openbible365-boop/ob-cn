import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const configuredPoolSize = Number(process.env.DATABASE_POOL_MAX);
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // The local PGlite/Postgres bridge supports one active connection. A larger
  // development pool can mix unnamed prepared statements and cause sporadic
  // 500 responses. Production keeps a normal pool unless explicitly tuned.
  max:
    Number.isFinite(configuredPoolSize) && configuredPoolSize > 0
      ? configuredPoolSize
      : process.env.NODE_ENV === "production"
        ? 10
        : 1,
});

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
