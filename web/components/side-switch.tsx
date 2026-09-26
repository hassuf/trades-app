"use client";

import { useEffect, useState } from "react";

export default function SideSwitch() {
  const [side, setSide] = useState<"homeowner" | "trade" | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fw-side");
      if (saved === "homeowner" || saved === "trade") setSide(saved);
    } catch {}
  }, []);

  function flip() {
    const next = side === "trade" ? "homeowner" : "trade";
    try {
      localStorage.setItem("fw-side", next);
    } catch {}
    window.location.href = next === "trade" ? "/?view=trade" : "/";
  }

  if (!side) return null;

  return (
    <button
      type="button"
      onClick={flip}
      className="press hidden items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--card)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink-soft)] hover:border-[var(--ink)] lg:flex"
    >
      {side === "trade" ? "Viewing as a trade" : "Viewing as a homeowner"}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8h13l-3-3M20 16H7l3 3" />
      </svg>
    </button>
  );
}