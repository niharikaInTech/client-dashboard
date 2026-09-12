import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("ADMIN", "PM"),
  asyncHandler(async (_req, res) => {
    const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
    res.json(clients);
  })
);

const createClientSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    contactEmail: z.string().email().optional(),
  }),
});

router.post(
  "/",
  authorize("ADMIN"),
  validate(createClientSchema),
  asyncHandler(async (req, res) => {
    const client = await prisma.client.create({ data: req.body });
    res.status(201).json(client);
  })
);

export default router;
