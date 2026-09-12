// Centralizing the naming scheme avoids typo drift between where a room is
// joined and where an event is emitted to it.
export const rooms = {
  user: (userId: string) => `user:${userId}`,
  pmProjects: (pmId: string) => `pm:${pmId}`,
  adminGlobal: "admin:global",
  project: (projectId: string) => `project:${projectId}`,
};
