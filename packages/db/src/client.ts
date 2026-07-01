import { PrismaClient } from "@prisma/client";

// Single shared PrismaClient instance per process. NestJS's PrismaService
// (apps/api/src/prisma) wraps this with lifecycle hooks; this file is what
// standalone scripts (seed, one-off migrations) import directly.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export * from "@prisma/client";
