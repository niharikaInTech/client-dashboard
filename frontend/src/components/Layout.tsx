import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { NotificationBell } from "./NotificationBell";

export function Layout() {
  const { user, logout } = useAuth();
  const { onlineCount } = useSocket();

  return (
    <div className="app-shell">
      <div className="navbar">
        <div className="navbar-links">
          <strong style={{ marginRight: 12 }}>Client Dashboard</strong>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/projects">Projects</NavLink>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {user?.role === "ADMIN" && (
            <span className="task-meta">
              <span className="presence-dot" />
              {onlineCount} online
            </span>
          )}
          <span className="task-meta">
            {user?.name} · {user?.role}
          </span>
          <NotificationBell />
          <button className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
