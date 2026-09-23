"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: string;
  homeowner_id: string;
  pro_id: string;
  job_post_id: string | null;
  created_at: string;
  job_posts: { categories: { name: string } | null } | null;
  messages: { body: string; created_at: string; sender_id: string }[];
};

type Item = {
  id: string;
  otherName: string;
  subject: string;
  preview: string;
  when: string | null;
};

export default function InboxPage() {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      const me = auth.user.id;

      const { data } = await supabase
        .from("conversations")
        .select(
          `id, homeowner_id, pro_id, job_post_id, created_at,
           job_posts(categories(name)),
           messages(body, created_at, sender_id)`
        )
        .order("created_at", { ascending: false });

      const rows = (data as unknown as Row[]) ?? [];

      // Look up the names of everyone on the other side.
      const otherIds = rows.map((r) => (r.homeowner_id === me ? r.pro_id : r.homeowner_id));
      const names: Record<string, string> = {};
      if (otherIds.length) {
        const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", otherIds);
        (people ?? []).forEach((p) => {
          names[p.id] = p.full_name;
        });
        const { data: bizNames } = await supabase.from("pros").select("id, business_name").in("id", otherIds);
        (bizNames ?? []).forEach((p) => {
          if (p.business_name) names[p.id] = p.business_name;
        });
      }

      const list: Item[] = rows.map((r) => {
        const otherId = r.homeowner_id === me ? r.pro_id : r.homeowner_id;
        const sorted = [...(r.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const last = sorted[sorted.length - 1];
        return {
          id: r.id,
          otherName: names[otherId] ?? "Someone",
          subject: r.job_posts?.categories?.name ?? "Direct message",
          preview: last ? `${last.sender_id === me ? "You: " : ""}${last.body}` : "No messages yet",
          when: last ? new Date(last.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null,
        };
      });

      // Most recently active first.
      setItems(list);
    }
    load();
  }, []);

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Messages</h1>

        {items === null && <p className="text-sm text-[#5C584F]">Loading…</p>}

        {items?.length === 0 && (
          <p className="rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#5C584F]">
            No messages yet. Message a pro from their profile, or reply to a quote on one of your jobs.
          </p>
        )}

        {items?.map((c) => (
          <Link
            key={c.id}
            href={`/messages/${c.id}`}
            className="flex flex-col gap-1 rounded-2xl border border-[#E2DCCF] bg-white p-4 no-underline"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[16px] font-bold text-[#1C1B19]">{c.otherName}</span>
              {c.when && <span className="shrink-0 text-xs text-[#5C584F]">{c.when}</span>}
            </div>
            <span className="text-xs font-medium text-[#B43C0A]">{c.subject}</span>
            <span className="line-clamp-2 text-sm text-[#4A4740]">{c.preview}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}