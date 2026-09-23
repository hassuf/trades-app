"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function BookingSheet({ proId, proName }: { proId: string; proName: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function start() {
    if (!me) {
      router.push("/login");
      return;
    }
    setError(null);
    setOpen(true);
  }

  async function send() {
    if (!me || !body.trim()) return;
    setSending(true);
    setError(null);

    // Reuse an existing conversation with this pro if there is one.
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

  const isOwn = me === proId;

  return (
    <>
      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--line)] bg-[var(--card)]">
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
        className={`veil fixed inset-0 z-40 bg-[var(--ink)]/45 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Message ${proName}`}
        className={`sheet fixed bottom-0 left-0 right-0 z-50 rounded-t-[22px] bg-[var(--paper)] px-5 pb-6 pt-3.5 shadow-[0_-10px_30px_rgba(34,32,26,0.18)] ${
          open ? "translate-y-0" : "translate-y-[105%]"
        }`}
      >
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-4 h-1 w-[38px] rounded-sm bg-[#d9d0be]" />
          <h3 className="font-display mb-1.5 text-[19px] font-extrabold">Ask {proName}</h3>
          <p className="mb-3.5 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
            Tell them what you need. They confirm the final price on site before starting.
          </p>
          <textarea
            className="area"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. One outlet on the bedroom wall, nearest one is 6 ft away"
          />
          {error && <p className="error mt-2">{error}</p>}
          <button
            type="button"
            onClick={send}
            disabled={sending || !body.trim()}
            className="btn btn-primary mt-3 w-full"
          >
            {sending ? "Sending…" : "Send message"}
          </button>
          <p className="mt-2.5 text-center text-[11.5px] text-[var(--ink-faint)]">
            Free to ask. You pay only when the job is done.
          </p>
        </div>
      </div>
    </>
  );
}