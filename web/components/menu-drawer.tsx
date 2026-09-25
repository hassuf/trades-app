"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: number; slug: string; name: string };

export default function MenuDrawer({ categories }: { categories: Category[] }) {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setUserId(null);
        setIsPro(false);
        return;
      }
      setUserId(auth.user.id);
      const { data: pro } = await supabase.from("pros").select("id").eq("id", auth.user.id).maybeSingle();
      setIsPro(!!pro);
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
      setName(profile?.full_name ?? "");
    }
    load();
  }, [pathname]);

  // Close on route change and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function logOut() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const item =
    "flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium text-[var(--ink)] no-underline hover:bg-[var(--sand)]";
  const sectionLabel = "px-3 pb-1 pt-4 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]";

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="press flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--card)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setOpen(false)}
        className={`veil fixed inset-0 z-40 bg-[var(--ink)]/45 ${open ? "visible opacity-100" : "invisible opacity-0"}`}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`panel fixed left-0 top-0 z-50 flex h-full w-[86%] max-w-[340px] flex-col bg-[var(--paper)] shadow-[8px_0_30px_rgba(34,32,26,0.18)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
          <span className="font-display text-xl font-extrabold">FairWork</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="press flex h-9 w-9 items-center justify-center rounded-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-6">
          {userId && name && (
            <div className="px-3 pb-2 pt-4 text-sm text-[var(--ink-soft)]">
              Signed in as <span className="font-semibold text-[var(--ink)]">{name}</span>
            </div>
          )}

          <div className={sectionLabel}>Find work done</div>
          <Link href="/" className={item}>Browse pros</Link>
          <Link href="/jobs/new" className={item}>Post a job</Link>
          <Link href="/costs" className={item}>Going rates</Link>
          {userId && <Link href="/jobs" className={item}>My jobs</Link>}

          <div className={sectionLabel}>For pros</div>
          {isPro ? (
            <>
              <Link href="/pro/jobs-available" className={item}>Find work</Link>
              <Link href={`/pros/${userId}`} className={item}>My profile</Link>
              <Link href="/pro/rates" className={item}>My rate card</Link>
              <Link href="/pro/jobs" className={item}>My past jobs</Link>
              <Link href="/pro/setup" className={item}>Business details</Link>
            </>
          ) : (
            <Link href="/signup" className={item}>List your work</Link>
          )}

          <div className={sectionLabel}>Trades</div>
          {categories.map((c) => (
            <Link key={c.id} href={`/?category=${c.slug}`} className={item}>
              {c.name}
            </Link>
          ))}

          <div className="mt-4 border-t border-[var(--line)] pt-3">
            {userId ? (
              <>
                <Link href="/messages" className={item}>Messages</Link>
                <button type="button" onClick={logOut} className={`${item} w-full text-left`}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={item}>Log in</Link>
                <Link href="/signup" className={item}>Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}