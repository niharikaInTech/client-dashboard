import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { getAccessToken } from "../api/client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface SocketContextValue {
  socket: Socket | null;
  onlineCount: number;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, onlineCount: 0 });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      return;
    }

    const token = getAccessToken();
    const instance = io(API_URL, {
      auth: { token },
      withCredentials: true,
    });

    instance.on("presence:count", (count: number) => setOnlineCount(count));

    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.disconnect();
    };
    // Reconnect whenever the logged-in user changes; the access token is
    // read at connect time from the same in-memory store api/client.ts uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, onlineCount }}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
