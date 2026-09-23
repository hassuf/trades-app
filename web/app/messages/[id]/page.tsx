"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; sender_id: string; body: string; created_at: string };

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const endRef = useRef<HTMLDivElement>(null);

  const [me, setMe] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [subject, setSubject] = useState("");
  const [otherId, setOtherId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setMe(auth.user.id);

      const { data: convo } = await supabase
        .from("conversations")
        .select("id, homeowner_id, pro_id, job_posts(categories(name))")
        .eq("id", params.id)
        .maybeSingle();

      if (!convo) {
        setLoading(false);
        return;
      }

      const other = convo.homeowner_id === auth.user.id ? convo.pro_id : convo.homeowner_id;
      setOtherId(other);
      setSubject((convo as any).job_posts?.categories?.name ?? "Direct message");

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", other).maybeSingle();
      const { data: pro } = await supabase.from("pros").select("business_name").eq("id", other).maybeSingle();
      setOtherName(pro?.business_name || profile?.full_name || "Someone");

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", params.id)
        .order("created_at");
      setMessages((msgs as Message[]) ?? []);
      setLoading(false);
    }
    load();
  }, [params.id]);

  // Listen for new messages in this conversation.
  useEffect(() => {
    const channel = supabase
      .channel(`thread-${params.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${params.id}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !body.trim()) return;
    setSending(true);
    const text = body.trim();
    setBody("");

    const { data, error: sendError } = await supabase
      .from("messages")
      .insert({ conversation_id: params.id, sender_id: me, body: text })
      .select("id, sender_id, body, created_at")
      .single();

    setSending(false);
    if (sendError) {
      setError("Couldn't send that. Check your connection and try again.");
      setBody(text);
      return;
    }
    setError(null);
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data as Message]));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4F1EA] px-5 py-10">
        <p className="mx-auto max-w-md text-sm text-[#5C584F]">Loading…</p>
      </main>
    );
  }

  if (!otherId) {
    return (
      <main className="min-h-screen bg-[#F4F1EA] px-5 py-10">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <p className="text-sm text-[#5C584F]">This conversation isn't available.</p>
          <Link href="/messages" className="text-sm font-semibold text-[#B43C0A] underline">
            Back to messages
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-6 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Link href="/messages" className="text-sm font-semibold text-[#B43C0A] underline">
            Back to messages
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">{otherName}</h1>
          <span className="text-xs font-medium text-[#B43C0A]">{subject}</span>
        </div>

        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="rounded-2xl border border-[#E2DCCF] bg-white p-4 text-sm text-[#5C584F]">
              No messages yet. Say hello.
            </p>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                    mine ? "bg-[#B43C0A] text-white" : "border border-[#E2DCCF] bg-white text-[#1C1B19]"
                  }`}
                >
                  {m.body}
                </div>
                <span className="px-1 text-[11px] text-[#5C584F]">
                  {new Date(m.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {error && <p className="rounded-lg bg-[#FBE9E2] px-3 py-2 text-sm text-[#8A2E08]">{error}</p>}

        <form onSubmit={send} className="sticky bottom-20 flex gap-2 sm:bottom-4">
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message"
            className="flex-1 resize-none rounded-xl border border-[#D9D3C6] bg-white p-3 text-[15px] outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="h-12 shrink-0 self-end rounded-xl bg-[#B43C0A] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}