import { FormEvent, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useActivityFeed } from "../hooks/useActivityFeed";
import { ActivityFeedList } from "../components/ActivityFeedList";
import { TaskFilterBar } from "../components/TaskFilterBar";
import { TaskList } from "../components/TaskList";
import { Project, Task, User } from "../types";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [params] = useSearchParams();
  const events = useActivityFeed(id);

  const canManage = user?.role === "ADMIN" || (user?.role === "PM" && project?.managerId === user.id);

  function reloadTasks() {
    api
      .get<Task[]>("/tasks", { params: { projectId: id, ...Object.fromEntries(params) } })
      .then((res) => setTasks(res.data));
  }

  useEffect(() => {
    api.get<Project>(`/projects/${id}`).then((res) => setProject(res.data));
  }, [id]);

  useEffect(() => {
    reloadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, params.toString()]);

  useEffect(() => {
    if (user?.role === "ADMIN" || user?.role === "PM") {
      api.get<User[]>("/users", { params: { role: "DEVELOPER" } }).then((res) => setDevelopers(res.data));
    }
  }, [user]);

  if (!project) return <div>Loading...</div>;

  return (
    <div className="two-col">
      <div>
        <h2 style={{ marginBottom: 4 }}>{project.name}</h2>
        <div className="task-meta" style={{ marginBottom: 16 }}>
          {project.client?.name} · managed by {project.manager?.name}
        </div>

        {canManage && (
          <div style={{ marginBottom: 16 }}>
            <button className="btn" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "New task"}
            </button>
          </div>
        )}

        {showForm && (
          <NewTaskForm
            projectId={project.id}
            developers={developers}
            onCreated={() => {
              setShowForm(false);
              reloadTasks();
            }}
          />
        )}

        <TaskFilterBar />
        <TaskList
          tasks={tasks}
          onChanged={reloadTasks}
          canEditStatus={(task) =>
            user?.role === "ADMIN" || (user?.role === "PM" && canManage) || task.assigneeId === user?.id
          }
        />
      </div>

      <div className="card">
        <div className="section-title">Live activity</div>
        <ActivityFeedList events={events} />
      </div>
    </div>
  );
}

function NewTaskForm({
  projectId,
  developers,
  onCreated,
}: {
  projectId: string;
  developers: User[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/tasks", {
        projectId,
        title,
        assigneeId: assigneeId || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      });
      setTitle("");
      onCreated();
    } catch {
      setError("Could not create the task.");
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }} onSubmit={handleSubmit}>
      <input className="input" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
        <option value="">Unassigned</option>
        {developers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <button className="btn" type="submit">
        Create task
      </button>
      {error && <div className="error-text">{error}</div>}
    </form>
  );
}
