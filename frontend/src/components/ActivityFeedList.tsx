import { formatDistanceToNow } from "date-fns";
import { ActivityEvent, STATUS_LABEL } from "../types";

function describe(event: ActivityEvent): string {
  const from = event.fromStatus ? STATUS_LABEL[event.fromStatus] : "nothing";
  const to = STATUS_LABEL[event.toStatus];
  return `${event.userName} moved "${event.taskTitle}" from ${from} → ${to}`;
}

export function ActivityFeedList({ events, showProject }: { events: ActivityEvent[]; showProject?: boolean }) {
  if (events.length === 0) {
    return <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No activity yet.</div>;
  }

  return (
    <div className="feed-panel">
      {events.map((event) => (
        <div key={event.id} className="feed-item">
          <div>{describe(event)}</div>
          <div className="feed-time">
            {showProject ? `${event.projectName} · ` : ""}
            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
          </div>
        </div>
      ))}
    </div>
  );
}
