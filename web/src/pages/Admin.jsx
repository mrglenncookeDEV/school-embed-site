import { useEffect, useState } from "react";
import { getHouseById } from "../config/houses";

export default function Admin() {
  const [entries, setEntries] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadEntries = async () => {
    setLoadingEntries(true);
    setError("");
    try {
      const response = await fetch("/api/entries?week=current");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load entries");
      }
      setEntries(payload.entries);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingEntries(false);
    }
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const response = await fetch("/api/audit?limit=50");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load audit log");
      }
      setAudit(payload.audit);
    } catch (err) {
      setActionMessage(err.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadEntries();
    loadAudit();
  }, []);

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Delete this entry permanently?");
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/entries/${id}?actorEmail=admin@school.local`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete entry");
      }
      setActionMessage("Entry deleted");
      await loadEntries();
      await loadAudit();
    } catch (err) {
      setActionMessage(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-bold text-slate-900">Manage entries</h1>
        <p className="text-sm text-slate-600">Review this week’s submissions and audit trail.</p>
      </div>

      {actionMessage && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
          {actionMessage}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 px-4 text-xs uppercase tracking-[0.4em] text-slate-500">Submissions</h2>
        {loadingEntries ? (
          <p className="px-4 text-sm text-slate-500">Loading entries…</p>
        ) : error ? (
          <p className="px-4 text-sm text-rose-600">{error}</p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-auto text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">House</th>
                  <th className="px-3 py-2">Points</th>
                  <th className="px-3 py-2">Submitted by</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => {
                  const houseId = entry.house_id || entry.houseId;
                  const houseMeta = getHouseById(houseId);
                  const houseColor = houseMeta?.color ?? entry.house_color ?? "#94a3b8";
                  const HouseIcon = houseMeta?.icon;
                  const houseLabel = houseMeta?.name ?? entry.house_name;
                  return (
                    <tr key={entry.id}>
                      <td className="px-3 py-3 font-semibold text-slate-900">{entry.class_name}</td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: houseColor }}
                          />
                          <span className="flex items-center gap-2 text-slate-700">
                            {HouseIcon && (
                              <HouseIcon className="h-4 w-4" color={houseColor} />
                            )}
                            {houseLabel}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{entry.points}</td>
                      <td className="px-3 py-3 text-slate-600">{entry.submitted_by_email}</td>
                      <td className="px-3 py-3 text-slate-600">{entry.entry_date}</td>
                      <td className="px-3 py-3 text-slate-600">{entry.notes || "—"}</td>
                      <td className="px-3 py-3">
                        <button
                          disabled={deletingId === entry.id}
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-600 transition hover:text-rose-400 disabled:text-slate-400"
                        >
                          {deletingId === entry.id ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Audit log</p>
            <p className="text-lg font-semibold text-slate-900">Recent actions</p>
          </div>
          {loadingAudit && <p className="text-sm text-slate-500">Loading…</p>}
        </div>
        <div className="mt-4 space-y-3">
          {loadingAudit ? (
            <p className="text-sm text-slate-500">Listening for events…</p>
          ) : audit.length === 0 ? (
            <p className="text-sm text-slate-600">No audit events yet.</p>
          ) : (
            audit.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                  <span>{event.action}</span>
                  <span>{new Date(event.created_at).toLocaleString()}</span>
                </div>
                <p className="font-semibold text-slate-900">{event.actor_email}</p>
                <p className="text-xs text-slate-500">
                  Target: {event.target_type} {event.target_id ?? "—"}
                </p>
                {event.meta && (
                  <pre className="mt-2 max-w-full overflow-auto text-[0.65rem] text-slate-500">
                    {JSON.stringify(event.meta)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
