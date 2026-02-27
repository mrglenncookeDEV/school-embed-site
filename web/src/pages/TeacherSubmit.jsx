import { useEffect, useMemo, useState } from "react";

const AWARD_OPTIONS = [
  "General Award",
  "Be Kind",
  "Be Responsible",
  "Be Safe",
  "Be Ready",
];
const CATEGORY_PALETTE = ["#60a5fa", "#f472b6", "#34d399", "#facc15", "#a78bfa"];
const CATEGORY_COLOR_MAP = AWARD_OPTIONS.reduce((acc, category, idx) => {
  acc[category] = CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
  return acc;
}, {});

const createInitialCategoryPoints = () =>
  AWARD_OPTIONS.reduce((acc, category) => ({ ...acc, [category]: "0" }), {});

const initialForm = {
  classId: "",
  houseId: "",
  notes: "",
  submittedByEmail: "",
};

export default function TeacherSubmit({ entry, onSuccess } = {}) {
  const [form, setForm] = useState(initialForm);
  const [classes, setClasses] = useState([]);
  const [houses, setHouses] = useState([]);
  const [countdownLabel, setCountdownLabel] = useState("");
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(true);
  const [categoryPoints, setCategoryPoints] = useState(createInitialCategoryPoints);
  const isEditing = Boolean(entry);

  useEffect(() => {
    const getNextFridayDeadlineUTC = (from = new Date()) => {
      const target = new Date(from);
      target.setUTCHours(14, 25, 0, 0);
      const day = target.getUTCDay(); // 0 Sun ... 5 Fri
      const diff = (5 - day + 7) % 7;
      target.setUTCDate(target.getUTCDate() + diff);
      if (diff === 0 && from > target) {
        target.setUTCDate(target.getUTCDate() + 7);
      }
      return target;
    };

    const getLastFridayDeadlineUTC = (from = new Date()) => {
      const target = new Date(from);
      target.setUTCHours(14, 25, 0, 0);
      const day = target.getUTCDay(); // 0 Sun ... 5 Fri
      const diff = day >= 5 ? day - 5 : day + 2; // days since last Friday
      target.setUTCDate(target.getUTCDate() - diff);
      if (from < target) {
        target.setUTCDate(target.getUTCDate() - 7);
      }
      return target;
    };

    const formatCountdown = (ms) => {
      if (ms <= 0) return "Deadline: Friday 14:25 GMT is here!";
      const totalSeconds = Math.floor(ms / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      if (days > 0) {
        return `Deadline: Friday 14:25 GMT in ${days}d ${hours}h ${minutes}m ${seconds}s`;
      }
      if (hours > 0) {
        return `Deadline: Friday 14:25 GMT in ${hours}h ${minutes}m ${seconds}s`;
      }
      if (minutes > 0) {
        return `Deadline: Friday 14:25 GMT in ${minutes}m ${seconds}s`;
      }
      return `Deadline: Friday 14:25 GMT in ${seconds}s`;
    };

    const update = () => {
      const now = new Date();
      const nextTarget = getNextFridayDeadlineUTC(now);
      const lastTarget = getLastFridayDeadlineUTC(now);
      const reopenTime = new Date(lastTarget);
      reopenTime.setUTCMinutes(reopenTime.getUTCMinutes() + 50);
      const passedWindow = now > lastTarget && now < reopenTime;
      setDeadlinePassed(passedWindow);
      setCountdownLabel(
        passedWindow ? "DEADLINE PASSED (reopens at 15:15 GMT)" : formatCountdown(nextTarget - now)
      );
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const formDisabled = deadlinePassed;
  const inputClass =
    "w-full rounded-2xl border border-slate-700 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none";
  const inputFill = formDisabled ? "bg-slate-100 text-slate-500" : "bg-white";
  const compactInputClass = `border border-slate-700 rounded-md px-3 py-2 text-slate-900 ${formDisabled ? "bg-slate-100 text-slate-500" : "bg-white"}`;

  useEffect(() => {
    if (!entry) {
      setForm(initialForm);
      setCategoryPoints(createInitialCategoryPoints());
      return;
    }

    const nextCategoryPoints = createInitialCategoryPoints();
    const entryCategory = AWARD_OPTIONS.includes(entry.award_category)
      ? entry.award_category
      : AWARD_OPTIONS[0];
    const entryPoints = Number(entry.points);
    nextCategoryPoints[entryCategory] = String(
      Number.isInteger(entryPoints) && entryPoints > 0 ? entryPoints : 0
    );

    setForm({
      classId: entry.class_id ?? entry.classId ?? "",
      houseId: entry.house_id ?? entry.houseId ?? "",
      notes: entry.notes ?? "",
      submittedByEmail:
        entry.submitted_by_email ?? entry.submittedByEmail ?? "",
    });
    setCategoryPoints(nextCategoryPoints);
  }, [entry]);

  useEffect(() => {
    let isMounted = true;

    const hydrateEditCategoryPoints = async () => {
      if (!entry) return;
      const classId = String(entry.class_id ?? entry.classId ?? "");
      const houseId = String(entry.house_id ?? entry.houseId ?? "");
      if (!classId || !houseId) return;

      try {
        const response = await fetch(`${import.meta.env.BASE_URL}api/entries?week=current`);
        if (!response.ok) return;
        const data = await response.json();
        const rows = Array.isArray(data.entries) ? data.entries : [];
        const matchingRows = rows.filter((row) => {
          const rowClassId = String(row.class_id ?? row.classId ?? "");
          const rowHouseId = String(row.house_id ?? row.houseId ?? "");
          return rowClassId === classId && rowHouseId === houseId;
        });

        if (!isMounted || matchingRows.length === 0) return;

        const nextCategoryPoints = createInitialCategoryPoints();
        matchingRows.forEach((row) => {
          const category = row.award_category;
          if (!AWARD_OPTIONS.includes(category)) return;
          const points = Number(row.points);
          nextCategoryPoints[category] = String(
            Number.isInteger(points) && points > 0 ? points : 0
          );
        });
        setCategoryPoints(nextCategoryPoints);
      } catch {
        // Keep local defaults if fetch fails.
      }
    };

    hydrateEditCategoryPoints();
    return () => {
      isMounted = false;
    };
  }, [entry]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [classesRes, housesRes, weekRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}api/classes`),
          fetch(`${import.meta.env.BASE_URL}api/houses`),
          fetch(`${import.meta.env.BASE_URL}api/weeks/current`),
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
            // deadlineAt is available for future use (e.g., display or analytics).
          }
        }
      } catch {
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

  const categoryTotals = useMemo(
    () =>
      AWARD_OPTIONS.reduce((acc, category) => {
        const raw = Number(categoryPoints[category]);
        const value = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(500, Math.trunc(raw)));
        return { ...acc, [category]: value };
      }, {}),
    [categoryPoints]
  );
  const totalPoints = AWARD_OPTIONS.reduce(
    (sum, category) => sum + (categoryTotals[category] || 0),
    0
  );
  const hasPointsToSubmit = totalPoints > 0;
  const isSubmitting = status.type === "loading";
  const submitDisabled =
    isSubmitting ||
    !form.classId ||
    !form.houseId ||
    !hasPointsToSubmit ||
    !form.submittedByEmail;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "loading", message: "Saving submission…" });

    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/entries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          points: totalPoints,
          award_category: "General Award",
          category_points: categoryTotals,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Unable to save entry (HTTP ${response.status})`);
      }

      setStatus({ type: "success", message: "Points submitted!" });
      setForm((prev) => ({
        ...prev,
        notes: "",
      }));
      setCategoryPoints(createInitialCategoryPoints());
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
    <section className="flex min-h-full w-full flex-col pb-0">
      <div
        className="relative flex w-full shrink-0 flex-wrap items-center gap-3 bg-[#1f2aa6] px-6 py-4 text-white"
      >
        <img
          src={`${import.meta.env.BASE_URL}favicon.png`}
          alt="House Points logo"
          className="h-14 w-14 sm:h-16 sm:w-16 object-contain"
          loading="lazy"
        />
        <div className="space-y-2">
          <p
            className={`text-xs font-semibold uppercase tracking-tight sm:tracking-wide ${
              deadlinePassed ? "text-rose-200" : "text-white/80"
            }`}
          >
            {countdownLabel}
          </p>
          <h1 className="text-2xl font-thin text-white">
            {isEditing ? "Edit submission" : "Log house points"}
          </h1>
          {isEditing && (
            <p className="text-sm text-white/80">
              Editing an existing record — submit points to save changes.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        {status.message && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${status.type === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
              }`}
          >
            {status.message}
          </div>
        )}

        <div
          className="mt-2 flex flex-1 flex-col rounded-3xl rounded-b-none border border-[#3b5bdb]/55 p-4 shadow-sm ring-1 ring-[#1d4ed8]/35"
          style={{
            backgroundImage:
              "radial-gradient(rgba(71,85,105,0.05) 0.5px, transparent 0.65px), linear-gradient(135deg, #fbfcfe 0%, #f3f6fb 56%, #e8edf5 100%)",
            backgroundSize: "11px 11px, 100% 100%",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.78), inset 0 -1px 0 rgba(30,64,175,0.22), 0 0 0 1px rgba(59,130,246,0.18)",
          }}
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading form…</p>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Class
                <div className="relative">
                  <select
                    value={form.classId}
                    onChange={(event) => handleClassChange(event.target.value)}
                    disabled={formDisabled}
                    className={`${inputClass} ${inputFill} rounded-full appearance-none pr-10`}
                  >
                    <option value="">Select class</option>
                    {classes.map((klass) => (
                      <option key={klass.id} value={klass.id}>
                        {klass.name} · {klass.teacherDisplayName}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    ▼
                  </span>
                </div>
              </label>

              <label className="space-y-1 text-sm font-semibold text-slate-700">
                House
                <div className="relative">
                  <select
                    value={form.houseId}
                    onChange={(event) => setForm({ ...form, houseId: event.target.value })}
                    disabled={formDisabled}
                    className={`${inputClass} ${inputFill} rounded-full appearance-none pr-10`}
                  >
                    <option value="">Select house</option>
                    {houses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    ▼
                  </span>
                </div>
              </label>
            </div>

            <div className="flex flex-nowrap items-end gap-3">
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">
                    Award points by category
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {AWARD_OPTIONS.map((category) => {
                    const color = CATEGORY_COLOR_MAP[category] || "#94a3b8";
                    return (
                      <label
                        key={category}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-700"
                        style={{
                          borderColor: `${color}80`,
                          background: formDisabled ? "#f8fafc" : `${color}1a`,
                        }}
                      >
                        <span className="font-semibold" style={{ color }}>
                          {category}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="500"
                          step="1"
                          value={categoryPoints[category]}
                          onChange={(event) =>
                            setCategoryPoints((prev) => ({
                              ...prev,
                              [category]: event.target.value,
                            }))
                          }
                          disabled={formDisabled}
                          className={`${compactInputClass} w-[88px] text-center font-semibold`}
                          style={{
                            borderColor: color,
                            backgroundColor: formDisabled ? "#f1f5f9" : "#ffffff",
                          }}
                          required
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Notes
              <textarea
                rows="8"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                disabled={formDisabled}
                className={`${inputClass} ${inputFill}`}
              />
            </label>

            <label className="space-y-1 text-sm font-semibold text-slate-700">
              Your email
              <input
                type="email"
                value={form.submittedByEmail}
                onChange={(event) => setForm({ ...form, submittedByEmail: event.target.value })}
                disabled={formDisabled}
                className={`${inputClass} ${inputFill}`}
              />
            </label>

            <div
              className="rounded-3xl border px-4 py-4 text-center shadow-md"
              style={{
                borderColor: "#7c3aed",
                background:
                  "radial-gradient(circle at top left, rgba(96,165,250,0.25), transparent 48%), linear-gradient(135deg, #eef2ff 0%, #e0e7ff 45%, #ddd6fe 100%)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-indigo-700">
                Total points to submit
              </p>
              <p className="mt-1 text-4xl font-black leading-none text-indigo-900">
                {totalPoints}
                <span className="ml-2 text-lg font-bold align-middle text-indigo-700">pts</span>
              </p>
            </div>

            <button
              disabled={submitDisabled || formDisabled}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition ${submitDisabled || formDisabled ? "bg-slate-400" : "bg-emerald-600 hover:bg-emerald-500"
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
          <div className="mt-2 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-5 text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-200">Current House</p>
            <p className="text-2xl font-semibold">{housesById[form.houseId].name}</p>
            <p className="text-sm text-slate-200">Stay focused, submit by Friday 14:25 GMT.</p>
          </div>
        )}
      </div>
    </section>
  );
}
