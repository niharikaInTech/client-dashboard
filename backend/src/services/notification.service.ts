import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getIO } from "../sockets/registry";
import { rooms } from "../sockets/rooms";

async function pushNotification(userId: string, type: NotificationType, message: string, taskId?: string) {
  const notification = await prisma.notification.create({
    data: { userId, type, message, relatedTaskId: taskId ?? null },
  });

  const unreadCount = await prisma.notification.count({ where: { userId, isRead: false } });

  getIO().to(rooms.user(userId)).emit("notification:new", { notification, unreadCount });

  return notification;
}

export function notifyTaskAssigned(assigneeId: string, taskTitle: string, taskId: string) {
  return pushNotification(
    assigneeId,
    "TASK_ASSIGNED",
    `You were assigned to "${taskTitle}"`,
    taskId
  );
}

export function notifyTaskInReview(pmId: string, taskTitle: string, taskId: string) {
  return pushNotification(
    pmId,
    "TASK_IN_REVIEW",
    `"${taskTitle}" was moved to In Review`,
    taskId
  );
}
