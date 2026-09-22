"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OwnerLinks({ proId }: { proId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsOwner(data.user?.id === proId));
  }, [proId]);

  async function logOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!isOwner) return null;

  const link = "text-sm font-semibold text-[#B43C0A] underline";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#C9C1B1] p-4">
      <span className="text-xs font-medium text-[#5C584F]">Only you can see this.</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/pro/rates" className={link}>Edit rate card</Link>
        <Link href="/pro/jobs" className={link}>Edit past jobs</Link>
        <Link href="/pro/setup" className={link}>Edit business details</Link>
        <button type="button" onClick={logOut} className="text-sm font-medium text-[#4A4740] underline">
          Log out
        </button>
      </div>
    </div>
  );
}