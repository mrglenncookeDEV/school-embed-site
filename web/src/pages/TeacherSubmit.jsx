import { useEffect, useMemo, useState } from "react";

const AWARD_OPTIONS = [
  "General Award",
  "Be Kind",
  "Be Responsible",
  "Be Safe",
  "Be Ready",
];

const initialForm = {
  classId: "",
  houseId: "",
  points: "0",
  notes: "",
  submittedByEmail: "",
};

export default function TeacherSubmit({ entry, onSuccess } = {}) {
  const [form, setForm] = useState(initialForm);
  const [classes, setClasses] = useState([]);
  const [houses, setHouses] = useState([]);
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(true);
  const [awardCategory, setAwardCategory] = useState("General Award");
  const isEditing = Boolean(entry);

  useEffect(() => {
    if (!entry) {
      setForm(initialForm);
      setAwardCategory("General Award");
      return;
    }

    setForm({
      classId: entry.class_id ?? entry.classId ?? "",
      houseId: entry.house_id ?? entry.houseId ?? "",
      points: entry.points !== undefined ? String(entry.points) : "0",
      notes: entry.notes ?? "",
      submittedByEmail:
        entry.submitted_by_email ?? entry.submittedByEmail ?? "",
    });
    setAwardCategory(entry.award_category ?? "General Award");
  }, [entry]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [classesRes, housesRes, weekRes] = await Promise.all([
          fetch("/api/classes"),
          fetch("/api/houses"),
          fetch("/api/weeks/current"),
        ]);

        if (!classesRes.ok || !housesRes.ok || !weekRes.ok) {
          throw new Error("Unable to load form data");
        }

        const [{ classes }, { houses }, weekData] = await Promise.all([
          classesRes.json(),
          housesRes.json(),
          weekRes.json(),
        ]);

        if (isMounted) {
          setClasses(classes);
          setHouses(houses);
          if (weekData.deadlineAt) {
            const when = new Date(weekData.deadlineAt);
            setDeadline(
              `Deadline: ${when.toLocaleString("en-US", {
                weekday: "long",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
                hour12: false,
              })} UTC`
            );
          }
        }
      } catch (error) {
        if (isMounted) {
          setStatus({ type: "error", message: "Unable to load form data" });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const numericPoints = Number(form.points);
  const isSubmitting = status.type === "loading";
  const submitDisabled =
    isSubmitting ||
    !form.classId ||
    !form.houseId ||
    Number.isNaN(numericPoints) ||
    numericPoints <= 0 ||
    !form.submittedByEmail;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "loading", message: "Saving submission…" });

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          points: Number(form.points),
          award_category: awardCategory,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to save entry");
      }

      setStatus({ type: "success", message: "Points submitted!" });
      setForm((prev) => ({
        ...prev,
        points: "0",
        notes: "",
      }));
      setAwardCategory("General Award");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("scoreboard:refresh"));
      }
      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const housesById = useMemo(
    () => houses.reduce((acc, house) => ({ ...acc, [house.id]: house }), {}),
    [houses]
  );

  const handleClassChange = (value) => {
    const selectClass = classes.find((klass) => String(klass.id) === value);
    setForm((prev) => ({
      ...prev,
      classId: value,
      submittedByEmail:
        value === ""
          ? ""
          : selectClass?.teacherEmail ?? prev.submittedByEmail,
    }));
  };

  return (
    <section className="flex w-full flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <img
              src="/favicon.png"
              alt="House Points logo"
              className="h-12 w-12 sm:h-24 sm:w-24 object-contain"
              loading="lazy"
            />
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Teacher Submit</p>
              <h1 className="text-3xl font-bold text-slate-900">
                {isEditing ? "Edit submission" : "Log house points"}
              </h1>
              {isEditing && (
                <p className="text-sm text-slate-600">
                  Editing an existing record — submit points to save changes.
                </p>
              )}
              {deadline && <p className="text-sm text-slate-600">{deadline}</p>}
            </div>
          </div>

      {status.message && (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            status.type === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading form…</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Class
                <select
                  value={form.classId}
                  onChange={(event) => handleClassChange(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
                >
                <option value="">Select class</option>
                {classes.map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      {klass.name} · {klass.teacherDisplayName}
                    </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-semibold text-slate-700">
              House
              <select
                value={form.houseId}
                onChange={(event) => setForm({ ...form, houseId: event.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
              >
                <option value="">Select house</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Award Category</label>
                <select
                  value={awardCategory}
                  onChange={(event) => setAwardCategory(event.target.value)}
                  className="border rounded-md px-3 py-2 bg-white dark:bg-slate-900 text-slate-900"
                >
                  {AWARD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Points</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={form.points}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, points: event.target.value }))
                  }
                  className="border rounded-md px-3 py-2 bg-slate-50 text-slate-900 text-center w-full max-w-[120px] md:max-w-[140px] mx-auto md:mx-0"
                  required
                />
              </div>
            </div>

            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Notes
              <textarea
                rows="3"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Your email
              <input
                type="email"
                value={form.submittedByEmail}
                onChange={(event) => setForm({ ...form, submittedByEmail: event.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:border-slate-400 focus:outline-none"
              />
            </label>

            <button
              disabled={submitDisabled}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition ${
                submitDisabled ? "bg-slate-400" : "bg-slate-900 hover:bg-slate-800"
              }`}
            >
              {isSubmitting
                ? "Saving…"
                : isEditing
                ? "Save changes"
                : "Submit points"}
            </button>

            {status.type === "error" && (
              <p className="text-xs text-rose-600">{status.message}</p>
            )}
          </form>
        )}
      </div>

      {form.houseId && housesById[form.houseId] && (
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-5 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-200">Current House</p>
          <p className="text-2xl font-semibold">{housesById[form.houseId].name}</p>
          <p className="text-sm text-slate-200">Stay focused, submit by Friday noon.</p>
        </div>
      )}
    </section>
  );
}
