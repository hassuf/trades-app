"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, type RateItem } from "@/lib/format";

export default function BookingSheet({
  proId,
  proName,
  rates = [],
  hourly = null,
}: {
  proId: string;
  proName: string;
  rates?: RateItem[];
  hourly?: RateItem | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [job, setJob] = useState("");
  const [timing, setTiming] = useState("flexible");
  const [me, setMe] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isOwn = me === proId;
  const headline = rates[0] ?? hourly ?? null;

  function start() {
    if (!me) {
      router.push("/login");
      return;
    }
    setError(null);
    // Seed the message with what they picked, so they're not staring at a blank box.
    if (!body && job) {
      const timingText =
        timing === "this_week" ? "this week" : timing === "next_2_weeks" ? "in the next two weeks" : "whenever suits you";
      setBody(`Hi, I'm after: ${job}. I'd like it done ${timingText}. `);
    }
    setOpen(true);
  }

  async function send() {
    if (!me || !body.trim()) return;
    setSending(true);
    setError(null);

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("homeowner_id", me)
      .eq("pro_id", proId)
      .limit(1)
      .maybeSingle();

    let conversationId = existing?.id ?? null;

    if (!conversationId) {
      const { data: created, error: convoError } = await supabase
        .from("conversations")
        .insert({ homeowner_id: me, pro_id: proId })
        .select("id")
        .single();
      if (convoError || !created) {
        setSending(false);
        setError("Couldn't start that conversation. Try again.");
        return;
      }
      conversationId = created.id;
    }

    const { error: msgError } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body: body.trim() });

    setSending(false);
    if (msgError) {
      setError("Couldn't send that message. Try again.");
      return;
    }
    router.push(`/messages/${conversationId}`);
  }

  const panelInner = (
    <>
      {headline && (
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-[var(--ink-faint)]">
            {rates.length > 0 ? "Most common job" : "Hourly rate"}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[30px] font-extrabold">{formatPrice(headline)}</span>
            <span className="text-sm text-[var(--ink-faint)]">{headline.title.toLowerCase()}</span>
          </div>
          {hourly && rates.length > 0 && (
            <span className="text-[13px] text-[var(--ink-faint)]">
              Or {formatPrice(hourly)} for anything else
            </span>
          )}
        </div>
      )}

      {!isOwn && (
        <>
          <div className="flex flex-col gap-2.5 border-y border-[#e8e1d3] py-3.5">
            {rates.length > 0 && (
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                What do you need done?
                <select
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  className="h-[46px] rounded-[11px] border border-[#ddd4c2] bg-white px-3 text-[14.5px] font-normal"
                >
                  <option value="">Choose a job</option>
                  {rates.map((r) => (
                    <option key={r.id} value={`${r.title} (${formatPrice(r)})`}>
                      {r.title} · {formatPrice(r)}
                    </option>
                  ))}
                  <option value="something else">Something else</option>
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              When suits you?
              <select
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                className="h-[46px] rounded-[11px] border border-[#ddd4c2] bg-white px-3 text-[14.5px] font-normal"
              >
                <option value="this_week">This week</option>
                <option value="next_2_weeks">Next two weeks</option>
                <option value="flexible">I'm flexible</option>
              </select>
            </label>
          </div>

          <button type="button" onClick={start} className="btn btn-primary h-[52px] text-base">
            Ask about this job
          </button>

          <span className="text-center text-[12.5px] leading-relaxed text-[var(--ink-faint)]">
            Free to ask. You pay only when the job is done.
          </span>
        </>
      )}

      {isOwn && (
        <p className="border-t border-[#e8e1d3] pt-3.5 text-sm text-[var(--ink-faint)]">
          This is how homeowners see your profile. They'd see a booking form here.
        </p>
      )}
    </>
  );

  return (
    <>
      {/* Desktop: sticky side panel */}
      <div className="hidden lg:block">
        <div className="sticky top-24 flex flex-col gap-4 rounded-[18px] border border-[var(--line)] bg-[var(--card)] p-[22px] shadow-[0_6px_20px_rgba(34,32,26,0.07)]">
          {panelInner}
        </div>
      </div>

      {/* Phone: fixed action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--line)] bg-[var(--card)] lg:hidden">
        <div className="mx-auto flex max-w-md gap-2.5 px-5 pb-[18px] pt-3">
          {isOwn ? (
            <span className="flex-1 self-center text-center text-sm text-[var(--ink-faint)]">
              This is how homeowners see your profile.
            </span>
          ) : (
            <>
              <button type="button" onClick={start} className="btn btn-outline flex-1">
                Message
              </button>
              <button type="button" onClick={start} className="btn btn-primary flex-[2]">
                Ask about a job
              </button>
            </>
          )}
        </div>
      </div>

      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => setOpen(false)}
        className={`veil fixed inset-0 z-40 bg-[var(--ink)]/45 ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      />

      {/* Sheet, both sizes */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Message ${proName}`}
        className={`sheet fixed bottom-0 left-0 right-0 z-50 rounded-t-[22px] bg-[var(--paper)] px-5 pb-6 pt-3.5 shadow-[0_-10px_30px_rgba(34,32,26,0.18)] lg:left-1/2 lg:right-auto lg:bottom-auto lg:top-1/2 lg:w-[480px] lg:-translate-x-1/2 lg:rounded-[22px] lg:p-7 ${
          open ? "translate-y-0 lg:-translate-y-1/2" : "translate-y-[105%] lg:translate-y-[120%]"
        }`}
      >
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-4 h-1 w-[38px] rounded-sm bg-[#d9d0be] lg:hidden" />
          <h3 className="font-display mb-1.5 text-[19px] font-extrabold">Ask {proName}</h3>
          <p className="mb-3.5 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            Tell them what you need. They confirm the final price on site before starting.
          </p>
          <textarea
            className="area"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. One outlet on the bedroom wall, nearest one is 6 ft away"
          />
          {error && <p className="error mt-2">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-outline px-5">
              Cancel
            </button>
            <button type="button" onClick={send} disabled={sending || !body.trim()} className="btn btn-primary flex-1">
              {sending ? "Sending…" : "Send message"}
            </button>
          </div>
          <p className="mt-2.5 text-center text-[11.5px] text-[var(--ink-faint)]">
            Free to ask. You pay only when the job is done.
          </p>
        </div>
      </div>
    </>
  );
}