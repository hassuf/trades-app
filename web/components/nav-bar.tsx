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
  const [initials, setInitials] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        setUserId(auth.user.id);
        const { data: pro } = await supabase.from("pros").select("id").eq("id", auth.user.id).maybeSingle();
        setIsPro(!!pro);
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle();
        if (profile?.full_name) {
          setInitials(
            profile.full_name
              .split(" ")
              .slice(0, 2)
              .map((w: string) => w[0])
              .join("")
              .toUpperCase()
          );
        }
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

  const navLink = "text-[15px] font-medium text-[var(--ink)] no-underline hover:text-[var(--rust)]";
  const accentLink = "text-[15px] font-semibold text-[var(--rust)] no-underline hover:text-[var(--rust-dark)]";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-3 lg:px-14 lg:py-4">
          {/* Left: logo + sections */}
          <div className="flex items-center gap-10">
            <Link href="/" className="font-display text-xl font-extrabold text-[var(--ink)] no-underline lg:text-[23px]">
              FairWork
            </Link>
            <div className="hidden items-center gap-7 lg:flex">
              <Link href="/" className={navLink}>Browse pros</Link>
              <Link href="/costs" className={navLink}>What things cost</Link>
              {ready && isPro && <Link href="/pro/jobs-available" className={navLink}>Find work</Link>}
            </div>
          </div>

          {/* Right: account */}
          <div className="flex items-center gap-4 lg:gap-6">
            {ready && !userId && (
              <>
                <Link href="/signup" className={`hidden lg:inline ${accentLink}`}>List your work</Link>
                <Link href="/login" className={navLink}>Log in</Link>
                <Link
                  href="/signup"
                  className="press rounded-[11px] bg-[var(--rust)] px-3 py-2 text-sm font-semibold text-white no-underline lg:px-[18px] lg:py-[11px] lg:text-[15px]"
                >
                  Sign up
                </Link>
              </>
            )}

            {ready && userId && (
              <>
                <Link href="/messages" className={`hidden lg:inline ${navLink}`}>Messages</Link>
                <Link href={isPro ? "/pro/jobs" : "/jobs"} className={`hidden lg:inline ${navLink}`}>
                  {isPro ? "My work" : "My jobs"}
                </Link>
                {!isPro && (
                  <Link
                    href="/jobs/new"
                    className="press hidden rounded-[11px] bg-[var(--rust)] px-[18px] py-[11px] text-[15px] font-semibold text-white no-underline lg:inline"
                  >
                    Post a job
                  </Link>
                )}
                {isPro && userId && (
                  <Link href={`/pros/${userId}`} className={`hidden lg:inline ${accentLink}`}>My profile</Link>
                )}
                <button type="button" onClick={logOut} className="press text-sm font-medium text-[var(--ink-soft)] underline lg:text-[15px]">
                  Log out
                </button>
                {initials && (
                  <span className="hidden h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--sand)] text-[13px] font-semibold text-[#6b5a3e] lg:flex">
                    {initials}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Bottom tabs on phones */}
      {ready && userId && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--line)] bg-[var(--card)] lg:hidden">
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