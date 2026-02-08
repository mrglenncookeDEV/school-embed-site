import confetti from "canvas-confetti";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { createRoot } from "react-dom/client";
import houseBadge from "../assets/house_gold.png";
import { HOUSES, HOUSE_ORDER, resolveHouseKey, getHouseById } from "../config/houses";
import { WaffleChart } from "../components/charts/WaffleChart";
import { exportAssemblyDeck } from "../utils/exportAssemblyDeck";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  Timer,
  Megaphone,
  Trophy,
  Star,
  Shield,
  Crown,
  Heart,
  Printer,
  Presentation,
  Zap,
  Ghost,
  Bird,
  Cat,
  Dog,
  Trees,
  Cloud,
  Sun,
  Moon,
  Map,
  Flag,
  Home,
  User,
  Earth,
  Droplets,
  Flame,
  Wind,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function generateSummaryLine({
  leader,
  prevLeader,
  leaderMargin,
  strongestDeltaHouse,
  periodLabel, // "week" | "term"
}) {
  if (leader && prevLeader && leader !== prevLeader) {
    return `${leader} takes the lead this ${periodLabel} after a strong performance.`;
  }

  if (leaderMargin <= 10 && strongestDeltaHouse) {
    return `A tight contest at the top, with ${strongestDeltaHouse} closing the gap.`;
  }

  if (leader) {
    return `${leader} maintains a strong lead this ${periodLabel}.`;
  }

  return `Competition remains open this ${periodLabel}.`;
}

const ICON_MAP = {
  shield: Shield,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  heart: Heart,
  zap: Zap,
  ghost: Ghost,
  bird: Bird,
  cat: Cat,
  dog: Dog,
  tree: Trees,
  cloud: Cloud,
  sun: Sun,
  moon: Moon,
  map: Map,
  flag: Flag,
  home: Home,
  user: User,
  earth: Earth,
  droplets: Droplets,
  flame: Flame,
  wind: Wind,
  sparkles: Sparkles,
};

const BAR_CHART_MARGIN = { top: 20, right: 30, left: 0, bottom: 60 };

// Canonical values list (single source of truth for ordering, legend, and normalisation)
const CANONICAL_VALUES = [
  "General Award",
  "Be Kind",
  "Be Responsible",
  "Be Safe",
  "Be Ready",
];

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
      const day = d.getUTCDay();
      const diffToFriday = (5 - day + 7) % 7;
      const friday = new Date(d);
      friday.setUTCDate(d.getUTCDate() + diffToFriday);
      friday.setUTCHours(14, 25, 0, 0);
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

  const POSITION_COLORS = useMemo(
    () => ({
      1: "#facc15",
      2: "#c0c0c0",
      3: "#b87333",
      4: "#0f172a",
    }),
    []
  );

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
  }, [disabled, effectiveRows, POSITION_COLORS]);

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
        {/* Racetrack elements */}
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
            const dbIconName = String(house.icon || houseMeta.iconName || "").toLowerCase();
            const HouseIcon = ICON_MAP[dbIconName] || houseMeta.icon || ICON_MAP.shield;
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
          zIndex: 5,
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
          zIndex: 5,
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
            zIndex: 5,
            width: "max-content",
          }}
        >
          <Trophy className="h-6 w-6 text-yellow-500 fill-yellow-400 animate-bounce drop-shadow-md" />
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
              height: "250px",
              transform: "translateX(-50%)",
            }}
          />
          <div className="relative w-full h-[120px] overflow-visible">
            {renderTrackZone()}
          </div>
          <div className="relative mt-24 h-[56px]">
            {renderBelowTrackElements()}
          </div>
        </div>
      </div>
      {footer && (
        <div className="mt-4 pt-4 flex justify-end">
          {footer}
        </div>
      )}
    </div>
  );
}

