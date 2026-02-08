import { createPortal } from "react-dom";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, Navigate } from "react-router-dom";
import { Presentation, Printer, Send, UserStar, Shield, ChevronDown, ChartPie } from "lucide-react";

const PLAYFUL_FONT = '"Permanent Marker", "Marker Felt", "Kalam", cursive';

const Admin = lazy(() => import("./pages/Admin"));
const EmbedScoreboard = lazy(() => import("./pages/EmbedScoreboard"));
const Scoreboard = lazy(() => import("./pages/Scoreboard"));
const TeacherSubmit = lazy(() => import("./pages/TeacherSubmit"));
const TestHouses = lazy(() => import("./pages/TestHouses"));

function SlideUpModal({ open, onClose, children }) {
  const [modalHeight, setModalHeight] = useState(92);
  const resizingRef = useRef(false);
  const startHeightRef = useRef(modalHeight);
  const startYRef = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const handleResizeStart = (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    resizingRef.current = true;
    startYRef.current = event.clientY;
    startHeightRef.current = modalHeight;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleResizeMove = (event) => {
    if (!resizingRef.current) return;
    const delta = startYRef.current - event.clientY;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const deltaVh = (delta / viewportHeight) * 100;
    const next = Math.min(94, Math.max(58, startHeightRef.current + deltaVh));
    setModalHeight(next);
  };

  const handleResizeEnd = (event) => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-[env(safe-area-inset-bottom)]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity" onClick={onClose} />
      <div
        className="relative z-10 flex w-[95vw] max-w-[720px] flex-col items-stretch rounded-t-[32px] bg-[#1f2aa6] shadow-2xl sm:w-[60vw] transition-transform duration-500 ease-out animate-[modalIn_520ms_ease-out]"
        style={{
          height: `min(${modalHeight}dvh, ${modalHeight}vh)`,
          maxHeight: "calc(100dvh - env(safe-area-inset-top))",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex items-center justify-center pt-2"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
        >
          <div
            className="h-1.5 w-12 rounded-full bg-white/70 shadow-[inset_0_-1px_2px_rgba(0,0,0,0.25)] cursor-ns-resize"
            aria-hidden="true"
          />
        </div>
        <div className="flex h-full overflow-y-auto p-3 pb-0 sm:p-4 sm:pb-0">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function ReportViewer({ url, fallbackUrl, extraUrls = [], title }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const urls = useMemo(
    () =>
      [url, fallbackUrl, ...extraUrls, "/reports/values"]
        .filter(Boolean)
        .filter((v, idx, arr) => arr.indexOf(v) === idx),
    [url, fallbackUrl, extraUrls]
  );

  useEffect(() => {
    let cancelled = false;
    setHtml("");
    setError("");
    setLoading(true);
    const tryFetch = async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    };
    const run = async () => {
      const errors = [];
      for (const candidate of urls) {
        try {
          const text = await tryFetch(candidate);
          if (cancelled) return;
          const looksLikeAppShell =
            text.includes('div id="root"') ||
            text.toLowerCase().includes("scoreboard");
          if (looksLikeAppShell) {
            throw new Error("Endpoint returned app shell (scoreboard)");
          }
          setHtml(text);
          setError("");
          return;
        } catch (err) {
          errors.push(`${candidate}: ${err.message || err}`);
        }
      }
      if (!cancelled) setError(`Failed to load report. Tried: ${errors.join(" | ")}`);
    };
    run().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [urls]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {error ? (
        <p className="text-sm text-rose-600">Could not load report: {error}</p>
      ) : loading ? (
        <p className="text-sm text-slate-600">Loading report…</p>
      ) : (
        <div
          className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const [isTeacherModalOpen, setTeacherModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerRef = useRef(null);
  const isEmbedRoute = location.pathname.startsWith("/embed/");
  // Worker host for reports (prefer env; otherwise use current origin).
  const STAFF_SECRET =
    (import.meta.env.VITE_STAFF_REPORT_SECRET || "s3cret-8d7f2e3e-62c8-4f7a-9c6f-9f3d4b96a8f2").trim();
  const PRIMARY_REPORTS_HOST = (
    import.meta.env.VITE_REPORTS_HOST ||
    import.meta.env.VITE_REPORTS_BASE ||
    (typeof window !== "undefined" ? window.location.origin : "")
  ).trim();
  const DEPLOYED_REPORTS_HOST = "https://school-embed-site.workers.dev";
  const FALLBACK_REPORTS_HOST = "http://127.0.0.1:8787";
  const reportsAvailable = Boolean(PRIMARY_REPORTS_HOST);
  const REPORTS_BASE = `${PRIMARY_REPORTS_HOST.replace(/\/$/, "")}/reports/values`;
  const REPORTS_BASE_FALLBACK = `${FALLBACK_REPORTS_HOST}/reports/values`;
  const REPORTS_BASE_DEPLOYED = `${DEPLOYED_REPORTS_HOST}/reports/values`;
  const DEFAULT_PERIOD = "week";
  const staffReportUrl = (audience = "staff") =>
    reportsAvailable
      ? `${REPORTS_BASE}?period=${DEFAULT_PERIOD}&audience=${audience}&token=${STAFF_SECRET}`
      : "";
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);
  useEffect(() => {
    if (isEmbedRoute) return;
    const node = headerRef.current;
    if (!node) return;
    const update = () => setHeaderHeight(node.offsetHeight || 0);
    update();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(node);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [isEmbedRoute]);
  const staffReportUrlFallback = (audience = "staff") =>
    `${REPORTS_BASE_FALLBACK}?period=${DEFAULT_PERIOD}&audience=${audience}&token=${STAFF_SECRET}`;
  const staffReportUrlDeployed = (audience = "staff") =>
    `${REPORTS_BASE_DEPLOYED}?period=${DEFAULT_PERIOD}&audience=${audience}&token=${STAFF_SECRET}`;
  const openTeacherSubmit = useCallback((entry = null) => {
    setEditingEntry(entry);
    setTeacherModalOpen(true);
  }, []);
  const closeTeacherSubmit = useCallback(() => {
    setTeacherModalOpen(false);
    setEditingEntry(null);
  }, []);

  const navItems = [
    { label: "Scoreboard", to: "/scoreboard", end: true, icon: Presentation },
    { label: "Submit Points", action: () => openTeacherSubmit(null), icon: Send },
    { label: "Admin", to: "/admin", icon: UserStar },
  ];

  // Common styles for the pill buttons to ensure perfect equality and Apple/Android look
  const pillBaseClass =
    "flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 shadow-sm transition-all hover:scale-[1.02] hover:bg-slate-200 hover:shadow-md active:scale-95";
  const pillTextClass = "text-xs font-bold tracking-wide uppercase text-slate-700 whitespace-nowrap";

  useEffect(() => {
    const handleClick = () => setReportsOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);
  useEffect(() => {
    if (location.pathname === "/teacher") {
      // Defer to next tick to avoid synchronous setState inside effect
      const id = setTimeout(() => openTeacherSubmit(null), 0);
      return () => clearTimeout(id);
    }
  }, [location.pathname, openTeacherSubmit]);

  useEffect(() => {
    const handleEditEvent = (event) => {
      openTeacherSubmit(event?.detail?.entry ?? null);
    };

    window.addEventListener("teacherSubmit:open", handleEditEvent);
    return () => {
      window.removeEventListener("teacherSubmit:open", handleEditEvent);
    };
  }, [openTeacherSubmit]);

  return (
    <div className={isEmbedRoute ? "min-h-screen bg-white" : "min-h-screen bg-slate-50 text-slate-900"}>
      {!isEmbedRoute && (
        <header
          ref={headerRef}
          className="fixed top-0 left-0 right-0 z-10 border-b border-slate-200 bg-[#1f2aa6] px-6 py-4 shadow-sm backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={`${import.meta.env.BASE_URL}favicon.png`}
                alt="House Points logo"
                className="h-[120px] w-[120px] object-cover"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.2em] text-white whitespace-nowrap">
                  Weekly Competition
                </p>
                <p
                  className="text-2xl font-semibold text-white whitespace-nowrap flex items-center gap-0"
                  style={{ fontFamily: PLAYFUL_FONT }}
                >
                  <span className="text-sky-500 text-4xl" aria-hidden="true">
                    🏠
                  </span>{" "}
                  <span className="text-2xl font-semibold text-white whitespace-nowrap">
                    House Points
                  </span>
                </p>
              </div>
            </div>

            {/* Navigation: Grid 2 cols on mobile, 4 cols on sm+ */}
            <nav className="grid w-full grid-cols-2 gap-2 mt-4 sm:mt-0 sm:w-auto sm:ml-auto sm:grid-cols-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                if (item.action) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className={pillBaseClass}
                    >
                      <Icon className="w-4 h-4 text-slate-800" />
                      <span className={pillTextClass}>
                        {item.label}
                      </span>
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `${pillBaseClass} ${isActive ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-[#1f2aa6]" : ""}`
                    }
                  >
                    <Icon className="w-4 h-4 text-slate-800" />
                    <span className={pillTextClass}>
                      {item.label}
                    </span>
                  </NavLink>
                );
              })}

              <div
                className="relative"
                onClick={(event) => event.stopPropagation()}
                onMouseEnter={() => setReportsOpen(true)}
                onMouseLeave={() => setReportsOpen(false)}
              >
                <button
                  type="button"
                  onMouseEnter={() => setReportsOpen(true)}
                  className={pillBaseClass}
                >
                  <ChartPie className="w-4 h-4 text-slate-800" />
                  <span className={pillTextClass}>
                    Reports
                  </span>
                </button>
                {reportsOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg z-20"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="px-4 py-3 text-sm font-semibold text-orange-700 bg-orange-50 rounded-xl">
                      In Development...
                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>
        </header>
      )}

      <main
        className={
          isEmbedRoute
            ? "min-h-screen"
            : "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-6 sm:px-6 lg:px-8"
        }
        style={
          isEmbedRoute
            ? undefined
            : {
                paddingTop: `calc(${headerHeight}px + 16px)`,
                scrollPaddingTop: `${headerHeight + 16}px`,
              }
        }
      >
        <Suspense fallback={<div className="text-sm text-slate-600">Loading…</div>}>
          <Routes>
            {/* Explicit pages */}
            <Route path="/" element={<Navigate to="/scoreboard" replace />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
            <Route path="/teacher" element={<Scoreboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/embed/scoreboard" element={<EmbedScoreboard />} />
            <Route path="/test-houses" element={<TestHouses />} />

            {/* Reports */}
            <Route
              path="/reports/staff"
              element={
                <ReportViewer
                  url={staffReportUrl("staff")}
                  fallbackUrl={staffReportUrlFallback("staff")}
                  extraUrls={[staffReportUrlDeployed("staff")]}
                  title="Staff / Ofsted values report"
                />
              }
            />
            <Route
              path="/reports/parents"
              element={
                <ReportViewer
                  url={staffReportUrl("parents")}
                  fallbackUrl={staffReportUrlFallback("parents")}
                  extraUrls={[staffReportUrlDeployed("parents")]}
                  title="Parent-safe values report"
                />
              }
            />
            <Route
              path="/reports/weekly-pdf"
              element={
                <ReportViewer
                  url={`${staffReportUrl("staff")}&format=pdf`}
                  fallbackUrl={`${staffReportUrlFallback("staff")}&format=pdf`}
                  extraUrls={[`${staffReportUrlDeployed("staff")}&format=pdf`]}
                  title="Weekly PDF (staff)"
                />
              }
            />
            <Route
              path="/reports/print-pdf"
              element={
                <ReportViewer
                  url={`${staffReportUrl("staff")}&format=pdf&monochrome=true`}
                  fallbackUrl={`${staffReportUrlFallback("staff")}&format=pdf&monochrome=true`}
                  extraUrls={[`${staffReportUrlDeployed("staff")}&format=pdf&monochrome=true`]}
                  title="Print-friendly PDF"
                />
              }
            />

            {/* 404 — inert */}
            <Route path="*" element={<div />} />
          </Routes>
        </Suspense>
      </main>
      {isTeacherModalOpen && (
        <SlideUpModal open={isTeacherModalOpen} onClose={closeTeacherSubmit}>
          <Suspense fallback={<div className="text-sm text-slate-600">Loading form…</div>}>
            <TeacherSubmit entry={editingEntry} onSuccess={closeTeacherSubmit} onClose={closeTeacherSubmit} />
          </Suspense>
        </SlideUpModal>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <AppContent />
    </Router>
  );
}
