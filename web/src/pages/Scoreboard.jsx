import confetti from "canvas-confetti";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flag, Trophy } from "lucide-react";
import { HOUSES, HOUSE_ORDER, resolveHouseKey } from "../config/houses";

const BAR_CHART_MARGIN = { top: 20, right: 30, left: 0, bottom: 60 };

const PLAYFUL_FONT = {
  fontFamily:
    '"Comic Sans MS", "Comic Neue", "Permanent Marker", "Luckiest Guy", cursive',
  fontWeight: 700,
};

const WEEK_TITLE_COLOR = "#0ea5e9";
const TERM_TITLE_COLOR = "#be185d";

const formatReadableDate = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const buildWeekRangeLabel = (week) => {
  const rawStart = week?.week_start ?? week?.weekStart ?? null;
  if (!rawStart) return null;
  const parsedStart = Date.parse(rawStart);
  const rawEnd =
    week?.week_end ??
    week?.weekEnd ??
    (Number.isNaN(parsedStart)
      ? null
      : new Date(parsedStart + 6 * 24 * 60 * 60 * 1000).toISOString());

  const formattedStart = formatReadableDate(rawStart);
  const formattedEnd = formatReadableDate(rawEnd);
  return formattedStart && formattedEnd
    ? `From ${formattedStart} to ${formattedEnd}`
    : formattedStart;
};

