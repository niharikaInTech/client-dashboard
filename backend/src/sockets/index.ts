import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { Role } from "@prisma/client";
import { env } from "../config/env";
import { verifyAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { setIO, markOnline, markOffline, onlineUserCount } from "./registry";
import { rooms } from "./rooms";
import { getRecentActivityForUser } from "../services/activityFeed.service";

export function initSockets(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });
  setIO(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role as Role;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const { userId, role } = socket.data as { userId: string; role: Role };

    socket.join(rooms.user(userId));
    if (role === "ADMIN") socket.join(rooms.adminGlobal);
    if (role === "PM") socket.join(rooms.pmProjects(userId));

    markOnline(userId, socket.id);
    io.to(rooms.adminGlobal).emit("presence:count", onlineUserCount());

    // Missed-event catchup: fetched from the DB every time, per the spec -
    // never served out of an in-memory buffer that would be empty after a
    // server restart.
     socket.on("activity:catchup", async (ack: (events: unknown) => void) => {
      const events = await getRecentActivityForUser(userId, role);
      ack(events);
    });

    socket.on("project:join", async (projectId: string) => {
      const allowed = await canAccessProject(userId, role, projectId);
      if (allowed) socket.join(rooms.project(projectId));
    });

    socket.on("project:leave", (projectId: string) => {
      socket.leave(rooms.project(projectId));
    });

    socket.on("disconnect", () => {
      markOffline(userId, socket.id);
      io.to(rooms.adminGlobal).emit("presence:count", onlineUserCount());
    });
  });

  return io;
}

async function canAccessProject(userId: string, role: Role, projectId: string): Promise<boolean> {
  if (role === "ADMIN") return true;

  if (role === "PM") {
    const project = await prisma.project.findFirst({ where: { id: projectId, managerId: userId } });
    return Boolean(project);
  }

  const task = await prisma.task.findFirst({ where: { projectId, assigneeId: userId } });
  return Boolean(task);
}
