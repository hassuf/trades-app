"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SaveButton({ proId }: { proId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [saved, setSaved] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setMe(auth.user.id);
      const { data } = await supabase
        .from("saved_pros")
        .select("pro_id")
        .eq("homeowner_id", auth.user.id)
        .eq("pro_id", proId)
        .maybeSingle();
      setSaved(!!data);
    }
    load();
  }, [proId]);

  async function toggle(e: React.MouseEvent) {
    // The button sits inside a card link, so don't navigate.
    e.preventDefault();
    e.stopPropagation();

    if (!me) {
      router.push("/login");
      return;
    }
    if (me === proId) return;

    const next = !saved;
    setSaved(next);
    if (next) {
      setBump(true);
      setTimeout(() => setBump(false), 360);
      await supabase.from("saved_pros").insert({ homeowner_id: me, pro_id: proId });
    } else {
      await supabase.from("saved_pros").delete().eq("homeowner_id", me).eq("pro_id", proId);
    }
  }

  if (me === proId) return null;

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from saved" : "Save this pro"}
      aria-pressed={saved}
      onClick={toggle}
      className={`save absolute right-2.5 top-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-full shadow-sm transition-[background,transform] duration-200 hover:scale-110 ${
        saved ? "bg-[#ffe3d6]" : "bg-[var(--card)]/95"
      }`}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill={saved ? "var(--rust)" : "none"}
        stroke="var(--ink)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        aria-hidden="true"
        className={bump ? "pop" : ""}
      >
        <path d="M12 20s-7-4.5-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5c0 5-7 9.5-7 9.5z" />
      </svg>
    </button>
  );
}