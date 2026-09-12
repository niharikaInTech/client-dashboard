import { Router } from "express";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate } from "../middleware/auth";
import { onlineUserCount } from "../sockets/registry";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    if (user.role === "ADMIN") {
      const [totalProjects, tasksByStatus, overdueCount] = await Promise.all([
        prisma.project.count(),
        prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.task.count({ where: { isOverdue: true } }),
      ]);
      return res.json({
        role: "ADMIN",
        totalProjects,
        tasksByStatus: Object.fromEntries(tasksByStatus.map((t) => [t.status, t._count._all])),
        overdueCount,
        onlineUsers: onlineUserCount(),
      });
    }

    if (user.role === "PM") {
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [projects, tasksByPriority, upcoming] = await Promise.all([
        prisma.project.findMany({
          where: { managerId: user.id },
          include: { _count: { select: { tasks: true } } },
        }),
        prisma.task.groupBy({
          by: ["priority"],
          where: { project: { managerId: user.id } },
          _count: { _all: true },
        }),
        prisma.task.findMany({
          where: {
            project: { managerId: user.id },
            dueDate: { gte: new Date(), lte: weekFromNow },
            status: { not: "DONE" },
          },
          orderBy: { dueDate: "asc" },
          include: { assignee: { select: { name: true } } },
        }),
      ]);
      return res.json({
        role: "PM",
        projects,
        tasksByPriority: Object.fromEntries(tasksByPriority.map((t) => [t.priority, t._count._all])),
        upcomingDueThisWeek: upcoming,
      });
    }

    // DEVELOPER
    const tasks = await prisma.task.findMany({
      where: { assigneeId: user.id },
      include: { project: { select: { id: true, name: true } } },
    });

    const priorityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    tasks.sort((a, b) => {
      const diff = priorityRank[a.priority] - priorityRank[b.priority];
      if (diff !== 0) return diff;
      return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
    });

    res.json({ role: "DEVELOPER", tasks });
  })
);

export default router;
