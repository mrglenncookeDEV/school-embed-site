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

export default function TeacherSubmit({ entry, onSuccess, onClose } = {}) {
  const [form, setForm] = useState(initialForm);
  const [classes, setClasses] = useState([]);
  const [houses, setHouses] = useState([]);
  const [deadline, setDeadline] = useState("");
  const [countdownLabel, setCountdownLabel] = useState("");
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(true);
  const [awardCategory, setAwardCategory] = useState("General Award");
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
      const nextMonday = new Date(lastTarget);
      nextMonday.setUTCDate(nextMonday.getUTCDate() + 3);
      nextMonday.setUTCHours(0, 0, 0, 0);
      const passedWindow = now > lastTarget && now < nextMonday;
      setDeadlinePassed(passedWindow);
      setCountdownLabel(
        passedWindow ? "DEADLINE PASSED" : formatCountdown(nextTarget - now)
      );
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const formDisabled = deadlinePassed;
  const inputClass =
    "w-full rounded-2xl border border-slate-700 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none";
  const inputFill = formDisabled ? "bg-slate-200 text-slate-500" : "bg-yellow-50";
  const compactInputClass = `border border-slate-700 rounded-md px-3 py-2 text-slate-900 ${formDisabled ? "bg-slate-200 text-slate-500" : "bg-yellow-50"}`;

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
            const when = new Date(weekData.deadlineAt);
            setDeadline(
              `Deadline: ${when.toLocaleString("en-US", {
                weekday: "long",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "GMT",
                hour12: false,
              })} GMT`
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
      const response = await fetch(`${import.meta.env.BASE_URL}api/entries`, {
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
    <section className="flex w-full flex-1 flex-col gap-2 pb-0">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-[#1f2aa6] px-4 py-3 text-white">
        <img
          src={`${import.meta.env.BASE_URL}favicon.png`}
          alt="House Points logo"
          className="h-14 w-14 sm:h-16 sm:w-16 object-contain"
          loading="lazy"
        />
        <div className="space-y-2">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.3em] ${
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-full px-3 py-1 text-xs font-semibold uppercase text-white transition bg-[linear-gradient(180deg,#fecaca_0%,#ef4444_55%,#b91c1c_100%)] hover:brightness-105 active:translate-y-[1px]"
          >
            Close
          </button>
        )}
      </div>

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

      <div className="flex flex-1 flex-col rounded-3xl rounded-b-none border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading form…</p>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                Class
                <select
                  value={form.classId}
                  onChange={(event) => handleClassChange(event.target.value)}
                  disabled={formDisabled}
                  className={`${inputClass} ${inputFill}`}
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
                  disabled={formDisabled}
                  className={`${inputClass} ${inputFill}`}
                >
                  <option value="">Select house</option>
                  {houses.map((house) => (
                    <option key={house.id} value={house.id}>
                      {house.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-nowrap items-end gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Award Category</label>
                <select
                  value={awardCategory}
                  onChange={(event) => setAwardCategory(event.target.value)}
                  disabled={formDisabled}
                  className={`${compactInputClass} w-full min-w-0`}
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
                  disabled={formDisabled}
                  className={`${compactInputClass} w-[108px] text-center border-4 border-sky-400`}
                  required
                />
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
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-5 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-200">Current House</p>
          <p className="text-2xl font-semibold">{housesById[form.houseId].name}</p>
          <p className="text-sm text-slate-200">Stay focused, submit by Friday 14:25 GMT.</p>
        </div>
      )}
    </section>
  );
}
