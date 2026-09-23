"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NavBar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  const [userId, setUserId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setUserId(auth.user.id);
        const { data: pro } = await supabase.from("pros").select("id").eq("id", auth.user.id).maybeSingle();
        setIsPro(!!pro);
      } else {
        setUserId(null);
        setIsPro(false);
      }
      setReady(true);
    }
    load();
  }, [pathname]);

  async function logOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const tabs = isPro
    ? [
        { href: "/", label: "Browse" },
        { href: "/pro/jobs-available", label: "Find work" },
        { href: "/messages", label: "Messages" },
      ]
    : [
        { href: "/", label: "Browse" },
        { href: "/jobs", label: "My jobs" },
        { href: "/messages", label: "Messages" },
      ];

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const activeIndex = tabs.findIndex((t) => active(t.href));
  const topLink = "text-sm font-semibold text-[var(--rust)] no-underline hover:text-[var(--rust-dark)]";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="font-display text-xl font-extrabold text-[var(--ink)] no-underline">
            [NAME]
          </Link>

          <nav className="flex items-center gap-4">
            <div className="hidden items-center gap-4 sm:flex">
              {ready &&
                (isPro ? (
                  <>
                    <Link href="/pro/jobs-available" className={topLink}>Find work</Link>
                    <Link href="/pro/rates" className={topLink}>Rate card</Link>
                    <Link href="/pro/jobs" className={topLink}>Past jobs</Link>
                  </>
                ) : userId ? (
                  <>
                    <Link href="/jobs/new" className={topLink}>Post a job</Link>
                    <Link href="/jobs" className={topLink}>My jobs</Link>
                  </>
                ) : null)}
            </div>

            {ready && userId && (
              <>
                <Link href="/messages" className={topLink}>Messages</Link>
                {isPro && (
                  <Link href={`/pros/${userId}`} className={topLink}>My profile</Link>
                )}
                <button type="button" onClick={logOut} className="press text-sm font-medium text-[var(--ink-soft)] underline">
                  Log out
                </button>
              </>
            )}

            {ready && !userId && (
              <>
                <Link href="/login" className={topLink}>Log in</Link>
                <Link
                  href="/signup"
                  className="press rounded-[10px] bg-[var(--rust)] px-3 py-2 text-sm font-semibold text-white no-underline"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* bottom tabs on phones, with a sliding indicator */}
      {ready && userId && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--line)] bg-[var(--card)] sm:hidden">
          <div className="relative mx-auto grid max-w-md grid-cols-3 pt-2 pb-3.5">
            {activeIndex >= 0 && (
              <span
                className="absolute top-0 h-[3px] w-10 rounded-sm bg-[var(--rust)] transition-[left] duration-300 ease-out"
                style={{ left: `calc(${activeIndex * 33.333}% + 16.666% - 20px)` }}
              />
            )}
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`press py-1.5 text-center text-xs no-underline ${
                  active(t.href) ? "font-semibold text-[var(--rust)]" : "font-medium text-[var(--ink-faint)]"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}