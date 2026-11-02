import fs from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "./env";

const createClient = () => {
  const dbPath = serverEnv.databaseUrl.replace(/^file:/, "");
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const adapter = new PrismaBetterSqlite3({ url: serverEnv.databaseUrl });
  return new PrismaClient({ adapter });
};

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
