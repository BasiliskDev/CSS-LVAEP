import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Next's dev server hot-reloads modules, and on serverless each warm instance reuses
// this module, so without a singleton we would open a new connection pool per reload
// or per invocation and exhaust the database's connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env for local development, " +
        "or set it in your hosting provider's environment variables.",
    );
  }

  // Keep the pool small: every serverless instance opens its own, so a large pool
  // multiplied by instances is what exhausts Postgres connection limits. Point
  // DATABASE_URL at a pooled endpoint (PgBouncer / Neon pooler) in production.
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
