import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { getHouseById } from "../config/houses";

export default function Admin() {
  const [entries, setEntries] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState("entries");

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
      setConfirmDeleteId(null);
    }
  };

  const requestDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const openTeacherSubmitModalForEntry = (entry) => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("teacherSubmit:open", {
        detail: { entry },
      })
    );
  };

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-bold text-slate-900">
          {activeTab === "entries" ? "Manage Entries" : "Manage Setup"}
        </h1>
        <p className="text-sm text-slate-600">
          {activeTab === "entries"
            ? "Review this week’s submissions and audit trail."
            : "Configure school houses, classes, and site settings."}
        </p>
      </div>

      <div className="mb-6 border-b border-slate-200 dark:border-white/10">
        <div className="flex gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("entries")}
            className={`pb-3 border-b-2 transition ${activeTab === "entries"
              ? "border-slate-900 dark:border-white"
              : "border-transparent text-slate-500"
              }`}
          >
            Manage Entries
          </button>

          <button
            onClick={() => setActiveTab("setup")}
            className={`pb-3 border-b-2 transition ${activeTab === "setup"
              ? "border-slate-900 dark:border-white"
              : "border-transparent text-slate-500"
              }`}
          >
            Manage Setup
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
          {actionMessage}
        </div>
      )}

      {activeTab === "entries" && (
        <>
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
                      <th className="px-3 py-2">Category</th>
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
                          <td className="px-3 py-3 text-slate-600">{entry.award_category || "General"}</td>
                          <td className="px-3 py-3 text-slate-600">{entry.submitted_by_email}</td>
                          <td className="px-3 py-3 text-slate-600">{entry.entry_date}</td>
                          <td className="px-3 py-3 text-slate-600">{entry.notes || "—"}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => openTeacherSubmitModalForEntry(entry)}
                                className="p-1.5 text-slate-500 transition hover:text-slate-900"
                                title="Edit Entry"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                disabled={deletingId === entry.id}
                                onClick={() => requestDelete(entry.id)}
                                className="p-1.5 text-rose-600 transition hover:text-rose-800 disabled:opacity-30"
                                title="Delete Entry"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
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
            <div className="mt-4">
              <div
                className="space-y-3 overflow-y-auto pr-2"
                style={{ maxHeight: "calc(100vh - 280px)" }}
              >
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
          </div>
        </>
      )}

      {activeTab === "setup" && (
        <div className="space-y-6">
          {[
            "Manage Classes",
            "Manage Houses",
            "Manage Pupils",
            "Manage Users",
            "Manage Term Dates",
            "Advanced Settings",
          ].map((title) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200 dark:border-white/10 p-4"
            >
              <h3 className="text-lg font-semibold mb-3">{title}</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-200 dark:border-white/10">
                      <th className="py-2">Placeholder</th>
                      <th className="py-2">Column</th>
                      <th className="py-2">Structure</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-slate-500">
                      <td className="py-2">—</td>
                      <td className="py-2">—</td>
                      <td className="py-2">Setup UI coming next</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-left shadow-2xl dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Mrs Cooke wants to check
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              Delete this entry permanently?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-rose-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
