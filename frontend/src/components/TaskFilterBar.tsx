import { useSearchParams } from "react-router-dom";

// Filters live entirely in the URL's query string (?status=&priority=&dueFrom=&dueTo=)
// so a filtered view can be bookmarked or shared, per the spec.
export function TaskFilterBar() {
  const [params, setParams] = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="filter-bar">
      <select value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
        <option value="">All statuses</option>
        <option value="TODO">To Do</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="IN_REVIEW">In Review</option>
        <option value="DONE">Done</option>
      </select>

      <select value={params.get("priority") ?? ""} onChange={(e) => update("priority", e.target.value)}>
        <option value="">All priorities</option>
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>

      <input
        className="input"
        type="date"
        value={params.get("dueFrom")?.slice(0, 10) ?? ""}
        onChange={(e) => update("dueFrom", e.target.value ? new Date(e.target.value).toISOString() : "")}
      />
      <input
        className="input"
        type="date"
        value={params.get("dueTo")?.slice(0, 10) ?? ""}
        onChange={(e) => update("dueTo", e.target.value ? new Date(e.target.value).toISOString() : "")}
      />

      {(params.get("status") || params.get("priority") || params.get("dueFrom") || params.get("dueTo")) && (
        <button className="btn btn-secondary" onClick={() => setParams({}, { replace: true })}>
          Clear filters
        </button>
      )}
    </div>
  );
}
