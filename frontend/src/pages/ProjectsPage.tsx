import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Client, Project, User } from "../types";

export function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);

  const canCreate = user?.role === "ADMIN" || user?.role === "PM";

  function reload() {
    api.get<Project[]>("/projects").then((res) => setProjects(res.data));
  }

  useEffect(() => {
    reload();
    if (canCreate) {
      api.get<Client[]>("/clients").then((res) => setClients(res.data));
      if (user?.role === "ADMIN") {
        api.get<User[]>("/users", { params: { role: "PM" } }).then((res) => setManagers(res.data));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Projects</h2>
        {canCreate && (
          <button className="btn" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "New project"}
          </button>
        )}
      </div>

      {showForm && (
        <NewProjectForm
          clients={clients}
          managers={managers}
          isAdmin={user?.role === "ADMIN"}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      <div className="card">
        {projects.length === 0 && <div className="task-meta">No projects yet.</div>}
        {projects.map((p) => (
          <div key={p.id} className="task-row">
            <Link className="task-title" to={`/projects/${p.id}`}>
              <div className="task-title-main">{p.name}</div>
              <div className="task-meta">
                {p.client?.name} · managed by {p.manager?.name} · {p._count?.tasks ?? 0} tasks
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewProjectForm({
  clients,
  managers,
  isAdmin,
  onCreated,
}: {
  clients: Client[];
  managers: User[];
  isAdmin: boolean;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/projects", { name, clientId, managerId: isAdmin ? managerId : undefined });
      onCreated();
    } catch {
      setError("Could not create the project. Check the fields and try again.");
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }} onSubmit={handleSubmit}>
      <input className="input" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
        <option value="">Select client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {isAdmin && (
        <select value={managerId} onChange={(e) => setManagerId(e.target.value)} required>
          <option value="">Assign to PM</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
      <button className="btn" type="submit">
        Create
      </button>
      {error && <div className="error-text">{error}</div>}
    </form>
  );
}
