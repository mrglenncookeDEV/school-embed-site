import { useEffect, useState } from "react";
import { getHouseById } from "../config/houses";
import {
  Pencil,
  Trash2,
  Shield,
  Trophy,
  Star,
  Crown,
  Heart,
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function CollapsibleSection({ title, subtitle, action, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all duration-300">
      <div
        className="flex items-center justify-between p-6 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white border border-slate-200 text-slate-400">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      </div>

      {isOpen && (
        <div className="px-6 pb-6 pt-0 border-t border-slate-100/50 animate-in slide-in-from-top-2 duration-200">
          <div className="pt-6">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [entries, setEntries] = useState([]);
  const [classes, setClasses] = useState([]);
  const [houses, setHouses] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingHouses, setLoadingHouses] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState("entries");

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [classForm, setClassForm] = useState({
    name: "",
    YearGrp: 3,
    Teacher_Title: "Mr",
    Teacher_FirstName: "",
    Teacher_LastName: "",
    Teacher_email: "",
  });
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState(null);
  const [isSavingClass, setIsSavingClass] = useState(false);

  const [isHouseModalOpen, setIsHouseModalOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState(null);
  const [houseForm, setHouseForm] = useState({
    name: "",
    color: "#000000",
    icon: "shield",
  });
  const [confirmDeleteHouseId, setConfirmDeleteHouseId] = useState(null);
  const [isSavingHouse, setIsSavingHouse] = useState(false);

  // Term management state
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [termForm, setTermForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_active: false,
  });
  const [confirmDeleteTermId, setConfirmDeleteTermId] = useState(null);
  const [isSavingTerm, setIsSavingTerm] = useState(false);
  const [terms, setTerms] = useState([]);
  const [loadingTerms, setLoadingTerms] = useState(true);

  const AVAILABLE_ICONS = [
    { id: "shield", icon: Shield },
    { id: "trophy", icon: Trophy },
    { id: "star", icon: Star },
    { id: "crown", icon: Crown },
    { id: "heart", icon: Heart },
    { id: "zap", icon: Zap },
    { id: "ghost", icon: Ghost },
    { id: "bird", icon: Bird },
    { id: "cat", icon: Cat },
    { id: "dog", icon: Dog },
    { id: "tree", icon: Trees },
    { id: "cloud", icon: Cloud },
    { id: "sun", icon: Sun },
    { id: "moon", icon: Moon },
    { id: "map", icon: Map },
    { id: "flag", icon: Flag },
    { id: "home", icon: Home },
    { id: "user", icon: User },
    { id: "earth", icon: Earth },
    { id: "droplets", icon: Droplets },
    { id: "flame", icon: Flame },
    { id: "wind", icon: Wind },
    { id: "sparkles", icon: Sparkles },
  ];

  const loadEntries = async () => {
    setLoadingEntries(true);
    setError("");
    try {
      const response = await fetch("/api/entries?week=current");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load entries");
      }
      setEntries(payload.entries);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingEntries(false);
    }
  };

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const response = await fetch("/api/classes");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load classes");
      }
      setClasses(payload.classes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingClasses(false);
    }
  };

  const loadHouses = async () => {
    setLoadingHouses(true);
    try {
      const response = await fetch("/api/houses");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load houses");
      }
      setHouses(payload.houses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingHouses(false);
    }
  };

  const loadTerms = async () => {
    setLoadingTerms(true);
    try {
      const response = await fetch("/api/terms");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load terms");
      }
      setTerms(payload.terms);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTerms(false);
    }
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const response = await fetch("/api/audit?limit=50");
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load audit log");
      }
      setAudit(payload.audit);
    } catch (err) {
      setActionMessage(err.message);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadEntries();
    loadClasses();
    loadHouses();
    loadTerms();
    loadAudit();
  }, []);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/entries/${id}?actorEmail=admin@school.local`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete entry");
      }
      setActionMessage("Entry deleted");
      await loadEntries();
      await loadAudit();
    } catch (err) {
      setActionMessage(err.message);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const requestDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const openTeacherSubmitModalForEntry = (entry) => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("teacherSubmit:open", {
        detail: { entry },
      })
    );
  };

  const handleCreateOrUpdateClass = async (e) => {
    e.preventDefault();
    setIsSavingClass(true);
    setError("");
    try {
      const url = editingClass ? `/api/classes/${editingClass.id}` : "/api/classes";
      const method = editingClass ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(classForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save class");
      }
      setActionMessage(editingClass ? "Class updated" : "Class created");
      setIsClassModalOpen(false);
      setEditingClass(null);
      setClassForm({
        name: "",
        YearGrp: 3,
        Teacher_Title: "Mr",
        Teacher_FirstName: "",
        Teacher_LastName: "",
        Teacher_email: "",
      });
      await loadClasses();
      await loadAudit();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingClass(false);
    }
  };

  const handleDeleteClass = async (id) => {
    setError("");
    try {
      const response = await fetch(`/api/classes/${id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete class");
      }
      setActionMessage("Class deleted");
      setConfirmDeleteClassId(null);
      await loadClasses();
      await loadAudit();
    } catch (err) {
      setError(err.message);
    }
  };

  const openClassModal = (cls = null) => {
    if (cls) {
      setEditingClass(cls);
      setClassForm({
        name: cls.name,
        YearGrp: cls.YearGrp,
        Teacher_Title: cls.teacherTitle || "Mr",
        Teacher_FirstName: cls.teacherFirstName || "",
        Teacher_LastName: cls.teacherLastName || "",
        Teacher_email: cls.teacherEmail || "",
      });
    } else {
      setEditingClass(null);
      setClassForm({
        name: "",
        YearGrp: 3,
        Teacher_Title: "Mr",
        Teacher_FirstName: "",
        Teacher_LastName: "",
        Teacher_email: "",
      });
    }
    setIsClassModalOpen(true);
  };

  const handleCreateOrUpdateHouse = async (e) => {
    e.preventDefault();
    setIsSavingHouse(true);
    setError("");
    try {
      const url = editingHouse ? `/api/houses/${editingHouse.id}` : "/api/houses";
      const method = editingHouse ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(houseForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save house");
      }
      setActionMessage(editingHouse ? "House updated" : "House created");
      setIsHouseModalOpen(false);
      setEditingHouse(null);
      setHouseForm({ name: "", color: "#000000", icon: "shield" });
      await loadHouses();
      await loadAudit();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingHouse(false);
    }
  };

  const handleDeleteHouse = async (id) => {
    setError("");
    try {
      const response = await fetch(`/api/houses/${id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete house");
      }
      setActionMessage("House deleted");
      setConfirmDeleteHouseId(null);
      await loadHouses();
      await loadAudit();
    } catch (err) {
      setError(err.message);
    }
  };

  const openHouseModal = (house = null) => {
    if (house) {
      setEditingHouse(house);
      setHouseForm({
        name: house.name,
        color: house.color,
        icon: house.icon || "shield",
      });
    } else {
      setEditingHouse(null);
      setHouseForm({
        name: "",
        color: "#000000",
        icon: "shield",
      });
    }
    setIsHouseModalOpen(true);
  };

  const handleCreateOrUpdateTerm = async (e) => {
    e.preventDefault();
    setIsSavingTerm(true);
    setError("");
    try {
      const url = editingTerm ? `/api/terms/${editingTerm.id}` : "/api/terms";
      const method = editingTerm ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(termForm),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save term");
      }
      setActionMessage(editingTerm ? "Term updated" : "Term created");
      setIsTermModalOpen(false);
      setEditingTerm(null);
      setTermForm({ name: "", start_date: "", end_date: "", is_active: false });
      await loadTerms();
      await loadAudit();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingTerm(false);
    }
  };

  const handleDeleteTerm = async (id) => {
    setError("");
    try {
      const response = await fetch(`/api/terms/${id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete term");
      }
      setActionMessage("Term deleted");
      setConfirmDeleteTermId(null);
      await loadTerms();
      await loadAudit();
    } catch (err) {
      setError(err.message);
    }
  };

  const openTermModal = (term = null) => {
    if (term) {
      setEditingTerm(term);
      setTermForm({
        name: term.name,
        start_date: term.start_date,
        end_date: term.end_date,
        is_active: Boolean(term.is_active),
      });
    } else {
      setEditingTerm(null);
      setTermForm({
        name: "",
        start_date: "",
        end_date: "",
        is_active: false,
      });
    }
    setIsTermModalOpen(true);
  };

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-bold text-slate-900">
          {activeTab === "entries" ? "Manage Entries" : "Settings"}
        </h1>
        <p className="text-sm text-slate-600">
          {activeTab === "entries"
            ? "Review this week’s submissions and audit trail."
            : "Configure school houses, classes, and site settings."}
        </p>
      </div>

      <div className="mb-6 border-b border-slate-200 dark:border-white/10">
        <div className="flex gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab("entries")}
            className={`pb-3 border-b-2 transition ${activeTab === "entries"
              ? "border-slate-900 dark:border-white"
              : "border-transparent text-slate-500"
              }`}
          >
            Manage Entries
          </button>

          <button
            onClick={() => setActiveTab("setup")}
            className={`pb-3 border-b-2 transition ${activeTab === "setup"
              ? "border-slate-900 dark:border-white"
              : "border-transparent text-slate-500"
              }`}
          >
            Settings
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm">
          {actionMessage}
        </div>
      )}

      {activeTab === "entries" && (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 px-4 text-xs uppercase tracking-[0.4em] text-slate-500">Submissions</h2>
            {loadingEntries ? (
              <p className="px-4 text-sm text-slate-500">Loading entries…</p>
            ) : error ? (
              <p className="px-4 text-sm text-rose-600">{error}</p>
            ) : entries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">No submissions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-auto text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">House</th>
                      <th className="px-3 py-2">Points</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Submitted by</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.map((entry) => {
                      const houseId = entry.house_id || entry.houseId;
                      const houseMeta = getHouseById(houseId);
                      const houseColor = houseMeta?.color ?? entry.house_color ?? "#94a3b8";
                      const HouseIcon = houseMeta?.icon;
                      const houseLabel = houseMeta?.name ?? entry.house_name;
                      return (
                        <tr key={entry.id}>
                          <td className="px-3 py-3 font-semibold text-slate-900">{entry.class_name}</td>
                          <td className="px-3 py-3">
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
                          <td className="px-3 py-3 font-semibold text-slate-900">{entry.points}</td>
                          <td className="px-3 py-3 text-slate-600">{entry.award_category || "General"}</td>
                          <td className="px-3 py-3 text-slate-600">{entry.submitted_by_email}</td>
                          <td className="px-3 py-3 text-slate-600">{entry.entry_date}</td>
                          <td className="px-3 py-3 text-slate-600">{entry.notes || "—"}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => openTeacherSubmitModalForEntry(entry)}
                                className="p-1.5 text-slate-500 transition hover:text-slate-900"
                                title="Edit Entry"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                disabled={deletingId === entry.id}
                                onClick={() => requestDelete(entry.id)}
                                className="p-1.5 text-rose-600 transition hover:text-rose-800 disabled:opacity-30"
                                title="Delete Entry"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Audit log</p>
                <p className="text-lg font-semibold text-slate-900">Recent actions</p>
              </div>
              {loadingAudit && <p className="text-sm text-slate-500">Loading…</p>}
            </div>
            <div className="mt-4">
              <div
                className="space-y-3 overflow-y-auto pr-2"
                style={{ maxHeight: "calc(100vh - 280px)" }}
              >
                {loadingAudit ? (
                  <p className="text-sm text-slate-500">Listening for events…</p>
                ) : audit.length === 0 ? (
                  <p className="text-sm text-slate-600">No audit events yet.</p>
                ) : (
                  audit.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                        <span>{event.action}</span>
                        <span>{new Date(event.created_at).toLocaleString()}</span>
                      </div>
                      <p className="font-semibold text-slate-900">{event.actor_email}</p>
                      <p className="text-xs text-slate-500">
                        Target: {event.target_type} {event.target_id ?? "—"}
                      </p>
                      {event.meta && (
                        <pre className="mt-2 max-w-full overflow-auto text-[0.65rem] text-slate-500">
                          {JSON.stringify(event.meta)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === "setup" && (
        <div className="space-y-6">
          <CollapsibleSection
            title="Manage Classes"
            subtitle="Configure class names and teachers"
            action={
              <button
                onClick={() => openClassModal()}
                className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-indigo-500 w-48 shadow-sm hover:shadow-md"
              >
                Add New Class
              </button>
            }
          >
            {loadingClasses ? (
              <p className="text-sm text-slate-500">Loading classes…</p>
            ) : classes.length === 0 ? (
              <p className="text-sm text-slate-600">No classes configured.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-auto text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2">Year</th>
                      <th className="px-3 py-2">Class Name</th>
                      <th className="px-3 py-2">Teacher</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {classes.map((cls) => (
                      <tr key={cls.id}>
                        <td className="px-3 py-3 font-semibold text-slate-900">Year {cls.YearGrp}</td>
                        <td className="px-3 py-3 text-slate-700">{cls.name}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {cls.teacherTitle} {cls.teacherFirstName} {cls.teacherLastName}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{cls.teacherEmail}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => openClassModal(cls)}
                              className="p-1.5 text-slate-500 transition hover:text-slate-900"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteClassId(cls.id)}
                              className="p-1.5 text-rose-600 transition hover:text-rose-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Manage Houses"
            subtitle="Configure house teams and colors"
            action={
              <button
                onClick={() => openHouseModal()}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-emerald-500 w-48 shadow-sm hover:shadow-md"
              >
                Add New House
              </button>
            }
          >
            {loadingHouses ? (
              <p className="text-sm text-slate-500">Loading houses…</p>
            ) : houses.length === 0 ? (
              <p className="text-sm text-slate-600">No houses configured.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[300px] table-auto text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2">Icon</th>
                      <th className="px-3 py-2">Color</th>
                      <th className="px-3 py-2">House Name</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {houses.map((house) => {
                      const IconComp = AVAILABLE_ICONS.find(i => i.id === (house.icon || "shield"))?.icon || Shield;
                      return (
                        <tr key={house.id}>
                          <td className="px-3 py-3 font-semibold text-slate-900">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                              <IconComp className="h-5 w-5 text-slate-600" />
                            </div>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-900">
                            <div className="h-6 w-6 rounded-full border border-slate-200" style={{ backgroundColor: house.color }} />
                          </td>
                          <td className="px-3 py-3 text-slate-700">{house.name}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => openHouseModal(house)}
                                className="p-1.5 text-slate-500 transition hover:text-slate-900"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteHouseId(house.id)}
                                className="p-1.5 text-rose-600 transition hover:text-rose-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Manage Term Dates"
            subtitle="Set up school terms and active periods"
            action={
              <button
                onClick={() => openTermModal()}
                className="rounded-full bg-cyan-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-cyan-500 w-48 shadow-sm hover:shadow-md"
              >
                Add New Term
              </button>
            }
          >
            {loadingTerms ? (
              <p className="text-sm text-slate-500">Loading terms…</p>
            ) : terms.length === 0 ? (
              <p className="text-sm text-slate-600">No terms configured.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] table-auto text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Term Name</th>
                      <th className="px-3 py-2">Start Date</th>
                      <th className="px-3 py-2">End Date</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {terms.map((term) => (
                      <tr key={term.id}>
                        <td className="px-3 py-3">
                          {term.is_active ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900">{term.name}</td>
                        <td className="px-3 py-3 text-slate-600">{term.start_date}</td>
                        <td className="px-3 py-3 text-slate-600">{term.end_date}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openTermModal(term)}
                              className="p-1.5 text-slate-500 transition hover:text-slate-900"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteTermId(term.id)}
                              className="p-1.5 text-rose-600 transition hover:text-rose-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {[
            "Manage Pupils",
            "Manage Users",
            "Advanced Settings",
          ].map((title) => (
            <div
              key={title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm opacity-50 transition hover:opacity-100"
            >
              <h3 className="text-lg font-semibold mb-3">{title}</h3>
              <p className="text-sm text-slate-500 italic">Management interface for {title.toLowerCase()} coming soon...</p>
            </div>
          ))}
        </div>
      )}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-left shadow-2xl dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Confirm Delete
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
              Delete this entry permanently?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-slate-600 transition hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-rose-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl my-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {editingClass ? "Edit Class" : "Add New Class"}
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              {editingClass ? "Update the details for this class." : "Enter the details for the new school class."}
            </p>

            <form onSubmit={handleCreateOrUpdateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Class Name (e.g. 3A)
                </label>
                <input
                  required
                  type="text"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Year Group
                  </label>
                  <select
                    value={classForm.YearGrp}
                    onChange={(e) => setClassForm({ ...classForm, YearGrp: parseInt(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                  >
                    {[3, 4, 5, 6].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Teacher Title
                  </label>
                  <select
                    value={classForm.Teacher_Title}
                    onChange={(e) => setClassForm({ ...classForm, Teacher_Title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                  >
                    {['Mr', 'Mrs', 'Miss', 'Ms', 'Dr'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={classForm.Teacher_FirstName}
                    onChange={(e) => setClassForm({ ...classForm, Teacher_FirstName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Last Name
                  </label>
                  <input
                    required
                    type="text"
                    value={classForm.Teacher_LastName}
                    onChange={(e) => setClassForm({ ...classForm, Teacher_LastName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Teacher Email
                </label>
                <input
                  required
                  type="email"
                  value={classForm.Teacher_email}
                  onChange={(e) => setClassForm({ ...classForm, Teacher_email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>

              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="rounded-full border border-slate-200 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingClass}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSavingClass ? "Saving..." : (editingClass ? "Update Class" : "Create Class")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteClassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete Class</h2>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete this class? This cannot be undone and will fail if entries exist for this class.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteClassId(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteClass(confirmDeleteClassId)}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white transition hover:bg-rose-500"
              >
                Delete Class
              </button>
            </div>
          </div>
        </div>
      )}

      {isHouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl my-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {editingHouse ? "Edit House" : "Add New House"}
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              {editingHouse ? "Update the details for this house." : "Enter the details for the new school house."}
            </p>

            <form onSubmit={handleCreateOrUpdateHouse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                  House Name
                </label>
                <input
                  required
                  type="text"
                  value={houseForm.name}
                  onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                  House Color
                </label>
                <div className="flex gap-4 items-center">
                  <input
                    type="color"
                    value={houseForm.color}
                    onChange={(e) => setHouseForm({ ...houseForm, color: e.target.value })}
                    className="h-10 w-20 rounded border border-slate-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={houseForm.color}
                    onChange={(e) => setHouseForm({ ...houseForm, color: e.target.value })}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900 uppercase"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                  House Icon
                </label>
                <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                  {AVAILABLE_ICONS.map(({ id, icon: IconComp }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHouseForm({ ...houseForm, icon: id })}
                      className={`flex aspect-square items-center justify-center rounded-lg border transition ${houseForm.icon === id
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-100 hover:border-slate-300 text-slate-500"
                        }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsHouseModalOpen(false)}
                  className="rounded-full border border-slate-200 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHouse}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSavingHouse ? "Saving..." : (editingHouse ? "Update House" : "Create House")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteHouseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete House</h2>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete this house? This cannot be undone and will fail if entries exist for this house.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteHouseId(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteHouse(confirmDeleteHouseId)}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white transition hover:bg-rose-500"
              >
                Delete House
              </button>
            </div>
          </div>
        </div>
      )}
      {
        isTermModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl my-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                {editingTerm ? "Edit Term" : "Add New Term"}
              </h2>
              <p className="text-sm text-slate-600 mb-6">
                {editingTerm ? "Update the details for this term." : "Setup a new school term."}
              </p>

              <form onSubmit={handleCreateOrUpdateTerm} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                    Term Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Spring Term 2024"
                    value={termForm.name}
                    onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                      Start Date
                    </label>
                    <input
                      required
                      type="date"
                      value={termForm.start_date}
                      onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">
                      End Date
                    </label>
                    <input
                      required
                      type="date"
                      value={termForm.end_date}
                      onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="termIsActive"
                    checked={termForm.is_active}
                    onChange={(e) => setTermForm({ ...termForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <label htmlFor="termIsActive" className="text-sm text-slate-700">
                    Set as current active term
                  </label>
                </div>

                {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsTermModalOpen(false)}
                    className="rounded-full border border-slate-200 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTerm}
                    className="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSavingTerm ? "Saving..." : (editingTerm ? "Update Term" : "Create Term")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        confirmDeleteTermId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Delete Term</h2>
              <p className="text-sm text-slate-600 mb-5">
                Are you sure you want to delete this term?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTermId(null)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTerm(confirmDeleteTermId)}
                  className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white transition hover:bg-rose-500"
                >
                  Delete Term
                </button>
              </div>
            </div>
          </div>
        )
      }
    </section >
  );
}
