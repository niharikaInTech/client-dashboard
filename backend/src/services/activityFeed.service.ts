import { Role, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getIO } from "../sockets/registry";
import { rooms } from "../sockets/rooms";

const CATCHUP_LIMIT = 20;

export interface ActivityEvent {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  createdAt: Date;
}

function toEvent(row: {
  id: string;
  taskId: string;
  task: { title: string };
  projectId: string;
  project: { name: string };
  userId: string;
  user: { name: string };
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  createdAt: Date;
}): ActivityEvent {
  return {
    id: row.id,
    taskId: row.taskId,
    taskTitle: row.task.title,
    projectId: row.projectId,
    projectName: row.project.name,
    userId: row.userId,
    userName: row.user.name,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    createdAt: row.createdAt,
  };
}

const include = {
  task: { select: { title: true } },
  project: { select: { name: true } },
  user: { select: { name: true } },
} as const;

// Called from the task controller whenever a status changes. Writes the
// permanent log row, then fans it out over the sockets that should see it -
// the project room for live viewers, plus each role's own scoped feed room.
export async function recordStatusChange(params: {
  taskId: string;
  projectId: string;
  assigneeId: string | null;
  projectManagerId: string;
  userId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
}) {
  const row = await prisma.activityLog.create({
    data: {
      taskId: params.taskId,
      projectId: params.projectId,
      userId: params.userId,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
    },
    include,
  });

  const event = toEvent(row);
  const io = getIO();

 const targetRooms = [rooms.project(params.projectId), rooms.adminGlobal, rooms.pmProjects(params.projectManagerId)];
  if (params.assigneeId) targetRooms.push(rooms.user(params.assigneeId));
  io.to(targetRooms).emit("activity:new", event);

  return event;
}

export async function getRecentActivityForUser(userId: string, role: Role): Promise<ActivityEvent[]> {
  if (role === "ADMIN") {
    const rows = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: CATCHUP_LIMIT,
      include,
    });
    return rows.map(toEvent);
  }

  if (role === "PM") {
    const rows = await prisma.activityLog.findMany({
      where: { project: { managerId: userId } },
      orderBy: { createdAt: "desc" },
      take: CATCHUP_LIMIT,
      include,
    });
    return rows.map(toEvent);
  }

  // DEVELOPER: only activity on tasks currently assigned to them.
  const rows = await prisma.activityLog.findMany({
    where: { task: { assigneeId: userId } },
    orderBy: { createdAt: "desc" },
    take: CATCHUP_LIMIT,
    include,
  });
  return rows.map(toEvent);
}

export async function getProjectActivity(projectId: string, limit = 50): Promise<ActivityEvent[]> {
  const rows = await prisma.activityLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include,
  });
  return rows.map(toEvent);
}
