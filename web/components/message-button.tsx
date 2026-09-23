"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MessageButton({
  proId,
  jobPostId = null,
  label = "Message",
  variant = "solid",
}: {
  proId: string;
  jobPostId?: string | null;
  label?: string;
  variant?: "solid" | "plain";
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    if (auth.user.id === proId) {
      setBusy(false);
      alert("That's your own profile.");
      return;
    }

    // Reuse the existing conversation if there is one.
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("homeowner_id", auth.user.id)
      .eq("pro_id", proId)
      .is("job_post_id", jobPostId === null ? null : undefined)
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
      alert("Couldn't start that conversation. Try again.");
      return;
    }
    router.push(`/messages/${created.id}`);
  }

  const styles =
    variant === "solid"
      ? "rounded-xl bg-[#B43C0A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      : "text-sm font-semibold text-[#B43C0A] underline disabled:opacity-60";

  return (
    <button type="button" onClick={open} disabled={busy} className={styles}>
      {busy ? "Opening…" : label}
    </button>
  );
}