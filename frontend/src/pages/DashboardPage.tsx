import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { ActivityFeedList } from "../components/ActivityFeedList";
import { TaskList } from "../components/TaskList";
import { TaskFilterBar } from "../components/TaskFilterBar";
import { useSearchParams } from "react-router-dom";
import { Task } from "../types";

interface AdminData {
  role: "ADMIN";
  totalProjects: number;
  tasksByStatus: Record<string, number>;
  overdueCount: number;
  onlineUsers: number;
}

interface PMData {
  role: "PM";
  projects: { id: string; name: string; _count: { tasks: number } }[];
  tasksByPriority: Record<string, number>;
  upcomingDueThisWeek: Task[];
}

interface DevData {
  role: "DEVELOPER";
  tasks: Task[];
}

type DashboardData = AdminData | PMData | DevData;

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const events = useActivityFeed();
  const [params] = useSearchParams();

  function reload() {
    api.get<DashboardData>("/dashboard").then((res) => setData(res.data));
  }

  useEffect(reload, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="two-col">
      <div>
        {data.role === "ADMIN" && <AdminView data={data} />}
        {data.role === "PM" && <PMView data={data} />}
        {data.role === "DEVELOPER" && <DevView data={data} params={params} onChanged={reload} />}
      </div>
      <div className="card">
        <div className="section-title">
          {user?.role === "ADMIN" ? "Global activity" : user?.role === "PM" ? "Your projects' activity" : "Your task activity"}
        </div>
        <ActivityFeedList events={events} showProject />
      </div>
    </div>
  );
}

function AdminView({ data }: { data: AdminData }) {
  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{data.totalProjects}</div>
          <div className="stat-label">Total projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overdueCount}</div>
          <div className="stat-label">Overdue tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.onlineUsers}</div>
          <div className="stat-label">Users online now</div>
        </div>
      </div>
      <div className="card">
        <div className="section-title">Tasks by status</div>
        {Object.entries(data.tasksByStatus).map(([status, count]) => (
          <div key={status} className="task-row">
            <div className="task-title">{status.replace("_", " ")}</div>
            <div>{count}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function PMView({ data }: { data: PMData }) {
  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Your projects</div>
        {data.projects.map((p) => (
          <div key={p.id} className="task-row">
            <Link className="task-title" to={`/projects/${p.id}`}>
              {p.name}
            </Link>
            <div className="task-meta">{p._count.tasks} tasks</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title">Tasks by priority</div>
        {Object.entries(data.tasksByPriority).map(([priority, count]) => (
          <div key={priority} className="task-row">
            <div className="task-title">{priority}</div>
            <div>{count}</div>
          </div>
        ))}
      </div>
      <div className="section-title">Due this week</div>
      <TaskList tasks={data.upcomingDueThisWeek} showProject />
    </>
  );
}

function DevView({ data, params, onChanged }: { data: DevData; params: URLSearchParams; onChanged: () => void }) {
  const status = params.get("status");
  const priority = params.get("priority");
  const dueFrom = params.get("dueFrom");
  const dueTo = params.get("dueTo");

  const filtered = data.tasks.filter((t) => {
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (dueFrom && (!t.dueDate || new Date(t.dueDate) < new Date(dueFrom))) return false;
    if (dueTo && (!t.dueDate || new Date(t.dueDate) > new Date(dueTo))) return false;
    return true;
  });

  return (
    <>
      <div className="section-title">Your tasks</div>
      <TaskFilterBar />
      <TaskList tasks={filtered} showProject canEditStatus={() => true} onChanged={onChanged} />
    </>
  );
}
