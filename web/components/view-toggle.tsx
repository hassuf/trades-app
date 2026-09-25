"use client";

import { useEffect, useState } from "react";

export default function ViewToggle() {
  const [view, setView] = useState<"list" | "grid">("list");

  // Restore the last choice.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fw-view");
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {}
  }, []);

  // Apply it to the results grid.
  useEffect(() => {
    const el = document.getElementById("pro-grid");
    if (!el) return;
    el.classList.toggle("grid-cols-2", view === "grid");
    el.classList.toggle("grid-cols-1", view === "list");
    el.classList.toggle("compact", view === "grid");
    try {
      localStorage.setItem("fw-view", view);
    } catch {}
  }, [view]);

  const btn = (on: boolean) =>
    `press flex h-9 w-9 items-center justify-center rounded-lg border ${
      on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]" : "border-[var(--line)] bg-[var(--card)] text-[var(--ink-soft)]"
    }`;

  return (
    <div className="flex gap-1.5 lg:hidden">
      <button type="button" aria-label="One at a time" aria-pressed={view === "list"} onClick={() => setView("list")} className={btn(view === "list")}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="4" y="5" width="16" height="6" rx="1" />
          <rect x="4" y="14" width="16" height="6" rx="1" />
        </svg>
      </button>
      <button type="button" aria-label="Grid" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={btn(view === "grid")}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
      </button>
    </div>
  );
}