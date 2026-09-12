import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ApiError } from "../utils/ApiError";

const router = Router();
router.use(authenticate);

const roleQuerySchema = z.object({
  query: z.object({ role: z.enum(["ADMIN", "PM", "DEVELOPER"]).optional() }),
});

// Admins and PMs both need the user list (PMs to pick a developer when
// assigning a task); developers have no legitimate reason to enumerate
// other users, so they're excluded here rather than filtered client-side.
router.get(
  "/",
  authorize("ADMIN", "PM"),
  validate(roleQuerySchema),
  asyncHandler(async (req, res) => {
    const { role } = req.query as { role?: "ADMIN" | "PM" | "DEVELOPER" };
    const users = await prisma.user.findMany({
      where: role ? { role } : undefined,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  })
);

const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(["ADMIN", "PM", "DEVELOPER"]),
  }),
});

router.post(
  "/",
  authorize("ADMIN"),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict("A user with this email already exists");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    res.status(201).json(user);
  })
);

export default router;
