"use client";

import { useEffect, useState } from "react";

export default function SideChooser() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fw-side");
      if (!saved) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function choose(side: "homeowner" | "trade") {
    try {
      localStorage.setItem("fw-side", side);
    } catch {}
    // A full reload so the home page renders the right side.
    window.location.href = side === "trade" ? "/?view=trade" : "/";
  }

  if (!show) return null;

  return (
    <section className="border-b border-[var(--line)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-7 lg:px-14 lg:py-10">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-[22px] font-extrabold lg:text-[28px]">Which are you?</h2>
          <p className="text-sm text-[var(--ink-soft)] lg:text-base">
            So we show you the right thing first. You can switch any time.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-[760px]">
          <button
            type="button"
            onClick={() => choose("homeowner")}
            className="press group flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ink)] hover:shadow-[0_10px_22px_rgba(34,32,26,0.12)]"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--sand)]">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11l9-7 9 7" />
                <path d="M5 10v10h14V10" />
                <path d="M10 20v-6h4v6" />
              </svg>
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-display text-[19px] font-extrabold">I need work done</span>
              <span className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                Browse local trades, see their prices, and post a job.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => choose("trade")}
            className="press group flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ink)] hover:shadow-[0_10px_22px_rgba(34,32,26,0.12)]"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--sand)]">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14.5 3.5l6 6-2.5 2.5-6-6z" />
                <path d="M12 6L4 14v6h6l8-8" />
                <path d="M9 11l4 4" />
              </svg>
            </span>
            <span className="flex flex-col gap-1">
              <span className="font-display text-[19px] font-extrabold">I do the work</span>
              <span className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                Find jobs, see who's hiring, and list what you charge.
              </span>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}