const formatTiedHouseNames = (names = []) => {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

const clamp01 = (value) => {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return 0;
  return Math.min(1, Math.max(0, num));
};

function ProgressTrack({
  title,
  rows = [],
  timeProgress = 0,
  disabled = false,
  placeholderText = "",
  footer = null,
  titleColor = "#94a3b8",
}) {
  const clampedTime = clamp01(timeProgress);
  const effectiveRows = useMemo(() => (disabled ? [] : rows), [disabled, rows]);

  const maxPoints = useMemo(() => {
    if (disabled) return 0;
    return Math.max(0, ...effectiveRows.map((r) => Number(r.points ?? 0)));
  }, [disabled, effectiveRows]);

  const markers = useMemo(() => {
    if (disabled) return [];
    return effectiveRows.map((house) => {
      const scoreProgress = maxPoints > 0 ? (house.points ?? 0) / maxPoints : 0;
      return {
        ...house,
        finalProgress: scoreProgress * clampedTime,
      };
    });
  }, [disabled, effectiveRows, maxPoints, clampedTime]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-[0.4em]"
        style={{ ...PLAYFUL_FONT, color: titleColor }}
      >
        {title}
      </p>

      <div className="relative h-28">
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-slate-400"
            style={{ width: `${clampedTime * 100}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 h-full rounded-full bg-white/70"
            style={{ width: `${(1 - clampedTime) * 100}%` }}
          />
        </div>
        <span
          className="absolute inset-y-0 w-[3px] bg-slate-700"
          style={{
            left: `${clampedTime * 100}%`,
            transform: "translateX(-50%)",
          }}
        />
        <Flag
          className="absolute -translate-y-full text-slate-700"
          size={16}
          style={{ left: `${clampedTime * 100}%`, transform: "translate(-50%,-50%)" }}
        />
        <div className="absolute inset-0">
          {disabled && markers.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {placeholderText || "Waiting for data…"}
            </div>
          ) : (
            markers.map((house, index) => {
              const Icon = house.icon;
              const labelAbove = index % 2 === 0;
              return (
                <div
                  key={house.houseKey}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ left: `${house.finalProgress * 100}%` }}
                >
                  <span
                    className={`
                      absolute inline-flex flex-col items-center
                      ${labelAbove ? "-top-10" : "top-12"}
                    `}
                  >
                    <span
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm whitespace-nowrap"
                    >
                      {house.name}
                    </span>
                    <span
                      className={`
                        absolute h-2 w-2 border border-slate-200 bg-white
                        ${labelAbove ? "top-full rotate-45" : "-top-1 -rotate-45"}
                      `}
                    />
                  </span>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full shadow-md ring-2 ring-white"
                    style={{ backgroundColor: house.color || "#2563eb" }}
                  >
                    {Icon ? <Icon className="h-5 w-5 text-white" /> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      {footer && <div className="mt-4 border-t border-slate-100 pt-4">{footer}</div>}
    </div>
  );
}

function HouseAxisTick({ x, y, payload, axisMetaMap = {} }) {
  const houseKey = payload?.value;
  const house = axisMetaMap[houseKey];
  const label = house?.name ?? houseKey ?? "";
  const Icon = house?.icon;
  const color = house?.color ?? "#0f172a";
  const pointsLabel = `${house?.points ?? 0} pts`;
  const playfulFont = PLAYFUL_FONT;

  return (
    <g transform={`translate(${x},${y + 18})`}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fill={color}
        fontSize="0.85rem"
        style={playfulFont}
      >
        {label}
      </text>
      {Icon && (
        <g transform="translate(-12, 8)">
          <circle cx={12} cy={12} r={12} fill={color} />
          <Icon
            width={16}
            height={16}
            color="#fff"
            style={{ transform: "translate(4px,4px)" }}
          />
        </g>
      )}
    <text
      x={0}
      y={48}
      textAnchor="middle"
      fill={color}
      style={playfulFont}
      fontSize="0.75rem"
    >
      {pointsLabel}
    </text>
    </g>
  );
}

function TopRoundedBar(props) {
  const {
    fill = "#2563eb",
    x,
    y,
    width,
    height,
    payload,
    leadingHouseKey,
    highlightHouseKeys = [],
  } = props;

  if (width <= 0 || height <= 0) return null;

  const radius = Math.min(18, height);
  const bottomY = y + height;
  const rightX = x + width;

  const highlightSet = new Set(highlightHouseKeys);
  const isLeader = payload?.houseKey === leadingHouseKey;
  const isHighlighted = highlightSet.has(payload?.houseKey);
  const showSmiley = isLeader || (highlightSet.size > 1 && isHighlighted);

  const path = `
    M ${x},${bottomY}
    L ${x},${y + radius}
    Q ${x},${y} ${x + radius},${y}
    L ${rightX - radius},${y}
    Q ${rightX},${y} ${rightX},${y + radius}
    L ${rightX},${bottomY}
    Z
  `;

  const centerX = x + width / 2;
  const smileyY = y + radius + 8;

  return (
    <g>
      <path
        d={path}
        fill={payload?.color ?? fill}
        style={showSmiley ? { animation: "bar-flash 1.2s ease-in-out" } : undefined}
      />

      {showSmiley && (
        <>
          <g transform={`translate(${centerX}, ${smileyY})`}>
            <circle r="11" fill="#facc15" />
            <ellipse cx="-4" cy="-3" rx="2" ry="3" fill="#000" />
            <ellipse cx="4" cy="-3" rx="2" ry="3" fill="#000" />
            <path
              d="M -6 2 Q 0 7 6 2"
              stroke="#000"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </>
      )}
    </g>
  );
}

const getCanonicalIdForRow = (row) => {
  const rawId = row.houseId ?? row.house_id ?? row.house ?? row.id;
  const canonical = resolveHouseKey(rawId);
  if (canonical) return canonical;

  const name = String(row.name ?? row.house_name ?? "").trim().toLowerCase();
  const match = Object.entries(HOUSES).find(
    ([, house]) => String(house?.name ?? "").toLowerCase() === name
  );
  if (!canonical && name) {
    console.warn("Unmapped house:", name, row);
  }
  return match?.[0];
};

const normalizeHouseRows = (rows = []) => {
  const byId = {};
  const unmatched = [];

  rows.forEach((row) => {
    const id = getCanonicalIdForRow(row);
    if (id) {
      byId[id] = row;
    } else {
      unmatched.push(row);
    }
  });

  const ordered = HOUSE_ORDER.map((houseId) => {
    const base = HOUSES[houseId] ?? {};
    const row = byId[houseId];

    return {
      houseKey: houseId,
      houseId,
      name: row?.name ?? base.name ?? String(houseId),
      color: row?.color ?? base.color ?? "#2563eb",
      icon: base.icon ?? null,
      points: Number(row?.points ?? 0),
    };
  });

  unmatched.forEach((row) => {
    ordered.push({
      houseKey: row.houseKey ?? row.houseId ?? row.house ?? row.id ?? row.name,
      houseId: row.houseId ?? row.house ?? row.id,
      name: row.name ?? "Unknown House",
      color: row.color ?? "#64748b",
      icon: null,
      points: Number(row.points ?? 0),
    });
  });

  return ordered;
};

const getLeadingHouseRow = (rows = []) => {
  if (!rows.length) return null;
  return rows.reduce((best, current) => {
    if (!best || Number(current.points ?? 0) > Number(best.points ?? 0)) {
      return current;
    }
    return best;
  }, null);
};

export function ScoreboardContent({ showMissing = true, showTotalsPanel = true, minimal = false }) {
  const [scoreboard, setScoreboard] = useState({
    totalsThisWeek: [],
    totalsAllTime: [],
    lastUpdated: null,
    week: null,
    term: null,
  });
  const [missingClasses, setMissingClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingLoading, setMissingLoading] = useState(true);
  const [error, setError] = useState("");
  const [missingError, setMissingError] = useState("");
  const scoreboardMountedRef = useRef(false);
  const prevWeekLeaderRef = useRef(null);
  const chartRef = useRef(null);

  const loadScoreboard = useCallback(
    async ({ showLoading = true } = {}) => {
      if (showLoading && scoreboardMountedRef.current) {
        setLoading(true);
      }
      try {
        const response = await fetch("/api/scoreboard/current");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load scoreboard");
        }
        if (scoreboardMountedRef.current) {
          setScoreboard(payload);
          setError("");
        }
      } catch (err) {
        if (scoreboardMountedRef.current) {
          setError(err.message);
        }
      } finally {
        if (scoreboardMountedRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    scoreboardMountedRef.current = true;
    loadScoreboard();

    const handleRefresh = () => {
      loadScoreboard({ showLoading: false });
    };
    window.addEventListener("scoreboard:refresh", handleRefresh);

    return () => {
      scoreboardMountedRef.current = false;
      window.removeEventListener("scoreboard:refresh", handleRefresh);
    };
  }, [loadScoreboard]);

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

  const thisWeekTotal = useMemo(
    () => (scoreboard.totalsThisWeek || []).reduce((acc, house) => acc + (house.points || 0), 0),
    [scoreboard.totalsThisWeek]
  );

  const allTimeTotal = useMemo(
    () => (scoreboard.totalsAllTime || []).reduce((acc, house) => acc + (house.points || 0), 0),
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

  const weekRows = useMemo(() => {
    const raw = scoreboard.week?.rows ?? scoreboard.totalsThisWeek ?? [];
    return normalizeHouseRows(raw);
  }, [scoreboard.week, scoreboard.totalsThisWeek]);

  const termRows = useMemo(() => {
    const raw = scoreboard.term?.rows ?? [];
    return normalizeHouseRows(raw);
  }, [scoreboard.term]);
  const termTotalPoints = useMemo(
    () => termRows.reduce((acc, row) => acc + (row.points ?? 0), 0),
    [termRows]
  );

  const weekAxisMap = useMemo(
    () =>
      weekRows.reduce((acc, row) => {
        acc[row.houseKey] = row;
        return acc;
      }, {}),
    [weekRows]
  );

  const termAxisMap = useMemo(
    () =>
      termRows.reduce((acc, row) => {
        acc[row.houseKey] = row;
        return acc;
      }, {}),
    [termRows]
  );

  const weekTimeProgress = useMemo(() => {
    const rawStart = scoreboard.week?.week_start ?? scoreboard.week?.weekStart;
    if (!rawStart) return 0;
    const start = Date.parse(rawStart);
    if (Number.isNaN(start)) return 0;
    const weekEnd = start + 7 * 24 * 60 * 60 * 1000;
    return clamp01((Date.now() - start) / (weekEnd - start));
  }, [scoreboard.week]);

  const termTimeProgress = useMemo(() => {
    const term = scoreboard.term;
    if (!term) return 0;
    const rawStart = term.start_date ?? term.startDate;
    const rawEnd = term.end_date ?? term.endDate;
    if (!rawStart || !rawEnd) return 0;
    const start = Date.parse(rawStart);
    const end = Date.parse(rawEnd);
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
    const inclusiveEnd = end + 24 * 60 * 60 * 1000;
    return clamp01((Date.now() - start) / (inclusiveEnd - start));
  }, [scoreboard.term]);

  const termDisabled = !scoreboard.term;
  const weekRangeLabel = useMemo(
    () => buildWeekRangeLabel(scoreboard.week),
    [scoreboard.week]
  );
  const termSubtitle = useMemo(() => {
    if (!scoreboard.term) {
      return null;
    }
    const name = scoreboard.term.name ?? scoreboard.term.termName ?? "Current Term";
    const start = scoreboard.term.start_date ?? scoreboard.term.startDate;
    const end = scoreboard.term.end_date ?? scoreboard.term.endDate;
    const formattedStart = formatReadableDate(start);
    const formattedEnd = formatReadableDate(end);
    return formattedStart && formattedEnd
      ? `${name} · ${formattedStart} – ${formattedEnd}`
      : name;
  }, [scoreboard.term]);

  const containerClasses = minimal ? "h-full" : "space-y-6";
  const weekLeadingRow = useMemo(() => getLeadingHouseRow(weekRows), [weekRows]);
  const weekLeadingHouseKey = weekLeadingRow?.houseKey ?? null;
  const termLeadingRow = useMemo(
    () => getLeadingHouseRow(termRows),
    [termRows]
  );
  const termLeadingHouseKey = termLeadingRow?.houseKey ?? null;
  const leadingHouse = useMemo(() => {
    if (!scoreboard.totalsThisWeek?.length) return null;
    return scoreboard.totalsThisWeek.reduce((best, current) => {
      if (!best || (current.points || 0) > (best.points || 0)) {
        return current;
      }
      return best;
    }, null);
  }, [scoreboard.totalsThisWeek]);
  const weekPointValues = useMemo(
    () => weekRows.map((row) => Number(row.points ?? 0)),
    [weekRows]
  );
  const allZeroPoints = useMemo(
    () => weekPointValues.length > 0 && weekPointValues.every((value) => value === 0),
    [weekPointValues]
  );
  const allEqualPoints = useMemo(() => {
    if (weekPointValues.length === 0) return false;
    const firstValue = weekPointValues[0];
    return weekPointValues.every((value) => value === firstValue);
  }, [weekPointValues]);
  const topPoints = useMemo(() => {
    if (!weekPointValues.length) return null;
    return Math.max(...weekPointValues);
  }, [weekPointValues]);
  const tiedHouses = useMemo(() => {
    if (topPoints === null) return [];
    return weekRows.filter((row) => Number(row.points ?? 0) === topPoints);
  }, [weekRows, topPoints]);
  const tiedHouseKeys = useMemo(
    () =>
      tiedHouses
        .map((row) => row.houseKey ?? row.houseId ?? row.house ?? row.id)
        .filter(Boolean),
    [tiedHouses]
  );
  const termPointValues = useMemo(
    () => termRows.map((row) => Number(row.points ?? 0)),
    [termRows]
  );
  const termTopPoints = useMemo(() => {
    if (!termPointValues.length) return null;
    return Math.max(...termPointValues);
  }, [termPointValues]);
  const termTiedHouses = useMemo(() => {
    if (termTopPoints === null) return [];
    return termRows.filter((row) => Number(row.points ?? 0) === termTopPoints);
  }, [termRows, termTopPoints]);
  const termTiedHouseKeys = useMemo(
    () =>
      termTiedHouses
        .map((row) => row.houseKey ?? row.houseId ?? row.house ?? row.id)
        .filter(Boolean),
    [termTiedHouses]
  );

  const LeadingHouseIcon = leadingHouse
    ? (HOUSES[resolveHouseKey(
        leadingHouse.houseId ??
          leadingHouse.house_id ??
          leadingHouse.house ??
          leadingHouse.id
      )]?.icon || null)
    : null;
  const leadingHouseColor = leadingHouse
    ? (
        HOUSES[
          resolveHouseKey(
            leadingHouse.houseId ??
              leadingHouse.house_id ??
              leadingHouse.house ??
              leadingHouse.id
          )
        ]?.color ??
        leadingHouse.color ??
        "#2563eb"
      )
    : "#2563eb";
  const tieHouseColors = useMemo(() => {
    const colors = tiedHouses.map((row) => row.color ?? "#2563eb").filter(Boolean);
    return Array.from(new Set(colors));
  }, [tiedHouses]);

  const confettiColors = useMemo(() => {
    const base = [...tieHouseColors, leadingHouseColor, "#facc15"];
    return Array.from(new Set(base));
  }, [leadingHouseColor, tieHouseColors]);

  const fireConfettiBurst = () => {
    const rect = chartRef.current?.getBoundingClientRect();

    const origin = rect
      ? {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: rect.top / window.innerHeight,
        }
      : { x: 0.5, y: 0.25 };

    const colors = confettiColors.length
      ? confettiColors
      : ["#facc15", leadingHouseColor];

    const defaults = {
      startVelocity: 45,
      spread: 360,
      ticks: 180,
      gravity: 0.9,
      decay: 0.92,
      scalar: 1,
      colors,
      origin,
      zIndex: 9999,
    };

    confetti({ ...defaults, particleCount: 90 });
    setTimeout(() => confetti({ ...defaults, particleCount: 60 }), 200);
    setTimeout(() => confetti({ ...defaults, particleCount: 40 }), 400);
  };

  useEffect(() => {
    if (
      weekLeadingHouseKey &&
      prevWeekLeaderRef.current &&
      prevWeekLeaderRef.current !== weekLeadingHouseKey &&
      chartRef.current
    ) {
      fireConfettiBurst();
    }

    prevWeekLeaderRef.current = weekLeadingHouseKey;
  }, [weekLeadingHouseKey]);

  const hasActiveLeader =
    topPoints !== null &&
    tiedHouses.length === 1 &&
    !allZeroPoints &&
    !allEqualPoints &&
    Boolean(leadingHouse);
  const tiedHouseNames = tiedHouses
    .map((row) => row.name ?? row.houseKey ?? "")
    .filter((name) => name);
  const tiedMessage =
    tiedHouseNames.length > 0 && topPoints !== null
      ? `Houses ${formatTiedHouseNames(tiedHouseNames)} are tied with ${topPoints} pts`
      : null;
  const leaderMessage = (() => {
    if (allZeroPoints) return "No leaders so far";
    if (allEqualPoints) return "It's a TIE!";
    if (tiedHouses.length > 1 && tiedMessage) return tiedMessage;
    if (hasActiveLeader && leadingHouse) {
      return `${leadingHouse.name} is leading with ${leadingHouse.points} pts`;
    }
    return null;
  })();
  const showTrophy = Boolean(leaderMessage && leaderMessage !== "No leaders so far");
  const zeroPointHouses = useMemo(
    () => weekRows.filter((row) => Number(row.points ?? 0) === 0),
    [weekRows]
  );
  const zeroPointMissing = zeroPointHouses.map((row) => ({
    id: row.houseId ?? row.houseKey,
    name: row.name,
    reason: "0 pts recorded",
  }));
  const missingClassesWithReason = missingClasses.map((klass) => ({
    ...klass,
    reason: "No submission yet",
  }));
  const mergedMissingClasses = [
    ...missingClassesWithReason,
    ...zeroPointMissing.filter(
      (zp) => !missingClassesWithReason.some((m) => m.id === zp.id)
    ),
  ];
  const leadingHouseFooter = leaderMessage ? (
    <div className="flex items-center justify-end gap-3">
      <p className="text-sm font-semibold text-emerald-700">
        <span className="inline-flex items-center gap-2">
          {hasActiveLeader && LeadingHouseIcon && (
            <LeadingHouseIcon className="h-5 w-5" color={leadingHouseColor} />
          )}
          {leaderMessage}
        </span>
      </p>
      {showTrophy && (
        <Trophy
          className="
            h-9 w-9
            fill-[#facc15]
            stroke-[#a16207]
            stroke-[1.4]
            drop-shadow-[0_6px_16px_rgba(161,98,7,0.45)]
          "
        />
      )}
    </div>
  ) : null;

  const missingCount = mergedMissingClasses.length;
  const missingHeadline = missingLoading
    ? "Checking for outstanding submissions…"
    : missingError
    ? missingError
    : missingCount === 0
    ? "All classes submitted this week"
    : `${missingCount} class${missingCount === 1 ? "" : "es"} have not submitted this week`;

  return (
    <section className={`${containerClasses} w-full`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Live scoreboard</p>
          <p className="text-[9px] text-slate-600">Updated: {lastUpdatedLabel}</p>
        </div>
      </div>


      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
          <div className="mb-4 space-y-1">
            <p
              className="text-xs uppercase tracking-[0.4em]"
              style={{ ...PLAYFUL_FONT, color: WEEK_TITLE_COLOR }}
            >
              Current Week
            </p>
            {weekRangeLabel && (
            <p className="text-sm font-semibold text-slate-700">{weekRangeLabel}</p>
            )}
          </div>
          <div
            ref={chartRef}
            className="relative flex-1 min-h-[360px] w-full"
          >
            {loading ? (
              <p className="text-sm text-slate-500">Loading scoreboard…</p>
            ) : error ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weekRows}
                  margin={{ ...BAR_CHART_MARGIN }}
                  barSize={65}
                  barCategoryGap="1%"
                  barGap={1}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="houseKey"
                    tick={(props) => <HouseAxisTick {...props} axisMetaMap={weekAxisMap} />}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                  <Tooltip formatter={(value) => `${value} pts`} />
                  <Bar
                    dataKey="points"
                    shape={(props) => (
                      <TopRoundedBar
                        {...props}
                        leadingHouseKey={weekLeadingHouseKey}
                        highlightHouseKeys={tiedHouseKeys}
                      />
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
          <div className="mb-4 space-y-1">
            <p
              className="text-xs uppercase tracking-[0.4em]"
              style={{ ...PLAYFUL_FONT, color: TERM_TITLE_COLOR }}
            >
              Current Term
            </p>
            {termSubtitle && (
              <p className="text-sm font-semibold text-slate-700">{termSubtitle}</p>
            )}
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Loading scoreboard…</p>
          ) : error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : termDisabled ? (
            <div className="flex flex-1 min-h-[360px] w-full items-center justify-center text-sm text-slate-500">
              No active term
            </div>
          ) : (
            <div className="relative flex-1 min-h-[360px] w-full overflow-visible">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={termRows}
                  margin={{ ...BAR_CHART_MARGIN }}
                  barSize={65}
                  barCategoryGap="1%"
                  barGap={1}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="houseKey"
                    tick={(props) => <HouseAxisTick {...props} axisMetaMap={termAxisMap} />}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                  <Tooltip formatter={(value) => `${value} pts`} />
                  <Bar
                    dataKey="points"
                    shape={(props) => (
                      <TopRoundedBar
                        {...props}
                        leadingHouseKey={termLeadingHouseKey}
                        highlightHouseKeys={termTiedHouseKeys}
                      />
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <ProgressTrack
          title="Current Week Progress"
          rows={weekRows}
          timeProgress={weekTimeProgress}
          placeholderText="Week data unavailable"
          footer={leadingHouseFooter}
          titleColor={WEEK_TITLE_COLOR}
        />
        <ProgressTrack
          title="Current Term Progress"
          rows={termRows}
          timeProgress={termTimeProgress}
          disabled={termDisabled}
          placeholderText="No active term"
          titleColor={TERM_TITLE_COLOR}
        />
      </div>

      {showTotalsPanel && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900/80 to-slate-900/40 p-6 text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-200">This week total</p>
            <p className="text-4xl font-semibold">{thisWeekTotal} pts</p>
            <p className="text-sm text-slate-200">Keep adding points before Friday noon.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p
              className="text-xs uppercase tracking-[0.4em]"
              style={{ ...PLAYFUL_FONT, color: TERM_TITLE_COLOR }}
            >
              Current Term Total
            </p>
            <p className="text-3xl font-semibold text-slate-900">{termTotalPoints} pts</p>
            <p className="text-sm text-slate-600">Points earned so far this term.</p>
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
          ) : mergedMissingClasses.length === 0 ? (
            <p className="mt-4 text-sm text-red-700">Great job—no classes are missing yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {mergedMissingClasses.map((klass) => (
                <li
                  key={klass.id}
                  className="rounded-2xl border border-red-100 bg-white/80 px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-red-700">{klass.name}</p>
                    <span className="rounded-full border border-red-200 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-red-700">
                      {klass.reason ?? "Missing"}
                    </span>
                  </div>
                  {klass.teacher_name || klass.teacher_email ? (
                    <p className="mt-2 text-xs text-red-500">
                      {klass.teacher_name} {klass.teacher_email ? `· ${klass.teacher_email}` : ""}
                    </p>
                  ) : null}
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
