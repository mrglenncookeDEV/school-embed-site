import { useEffect, useState } from "react";

export default function App() {
  const [message, setMessage] = useState("Loading…");

  useEffect(() => {
    fetch("/api/message")
      .then((r) => r.json())
      .then((d) => setMessage(d.message ?? "No message returned"))
      .catch(() => setMessage("Error loading message"));
  }, []);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-[min(720px,calc(100%-32px))] rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold">React + Tailwind</h1>
        <div className="mt-4 text-lg font-semibold">{message}</div>
      </div>
    </div>
  );
}