const BrickPatternDefs = ({ patterns }) => {
  if (!patterns?.length) return null;

  return (
    <defs>
      {patterns.map(({ id, color }) => (
        <pattern
          key={id}
          id={id}
          patternUnits="userSpaceOnUse"
          width="36"
          height="18"
        >
          <rect x="0" y="0" width="16" height="7" fill={color} />
          <rect x="18" y="0" width="16" height="7" fill={color} />

          <rect x="-8" y="9" width="16" height="7" fill={color} />
          <rect x="10" y="9" width="16" height="7" fill={color} />
          <rect x="28" y="9" width="16" height="7" fill={color} />

          <path
            d="
              M0 8 H36
              M17 0 V7
              M9 9 V16
              M27 9 V16
            "
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.6"
          />
        </pattern>
      ))}
    </defs>
  );
};

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

  const brickColor = payload?.color ?? fill;
  const resolvedFill = payload?.fill ?? fill;

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
  const badgeY = y + radius + 38;
  const smileySize = 16;

  const badgeSize = 70;
  const badgeOffset = badgeSize / 2;

  return (
    <g style={{ color: brickColor }}>
      <path
        d={path}
        fill={resolvedFill}
        stroke="#0f172a"
        strokeWidth={2}
        strokeLinejoin="round"
        style={showSmiley ? { animation: "bar-flash 1.2s ease-in-out" } : undefined}
      />

      {showSmiley && (
        <g transform={`translate(${centerX - badgeOffset}, ${badgeY - badgeOffset})`}>
          <image
            href={houseBadge}
            width={badgeSize}
            height={badgeSize}
            preserveAspectRatio="xMidYMid meet"
            style={{ backgroundColor: "transparent" }}
          />
        </g>
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

export function ScoreboardContent({ showTotalsPanel = true, minimal = false }) {
  const location = useLocation();
  const ALLOWED_PATHS = ["/scoreboard", "/teacher", "/embed/scoreboard"];
  const isAllowedPath = ALLOWED_PATHS.some((p) => location.pathname.startsWith(p));

  const [scoreboard, setScoreboard] = useState({
    totalsThisWeek: [],
    totalsAllTime: [],
    lastUpdated: null,
    week: null,
    term: null,
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [submissionsError, setSubmissionsError] = useState("");
  const scoreboardMountedRef = useRef(false);
  const prevWeekLeaderRef = useRef(null);
  const prevTermLeaderRef = useRef(null);
  const chartRef = useRef(null);
  const weekChartRef = useRef(null);
  const termChartRef = useRef(null);
  const valuesRef = useRef(null);
  const [aiHighlights, setAiHighlights] = useState({});
  const [valuesData, setValuesData] = useState({ houses: [], years: [] });
  const [previousValuesData, setPreviousValuesData] = useState({ houses: [], years: [] });
  const [valuesLoading, setValuesLoading] = useState(true);
  const [classValuesData, setClassValuesData] = useState([]);
  const [classValuesLoading, setClassValuesLoading] = useState(true);
  const [showClassBreakdown, setShowClassBreakdown] = useState(false);
  const [classesList, setClassesList] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [showWeekYearBars, setShowWeekYearBars] = useState(false);
  const [showWeekClassBars, setShowWeekClassBars] = useState(false);
  const [showTermClassBars, setShowTermClassBars] = useState(false);
  const [showTermYearBars, setShowTermYearBars] = useState(false);
  const [valueCaptions, setValueCaptions] = useState({ houses: {}, years: {} });
  const [deepDive, setDeepDive] = useState(false);
  const [exporting, setExporting] = useState({ png: false, slides: false });
  const currentPeriod = activeSlide === 0 ? "week" : "term";
  const highlightsText = aiHighlights[currentPeriod];
  const housesData = useMemo(
    () => valuesData.houses || valuesData.data || [],
    [valuesData]
  );
  const yearsData = useMemo(() => valuesData.years || [], [valuesData]);
  const prevHousesData = useMemo(
    () => previousValuesData.houses || [],
    [previousValuesData]
  );
  const prevYearsData = useMemo(
    () => previousValuesData.years || [],
    [previousValuesData]
  );
  const isStaff = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.has("staff") || import.meta.env.VITE_STAFF_MODE === "true";
  }, []);
  const loadHtml2Canvas = useCallback(async () => {
    if (typeof window === "undefined") return null;
    if (window.html2canvas) return window.html2canvas;
    try {
      const mod = await import("../utils/exportSnapshot.js");
      if (window.html2canvas) return window.html2canvas;
      if (typeof mod.ensureHtml2Canvas === "function") {
        return await mod.ensureHtml2Canvas();
      }
    } catch (e) {
      // ignore
    }
    return null;
  }, []);

  const CATEGORY_PALETTE = useMemo(
    () => ["#60a5fa", "#f472b6", "#34d399", "#facc15", "#a78bfa"],
    []
  );
  const categoryColorMap = useMemo(() => {
    const map = {};
    CANONICAL_VALUES.forEach((cat, idx) => {
      map[cat] = CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
    });
    return map;
  }, [CATEGORY_PALETTE]);

  const awardCategories = CANONICAL_VALUES;
  const captionsByHouse = useMemo(() => {
    const map = {};
    Object.entries(valueCaptions?.houses || {}).forEach(([key, val]) => {
      const canonical = resolveHouseKey(key) || resolveHouseKey(Number(key)) || String(key);
      map[canonical] = val;
    });
    return map;
  }, [valueCaptions]);
  const captionsByYear = valueCaptions.years || {};
  const getDominantPct = useCallback((rows) => {
    const total = rows.reduce((s, r) => s + r.points, 0);
    if (!total) return 0;
    return Math.max(...rows.map((r) => r.points / total));
  }, []);
  const normaliseValues = useCallback((rows = []) => {
    const map = Object.fromEntries(CANONICAL_VALUES.map((v) => [v, 0]));
    rows.forEach((r) => {
      const cat = r.category ?? r.award_category;
      if (map[cat] !== undefined) {
        map[cat] += Number(r.points || 0);
      }
    });
    return CANONICAL_VALUES.map((v) => ({ category: v, points: map[v] }));
  }, []);

  const renderHouseTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const dataPoint = payload[0]?.payload;
    const rawHouse = dataPoint?.houseKey ?? dataPoint?.house_id;
    const houseId = resolveHouseKey(rawHouse) || String(rawHouse ?? "");
    const data = normaliseValues(valuesByHouse[houseId] || []);
    const total = data.reduce((sum, d) => sum + d.points, 0);
    const items = [...data].sort((a, b) => (b.points || 0) - (a.points || 0));
    const houseName = (getHouseById(houseId)?.name || dataPoint?.house_name || dataPoint?.name || label || "").toString();
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-md min-w-[180px]">
        <div className="font-semibold text-base" style={PLAYFUL_FONT}>
          {houseName.toUpperCase()}
        </div>
        <div className="text-sm font-bold text-slate-900" style={PLAYFUL_FONT}>
          {total} pts
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {items.length === 0 && <li className="text-slate-400">No category data</li>}
          {items.map((entry) => (
            <li key={entry.category} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: categoryColorMap[entry.category] || "#cbd5e1" }}
              />
              <span className="font-medium capitalize">{entry.category}</span>
              <span className="text-slate-500">· {entry.points} pts</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderClassTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const dataPoint = payload[0]?.payload;
    const classId = dataPoint?.classId;
    const breakdown = classHouseBreakdown[classId] || {};
    const items = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    const className = (dataPoint?.className || "").toString();
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-md min-w-[200px]">
        <div className="font-semibold text-base" style={PLAYFUL_FONT}>
          {className.toUpperCase()}
        </div>
        <div className="text-sm font-bold text-slate-900" style={PLAYFUL_FONT}>
          {dataPoint?.points ?? 0} pts
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {items.length === 0 && <li className="text-slate-400">No house data</li>}
          {items.map(([houseId, pts]) => {
            const house = getHouseById(houseId) || { name: houseId, color: "#64748b" };
            return (
              <li key={houseId} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: house.color }}
                />
                <span className="font-medium">{house.name}</span>
                <span className="text-slate-500">· {pts} pts</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderYearTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const dataPoint = payload[0]?.payload;
    const yearLabel = dataPoint?.yearLabel;
    const breakdown = yearHouseBreakdown[yearLabel] || {};
    const items = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-md min-w-[200px]">
        <div className="font-semibold text-base" style={PLAYFUL_FONT}>
          {(yearLabel || "").toUpperCase()}
        </div>
        <div className="text-sm font-bold text-slate-900" style={PLAYFUL_FONT}>
          {dataPoint?.points ?? 0} pts
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {items.length === 0 && <li className="text-slate-400">No house data</li>}
          {items.map(([houseId, pts]) => {
            const house = getHouseById(houseId) || { name: houseId, color: "#64748b" };
            return (
              <li key={houseId} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: house.color }}
                />
                <span className="font-medium">{house.name}</span>
                <span className="text-slate-500">· {pts} pts</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderBarValueLabel = (props) => {
    const { x, y, width, height, value } = props;
    if (!width || !height || height < 14) return null;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        dy="0.35em"
        textAnchor="middle"
        fill="#fff"
        style={{ ...PLAYFUL_FONT, fontSize: 11, fontWeight: 700 }}
      >
        {value}
      </text>
    );
  };

  const loadScoreboard = useCallback(
    async ({ showLoading = true } = {}) => {
      if (showLoading && scoreboardMountedRef.current) {
        setLoading(true);
        setSubmissionsLoading(true);
      }
      try {
        const [scoreRes, entriesRes] = await Promise.all([
          fetch(`${import.meta.env.BASE_URL}api/scoreboard/current`),
          fetch(`${import.meta.env.BASE_URL}api/entries?week=current`)
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
    const loadClasses = async () => {
      try {
        setClassesLoading(true);
        const res = await fetch(`${import.meta.env.BASE_URL}api/classes`);
        const payload = await res.json();
        if (res.ok) {
          setClassesList(payload.classes || []);
        }
      } catch {
        // ignore
      } finally {
        setClassesLoading(false);
      }
    };
    loadClasses();

    const handleRefresh = () => {
      loadScoreboard({ showLoading: false });
    };
    window.addEventListener("scoreboard:refresh", handleRefresh);

    return () => {
      scoreboardMountedRef.current = false;
      window.removeEventListener("scoreboard:refresh", handleRefresh);
    };
  }, [loadScoreboard]);


  // Load submissions based on active carousel slide
  useEffect(() => {
    let isMounted = true;

    const loadSubmissions = async () => {
      setSubmissionsLoading(true);
      try {
        const endpoint = activeSlide === 0
          ? `${import.meta.env.BASE_URL}api/entries?week=current`
          : `${import.meta.env.BASE_URL}api/entries?term=current`;

        const response = await fetch(endpoint);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load entries");
        }

        if (isMounted) {
          setSubmissions(payload.entries || []);
          setSubmissionsError("");
        }
      } catch (err) {
        if (isMounted) {
          setSubmissionsError(err.message);
        }
      } finally {
        if (isMounted) {
          setSubmissionsLoading(false);
        }
      }
    };

    loadSubmissions();
    return () => {
      isMounted = false;
    };
  }, [activeSlide]);

  useEffect(() => {
    if (Object.prototype.hasOwnProperty.call(aiHighlights, currentPeriod)) {
      return;
    }

    let isMounted = true;

    fetch(`${import.meta.env.BASE_URL}api/highlights?period=${currentPeriod}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setAiHighlights((prev) => ({
          ...prev,
          [currentPeriod]: data?.text ?? null,
        }));
      })
      .catch(() => {
        if (!isMounted) return;
        setAiHighlights((prev) => ({
          ...prev,
          [currentPeriod]: null,
        }));
      });

    return () => {
      isMounted = false;
    };
  }, [currentPeriod, aiHighlights]);

  useEffect(() => {
    let isMounted = true;
    setValuesLoading(true);

    fetch(`${import.meta.env.BASE_URL}api/values-breakdown?period=${currentPeriod}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setValuesData({
          houses: data?.current?.houses || data?.houses || data?.data || [],
          years: data?.current?.years || data?.years || [],
        });
        setPreviousValuesData({
          houses: data?.previous?.houses || [],
          years: data?.previous?.years || [],
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setValuesData({ houses: [], years: [] });
        setPreviousValuesData({ houses: [], years: [] });
      })
      .finally(() => {
        if (isMounted) setValuesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentPeriod]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/values-captions?period=${currentPeriod}`)
      .then((res) => res.json())
      .then((data) =>
        setValueCaptions({
          houses: data?.houses || {},
          years: data?.years || {},
        })
      )
      .catch(() => setValueCaptions({ houses: {}, years: {} }));
  }, [currentPeriod]);

  useEffect(() => {
    let isMounted = true;
    setClassValuesLoading(true);

    fetch(`${import.meta.env.BASE_URL}api/values-by-class?period=${currentPeriod}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setClassValuesData(data?.data || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setClassValuesData([]);
      })
      .finally(() => {
        if (isMounted) setClassValuesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentPeriod]);

  // Global listener for admin-triggered PPT export
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
  const renderWaffleImage = useCallback(
    async (data) => {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const root = createRoot(container);
      root.render(
        <WaffleChart
          data={data}
          colours={categoryColorMap}
          size="xl"
        />
      );

      const html2canvas = await loadHtml2Canvas();

      if (!html2canvas) {
        root.unmount();
        container.remove();
        return "";
      }

      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      root.unmount();
      container.remove();
      return canvas.toDataURL("image/png");
    },
    [categoryColorMap, loadHtml2Canvas]
  );
  const valuesByHouse = useMemo(() => {
    const map = {};
    housesData.forEach((row) => {
      const houseId = resolveHouseKey(row.house_id) || row.house_id;
      if (!houseId) return;
      if (!map[houseId]) {
        map[houseId] = [];
      }
      map[houseId].push({
        category: row.award_category,
        points: Number(row.total_points || 0),
      });
    });
    return map;
  }, [housesData]);
  const prevValuesByHouse = useMemo(() => {
    const map = {};
    prevHousesData.forEach((row) => {
      const houseId = resolveHouseKey(row.house_id) || row.house_id;
      if (!houseId) return;
      if (!map[houseId]) {
        map[houseId] = [];
      }
      map[houseId].push({
        category: row.award_category,
        points: Number(row.total_points || 0),
      });
    });
    return map;
  }, [prevHousesData]);
  const houseDominance = useMemo(() => {
    const map = {};
    HOUSE_ORDER.forEach((houseId) => {
      const data = normaliseValues(valuesByHouse[houseId] || []);
      map[houseId] = getDominantPct(data);
    });
    return map;
  }, [valuesByHouse, normaliseValues, getDominantPct]);
  const houseDelta = useMemo(() => {
    const map = {};
    HOUSE_ORDER.forEach((houseId) => {
      const curPct = getDominantPct(normaliseValues(valuesByHouse[houseId] || []));
      const prevPct = getDominantPct(normaliseValues(prevValuesByHouse[houseId] || []));
      map[houseId] = curPct - prevPct;
    });
    return map;
  }, [valuesByHouse, prevValuesByHouse, getDominantPct, normaliseValues]);
  const sortedHouses = useMemo(() => {
    return [...HOUSE_ORDER].sort((a, b) => {
      const diff =
        getDominantPct(normaliseValues(valuesByHouse[b] || [])) -
        getDominantPct(normaliseValues(valuesByHouse[a] || []));

      return diff !== 0 ? diff : HOUSE_ORDER.indexOf(a) - HOUSE_ORDER.indexOf(b);
    });
  }, [valuesByHouse, getDominantPct, normaliseValues]);
  const classHouseBreakdown = useMemo(() => {
    const map = {};
    classValuesData.forEach((row) => {
      const classId = row.class_id;
      const houseId = resolveHouseKey(row.house_id) || row.house_id;
      if (!classId || !houseId) return;
      if (!map[classId]) map[classId] = {};
      map[classId][houseId] = (map[classId][houseId] || 0) + Number(row.total_points || 0);
    });
    return map;
  }, [classValuesData]);
  const yearHouseBreakdown = useMemo(() => {
    const map = {};
    classesList.forEach((cls) => {
      const yearLabel = cls.YearGrp ? `Year ${cls.YearGrp}` : "Year ?";
      if (!map[yearLabel]) map[yearLabel] = {};
      const classBreak = classHouseBreakdown[cls.id] || {};
      Object.entries(classBreak).forEach(([houseId, pts]) => {
        map[yearLabel][houseId] = (map[yearLabel][houseId] || 0) + pts;
      });
    });
    return map;
  }, [classesList, classHouseBreakdown]);
  const totalValues = useMemo(() => {
    const rows = housesData.map(({ award_category, total_points }) => ({
      category: award_category,
      points: Number(total_points || 0),
    }));
    return normaliseValues(rows);
  }, [housesData, normaliseValues]);
  const yearGroupOrder = useMemo(() => {
    const set = new Set();
    yearsData.forEach((row) => {
      const key = row.year_group ?? row.yearGroup ?? row.year ?? null;
      if (key === null || key === undefined) return;
      set.add(String(key));
    });
    classesList.forEach((cls) => {
      if (cls.YearGrp === null || cls.YearGrp === undefined) return;
      set.add(String(cls.YearGrp));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [yearsData, classesList]);

  const valuesByYear = useMemo(() => {
    const map = {};
    yearsData.forEach((row) => {
      const key = row.year_group ?? row.yearGroup ?? row.year ?? null;
      if (key === null || key === undefined) return;
      if (!map[key]) map[key] = [];
      map[key].push({
        category: row.award_category,
        points: Number(row.total_points || 0),
      });
    });
    return map;
  }, [yearsData]);
  const prevValuesByYear = useMemo(() => {
    const map = {};
    prevYearsData.forEach((row) => {
      const key = row.year_group ?? row.yearGroup ?? row.year ?? null;
      if (key === null || key === undefined) return;
      if (!map[key]) map[key] = [];
      map[key].push({
        category: row.award_category,
        points: Number(row.total_points || 0),
      });
    });
    return map;
  }, [prevYearsData]);
  const yearDelta = useMemo(() => {
    const map = {};
    yearGroupOrder.forEach((year) => {
      const curPct = getDominantPct(normaliseValues(valuesByYear[year] || []));
      const prevPct = getDominantPct(normaliseValues(prevValuesByYear[year] || []));
      map[year] = curPct - prevPct;
    });
    return map;
  }, [yearGroupOrder, valuesByYear, prevValuesByYear, getDominantPct, normaliseValues]);
  const valuesByClass = useMemo(() => {
    const base = {};
    classesList.forEach((cls) => {
      const teacher = [cls.teacherTitle, cls.teacherFirstName, cls.teacherLastName].filter(Boolean).join(" ");
      base[cls.id] = {
        className: cls.name,
        teacher,
        data: [],
      };
    });

    classValuesData.forEach((row) => {
      const key = row.class_id;
      if (!key) return;
      if (!base[key]) {
        const teacher = [row.teacher_title, row.teacher_first_name, row.teacher_last_name].filter(Boolean).join(" ");
        base[key] = {
          className: row.class_name,
          teacher,
          data: [],
        };
      }
      base[key].data.push({
        category: row.award_category,
        points: Number(row.total_points || 0),
      });
    });

    return base;
  }, [classValuesData, classesList]);
  const strongestValue = useMemo(() => {
    if (!totalValues.length) return null;
    const isGeneralAward = (category) =>
      typeof category === "string" && category.trim().toLowerCase() === "general award";
    const candidates = totalValues.filter((value) => !isGeneralAward(value.category));
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => (b.points > a.points ? b : a));
  }, [totalValues]);

  const TrendArrow = ({ delta }) => {
    if (Math.abs(delta || 0) < 0.02) return <span className="text-slate-400">→</span>;
    return delta > 0 ? <span className="text-green-600">↑</span> : <span className="text-red-600">↓</span>;
  };
  const classTotals = useMemo(() => {
    const map = {};
    classesList.forEach((cls) => {
      map[cls.id] = {
        classId: cls.id,
        className: cls.name,
        year: cls.YearGrp,
        points: 0,
      };
    });
    classValuesData.forEach((row) => {
      const id = row.class_id;
      if (!map[id]) {
        map[id] = { classId: id, className: row.class_name, year: row.YearGrp, points: 0 };
      }
      map[id].points += Number(row.total_points || 0);
    });
    return Object.values(map).sort((a, b) => b.points - a.points);
  }, [classValuesData, classesList]);
  const yearGroupTotals = useMemo(() => {
    const map = {};
    classTotals.forEach((cls) => {
      const yearLabel = cls.year ? `Year ${cls.year}` : "Year ?";
      if (!map[yearLabel]) {
        map[yearLabel] = { yearLabel, points: 0 };
      }
      map[yearLabel].points += cls.points;
    });
    return Object.values(map).sort((a, b) => {
      const aNum = parseInt(a.yearLabel.replace(/\D/g, ""), 10);
      const bNum = parseInt(b.yearLabel.replace(/\D/g, ""), 10);
      if (Number.isNaN(aNum) || Number.isNaN(bNum)) return a.yearLabel.localeCompare(b.yearLabel);
      return aNum - bNum;
    });
  }, [classTotals]);

  const weekBrickPatterns = useMemo(
    () =>
      weekRows.map((row, idx) => ({
        id: `week-house-brick-${idx}`,
        color: row.color ?? "#2563eb",
      })),
    [weekRows]
  );

  const termBrickPatterns = useMemo(
    () =>
      termRows.map((row, idx) => ({
        id: `term-house-brick-${idx}`,
        color:
          row.color ??
          getHouseById(row.houseKey)?.color ??
          "#2563eb",
      })),
    [termRows]
  );

  // year/class breakdowns use solid fills (no patterns)

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
  const weekSummaryLine = useMemo(() => {
    const sorted = [...weekRows].sort((a, b) => (b.points || 0) - (a.points || 0));
    const leader = sorted[0];
    const second = sorted[1];
    const leaderName = leader ? (getHouseById(leader.houseKey)?.name || leader.name || leader.houseKey) : null;
    const prevLeaderName = prevWeekLeaderRef.current
      ? getHouseById(prevWeekLeaderRef.current)?.name || prevWeekLeaderRef.current
      : null;
    const leaderMargin = leader && second ? (leader.points || 0) - (second.points || 0) : 0;
    const strongestDeltaHouse =
      second && leaderMargin <= 10
        ? getHouseById(second.houseKey)?.name || second.name || second.houseKey
        : null;
    return generateSummaryLine({
      leader: leaderName,
      prevLeader: prevLeaderName,
      leaderMargin,
      strongestDeltaHouse,
      periodLabel: "week",
    });
  }, [weekRows, houseDelta]);

  const termSummaryLine = useMemo(() => {
    const sorted = [...termRows].sort((a, b) => (b.points || 0) - (a.points || 0));
    const leader = sorted[0];
    const second = sorted[1];
    const leaderName = leader ? (getHouseById(leader.houseKey)?.name || leader.name || leader.houseKey) : null;
    const prevLeaderName = prevTermLeaderRef.current
      ? getHouseById(prevTermLeaderRef.current)?.name || prevTermLeaderRef.current
      : null;
    const leaderMargin = leader && second ? (leader.points || 0) - (second.points || 0) : 0;
    const strongestDeltaHouse =
      second && leaderMargin <= 10
        ? getHouseById(second.houseKey)?.name || second.name || second.houseKey
        : null;
    return generateSummaryLine({
      leader: leaderName,
      prevLeader: prevLeaderName,
      leaderMargin,
      strongestDeltaHouse,
      periodLabel: "term",
    });
  }, [termRows, houseDelta]);

  useEffect(() => {
    const handler = () => {
      const currentRows = currentPeriod === "week" ? weekRows : termRows;
      const sorted = [...currentRows].sort((a, b) => (b.points || 0) - (a.points || 0));
      const leaderRow = sorted[0];
      const secondRow = sorted[1];
      const leaderName = leaderRow
        ? getHouseById(leaderRow.houseKey)?.name || leaderRow.name || leaderRow.houseKey
        : "—";
      const leaderColor = leaderRow
        ? leaderRow.color || getHouseById(leaderRow.houseKey)?.color || "#2563eb"
        : "#2563eb";
      const leaderMargin = leaderRow && secondRow ? (leaderRow.points || 0) - (secondRow.points || 0) : 0;
      const prevLeaderName =
        currentPeriod === "week"
          ? (prevWeekLeaderRef.current
            ? getHouseById(prevWeekLeaderRef.current)?.name || prevWeekLeaderRef.current
            : null)
          : (prevTermLeaderRef.current
            ? getHouseById(prevTermLeaderRef.current)?.name || prevTermLeaderRef.current
            : null);
      const chartData = currentRows.map((row) => ({
        name: getHouseById(row.houseKey)?.name || row.name || row.houseKey,
        points: row.points || 0,
        color: row.color || getHouseById(row.houseKey)?.color || "#94a3b8",
      }));

      exportAssemblyDeck({
        view: currentPeriod,
        periodLabel: currentPeriod === "week" ? "week" : "term",
        updatedLabel: lastUpdatedLabel,
        summaryLine: currentPeriod === "week" ? weekSummaryLine : termSummaryLine,
        leader: {
          name: leaderName,
          color: leaderColor,
          margin: leaderMargin,
          prevLeader: prevLeaderName,
        },
        chartData,
        deltas: houseDelta,
        totalValues,
        houses: sortedHouses.map((id) => ({
          id,
          name: HOUSES[id].name,
          data: valuesByHouse[id] || [],
          caption: valueCaptions.houses?.[id],
          color: HOUSES[id].color,
        })),
        colours: categoryColorMap,
      }).catch((err) => console.error("Admin-triggered PPT export failed", err));
    };

    window.addEventListener("export-assembly-ppt", handler);
    return () => window.removeEventListener("export-assembly-ppt", handler);
  }, [
    currentPeriod,
    weekRows,
    termRows,
    weekSummaryLine,
    termSummaryLine,
    houseDelta,
    totalValues,
    sortedHouses,
    valuesByHouse,
    categoryColorMap,
    lastUpdatedLabel,
    valueCaptions,
    valueCaptions.houses,
  ]);

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

  useEffect(() => {
    prevTermLeaderRef.current = termLeadingHouseKey;
  }, [termLeadingHouseKey]);
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
  const weekLeadingHouseFooter = leadingHouseFooter;
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

  if (!isAllowedPath) return null;

  return (
    <section className={`${containerClasses} w-full`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Live scoreboard</p>
          <p className="text-[9px] text-slate-600">Updated: {lastUpdatedLabel}</p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-2">
          {activeSlide === 1 && (
            <button
              onClick={() => setActiveSlide(0)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-blue-600 bg-blue-600 text-white shadow-sm transition hover:bg-blue-500"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">
                THIS WEEK
              </span>
            </button>
          )}
          {activeSlide === 0 && (
            <button
              onClick={() => setActiveSlide(1)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-red-600 bg-red-600 text-white shadow-sm transition hover:bg-red-500"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">
                THIS TERM
              </span>
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
      </div>


      <div className="relative w-full overflow-hidden">
        {/* Carousel Tracks */}
        <div
          className="flex transition-transform duration-500 ease-in-out will-change-transform"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {/* SLIDE 1: This Week */}
          <div className="w-full flex-shrink-0 px-1">
            <div className="flex flex-col gap-6">
              {/* Weekly Total Tile */}
              {showTotalsPanel && (
                <div
                  className="rounded-3xl text-white text-center flex flex-col items-center gap-3 border border-white/30 ring-1 ring-black/20 mx-1"
                  style={{
                    background: `linear-gradient(135deg, ${WEEK_TITLE_COLOR}, #0f172a)`,
                    padding: "28px",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -8px 16px rgba(0,0,0,0.25)",
                  }}
                >
                  <h2
                    className="highlight-title text-lg uppercase tracking-[0.4em]"
                    style={PLAYFUL_FONT}
                  >
                    This week total
                  </h2>
                  <p className="text-4xl font-semibold drop-shadow-sm" style={PLAYFUL_FONT}>
                    {thisWeekTotal} pts
                  </p>
                  <p className="text-sm text-white/80" style={PLAYFUL_FONT}>
                    Keep adding points before Friday 14:25 GMT.
                  </p>
                  <p className="text-xs text-slate-200 mt-1 leading-tight truncate">
                    {weekSummaryLine}
                  </p>
                </div>
              )}

              {/* Chart Card */}
              <div
                className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                style={weekCardBorderStyle}
              >
                <div className="absolute right-10 top-10 flex gap-2 no-export z-10">

                </div>
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
                <ChartGuard
                  name="week-main"
                  forwardedRef={chartRef}
                  className="w-full min-h-[320px]"
                  style={{ height: "400px" }}
                >
                  {loading ? (
                    <p className="text-sm text-slate-500">Loading scoreboard…</p>
                  ) : error ? (
                    <p className="text-sm text-rose-600">{error}</p>
                  ) : (
                    <div className="h-full">
                      <ResponsiveContainer ref={weekChartRef} width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart
                        data={weekRows}
                        margin={{ top: 10, right: 0, left: 0, bottom: 60 }}
                        barCategoryGap="0%"
                        barGap={0}
                      >
                        <BrickPatternDefs patterns={weekBrickPatterns} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="houseKey"
                            tick={(props) => <HouseAxisTick {...props} axisMetaMap={weekAxisMap} />}
                            tickLine={false}
                            axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                          />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: "#0f172a", strokeWidth: 2 }} width={40} />
                          <Tooltip content={renderHouseTooltip} />
                          <Bar
                            dataKey="points"
                            fill="transparent"
                            shape={(props) => (
                              <TopRoundedBar
                                {...props}
                                leadingHouseKey={weekLeadingHouseKey}
                                highlightHouseKeys={tiedHouseKeys}
                              />
                            )}
                          >
                            {weekRows.map((row, idx) => {
                              const pattern = weekBrickPatterns[idx];
                              return (
                                <Cell
                                  key={pattern?.id ?? idx}
                                  fill={
                                    pattern && Number(row.points ?? 0) > 0
                                      ? `url(#${pattern.id})`
                                      : "transparent"
                                  }
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </ChartGuard>
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowWeekYearBars((v) => !v)}
                    className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-slate-900"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs">
                      {showWeekYearBars ? "–" : "+"}
                    </span>
                    {showWeekYearBars ? "Hide year breakdown" : "Show year breakdown"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWeekClassBars((v) => !v)}
                    className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-slate-900"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs">
                      {showWeekClassBars ? "–" : "+"}
                    </span>
                    {showWeekClassBars ? "Hide class breakdown" : "Show class breakdown"}
                  </button>
                </div>

                {showWeekYearBars && (
                  <ChartGuard name="week-year" className="mt-3 h-72 min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={yearGroupTotals}
                      margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="yearLabel"
                        height={40}
                        interval={0}
                        tick={{ fontSize: 11 }}
                        axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                        tickLine={false}
                      />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: "#0f172a", strokeWidth: 2 }} width={40} />
                      <Tooltip content={renderYearTooltip} />
                      <Bar
                        dataKey="points"
                        fill="#0b1f3a"
                        radius={[8, 8, 0, 0]}
                        stroke="#0f172a"
                        strokeWidth={2}
                        label={renderBarValueLabel}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  </ChartGuard>
                )}

                {showWeekClassBars && (
                  <ChartGuard name="week-class" className="mt-3 h-72 min-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={classTotals}
                      margin={{ top: 10, right: 10, left: 10, bottom: 80 }}
                      barCategoryGap="0%"
                      barGap={0}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="className"
                        angle={-35}
                        textAnchor="end"
                          height={70}
                          interval={0}
                        tick={{ fontSize: 10 }}
                        axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                        tickLine={false}
                      />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: "#0f172a", strokeWidth: 2 }} width={40} />
                      <Tooltip content={renderClassTooltip} />
                      <Bar
                        dataKey="points"
                        fill="#0ea5e9"
                        radius={[6, 6, 0, 0]}
                        stroke="#0f172a"
                        strokeWidth={2}
                        label={renderBarValueLabel}
                      />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartGuard>
                )}
              </div>

              {/* Race Track for Week */}

                  <ProgressTrack
                    title="RACE FOR THE WEEK!"
                    subtitle={weekRangeLabel}
                    rows={weekRows}
                    timeProgress={weekTimeProgress}
                    placeholderText="Week data unavailable"
                    highlightHouseKeys={tiedHouseKeys}
                    timePillType="weekday"
                    finishLabel="Finish · Friday 14:25 GMT"
                    timePillPrimaryColor={leadingHouseColor}
                    timePillTieColors={tieHouseColors}
                    footer={weekLeadingHouseFooter}
                    titleColor={WEEK_TITLE_COLOR}
                    borderStyle={weekTrackBorderStyle}
                    leaderHouseKey={weekLeadingHouseKey}
                    onFinish={fireConfettiBurst}
                  />
                </div>
            </div>


          {/* SLIDE 2: This Term */}
          <div className="w-full flex-shrink-0 px-1">
            <div className="flex flex-col gap-6">
              {/* Term Total Tile */}
              {showTotalsPanel && (
                <div
                  className="rounded-3xl text-white text-center flex flex-col items-center gap-3 border border-white/30 ring-1 ring-black/20 mx-1"
                  style={{
                    background: "linear-gradient(135deg, #dc2626, #111827)",
                    padding: "28px",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -8px 16px rgba(0,0,0,0.25)",
                  }}
                >
                  <h2
                    className="highlight-title text-lg uppercase tracking-[0.4em]"
                    style={PLAYFUL_FONT}
                  >
                    Current Term Total
                  </h2>
                  <p className="text-3xl font-semibold drop-shadow-sm" style={PLAYFUL_FONT}>
                    {termTotalPoints} pts
                  </p>
                  <p className="text-sm text-white/80" style={PLAYFUL_FONT}>
                    Points earned so far this term.
                  </p>
                  <p className="text-xs text-slate-200 mt-1 leading-tight truncate">
                    {termSummaryLine}
                  </p>
                </div>
              )}

              {/* Chart Card */}
              <div
                className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
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
                  <div className="flex items-center justify-center text-sm text-slate-500" style={{ height: "400px" }}>
                    No active term
                  </div>
                ) : (
                  <ChartGuard name="term-main" className="w-full min-h-[320px]" style={{ height: "400px" }}>
                    <ResponsiveContainer ref={termChartRef} width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart
                        data={termRows}
                        margin={{ top: 10, right: 0, left: 0, bottom: 60 }}
                        barCategoryGap="0%"
                        barGap={0}
                      >
                        <BrickPatternDefs patterns={termBrickPatterns} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="houseKey"
                          tick={(props) => <HouseAxisTick {...props} axisMetaMap={termAxisMap} />}
                          tickLine={false}
                          axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                        />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: "#0f172a", strokeWidth: 2 }} width={40} />
                        <Tooltip content={renderHouseTooltip} />
                        <Bar
                          dataKey="points"
                          fill="transparent"
                          shape={(props) => (
                            <TopRoundedBar
                              {...props}
                              leadingHouseKey={termLeadingHouseKey}
                              highlightHouseKeys={termTiedHouseKeys}
                            />
                          )}
                        >
                          {termRows.map((row, idx) => {
                            const pattern = termBrickPatterns[idx];
                            return (
                              <Cell
                                key={pattern?.id ?? idx}
                                fill={
                                  pattern && Number(row.points ?? 0) > 0
                                    ? `url(#${pattern.id})`
                                    : "transparent"
                                }
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartGuard>
                )}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowTermYearBars((v) => !v)}
                    className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-slate-900"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs">
                      {showTermYearBars ? "–" : "+"}
                    </span>
                    {showTermYearBars ? "Hide year-group breakdown" : "Show year-group breakdown"}
                  </button>
                </div>

              {showTermYearBars && (
                <ChartGuard name="term-year" className="mt-3 h-72 min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart
                      data={yearGroupTotals}
                      margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="yearLabel"
                          height={40}
                          interval={0}
                          tick={{ fontSize: 11 }}
                          axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                          tickLine={false}
                        />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: "#0f172a", strokeWidth: 2 }} width={40} />
                        <Tooltip content={renderYearTooltip} />
                        <Bar
                          dataKey="points"
                          fill="#0b1f3a"
                          radius={[8, 8, 0, 0]}
                          stroke="#0f172a"
                          strokeWidth={2}
                          label={renderBarValueLabel}
                        />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartGuard>
              )}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowTermClassBars((v) => !v)}
                    className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-slate-900"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs">
                      {showTermClassBars ? "–" : "+"}
                    </span>
                    {showTermClassBars ? "Hide class breakdown" : "Show class breakdown"}
                  </button>
                </div>

                {showTermClassBars && (
                  <ChartGuard name="term-class" className="mt-3 h-72 min-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <BarChart
                        data={classTotals}
                        margin={{ top: 10, right: 10, left: 10, bottom: 80 }}
                        barCategoryGap="0%"
                        barGap={0}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="className"
                          angle={-35}
                          textAnchor="end"
                          height={70}
                          interval={0}
                          tick={{ fontSize: 10 }}
                          axisLine={{ stroke: "#0f172a", strokeWidth: 2 }}
                          tickLine={false}
                        />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: "#0f172a", strokeWidth: 2 }} width={40} />
                        <Tooltip content={renderClassTooltip} />
                      <Bar
                        dataKey="points"
                        fill="#dc2626"
                        radius={[6, 6, 0, 0]}
                        stroke="#0f172a"
                        strokeWidth={2}
                        label={renderBarValueLabel}
                      />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartGuard>
                )}
              </div>

              {/* Race Track for Term */}

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
              </div>
            </div>
          </div>

      {highlightsText !== undefined && (
        <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_45px_rgba(15,23,42,0.25)] mb-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <h2
              className="highlight-title text-lg font-semibold uppercase tracking-[0.4em] text-slate-900"
              style={PLAYFUL_FONT}
            >
              {currentPeriod === "week" ? "This Week's Highlights" : "Term Highlights"}
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            {highlightsText || (currentPeriod === "week"
              ? "I need more teacher notes to produce highlights for this week"
              : "I need more teacher notes to produce highlights for this term")}
          </p>
          <div className="pointer-events-none absolute top-0 right-0 h-14 w-14">
            <div
              className="absolute inset-0 border-l border-t border-slate-200 shadow-lg"
              style={{ background: "white", clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
            />
            <div
              className="absolute inset-2 border-l border-t border-slate-100"
              style={{ background: "rgba(148, 163, 184, 0.45)", clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
            />
          </div>
        </div>
      )}

      {!valuesLoading && (
        <div ref={valuesRef} className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm mb-6">
        <div className="absolute right-6 top-6 flex gap-2 no-export z-[5]">
          <button
            type="button"
            disabled={exporting.slides}
            onClick={async () => {
              setExporting((p) => ({ ...p, slides: true }));
              try {
                const currentRows = currentPeriod === "week" ? weekRows : termRows;
                const sorted = [...currentRows].sort((a, b) => (b.points || 0) - (a.points || 0));
                const leaderRow = sorted[0];
                const secondRow = sorted[1];
                const leaderName = leaderRow
                  ? getHouseById(leaderRow.houseKey)?.name || leaderRow.name || leaderRow.houseKey
                  : "—";
                const leaderColor = leaderRow
                  ? leaderRow.color || getHouseById(leaderRow.houseKey)?.color || "#2563eb"
                  : "#2563eb";
                const leaderMargin =
                  leaderRow && secondRow ? (leaderRow.points || 0) - (secondRow.points || 0) : 0;
                const prevLeaderName =
                  currentPeriod === "week"
                    ? (prevWeekLeaderRef.current
                      ? getHouseById(prevWeekLeaderRef.current)?.name || prevWeekLeaderRef.current
                      : null)
                    : (prevTermLeaderRef.current
                      ? getHouseById(prevTermLeaderRef.current)?.name || prevTermLeaderRef.current
                      : null);
                const chartData = currentRows.map((row) => ({
                  name: getHouseById(row.houseKey)?.name || row.name || row.houseKey,
                  points: row.points || 0,
                  color: row.color || getHouseById(row.houseKey)?.color || "#94a3b8",
                }));

                await exportAssemblyDeck({
                  view: currentPeriod,
                  periodLabel: currentPeriod === "week" ? "week" : "term",
                  updatedLabel: lastUpdatedLabel,
                  summaryLine: currentPeriod === "week" ? weekSummaryLine : termSummaryLine,
                  leader: {
                    name: leaderName,
                    color: leaderColor,
                    margin: leaderMargin,
                    prevLeader: prevLeaderName,
                  },
                  chartData,
                  deltas: houseDelta,
                  totalValues,
                  houses: sortedHouses.map((id) => ({
                    id,
                    name: HOUSES[id].name,
                    data: valuesByHouse[id] || [],
                    caption: valueCaptions.houses?.[id],
                    color: HOUSES[id].color,
                  })),
                  colours: categoryColorMap,
                });
              } catch (err) {
                console.error("Export slides failed", err);
                alert("Export slides failed. Please try again. Ensure internet access and allow downloads.");
              } finally {
                setExporting((p) => ({ ...p, slides: false }));
              }
            }}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm transition ${
              exporting.slides ? "bg-slate-400 cursor-wait" : "bg-orange-600 hover:bg-orange-700"
            } no-export`}
          >
            <Presentation className="h-4 w-4" />
            {exporting.slides ? "Building…" : "Export slides"}
            {exporting.slides && <span className="h-3 w-3 animate-spin rounded-full border border-white/70 border-t-transparent" />}
          </button>
        </div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
                <h3
                  className="highlight-title text-lg font-semibold uppercase tracking-[0.4em]"
                  style={{ ...PLAYFUL_FONT, color: "#ef4444" }}
                >
                  Living our values through points
                </h3>
              </div>
              <p className="text-sm text-slate-600">
                {currentPeriod === "week" ? "This week" : "This term"} by award category
              </p>
            </div>
            {isStaff && (
              <label className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                <input
                  type="checkbox"
                  checked={deepDive}
                  onChange={(e) => setDeepDive(e.target.checked)}
                />
                Staff deep-dive
              </label>
            )}
          </div>

            <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-12 items-start">
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold text-slate-700">
                  Whole school
                </h3>
                <div className="waffle-grid-start rounded-2xl border-2 border-blue-700 p-4">
                  <WaffleChart
                    data={totalValues}
                    colours={categoryColorMap}
                    size="xl"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div aria-hidden className="h-[1.75rem]" />
                <div className="waffle-grid-start">
                  <div className="flex flex-col gap-3 items-start text-sm">
                    <p className="pt-2 text-xs text-slate-500">
                      Each circle represents 1% of points awarded
                    </p>
                    {awardCategories.map((cat) => (
                      <div key={cat} className="flex gap-3 items-start">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: categoryColorMap[cat] || "#e5e7eb" }}
                        />
                        <span className="capitalize text-slate-700">
                          {cat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {strongestValue && (
              <div className="flex flex-col gap-2">
                <div
                  className="rounded-3xl border px-4 py-2.5 text-sm font-semibold shadow-[0_12px_18px_rgba(15,23,42,0.35)]"
                  style={{
                    background: "linear-gradient(135deg, #fef3c7 0%, #d4af37 60%, #a0711c 100%)",
                    borderColor: "#c49117",
                    color: "#0f172a",
                    boxShadow: "0 15px 30px rgba(15,23,42,0.45), inset 0 1px 5px rgba(255,255,255,0.5)",
                  }}
                >
                  <span className="text-base leading-snug flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>
                      This {currentPeriod === "week" ? "week’s" : "term’s"} strongest value:{" "}
                      <span className="capitalize">{strongestValue.category}</span>
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {sortedHouses.map((houseId) => {
                const house = HOUSES[houseId];
                const data = normaliseValues(valuesByHouse[houseId] || []);
                const total = data.reduce((s, d) => s + d.points, 0);

                return (
                  <div key={houseId} className="space-y-2">
                    <h5
                      className="text-sm font-semibold flex items-center gap-2"
                      style={PLAYFUL_FONT}
                    >
                      {house.icon && (
                        <house.icon className="h-4 w-4" color={house.color} />
                      )}
                      <span>{house.name}</span>
                    </h5>

                    <WaffleChart
                      data={data}
                      colours={categoryColorMap}
                      size="md"
                      frameColour={house.color}
                    />
                    {(captionsByHouse[houseId] || houseDelta[houseId] !== undefined) && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-600">
                          {data.length === 0 ? "No data" : (captionsByHouse[houseId] || "No data")}
                        </p>
                        <TrendArrow delta={houseDelta[houseId]} />
                      </div>
                    )}
                    {deepDive && (
                      <ul className="text-xs text-slate-500 mt-1 space-y-1">
                        {data.length === 0 ? (
                          <li>No data</li>
                        ) : (
                          data.map((d) => (
                            <li key={d.category}>
                              {d.category}: {total ? Math.round((d.points / total) * 100) : 0}% ({d.points} pts)
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <h4 className="mb-4 text-sm font-semibold text-slate-700">
                By year group
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {yearGroupOrder.map((year) => {
                  const data = normaliseValues(valuesByYear[year] || []);
                  const total = data.reduce((s, d) => s + d.points, 0);
                  return (
                    <div key={year} className="space-y-2">
                      <h5 className="text-sm font-semibold">Year {year}</h5>
                      <WaffleChart
                        data={data}
                        colours={categoryColorMap}
                        size="md"
                        frameColour="#e2e8f0"
                      />
                      {(captionsByYear?.[year] || yearDelta[year] !== undefined) && (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-600">
                            {data.length === 0 ? "No data" : (captionsByYear?.[year] || "No data")}
                          </p>
                          <TrendArrow delta={yearDelta[year]} />
                        </div>
                      )}
                      {deepDive && (
                        <ul className="text-xs text-slate-500 mt-1 space-y-1">
                          {data.length === 0 ? (
                            <li>No data</li>
                          ) : (
                            data.map((d) => (
                              <li key={d.category}>
                                {d.category}: {total ? Math.round((d.points / total) * 100) : 0}% ({d.points} pts)
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowClassBreakdown(!showClassBreakdown)}
                className="text-sm font-semibold text-slate-700 flex items-center gap-2 hover:text-slate-900"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs">
                  {showClassBreakdown ? "–" : "+"}
                </span>
                {showClassBreakdown ? "Hide class breakdown" : "Show class breakdown"}
              </button>
            </div>

            {showClassBreakdown && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.values(valuesByClass).map((entry, idx) => {
                  const data = normaliseValues(entry.data || []);
                  return (
                    <div key={`${entry.className}-${idx}`} className="space-y-2">
                      <h5 className="text-sm font-semibold">
                        {entry.className}
                      </h5>
                      <p className="text-xs text-slate-500">
                        {entry.teacher}
                      </p>
                      <WaffleChart
                        data={data}
                        colours={categoryColorMap}
                        size="md"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
            <p className="text-sm text-slate-600">
              {activeSlide === 0 ? "Points recorded this week." : "Points recorded this term."}
            </p>
          </div>
        </div>

        {submissionsLoading ? (
          <p className="text-sm text-slate-500">Loading submissions…</p>
        ) : submissionsError ? (
          <p className="text-sm text-rose-600">{submissionsError}</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-slate-600">
            {activeSlide === 0 ? "No submissions yet this week." : "No submissions yet this term."}
          </p>
        ) : (
          <div className="overflow-x-auto overflow-y-auto -mx-6" style={{ maxHeight: "420px" }}>
            <table className="w-full min-w-[700px] table-auto text-sm relative">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.3em] text-slate-500 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Class</th>
                  <th className="px-6 py-3">House</th>
                  <th className="px-6 py-3">Points</th>
                  <th className="px-6 py-3">Category</th>
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
                  const teacherLabel = entry.teacherDisplayName || entry.submitted_by_email || "—";
                  const submittedByLabel = `${entry.class_name}${teacherLabel ? ` · ${teacherLabel}` : ""}`;
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
                      <td className="px-6 py-4 text-slate-600">{entry.award_category || "General"}</td>
                      <td className="px-6 py-4 text-slate-600">{submittedByLabel}</td>
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

    </section >
  );
}

export default function ScoreboardPage() {
  return <ScoreboardContent />;
}
function ChartGuard({ name, className, style, children, forwardedRef }) {
  const localRef = useRef(null);
  const containerRef = forwardedRef ?? localRef;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      const ok = rect.width > 0 && rect.height > 0;
      if (!ok) {
        // Debug only: helps identify which chart container is still 0-sized.
        console.warn(`[ChartGuard] ${name ?? "chart"} has zero size`, {
          width: rect.width,
          height: rect.height,
        });
      }
      setReady(ok);
    };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(node);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [containerRef]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {ready ? children : <p className="text-sm text-slate-500">Loading chart…</p>}
    </div>
  );
}
