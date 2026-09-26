"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Symptom = {
  id: string;
  label: string;
  blurb: string;
  icon: React.ReactNode;
  trade: string;            // category slug we route to
  alsoTry?: string[];       // other trades worth knowing about
  questions: string[];      // what a pro will want to know
  photoHint: string;
  firstCheck?: string;      // something safe they can check themselves
  urgent?: string;          // when to stop and call someone now
};

const icon = (d: React.ReactNode) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const SYMPTOMS: Symptom[] = [
  {
    id: "hot",
    label: "My house is too hot or too cold",
    blurb: "Air conditioning or heating not keeping up",
    icon: icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>),
    trade: "hvac",
    questions: [
      "How old is the system, roughly?",
      "Is it the whole house or just some rooms?",
      "Is the outdoor unit running when it should be?",
      "When was it last serviced?",
    ],
    photoHint: "The outdoor unit, the indoor unit or furnace, and the label with the model number.",
    firstCheck: "Check the filter first. A blocked filter is the single most common cause and costs nothing to rule out.",
  },
  {
    id: "shower",
    label: "No hot water, or the shower is weak",
    blurb: "Water heater, pressure or a blocked line",
    icon: icon(<><path d="M7 4v6a5 5 0 0 0 5 5h2" /><path d="M14 12h6v6h-6z" /></>),
    trade: "plumbing",
    questions: [
      "Is it just this shower or the whole house?",
      "Hot only, cold only, or both?",
      "How old is the water heater?",
      "Has anything changed recently, like a repair nearby?",
    ],
    photoHint: "The shower fixture, and the water heater including its label.",
    firstCheck: "If it's only one fixture, the aerator or shower head may just be limed up, which you can unscrew and soak.",
  },
  {
    id: "lights",
    label: "Lights or outlets keep cutting out",
    blurb: "A breaker tripping, or old wiring",
    icon: icon(<path d="M13 3L5 14h6l-1 7 8-11h-6z" />),
    trade: "electrical",
    questions: [
      "Does a breaker trip, or do things just go dead?",
      "Which rooms are affected?",
      "Does it happen when you use something specific?",
      "Do you know the age of the wiring?",
    ],
    photoHint: "Your breaker panel with the door open, and the outlet or fixture that's failing.",
    urgent:
      "If you smell burning, see scorch marks, or an outlet is warm to the touch, stop using that circuit and get an electrician out today rather than posting a job.",
  },
  {
    id: "toilet",
    label: "Something is leaking or dripping",
    blurb: "Toilet, tap, pipe or under a sink",
    icon: icon(<><path d="M4 12h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M8 12V6a2 2 0 0 1 4 0" /></>),
    trade: "plumbing",
    questions: [
      "Where exactly is the water coming from?",
      "Is it constant or only when in use?",
      "Has it damaged anything yet, like a ceiling or floor?",
      "Can you shut the water off to it?",
    ],
    photoHint: "The leak itself, what's under it, and the shutoff valve if you can find one.",
    urgent:
      "If water is actively running and you can't stop it, shut off the main and call a plumber directly. Don't wait on quotes.",
  },
  {
    id: "ceiling",
    label: "A stain or sag on my ceiling or wall",
    blurb: "Often a roof or a pipe above it",
    icon: icon(<><path d="M2 12L12 4l10 8" /><path d="M5 12v8h14v-8" /></>),
    trade: "roofing",
    alsoTry: ["plumbing", "general-contracting"],
    questions: [
      "Which floor is it on, and what's directly above?",
      "Does it get worse when it rains?",
      "Is it growing, or has it been the same for a while?",
      "Any smell of damp?",
    ],
    photoHint: "The stain from a few feet back, a close-up, and the outside of the house above it if you can.",
    firstCheck:
      "If it only appears after rain it's usually the roof or flashing. If it's steady regardless of weather, suspect a pipe.",
  },
  {
    id: "door",
    label: "A door or window won't close right",
    blurb: "Sticking, dropping or draughty",
    icon: icon(<><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M12 3v18M4 12h16" /></>),
    trade: "carpentry",
    alsoTry: ["windows-doors", "handyman"],
    questions: [
      "Does it stick all year or only in certain weather?",
      "Is the frame square, or has it visibly moved?",
      "Is it the door, the hinges or the latch?",
    ],
    photoHint: "The gap around the closed door, the hinges, and the latch plate.",
    firstCheck: "Hinge screws working loose is the usual cause and often the whole fix.",
  },
  {
    id: "cracks",
    label: "Cracks in the walls or plaster",
    blurb: "Cosmetic, or something moving",
    icon: icon(<><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M9 4l3 7-2 3 3 6" /></>),
    trade: "drywall",
    alsoTry: ["general-contracting", "masonry"],
    questions: [
      "How wide, roughly? Hairline or wider than a coin's edge?",
      "Are they growing?",
      "Where are they: above doors, in corners, or across a whole wall?",
      "Any doors sticking at the same time?",
    ],
    photoHint: "Each crack with something for scale, like a coin or a tape measure.",
    firstCheck:
      "Hairline cracks above doors and windows are usually seasonal movement. Wide, growing, or stepped cracks are worth a structural opinion first.",
  },
  {
    id: "water-outside",
    label: "Water pooling outside or a wet basement",
    blurb: "Drainage, grading or gutters",
    icon: icon(<><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" /></>),
    trade: "landscaping",
    alsoTry: ["gutters", "concrete"],
    questions: [
      "Where does the water collect?",
      "Does it happen every time it rains or only heavy rain?",
      "Where do your downspouts end?",
      "Is the basement damp, or actually wet?",
    ],
    photoHint: "The pooling area during or just after rain, your downspouts, and the affected basement wall.",
    firstCheck:
      "Check where your downspouts discharge. If they dump at the foundation, extending them away often fixes it for the price of a length of pipe.",
  },
  {
    id: "kitchen",
    label: "I want to redo a kitchen or bathroom",
    blurb: "A whole room, not a repair",
    icon: icon(<><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M10 21v-6h4v6" /></>),
    trade: "general-contracting",
    alsoTry: ["bathroom"],
    questions: [
      "Keeping the layout, or moving things?",
      "Do you have a budget range in mind?",
      "When would you want it done?",
      "Have you chosen fixtures, or want help with that?",
    ],
    photoHint: "Every wall of the room, plus the ceiling, and anything you want kept.",
    firstCheck:
      "Look at finished projects with real costs on a few profiles before setting your budget. It's the fastest way to calibrate.",
  },
  {
    id: "other",
    label: "Something else, or a list of small things",
    blurb: "Odd jobs, mounting, repairs",
    icon: icon(<><path d="M3 20l7-7" /><path d="M13 7l4-4 4 4-4 4z" /><path d="M10 13l3 3" /></>),
    trade: "handyman",
    questions: [
      "What's on the list?",
      "Would one visit cover it all?",
      "Any of it urgent?",
    ],
    photoHint: "One photo of each thing on the list.",
  },
];

export default function HelpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [picked, setPicked] = useState<Symptom | null>(null);
  const [tradeNames, setTradeNames] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ids, setIds] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase.from("categories").select("id, slug, name");
      const names: Record<string, string> = {};
      const idMap: Record<string, number> = {};
      (cats ?? []).forEach((c) => {
        names[c.slug] = c.name;
        idMap[c.slug] = c.id;
      });
      setTradeNames(names);
      setIds(idMap);

      // How many pros do each trade, so we can say something honest about coverage.
      const { data: links } = await supabase.from("pro_categories").select("category_id");
      const byId: Record<number, number> = {};
      (links ?? []).forEach((l: any) => {
        byId[l.category_id] = (byId[l.category_id] ?? 0) + 1;
      });
      const bySlug: Record<string, number> = {};
      Object.entries(idMap).forEach(([slug, id]) => {
        bySlug[slug] = byId[id] ?? 0;
      });
      setCounts(bySlug);
    }
    load();
  }, []);

  // The answer screen
  if (picked) {
    const mainName = tradeNames[picked.trade] ?? picked.trade;
    const others = (picked.alsoTry ?? []).map((s) => tradeNames[s] ?? s);
    const count = counts[picked.trade] ?? 0;

    return (
      <main className="page">
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-[var(--rust)] underline"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Start over
        </button>

        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-semibold text-[var(--rust)]">{picked.label}</span>
          <h1 className="h1">You probably need {mainName.toLowerCase()}</h1>
          {others.length > 0 && (
            <p className="lede">
              It could also be {others.join(" or ").toLowerCase()}, depending on what they find. Start with{" "}
              {mainName.toLowerCase()} and they'll tell you if it's something else.
            </p>
          )}
          {count > 0 && (
            <p className="text-sm text-[var(--ink-soft)]">
              {count} {count === 1 ? "trade" : "trades"} on FairWork {count === 1 ? "does" : "do"} this work.
            </p>
          )}
        </div>

        {picked.urgent && (
          <div className="rounded-2xl border-2 border-[#8a2e08] bg-[#fbe9e2] p-4">
            <span className="mb-1 flex items-center gap-2 text-sm font-bold text-[#8a2e08]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 8v5M12 16.5v.5" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              Don't wait on this one
            </span>
            <p className="text-[14.5px] leading-relaxed text-[#8a2e08]">{picked.urgent}</p>
          </div>
        )}

        {picked.firstCheck && (
          <div className="rounded-2xl bg-[var(--sand)] p-4">
            <span className="mb-1 block text-sm font-bold">Worth checking yourself first</span>
            <p className="text-[14.5px] leading-relaxed text-[var(--ink-soft)]">{picked.firstCheck}</p>
          </div>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="h2">What they'll ask you</h2>
            <p className="hint">Answer these in your job post and you'll get real prices instead of "it depends".</p>
          </div>
          <div className="panel">
            {picked.questions.map((q, i) => (
              <div
                key={q}
                className={`flex gap-3 px-4 py-3 ${i < picked.questions.length - 1 ? "border-b border-[var(--line-soft)]" : ""}`}
              >
                <span className="font-display shrink-0 text-sm font-extrabold text-[var(--rust)]">{i + 1}</span>
                <span className="text-[14.5px]">{q}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="h2">Photos to take</h2>
          <p className="text-[14.5px] leading-relaxed text-[var(--ink-soft)]">{picked.photoHint}</p>
        </section>

        <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <span className="font-display text-lg font-extrabold">Ready?</span>
          <span className="text-sm leading-relaxed text-[var(--ink-soft)]">
            Post it once and {mainName.toLowerCase()} trades nearby send you prices. Or browse them first and
            see what they charge.
          </span>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              href={`/jobs/new?category=${ids[picked.trade] ?? ""}`}
              className="press rounded-xl bg-[var(--rust)] px-5 py-3 text-sm font-semibold text-white no-underline"
            >
              Post this job
            </Link>
            <Link
              href={`/?category=${picked.trade}`}
              className="press rounded-xl border border-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--ink)] no-underline"
            >
              Browse {mainName.toLowerCase()}
            </Link>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed text-[var(--ink-faint)]">
          This points you at the right trade. It isn't a diagnosis, and only someone who sees the job can tell
          you what's actually wrong.
        </p>
      </main>
    );
  }

  // The picker
  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">What's going on?</h1>
        <p className="lede">
          You don't need to know which trade to call. Pick what you're seeing and we'll point you at the right
          one, plus what to tell them.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {SYMPTOMS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setPicked(s);
              window.scrollTo({ top: 0 });
            }}
            className="press rise flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ink)] hover:shadow-[0_8px_18px_rgba(34,32,26,0.1)]"
            style={{ animationDelay: `${0.03 * i}s` }}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--sand)]">
              {s.icon}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15.5px] font-semibold">{s.label}</span>
              <span className="text-[13px] text-[var(--ink-faint)]">{s.blurb}</span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ink-faint)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="ml-auto shrink-0"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      <p className="text-center text-sm text-[var(--ink-soft)]">
        Know what you need already?{" "}
        <Link href="/" className="link">Browse trades</Link>
        {" or "}
        <Link href="/jobs/new" className="link">post a job</Link>.
      </p>
    </main>
  );
}