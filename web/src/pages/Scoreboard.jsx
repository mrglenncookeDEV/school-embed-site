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
import { Timer, Megaphone, Trophy, Star } from "lucide-react";
import { HOUSES, HOUSE_ORDER, resolveHouseKey } from "../config/houses";

const BAR_CHART_MARGIN = { top: 20, right: 30, left: 0, bottom: 60 };

const PLAYFUL_FONT = {
  fontFamily:
    '"Permanent Marker", "Marker Felt", "Kalam", cursive',
  fontWeight: 200,
  letterSpacing: "0.04em",
};

const LANES = [-18, -6, 6, 18];

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
      : new Date(parsedStart + 4 * 24 * 60 * 60 * 1000).toISOString());

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

const BORDER_FALLBACK_COLOR = "#94a3b8";

const buildBorderStyle = ({
  tieColors = [],
  primaryColor,
  fallbackColor = BORDER_FALLBACK_COLOR,
  isEmpty = false,
}) => {
  const base = {
    borderWidth: "3px",
    borderStyle: "solid",
  };

  if (tieColors.length > 1) {
    const [top, right, bottom, left] = [
      tieColors[0] ?? fallbackColor,
      tieColors[1] ?? tieColors[0] ?? fallbackColor,
      tieColors[2] ?? tieColors[0] ?? fallbackColor,
      tieColors[3] ?? tieColors[0] ?? fallbackColor,
    ];
    return {
      ...base,
      borderTopColor: top,
      borderRightColor: right,
      borderBottomColor: bottom,
      borderLeftColor: left,
    };
  }

  if (isEmpty) {
    return {
      ...base,
      borderColor: fallbackColor,
    };
  }

  return {
    ...base,
    borderColor: primaryColor ?? fallbackColor,
  };
};

const buildAccentBackground = (primaryColor = "#2563eb", tieColors = []) => {
  const palette = tieColors.length > 0 ? tieColors : [primaryColor];
  const unique = Array.from(new Set(palette.filter(Boolean)));
  if (unique.length > 1) {
    return `linear-gradient(135deg, ${unique.join(", ")})`;
  }
  return unique[0] ?? primaryColor;
};

const clamp = (value, min = 0, max = 1) => {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
};

const clamp01 = (value) => clamp(value, 0, 1);

