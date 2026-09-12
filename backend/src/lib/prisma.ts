import { PrismaClient } from "@prisma/client";

// Reuse a single client across the process; tsx watch mode would otherwise
// spawn a new pool on every reload.
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
