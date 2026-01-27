import { BrowserRouter as Router, NavLink, Route, Routes, useLocation } from "react-router-dom";
import Admin from "./pages/Admin";
import EmbedScoreboard from "./pages/EmbedScoreboard";
import Scoreboard from "./pages/Scoreboard";
import TeacherSubmit from "./pages/TeacherSubmit";

const navItems = [
  { label: "Scoreboard", to: "/", end: true },
  { label: "Teacher Submit", to: "/teacher" },
  { label: "Admin", to: "/admin" },
  { label: "Embed", to: "/embed/scoreboard" },
];

function AppContent() {
  const location = useLocation();
  const isEmbedRoute = location.pathname.startsWith("/embed/");

  return (
    <div className={isEmbedRoute ? "min-h-screen bg-white" : "min-h-screen bg-slate-50 text-slate-900"}>
      {!isEmbedRoute && (
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">House Points</p>
              <p className="text-2xl font-semibold text-slate-900">Weekly Competition</p>
            </div>
            <nav className="flex items-center gap-3 text-sm font-medium">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 transition ${
                      isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
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
          <Route path="/teacher" element={<TeacherSubmit />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/embed/scoreboard" element={<EmbedScoreboard />} />
          <Route path="*" element={<Scoreboard />} />
        </Routes>
      </main>
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
