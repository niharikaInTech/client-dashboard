import { Priority, TaskStatus, PRIORITY_LABEL, STATUS_LABEL } from "../types";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge badge-${priority.toLowerCase()}`}>{PRIORITY_LABEL[priority]}</span>;
}

export function OverdueBadge() {
  return <span className="badge badge-overdue">Overdue</span>;
}
