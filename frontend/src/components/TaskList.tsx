import { format } from "date-fns";
import { Task, TaskStatus } from "../types";
import { StatusBadge, PriorityBadge, OverdueBadge } from "./Badges";
import { api } from "../api/client";

interface Props {
  tasks: Task[];
  showProject?: boolean;
  onChanged?: () => void;
  canEditStatus?: (task: Task) => boolean;
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW", "TODO"],
  IN_REVIEW: ["DONE", "IN_PROGRESS"],
  DONE: [],
};

export function TaskList({ tasks, showProject, onChanged, canEditStatus }: Props) {
  async function changeStatus(taskId: string, status: TaskStatus) {
    await api.patch(`/tasks/${taskId}/status`, { status });
    onChanged?.();
  }

  if (tasks.length === 0) {
    return <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No tasks match these filters.</div>;
  }

  return (
    <div className="card">
      {tasks.map((task) => {
        const editable = canEditStatus ? canEditStatus(task) : true;
        return (
          <div className="task-row" key={task.id}>
            <div className="task-title">
              <div className="task-title-main">{task.title}</div>
              <div className="task-meta">
                {showProject && task.project ? `${task.project.name} · ` : ""}
                {task.assignee ? task.assignee.name : "Unassigned"}
                {task.dueDate ? ` · due ${format(new Date(task.dueDate), "MMM d")}` : ""}
              </div>
            </div>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
            {task.isOverdue && <OverdueBadge />}
            {editable && NEXT_STATUS[task.status].length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && changeStatus(task.id, e.target.value as TaskStatus)}
              >
                <option value="">Move to...</option>
                {NEXT_STATUS[task.status].map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
