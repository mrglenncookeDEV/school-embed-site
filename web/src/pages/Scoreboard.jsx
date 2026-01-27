import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ScoreboardContent({ showMissing = true, showTotalsPanel = true, minimal = false }) {
  const [scoreboard, setScoreboard] = useState({
    totalsThisWeek: [],
    totalsAllTime: [],
    lastUpdated: null,
  });
  const [missingClasses, setMissingClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingLoading, setMissingLoading] = useState(true);
  const [error, setError] = useState("");
  const [missingError, setMissingError] = useState("");
  const [classesCount, setClassesCount] = useState(null);
  const [classesError, setClassesError] = useState("");
  const [classesLoading, setClassesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadScoreboard = async () => {
      try {
        const response = await fetch("/api/scoreboard/current");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load scoreboard");
        }
        if (isMounted) {
          setScoreboard(payload);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadScoreboard();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showMissing) {
      setMissingClasses([]);
      setMissingLoading(false);
      return;
    }

    let isMounted = true;

    const loadMissing = async () => {
      try {
        const response = await fetch("/api/missing/current");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load missing submissions");
        }
        if (isMounted) {
          setMissingClasses(payload.classes);
        }
      } catch (err) {
        if (isMounted) {
          setMissingError(err.message);
        }
      } finally {
        if (isMounted) {
          setMissingLoading(false);
        }
      }
    };

    loadMissing();
    return () => {
      isMounted = false;
    };
  }, [showMissing]);

  useEffect(() => {
    let isMounted = true;
    const loadClasses = async () => {
      try {
        const response = await fetch("/api/classes");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load classes");
        }
        if (isMounted) {
          setClassesCount(payload.classes.length);
        }
      } catch (err) {
        if (isMounted) {
          setClassesError(err.message);
        }
      } finally {
        if (isMounted) {
          setClassesLoading(false);
        }
      }
    };

    loadClasses();
    return () => {
      isMounted = false;
    };
  }, []);

  const thisWeekTotal = useMemo(
    () => scoreboard.totalsThisWeek.reduce((acc, house) => acc + (house.points || 0), 0),
    [scoreboard.totalsThisWeek]
  );

  const allTimeTotal = useMemo(
    () => scoreboard.totalsAllTime.reduce((acc, house) => acc + (house.points || 0), 0),
    [scoreboard.totalsAllTime]
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!scoreboard.lastUpdated) {
      return "Not yet updated";
    }
    const when = new Date(scoreboard.lastUpdated);
    return when.toLocaleString("en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    });
  }, [scoreboard.lastUpdated]);

  const containerClasses = minimal ? "h-full" : "space-y-6";
  const leadingHouse = useMemo(() => {
    if (!scoreboard.totalsThisWeek.length) {
      return null;
    }
    return scoreboard.totalsThisWeek.reduce((best, house) => {
      if (!best || (house.points || 0) > (best.points || 0)) {
        return house;
      }
      return best;
    }, null);
  }, [scoreboard.totalsThisWeek]);

  const submissionsReceived =
    classesCount != null && missingClasses?.length != null
      ? Math.max(classesCount - missingClasses.length, 0)
      : null;
  const missingCount = missingClasses.length;
  const missingHeadline = missingLoading
    ? "Checking for outstanding submissions…"
    : missingError
    ? missingError
    : missingCount === 0
    ? "All classes submitted this week"
    : `${missingCount} class${missingCount === 1 ? "" : "es"} have not submitted this week`;

  return (
    <section className={`${containerClasses} w-full`}>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Live scoreboard</p>
        <h1 className="text-3xl font-bold text-slate-900">House totals</h1>
        <p className="text-sm text-slate-600">Updated: {lastUpdatedLabel}</p>
        {leadingHouse && (
          <p className="text-sm font-semibold text-emerald-700">
            🏆 {leadingHouse.name} is leading with {leadingHouse.points} pts
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-slate-500">This week</p>
          <p className="text-2xl">{thisWeekTotal} pts</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-slate-500">Last updated</p>
          <p className="text-base font-semibold text-slate-900">{lastUpdatedLabel}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-slate-500">Submissions</p>
          {classesLoading ? (
            <p className="text-base font-semibold text-slate-900">Loading…</p>
          ) : classesError ? (
            <p className="text-base font-semibold text-rose-600">{classesError}</p>
          ) : (
            <p className="text-base font-semibold text-slate-900">
              {submissionsReceived}/{classesCount} submitted
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading scoreboard…</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={scoreboard.totalsThisWeek}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(value) => `${value} pts`} />
                <Bar
                  dataKey="points"
                  radius={[16, 16, 0, 0]}
                  shape={(props) => {
                    const { x, y, width, height, payload } = props;
                    const color = payload.color || "#2563eb";
                    return <rect x={x} y={y} width={width} height={height} rx={16} fill={color} />;
                  }}
                >
                  <LabelList
                    dataKey="points"
                    position="top"
                    formatter={(value) => `${value} pts`}
                    style={{ fontSize: "0.65rem", fill: "#0f172a" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {showTotalsPanel && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-6 text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-200">This week total</p>
            <p className="text-4xl font-semibold">{thisWeekTotal} pts</p>
            <p className="text-sm text-slate-200">Keep adding points before Friday noon.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">All time</p>
            <p className="text-3xl font-semibold text-slate-900">{allTimeTotal} pts</p>
            <p className="text-sm text-slate-600">Historical performance across all weeks.</p>
          </div>
        </div>
      )}

      {showMissing && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-red-500">Missing submissions</p>
              <p className="text-lg font-semibold text-red-700">{missingHeadline}</p>
            </div>
            <span className="rounded-full border border-red-200 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-red-700">
              Weekly flag
            </span>
          </div>

          {missingLoading ? (
            <p className="mt-4 text-sm text-slate-600">Checking for outstanding submissions…</p>
          ) : missingError ? (
            <p className="mt-4 text-sm text-rose-600">{missingError}</p>
          ) : missingClasses.length === 0 ? (
            <p className="mt-4 text-sm text-red-700">Great job—no classes are missing yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {missingClasses.map((klass) => (
                <li
                  key={klass.id}
                  className="rounded-2xl border border-red-100 bg-white/80 px-4 py-3 shadow-sm"
                >
                  <p className="font-semibold text-red-700">{klass.name}</p>
                  <p className="text-xs text-red-500">
                    {klass.teacher_name} · {klass.teacher_email}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default function ScoreboardPage() {
  return <ScoreboardContent />;
}
