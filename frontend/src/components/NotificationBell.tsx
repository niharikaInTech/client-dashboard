import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "../hooks/useNotifications";

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn-secondary" onClick={() => setOpen((o) => !o)}>
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <button className="btn btn-secondary" style={{ padding: "2px 8px" }} onClick={markAllRead}>
              Mark all read
            </button>
          </div>

          {notifications.length === 0 && (
            <div style={{ color: "var(--text-dim)", fontSize: 13, padding: 8 }}>No notifications yet.</div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.isRead ? "" : "unread"}`}
              onClick={() => !n.isRead && markRead(n.id)}
            >
              <div>{n.message}</div>
              <div className="feed-time">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
