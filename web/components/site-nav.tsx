"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SiteNav() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);
      const { data: pro } = await supabase.from("pros").select("id").eq("id", auth.user.id).maybeSingle();
      setIsPro(!!pro);
    }
    load();
  }, []);

  const link = "text-sm font-semibold text-[#B43C0A] underline";

  return (
    <header className="flex items-center justify-between gap-4 pb-2">
      <Link href="/" className="text-2xl font-extrabold tracking-tight text-[#1C1B19] no-underline">
        [APP NAME]
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {userId && (
          <Link href="/jobs" className={link}>
            My jobs
          </Link>
        )}
        {userId && isPro && (
          <Link href={`/pros/${userId}`} className={link}>
            My profile
          </Link>
        )}
        {!userId && (
          <>
            <Link href="/login" className={link}>
              Log in
            </Link>
            <Link href="/signup" className={link}>
              List your work
            </Link>
          </>
        )}
      </div>
    </header>
  );
}