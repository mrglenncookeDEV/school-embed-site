import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Admin from "./pages/Admin";
import EmbedScoreboard from "./pages/EmbedScoreboard";
import Scoreboard from "./pages/Scoreboard";
import TeacherSubmit from "./pages/TeacherSubmit";
import TestHouses from "./pages/TestHouses";

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


function AppContent() {
  const location = useLocation();
  const [isTeacherModalOpen, setTeacherModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const isEmbedRoute = location.pathname.startsWith("/embed/");
  const openTeacherSubmit = useCallback((entry = null) => {
    setEditingEntry(entry);
    setTeacherModalOpen(true);
  }, []);
  const navigate = useNavigate();
  const closeTeacherSubmit = useCallback(() => {
    setTeacherModalOpen(false);
    setEditingEntry(null);
    navigate("/scoreboard");
  }, [navigate]);

  const navItems = [
    { label: "Scoreboard", to: "/", end: true },
    { label: "Submit Points", action: () => openTeacherSubmit(null) },
    { label: "Admin", to: "/admin" },
  ];
  useEffect(() => {
    if (location.pathname === "/teacher") {
      openTeacherSubmit(null);
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
                className="h-[80px] w-[80px] object-cover"
                loading="lazy"
              />
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500 whitespace-nowrap">
                  House Points
                </p>
                <p className="text-2xl font-semibold text-slate-900 whitespace-nowrap">
                  Weekly Competition
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm font-medium sm:flex-nowrap">
              {navItems.map((item) => (
                item.action ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                  >
                    {item.label}
                  </button>
                ) : (
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
                )
              ))}
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
          <Route path="/" element={<Scoreboard />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/teacher" element={<Scoreboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/embed/scoreboard" element={<EmbedScoreboard />} />
          <Route path="/test-houses" element={<TestHouses />} />
          <Route path="*" element={<Scoreboard />} />
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
