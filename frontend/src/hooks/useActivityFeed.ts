import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { ActivityEvent } from "../types";

// projectId omitted -> the user's own scoped feed (admin: global, PM: their
// projects, developer: their tasks), fed by the "activity:catchup" the
// server sends right after the socket connects.
// projectId set -> full history for one project via REST, then live
// updates for just that project's room.
export function useActivityFeed(projectId?: string) {
  const { socket } = useSocket();
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      api.get<ActivityEvent[]>(`/projects/${projectId}/activity`).then((res) => {
        if (!cancelled) setEvents(res.data);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;

       if (!projectId) {
      socket.emit("activity:catchup", (payload: ActivityEvent[]) => setEvents(payload));
      return;
    }

    socket.emit("project:join", projectId);
    return () => {
      socket.emit("project:leave", projectId);
    };
  }, [socket, projectId]);

  useEffect(() => {
    if (!socket) return;

    const onNew = (event: ActivityEvent) => {
      if (projectId && event.projectId !== projectId) return;
      setEvents((prev) => [event, ...prev].slice(0, 100));
    };

    socket.on("activity:new", onNew);
    return () => {
      socket.off("activity:new", onNew);
    };
  }, [socket, projectId]);

  return events;
}
