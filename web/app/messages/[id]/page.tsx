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
      <main className="page">
        <p className="text-sm text-[var(--ink-faint)]">Loading…</p>
      </main>
    );
  }

  if (!otherId) {
    return (
      <main className="page">
        <p className="text-sm text-[var(--ink-faint)]">This conversation isn't available.</p>
        <Link href="/messages" className="link">
          Back to messages
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-6 pt-6">
      <div className="flex flex-col gap-1 pb-4">
        <Link href="/messages" className="link">
          Back to messages
        </Link>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{otherName}</h1>
        <span className="text-xs font-medium text-[var(--rust)]">{subject}</span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {messages.length === 0 && (
          <p className="panel p-4 text-sm text-[var(--ink-faint)]">No messages yet. Say hello.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={`rise flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                  mine
                    ? "bg-[var(--rust)] text-white"
                    : "border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                }`}
              >
                {m.body}
              </div>
              <span className="px-1 text-[11px] text-[var(--ink-faint)]">
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

      {error && <p className="error mt-3">{error}</p>}

      <form onSubmit={send} className="sticky bottom-20 mt-4 flex gap-2 sm:bottom-4">
        <textarea
          className="area flex-1"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message"
        />
        <button type="submit" disabled={sending || !body.trim()} className="btn btn-primary self-end px-5">
          Send
        </button>
      </form>
    </main>
  );
}