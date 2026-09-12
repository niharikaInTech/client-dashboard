import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ApiError } from "../utils/ApiError";
import { getProjectOrThrow, projectScopeFilter } from "../services/access.service";
import { getProjectActivity } from "../services/activityFeed.service";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: projectScopeFilter(req.user!),
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(projects);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await getProjectOrThrow(req.user!, req.params.id);
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        manager: { select: { id: true, name: true, email: true } },
      },
    });
    res.json(project);
  })
);

const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    clientId: z.string().min(1),
    // Only ADMIN may set this; a PM creating a project always owns it.
    managerId: z.string().min(1).optional(),
  }),
});

router.post(
  "/",
  authorize("ADMIN", "PM"),
  validate(createProjectSchema),
  asyncHandler(async (req, res) => {
    const { name, description, clientId, managerId } = req.body;

    let ownerId = req.user!.id;
    if (req.user!.role === "ADMIN") {
      if (!managerId) throw ApiError.badRequest("managerId is required when an admin creates a project");
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      if (!manager || manager.role !== "PM") {
        throw ApiError.badRequest("managerId must reference a Project Manager");
      }
      ownerId = managerId;
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw ApiError.badRequest("Unknown clientId");

    const project = await prisma.project.create({
      data: { name, description, clientId, managerId: ownerId },
    });
    res.status(201).json(project);
  })
);

const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  }),
});

// A PM editing a project they don't own gets the same 404 a developer would -
// getProjectOrThrow already enforces "PMs only see their own projects", so
// there's nothing extra to check here.
router.patch(
  "/:id",
  authorize("ADMIN", "PM"),
  validate(updateProjectSchema),
  asyncHandler(async (req, res) => {
    await getProjectOrThrow(req.user!, req.params.id);
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(project);
  })
);

// Full history for the project detail page's feed panel. Live updates after
// that come over the socket "activity:new" event for this project's room.
router.get(
  "/:id/activity",
  asyncHandler(async (req, res) => {
    await getProjectOrThrow(req.user!, req.params.id);
    const activity = await getProjectActivity(req.params.id);
    res.json(activity);
  })
);

export default router;
