import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, useNavigate, Navigate } from "react-router-dom";
import Admin from "./pages/Admin";
import EmbedScoreboard from "./pages/EmbedScoreboard";
import Scoreboard from "./pages/Scoreboard";
import TeacherSubmit from "./pages/TeacherSubmit";
import TestHouses from "./pages/TestHouses";
import { Presentation, Printer, Camera, User, Shield, ChevronDown } from "lucide-react";

const PLAYFUL_FONT = '"Permanent Marker", "Marker Felt", "Kalam", cursive';

function SlideUpModal({ open, onClose, children }) {
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

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} />
      <div
        className="relative z-10 flex w-[95vw] max-w-[960px] flex-col items-stretch rounded-t-[32px] bg-white shadow-2xl sm:w-[75vw]"
        style={{ height: "87.5vh" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Submit points
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="flex h-full overflow-y-auto p-4 sm:p-6">{children}</div>
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
  const isEmbedRoute = location.pathname.startsWith("/embed/");
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
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
  const staffReportUrlFallback = (audience = "staff") =>
    `${REPORTS_BASE_FALLBACK}?period=${DEFAULT_PERIOD}&audience=${audience}&token=${STAFF_SECRET}`;
  const staffReportUrlDeployed = (audience = "staff") =>
    `${REPORTS_BASE_DEPLOYED}?period=${DEFAULT_PERIOD}&audience=${audience}&token=${STAFF_SECRET}`;
  const openTeacherSubmit = useCallback((entry = null) => {
    setEditingEntry(entry);
    setTeacherModalOpen(true);
  }, []);
  const navigate = useNavigate();
  const closeTeacherSubmit = useCallback(() => {
    setTeacherModalOpen(false);
    setEditingEntry(null);
  }, []);

  const navItems = [
    { label: "Scoreboard", to: "/scoreboard", end: true },
    { label: "Submit Points", action: () => openTeacherSubmit(null) },
    { label: "Admin", to: "/admin" },
  ];
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
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/favicon.png"
                alt="House Points logo"
                className="h-[120px] w-[120px] object-cover"
                loading="lazy"
              />
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500 whitespace-nowrap">
                  Weekly Competition
                </p>
                <p
                  className="text-2xl font-semibold text-slate-900 whitespace-nowrap flex items-center gap-0"
                  style={{ fontFamily: PLAYFUL_FONT }}
                >
                  <span className="text-sky-500 text-4xl" aria-hidden="true">
                    🏠
                  </span>{" "}
                  <span
                    className="highlight-title text-2xl font-semibold text-[#4169e1] whitespace-nowrap"
                  >
                    House Points
                  </span>
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium sm:flex-nowrap">
              <div
                className="relative"
                onClick={(event) => event.stopPropagation()}
                onMouseEnter={() => setReportsOpen(true)}
                onMouseLeave={() => setReportsOpen(false)}
              >
                <button
                  type="button"
                  onMouseEnter={() => setReportsOpen(true)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 flex items-center gap-1"
                >
                  Reports
                  <ChevronDown className="h-4 w-4" />
                </button>
                {reportsOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="px-4 py-3 text-sm font-semibold text-orange-700 bg-orange-50">
                      In Development...
                    </div>
                  </div>
                )}
              </div>
              {navItems.map((item) => {
                if (item.action) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                    >
                      {item.label}
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 transition ${isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:text-slate-900"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </header>
      )}

      <main
        className={
          isEmbedRoute
            ? "min-h-screen"
            : "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
        }
      >
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
      </main>
      <SlideUpModal open={isTeacherModalOpen} onClose={closeTeacherSubmit}>
        <TeacherSubmit entry={editingEntry} onSuccess={closeTeacherSubmit} />
      </SlideUpModal>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
