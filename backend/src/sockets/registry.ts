import { Server } from "socket.io";

// Route handlers and services run outside the socket setup code but still
// need to emit events; this module is the one shared handle between them.
let io: Server | null = null;

export function setIO(instance: Server) {
  io = instance;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io server has not been initialized yet");
  return io;
}

// userId -> set of connected socket ids. A user can have the dashboard open
// in two tabs, so presence is "at least one socket alive", not one-per-user.
const onlineUsers = new Map<string, Set<string>>();

export function markOnline(userId: string, socketId: string) {
  const set = onlineUsers.get(userId) ?? new Set<string>();
  set.add(socketId);
  onlineUsers.set(userId, set);
}

export function markOffline(userId: string, socketId: string) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

export function onlineUserCount(): number {
  return onlineUsers.size;
}
