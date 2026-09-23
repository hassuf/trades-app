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
  initials: string;
  subject: string;
  preview: string;
  when: string | null;
  sortKey: string;
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
        const otherName = names[otherId] ?? "Someone";
        return {
          id: r.id,
          otherName,
          initials: otherName
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase(),
          subject: r.job_posts?.categories?.name ?? "Direct message",
          preview: last ? `${last.sender_id === me ? "You: " : ""}${last.body}` : "No messages yet",
          when: last
            ? new Date(last.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : null,
          sortKey: last?.created_at ?? r.created_at,
        };
      });

      list.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
      setItems(list);
    }
    load();
  }, []);

  return (
    <main className="page">
      <h1 className="h1">Messages</h1>

      {items === null && <p className="text-sm text-[var(--ink-faint)]">Loading…</p>}

      {items?.length === 0 && (
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">
          No messages yet. Message a pro from their profile, or reply to a quote on one of your jobs.
        </p>
      )}

      {items?.map((c, i) => (
        <Link
          key={c.id}
          href={`/messages/${c.id}`}
          className="card rise flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 no-underline"
          style={{ animationDelay: `${0.04 * i}s` }}
        >
          <div className="font-display flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-[var(--sand)] text-[15px] font-extrabold text-[#6b5a3e]">
            {c.initials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-bold text-[var(--ink)]">{c.otherName}</span>
              {c.when && <span className="hint shrink-0">{c.when}</span>}
            </div>
            <span className="text-xs font-medium text-[var(--rust)]">{c.subject}</span>
            <span className="line-clamp-2 text-sm text-[var(--ink-soft)]">{c.preview}</span>
          </div>
        </Link>
      ))}
    </main>
  );
}