const getWeekProgress = (now = new Date()) => {
  const day = now.getDay(); // Sunday = 0
  const weekdayIndex = Math.max(0, Math.min(4, day - 1));
  const minutes = now.getHours() * 60 + now.getMinutes();
  const dayFraction = minutes / (24 * 60);
  return (weekdayIndex + dayFraction) / 5;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// LAYOUT LOCK:
// Car + flag share a fixed visual baseline.
// Timer must NEVER affect flag positioning.
// Increase container height if needed — do not move icons.
function ProgressTrack({
  title,
  subtitle = null,
  rows = [],
  timeProgress = 0,
  timePillType,
  finishLabel,
  termEndDate = null,
  disabled = false,
  placeholderText = "",
  footer = null,
  titleColor = "#94a3b8",
  borderStyle = {},
  highlightHouseKeys = [],
  timePillPrimaryColor = "#0f172a",
  timePillTieColors = [],
  leaderHouseKey = null,
  onFinish,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [hasFiredFinish, setHasFiredFinish] = useState(false);
  const TRACK_CENTER_Y = "50%";
  const clampedTime = clamp01(timeProgress);

  const getWeekdayLabel = () =>
    new Date().toLocaleDateString("en-GB", { weekday: "long" });

  const getDateLabel = () => {
    const d = new Date();
    const day = d.getDate();
    const suffix =
      day % 10 === 1 && day !== 11
        ? "st"
        : day % 10 === 2 && day !== 12
          ? "nd"
          : day % 10 === 3 && day !== 13
            ? "rd"
            : "th";

    return `${day}${suffix} ${d.toLocaleDateString("en-GB", { month: "short" })}`;
  };

  const timePillLabel =
    timePillType === "weekday"
      ? getWeekdayLabel()
      : timePillType === "date"
        ? getDateLabel()
        : null;

  const highlightSet = useMemo(
    () => new Set(highlightHouseKeys.filter(Boolean)),
    [highlightHouseKeys]
  );

  const normalizedTieColors = timePillTieColors
    .map((color) => (typeof color === "string" ? color : ""))
    .filter(Boolean);
  const timePillSwatches =
    normalizedTieColors.length > 0 ? normalizedTieColors : [timePillPrimaryColor];
  const uniqueTimePillColors = Array.from(new Set(timePillSwatches));
  const timePillBackground =
    uniqueTimePillColors.length > 1
      ? `linear-gradient(135deg, ${uniqueTimePillColors.join(", ")})`
      : uniqueTimePillColors[0] ?? "#0f172a";

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const getFinishDeadline = () => {
    if (timePillType === "weekday") {
      const d = new Date();
      const day = d.getDay();
      const diffToFriday = (5 - day + 7) % 7;
      const friday = new Date(d);
      friday.setDate(d.getDate() + diffToFriday);
      friday.setHours(12, 0, 0, 0);
      return friday;
    }

    if (timePillType === "date" && termEndDate) {
      const end = new Date(termEndDate);
      end.setHours(12, 0, 0, 0);
      return end;
    }

    return null;
  };

  const finishDeadline = getFinishDeadline();
  const remainingMs = finishDeadline ? finishDeadline - now : 0;
  const isUrgent = remainingMs > 0 && remainingMs < DAY_MS;
  const isFinished = remainingMs <= 0 && finishDeadline !== null;

  useEffect(() => {
    if (isFinished && !hasFiredFinish && !disabled) {
      if (onFinish) onFinish();
      setHasFiredFinish(true);
    }
  }, [isFinished, hasFiredFinish, disabled, onFinish]);

  const formatCountdown = (ms) => {
    if (ms <= 0) return "0s";

    const totalSeconds = Math.floor(ms / 1000);
    const weeks = Math.floor(totalSeconds / (7 * 24 * 3600));
    const days = Math.floor((totalSeconds % (7 * 24 * 3600)) / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");

    return `${weeks}w ${days}d ${hh}:${mm}:${ss}s`;
  };

  const effectiveRows = useMemo(() => (disabled ? [] : rows), [disabled, rows]);

  const maxPoints = useMemo(() => {
    if (disabled) return 0;
    return Math.max(0, ...effectiveRows.map((r) => Number(r.points ?? 0)));
  }, [disabled, effectiveRows]);

  const POSITION_COLORS = {
    1: "#facc15",
    2: "#c0c0c0",
    3: "#b87333",
    4: "#0f172a",
  };

  const getHouseMarkerKey = (house) =>
    house.houseKey ?? house.houseId ?? house.house ?? house.id ?? "";

  const positionColorByHouseKey = useMemo(() => {
    if (disabled) {
      return {};
    }

    const ordered = [...effectiveRows].sort((a, b) => {
      const pointsA = Number(a.points ?? 0);
      const pointsB = Number(b.points ?? 0);
      if (pointsA !== pointsB) {
        return pointsB - pointsA;
      }
      const nameA = (a.name ?? "").toString();
      const nameB = (b.name ?? "").toString();
      return nameA.localeCompare(nameB);
    });

    const pointsToPosition = {};
    let nextPosition = 1;
    let previousPoints = null;
    ordered.forEach((row) => {
      const points = Number(row.points ?? 0);
      if (points !== previousPoints) {
        pointsToPosition[points] = nextPosition;
      }
      previousPoints = points;
      nextPosition += 1;
    });

    const result = {};
    ordered.forEach((row) => {
      const key = getHouseMarkerKey(row);
      const points = Number(row.points ?? 0);
      const position = pointsToPosition[points] ?? nextPosition - 1;
      const borderColor = POSITION_COLORS[position] ?? POSITION_COLORS[4];
      result[key] = { position, borderColor };
    });

    return result;
  }, [disabled, effectiveRows]);

  const markers = useMemo(() => {
    if (disabled) return [];

    const computed = effectiveRows.map((house, index) => {
      const isLeader = maxPoints > 0 && Number(house.points ?? 0) === maxPoints;
      const scoreProgress = maxPoints > 0 ? (house.points ?? 0) / maxPoints : 0;
      const laneIndex = index % LANES.length;
      const finalProgress = (isFinished && isLeader) ? 1.02 : scoreProgress * clampedTime;

      return {
        ...house,
        finalProgress,
        laneIndex,
        isLeader,
      };
    });

    const groups = {};
    computed.forEach((m) => {
      const key = Math.round(m.finalProgress * 1000);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });

    return Object.values(groups).flatMap((group) =>
      group.map((m, i) => ({
        ...m,
        stackIndex: i,
        stackSize: group.length,
      }))
    );
  }, [disabled, effectiveRows, maxPoints, clampedTime, isFinished]);

  const FAN_OUT_DURATION = "320ms";

  const renderTrackZone = () => (
    <div
      className="track-wrapper"
      style={{
        marginLeft: "-40px",
        marginRight: "-40px",
        width: "calc(100% + 80px)",
        padding: 0,
      }}
    >
      <div className="track-road" style={{ height: "170px" }}>
        <div className="track-kerb top" />
        <div className="track-kerb bottom" />
        <div
          className="absolute inset-0"
          style={{
            background: "#000000",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "3px 3px",
            }}
          />
        </div>
        {/* edge fade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0) 8%)",
            opacity: 0.5,
            zIndex: 2,
          }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 pointer-events-none"
          style={{
            width: "60px",
            backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.5) 0 2px, transparent 2px 40px)",
            borderRight: "4px solid rgba(255,255,255,0.8)",
            zIndex: 2,
            opacity: 0.5,
          }}
        />
        <div
          className="absolute top-0 bottom-0 flex items-center pointer-events-none"
          style={{
            left: "70px",
            zIndex: 1,
          }}
        >
          <span
            style={{
              transform: "rotate(90deg)",
              color: "rgba(255,255,255,0.4)",
              fontSize: "24px",
              fontWeight: "900",
              letterSpacing: "0.3em",
              fontFamily: "system-ui, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            START
          </span>
        </div>
        <div
          className="absolute top-0 bottom-0 flex items-center pointer-events-none"
          style={{
            right: "62px",
            zIndex: 1,
          }}
        >
          <span
            style={{
              transform: "rotate(90deg)",
              color: "rgba(255,255,255,0.4)",
              fontSize: "24px",
              fontWeight: "900",
              letterSpacing: "0.3em",
              fontFamily: "system-ui, sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            FINISH
          </span>
        </div>
        <div
          className="absolute top-0 bottom-0 right-0 pointer-events-none"
          style={{
            width: "60px",
            backgroundImage: "repeating-conic-gradient(#334155 0% 25%, #ffffff 0% 50%)",
            backgroundSize: "10px 10px",
            zIndex: 2,
            opacity: 0.8,
          }}
        />
        <div className="absolute inset-0 mx-10">
          <div
            className="track-center-fade"
            style={{ "--progress-percent": `${clampedTime * 100}%` }}
          />
        </div>
      </div>

      <div className="house-cars absolute inset-0 mx-10">
        {disabled && markers.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {placeholderText || "Waiting for data…"}
          </div>
        ) : (
          markers.map((house) => {
            const laneOffset = LANES[house.laneIndex ?? 0] ?? 0;
            const labelAbove =
              house.stackSize > 1
                ? house.stackIndex % 2 === 0
                : laneOffset < 0;
            const highlightKey =
              house.houseKey ?? house.houseId ?? house.house ?? house.id ?? "";
            const canonicalKey = resolveHouseKey(highlightKey);
            const houseMeta = HOUSES[canonicalKey] ?? {};
            const HouseIcon = houseMeta.icon;
            const isHighlighted = highlightSet.has(highlightKey);
            const badgeShadow =
              isHighlighted
                ? "drop-shadow(0 0 10px rgba(250,204,21,0.75)) drop-shadow(0 4px 8px rgba(0,0,0,0.35))"
                : "drop-shadow(0 4px 12px rgba(0,0,0,0.4))";
            const markerKey = `${highlightKey}-${house.stackIndex}-${house.stackSize}`;
            const houseColor = house.color ?? houseMeta.color ?? "#0f172a";
            const rankInfo =
              positionColorByHouseKey[highlightKey] ??
              positionColorByHouseKey[canonicalKey] ?? { borderColor: POSITION_COLORS[4] };
            const borderColor = rankInfo.borderColor;
            const pointsLabel = `${house.points ?? 0} pts`;

            return (
              <div
                key={markerKey}
                className="absolute flex flex-col items-center"
                style={{
                  top: `calc(50% + ${laneOffset}px)`,
                  left: `${house.finalProgress * 100}%`,
                  transform: "translateX(-50%)",
                  transition: `transform ${FAN_OUT_DURATION} cubic-bezier(0.34, 1.56, 0.64, 1)`,
                  willChange: "transform",
                  zIndex: 7,
                }}
              >
                <span
                  className={`
                    absolute inline-flex flex-col items-center
                    ${labelAbove ? "-top-10" : "top-16"}
                  `}
                  style={{ zIndex: 10 }}
                >
                  <span
                    className={`
                      absolute h-2 w-2 border border-slate-200 bg-white
                      ${labelAbove ? "top-full rotate-45" : "-top-1 -rotate-45"}
                    `}
                  />
                  <span
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold shadow-sm whitespace-nowrap"
                    style={{
                      ...PLAYFUL_FONT,
                      fontSize: "11px",
                      color: houseColor,
                    }}
                  >
                    {house.name} — {pointsLabel}
                  </span>
                </span>
                <div
                  className="relative flex h-8 w-8 items-center justify-center rounded-full shadow-lg md:h-10 md:w-10 flex-shrink-0"
                  style={{
                    backgroundColor: houseColor,
                    borderColor,
                    borderWidth: "3px",
                    borderStyle: "solid",
                    filter: badgeShadow,
                  }}
                >

                  {HouseIcon ? (
                    <HouseIcon
                      className="h-4 w-4 text-white"
                      strokeWidth={1.5}
                      style={{ color: "#fff" }}
                    />
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white">
                      {house.name?.[0] ?? "?"}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderAboveTrackElements = () => (
    timePillLabel ? (
      <div
        className="absolute"
        style={{
          left: `${clampedTime * 100}%`,
          top: "-56px",
          transform: "translateX(-50%)",
          zIndex: 14,
        }}
      >
        <span
          className="px-4 py-1 text-xs font-normal text-white shadow-sm whitespace-nowrap rounded-none"
          style={{ background: timePillBackground }}
        >
          {timePillLabel}
        </span>
      </div>
    ) : null
  );

  const renderBelowTrackElements = () => (
    <>
      <div
        className="absolute flex flex-col items-center"
        style={{
          left: `${clampedTime * 100}%`,
          top: "0px",
          transform: "translateX(-50%)",
          zIndex: 14,
          pointerEvents: "none",
        }}
      >
        <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1 shadow-sm backdrop-blur-sm">
          {isUrgent && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
          <Timer className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 tabular-nums tracking-tight">
            {formatCountdown(remainingMs)}
          </span>
        </div>
        <div className={`mt-1 text-[9px] font-bold uppercase tracking-[0.2em] ${isUrgent ? "text-red-500" : "text-slate-400"
          }`}>
          Time Left
        </div>
      </div>

      {isFinished && markers.some(m => m.isLeader) && (
        <div
          className="absolute flex flex-col items-center"
          style={{
            left: `${clampedTime * 100}%`,
            top: "54px",
            transform: "translateX(-50%)",
            zIndex: 14,
            width: "max-content",
          }}
        >
          <Trophy className="h-8 w-8 text-yellow-500 fill-yellow-400 animate-bounce drop-shadow-md" />
          <div
            className="mt-1 text-xs font-bold uppercase tracking-widest text-emerald-600"
            style={PLAYFUL_FONT}
          >
            Winner: {formatTiedHouseNames(markers.filter(m => m.isLeader).map(m => m.name))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      style={borderStyle}
    >
      <div className="mb-3 space-y-1">
        <h2
          className="highlight-title text-lg font-semibold uppercase tracking-[0.4em]"
          style={{ ...PLAYFUL_FONT, color: titleColor }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm font-semibold text-slate-700">{subtitle}</p>
        )}
      </div>

      {/* TRACK + ICON SEMANTICS LOCKED. Do not re-anchor icons or alter track layering. Increase visual height outward if needed. */}
      <div className="relative h-[320px] pt-20">
        <div className="relative overflow-visible px-4">
          {renderAboveTrackElements()}
          <div
            className="absolute bg-slate-300 start-marker-line"
            style={{
              left: `${clampedTime * 100}%`,
              top: "-32px",
              width: "1px",
              height: "220px",
              transform: "translateX(-50%)",
            }}
          />
          <div className="relative w-full h-[120px] overflow-visible">
            {renderTrackZone()}
          </div>
          <div className="relative mt-12 h-[56px]">
            {renderBelowTrackElements()}
          </div>
        </div>
      </div>
      {footer && (
        <div className="mt-4 border-t border-slate-100 pt-4 flex justify-end">
          {footer}
        </div>
      )}
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
  const [submissions, setSubmissions] = useState([]);
  const [missingClasses, setMissingClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingLoading, setMissingLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [missingError, setMissingError] = useState("");
  const [submissionsError, setSubmissionsError] = useState("");
  const scoreboardMountedRef = useRef(false);
  const prevWeekLeaderRef = useRef(null);
  const chartRef = useRef(null);

  const loadScoreboard = useCallback(
    async ({ showLoading = true } = {}) => {
      if (showLoading && scoreboardMountedRef.current) {
        setLoading(true);
        setSubmissionsLoading(true);
      }
      try {
        const [scoreRes, entriesRes] = await Promise.all([
          fetch("/api/scoreboard/current"),
          fetch("/api/entries?week=current")
        ]);

        const payload = await scoreRes.json();
        const entriesPayload = await entriesRes.json();

        if (!scoreRes.ok) throw new Error(payload.error || "Unable to load scoreboard");
        if (!entriesRes.ok) throw new Error(entriesPayload.error || "Unable to load entries");

        if (scoreboardMountedRef.current) {
          setScoreboard(payload);
          setSubmissions(entriesPayload.entries || []);
          setError("");
          setSubmissionsError("");
        }
      } catch (err) {
        if (scoreboardMountedRef.current) {
          setError(err.message);
          setSubmissionsError(err.message);
        }
      } finally {
        if (scoreboardMountedRef.current) {
          setLoading(false);
          setSubmissionsLoading(false);
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

  const weekTimeProgress = clamp(getWeekProgress());

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
  const termEndDate = scoreboard.term?.end_date ?? scoreboard.term?.endDate ?? null;
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
  const termAllEqualPoints = useMemo(() => {
    if (termPointValues.length === 0) return false;
    const firstValue = termPointValues[0];
    return termPointValues.every((value) => value === firstValue);
  }, [termPointValues]);
  const termTieColors = termTiedHouses.map((row) => row.color ?? "#2563eb");
  const termLeadingHouseColor = termLeadingRow?.color ?? "#2563eb";
  const termAllZeroPoints = useMemo(
    () =>
      termPointValues.length > 0 && termPointValues.every((value) => value === 0),
    [termPointValues]
  );
  const termTiedHouseNames = useMemo(
    () =>
      termTiedHouses
        .map((row) => row.name ?? row.houseKey ?? "")
        .filter((name) => name),
    [termTiedHouses]
  );
  const termCardBorderStyle = buildBorderStyle({
    tieColors: termTieColors,
    primaryColor: termLeadingHouseColor,
    isEmpty: termAllZeroPoints,
  });
  const termTrackBorderStyle = buildBorderStyle({
    tieColors: termTieColors,
    primaryColor: termLeadingHouseColor,
    isEmpty: termAllZeroPoints,
  });
  const termTiedMessage =
    termTiedHouseNames.length > 0 && termTopPoints !== null
      ? `Houses ${formatTiedHouseNames(termTiedHouseNames)} are tied with ${termTopPoints} pts`
      : null;

  const LeadingHouseIcon = leadingHouse
    ? (HOUSES[resolveHouseKey(
      leadingHouse.houseId ??
      leadingHouse.house_id ??
      leadingHouse.house ??
      leadingHouse.id
    )]?.icon || null)
    : null;
  const TermLeadingHouseIcon = termLeadingRow
    ? (HOUSES[resolveHouseKey(
      termLeadingRow.houseId ??
      termLeadingRow.house_id ??
      termLeadingRow.house ??
      termLeadingRow.id
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

  const weekFooterAccentBackground = buildAccentBackground(
    leadingHouseColor,
    tieHouseColors
  );
  const termFooterAccentBackground = buildAccentBackground(
    termLeadingHouseColor,
    termTieColors
  );

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
  const weekTieColors = tiedHouses.map((row) => row.color ?? "#2563eb");
  const weekCardBorderStyle = buildBorderStyle({
    tieColors: weekTieColors,
    primaryColor: leadingHouseColor,
    isEmpty: allZeroPoints,
  });
  const weekTrackBorderStyle = buildBorderStyle({
    tieColors: weekTieColors,
    primaryColor: leadingHouseColor,
    isEmpty: allZeroPoints,
  });
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
  const termHasActiveLeader =
    termTopPoints !== null &&
    termTiedHouses.length === 1 &&
    !termAllZeroPoints &&
    !termAllEqualPoints &&
    Boolean(termLeadingRow);
  const termLeaderMessage = (() => {
    if (termAllZeroPoints) return "No leaders so far";
    if (termAllEqualPoints) return "It's a TIE!";
    if (termTiedHouses.length > 1 && termTiedMessage) return termTiedMessage;
    if (termHasActiveLeader && termLeadingRow) {
      return `${termLeadingRow.name} is leading with ${termLeadingRow.points} pts`;
    }
    return null;
  })();
  const termShowTrophy = Boolean(
    termLeaderMessage && termLeaderMessage !== "No leaders so far"
  );
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
      {showTrophy && (
        <span
          className="h-9 w-9 flex items-center justify-center rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
          style={{ background: weekFooterAccentBackground }}
        >
          <Megaphone className="h-4 w-4 text-white" />
        </span>
      )}
      <p className="text-sm font-semibold text-emerald-700 mt-1">
        <span className="inline-flex items-center gap-2">
          {hasActiveLeader && LeadingHouseIcon && (
            <LeadingHouseIcon className="h-5 w-5" color={leadingHouseColor} />
          )}
          {leaderMessage}
        </span>
      </p>
    </div>
  ) : null;
  const termLeadingHouseFooter = termLeaderMessage ? (
    <div className="flex items-center justify-end gap-3">
      {termShowTrophy && (
        <span
          className="h-9 w-9 flex items-center justify-center rounded-full shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
          style={{ background: termFooterAccentBackground }}
        >
          <Megaphone className="h-4 w-4 text-white" />
        </span>
      )}
      <p className="text-sm font-semibold text-emerald-700 mt-1">
        <span className="inline-flex items-center gap-2">
          {termHasActiveLeader && TermLeadingHouseIcon && (
            <TermLeadingHouseIcon className="h-5 w-5" color={termLeadingHouseColor} />
          )}
          {termLeaderMessage}
        </span>
      </p>
    </div>
  ) : null;

  const missingCount = mergedMissingClasses.length;
  const missingHeadline = missingLoading
    ? "Checking for outstanding submissions…"
    : missingError
      ? missingError
      : missingCount === 0
        ? "All classes submitted this week"
        : `${missingCount} class${missingCount === 1 ? "" : "es"} ${missingCount === 1 ? "has not" : "have not"
        } submitted this week`;

  return (
    <section className={`${containerClasses} w-full`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Live scoreboard</p>
          <p className="text-[9px] text-slate-600">Updated: {lastUpdatedLabel}</p>
        </div>
      </div>


      <div className="grid gap-6 md:grid-cols-2">
        <div
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full"
          style={weekCardBorderStyle}
        >
          <div className="mb-4 space-y-1">
            <h2
              className="highlight-title text-lg uppercase tracking-[0.4em]"
              style={{ ...PLAYFUL_FONT, color: WEEK_TITLE_COLOR }}
            >
              This Week
            </h2>
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

        <div
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full"
          style={termCardBorderStyle}
        >
          <div className="mb-4 space-y-1">
            <h2
              className="highlight-title text-lg uppercase tracking-[0.4em]"
              style={{ ...PLAYFUL_FONT, color: TERM_TITLE_COLOR }}
            >
              This Term
            </h2>
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

      {showTotalsPanel && (
        <div className="grid gap-6 sm:grid-cols-2">
          <div
            className="rounded-3xl border border-slate-200 p-6 shadow-lg text-white text-center flex flex-col items-center gap-3"
            style={{ backgroundColor: WEEK_TITLE_COLOR }}
          >
            <h2
              className="highlight-title text-lg uppercase tracking-[0.4em]"
              style={PLAYFUL_FONT}
            >
              This week total
            </h2>
            <p className="text-4xl font-semibold" style={PLAYFUL_FONT}>
              {thisWeekTotal} pts
            </p>
            <p className="text-sm" style={PLAYFUL_FONT}>
              Keep adding points before Friday noon.
            </p>
          </div>
          <div
            className="rounded-3xl border border-slate-200 p-6 shadow-lg text-white text-center flex flex-col items-center gap-3"
            style={{ backgroundColor: "#dc2626" }}
          >
            <h2
              className="highlight-title text-lg uppercase tracking-[0.4em]"
              style={PLAYFUL_FONT}
            >
              Current Term Total
            </h2>
            <p className="text-3xl font-semibold" style={PLAYFUL_FONT}>
              {termTotalPoints} pts
            </p>
            <p className="text-sm" style={PLAYFUL_FONT}>
              Points earned so far this term.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <ProgressTrack
          title="RACE FOR THE WEEK!"
          subtitle={weekRangeLabel}
          rows={weekRows}
          timeProgress={weekTimeProgress}
          placeholderText="Week data unavailable"
          highlightHouseKeys={tiedHouseKeys}
          timePillType="weekday"
          finishLabel="Finish · Friday 12:00"
          timePillPrimaryColor={leadingHouseColor}
          timePillTieColors={tieHouseColors}
          footer={leadingHouseFooter}
          titleColor={WEEK_TITLE_COLOR}
          borderStyle={weekTrackBorderStyle}
          leaderHouseKey={weekLeadingHouseKey}
          onFinish={fireConfettiBurst}
        />
        <ProgressTrack
          title="RACE FOR THE TERM!!!"
          subtitle={termSubtitle}
          rows={termRows}
          timeProgress={termTimeProgress}
          disabled={termDisabled}
          placeholderText="No active term"
          highlightHouseKeys={termTiedHouseKeys}
          timePillType="date"
          finishLabel="Finish · 13th Feb"
          titleColor={TERM_TITLE_COLOR}
          borderStyle={termTrackBorderStyle}
          timePillPrimaryColor={termLeadingHouseColor}
          timePillTieColors={termTieColors}
          footer={termLeadingHouseFooter}
          termEndDate={termEndDate}
          leaderHouseKey={termLeadingHouseKey}
          onFinish={fireConfettiBurst}
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
        <div className="mb-4 w-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400 animate-pulse flex-shrink-0" />
              <h2
                className="highlight-title text-lg font-semibold uppercase tracking-[0.4em] text-slate-500 whitespace-nowrap"
                style={PLAYFUL_FONT}
              >
                RECENT STARS!
              </h2>
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400 animate-pulse delay-75 flex-shrink-0" />
            </div>
            <p className="text-sm text-slate-600">Points recorded this week.</p>
          </div>
        </div>

        {submissionsLoading ? (
          <p className="text-sm text-slate-500">Loading submissions…</p>
        ) : submissionsError ? (
          <p className="text-sm text-rose-600">{submissionsError}</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-slate-600">No submissions yet this week.</p>
        ) : (
          <div className="overflow-x-auto overflow-y-auto -mx-6" style={{ maxHeight: "420px" }}>
            <table className="w-full min-w-[700px] table-auto text-sm relative">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.3em] text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Class</th>
                  <th className="px-6 py-3">House</th>
                  <th className="px-6 py-3">Points</th>
                  <th className="px-6 py-3">Submitted by</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {submissions.map((entry) => {
                  const houseId = entry.house_id || entry.houseId;
                  const houseMeta = HOUSES[resolveHouseKey(houseId)];
                  const houseColor = houseMeta?.color ?? entry.house_color ?? "#94a3b8";
                  const HouseIcon = houseMeta?.icon;
                  const houseLabel = houseMeta?.name ?? entry.house_name;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{entry.class_name}</td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 font-bold text-slate-900">{entry.points}</td>
                      <td className="px-6 py-4 text-slate-600">{entry.submitted_by_email}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        }) : "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600 italic">{entry.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMissing && (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-6 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: "500px" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 sticky top-0 bg-red-50 z-10 pb-4">
            <div>
              <h2
                className="text-lg font-semibold uppercase tracking-[0.4em] text-red-500"
              >
                Missing submissions
              </h2>
              <p className="text-lg font-semibold text-red-700">{missingHeadline}</p>
            </div>
            <span className="rounded-full border border-red-200 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-red-700">
              Weekly flag
            </span>
          </div>

          <div className="overflow-y-auto pr-2">
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
                    {klass.teacherDisplayName || klass.teacher_email ? (
                      <p className="mt-2 text-xs text-red-500">
                        {klass.teacherDisplayName} {klass.teacher_email ? `· ${klass.teacher_email}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ScoreboardPage() {
  return <ScoreboardContent />;
}
