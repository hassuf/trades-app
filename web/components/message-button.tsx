"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MessageButton({
  proId,
  jobPostId = null,
  label = "Message",
  variant = "solid",
  grow = false,
}: {
  proId: string;
  jobPostId?: string | null;
  label?: string;
  variant?: "solid" | "outline" | "plain";
  grow?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    if (auth.user.id === proId) {
      setBusy(false);
      setNote("That's your own profile.");
      return;
    }

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("homeowner_id", auth.user.id)
      .eq("pro_id", proId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      router.push(`/messages/${existing.id}`);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ homeowner_id: auth.user.id, pro_id: proId, job_post_id: jobPostId })
      .select("id")
      .single();

    setBusy(false);
    if (error || !created) {
      setNote("Couldn't start that conversation. Try again.");
      return;
    }
    router.push(`/messages/${created.id}`);
  }

  const base = "press h-[47px] rounded-xl text-sm font-semibold disabled:opacity-60";
  const styles =
    variant === "solid"
      ? `${base} bg-[var(--rust)] px-5 text-white`
      : variant === "outline"
      ? `${base} border border-[var(--ink)] bg-[var(--card)] px-5 text-[var(--ink)]`
      : "press text-sm font-semibold text-[var(--rust)] underline disabled:opacity-60";

  const width = grow ? "flex-[2]" : variant === "plain" ? "" : "flex-1";

  return (
    <>
      <button type="button" onClick={open} disabled={busy} className={`${styles} ${width}`}>
        {busy ? "Opening…" : label}
      </button>
      {note && <span className="self-center text-xs text-[var(--ink-faint)]">{note}</span>}
    </>
  );
}