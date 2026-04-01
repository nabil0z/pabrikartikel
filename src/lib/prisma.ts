import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // Di Docker: DATABASE_URL=file:/app/data/pabrik.db (absolute)
  // Di Local:  DATABASE_URL=file:./dev.db (relative, resolves to cwd)
  const envUrl = process.env.DATABASE_URL || "file:./dev.db";
  
  let dbUrl: string;
  if (envUrl.startsWith("file:/") && !envUrl.startsWith("file:./")) {
    // Absolute path from Docker (file:/app/data/pabrik.db)
    dbUrl = envUrl;
  } else {
    // Relative path (file:./dev.db) -> resolve to absolute
    const relativePath = envUrl.replace("file:", "");
    const absolutePath = path.resolve(process.cwd(), relativePath);
    dbUrl = `file:${absolutePath}`;
  }

  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
