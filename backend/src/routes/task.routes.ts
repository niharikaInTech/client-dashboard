import { Router } from "express";
import { z } from "zod";
import { Priority, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ApiError } from "../utils/ApiError";
import { getProjectOrThrow, getTaskOrThrow, taskScopeFilter } from "../services/access.service";
import { recordStatusChange } from "../services/activityFeed.service";
import { notifyTaskAssigned, notifyTaskInReview } from "../services/notification.service";

const router = Router();
router.use(authenticate);

// Priority order used to sort "priority then due date" for the developer
// dashboard - kept here rather than relying on enum declaration order, which
// isn't guaranteed to sort usefully in a raw SQL ORDER BY.
const PRIORITY_RANK: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const listQuerySchema = z.object({
  query: z.object({
    projectId: z.string().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueFrom: z.string().datetime().optional(),
    dueTo: z.string().datetime().optional(),
    sort: z.enum(["priority", "dueDate", "recent"]).optional(),
  }),
});

router.get(
  "/",
  validate(listQuerySchema),
  asyncHandler(async (req, res) => {
    const { projectId, status, priority, dueFrom, dueTo, sort } = req.query as z.infer<
      typeof listQuerySchema
    >["query"];

    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          taskScopeFilter(req.user!),
          projectId ? { projectId } : {},
          status ? { status } : {},
          priority ? { priority } : {},
          dueFrom || dueTo
            ? {
                dueDate: {
                  gte: dueFrom ? new Date(dueFrom) : undefined,
                  lte: dueTo ? new Date(dueTo) : undefined,
                },
              }
            : {},
        ],
      },
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: sort === "dueDate" ? { dueDate: "asc" } : sort === "recent" ? { updatedAt: "desc" } : undefined,
    });

    if (sort === "priority") {
      tasks.sort((a, b) => {
        const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (rankDiff !== 0) return rankDiff;
        const aDue = a.dueDate?.getTime() ?? Infinity;
        const bDue = b.dueDate?.getTime() ?? Infinity;
        return aDue - bDue;
      });
    }

    res.json(tasks);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await getTaskOrThrow(req.user!, req.params.id);
    const full = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, managerId: true } },
      },
    });
    res.json(full);
  })
);

const createTaskSchema = z.object({
  body: z.object({
    projectId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    assigneeId: z.string().min(1).optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().datetime().optional(),
  }),
});

router.post(
  "/",
  authorize("ADMIN", "PM"),
  validate(createTaskSchema),
  asyncHandler(async (req, res) => {
    const { projectId, title, description, assigneeId, priority, dueDate } = req.body;

    // Confirms the caller actually owns this project (or is admin) before
    // anything is written.
    await getProjectOrThrow(req.user!, projectId);

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || assignee.role !== "DEVELOPER") {
        throw ApiError.badRequest("assigneeId must reference a Developer");
      }
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        assigneeId,
        priority,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
    });

    if (assigneeId) {
      await notifyTaskAssigned(assigneeId, task.title, task.id);
    }

    res.status(201).json(task);
  })
);

const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    priority: z.nativeEnum(Priority).optional(),
    dueDate: z.string().datetime().nullable().optional(),
  }),
});

// Editing task details (not status) is a PM/admin action - reassigning,
// repriotizing, or changing scope isn't something a developer should do to
// their own ticket.
router.patch(
  "/:id",
  authorize("ADMIN", "PM"),
  validate(updateTaskSchema),
  asyncHandler(async (req, res) => {
    const existing = await getTaskOrThrow(req.user!, req.params.id);
    const { assigneeId } = req.body;

    if (assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee || assignee.role !== "DEVELOPER") {
        throw ApiError.badRequest("assigneeId must reference a Developer");
      }
    }

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: {
        ...req.body,
        dueDate: req.body.dueDate === undefined ? undefined : req.body.dueDate ? new Date(req.body.dueDate) : null,
      },
    });

    if (assigneeId && assigneeId !== existing.assigneeId) {
      await notifyTaskAssigned(assigneeId, task.title, task.id);
    }

    res.json(task);
  })
);

const statusSchema = z.object({
  body: z.object({ status: z.nativeEnum(TaskStatus) }),
});

// The one endpoint a developer is allowed to write to, and only for a task
// assigned to them - getTaskOrThrow already turns "not my task" into a 404
// for developers, so a forged token pointing at someone else's task id gets
// nothing back either.
router.patch(
  "/:id/status",
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const existing = await getTaskOrThrow(req.user!, req.params.id);
    const { status } = req.body;

    if (existing.status === status) {
      return res.json(existing);
    }

    const updated = await prisma.task.update({
      where: { id: existing.id },
      data: {
        status,
        isOverdue: status === "DONE" ? false : existing.isOverdue,
      },
    });

    await recordStatusChange({
      taskId: updated.id,
      projectId: existing.projectId,
      assigneeId: existing.assigneeId,
      projectManagerId: existing.project.managerId,
      userId: req.user!.id,
      fromStatus: existing.status,
      toStatus: status,
    });

    if (status === "IN_REVIEW") {
      await notifyTaskInReview(existing.project.managerId, updated.title, updated.id);
    }

    res.json(updated);
  })
);

export default router;
