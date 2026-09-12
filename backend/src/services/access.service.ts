import { Project, Task } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { AuthUser } from "../middleware/auth";

// Single source of truth for "can this user touch this project/task" so the
// rule can't drift between the REST layer and the socket layer. A developer
// hitting a PM's endpoint with a forged token still lands here and still
// gets a 403/404, because the check is on the resource, not the route.
export async function getProjectOrThrow(user: AuthUser, projectId: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw ApiError.notFound("Project not found");

  if (user.role === "ADMIN") return project;
  if (user.role === "PM") {
    if (project.managerId !== user.id) throw ApiError.notFound("Project not found");
    return project;
  }

  // DEVELOPER: only allowed if they have a task on this project.
  const hasTask = await prisma.task.findFirst({ where: { projectId, assigneeId: user.id } });
  if (!hasTask) throw ApiError.notFound("Project not found");
  return project;
}

export async function getTaskOrThrow(user: AuthUser, taskId: string): Promise<Task & { project: Project }> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) throw ApiError.notFound("Task not found");

  if (user.role === "ADMIN") return task;
  if (user.role === "PM") {
    if (task.project.managerId !== user.id) throw ApiError.notFound("Task not found");
    return task;
  }
  if (task.assigneeId !== user.id) throw ApiError.notFound("Task not found");
  return task;
}

// Returns the Prisma `where` fragment that scopes a project list query to
// what the given role is allowed to see - used by both the project list and
// the dashboard summary so they can never disagree.
export function projectScopeFilter(user: AuthUser) {
  if (user.role === "ADMIN") return {};
  if (user.role === "PM") return { managerId: user.id };
  return { tasks: { some: { assigneeId: user.id } } };
}

export function taskScopeFilter(user: AuthUser) {
  if (user.role === "ADMIN") return {};
  if (user.role === "PM") return { project: { managerId: user.id } };
  return { assigneeId: user.id };
}
