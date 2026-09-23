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

  // Tabs shown in the bottom bar on phones.
  const tabs = isPro
    ? [
        { href: "/", label: "Browse" },
        { href: "/pro/jobs-available", label: "Find work" },
        { href: userId ? `/pros/${userId}` : "/login", label: "My profile" },
      ]
    : [
        { href: "/", label: "Browse" },
        { href: "/jobs/new", label: "Post a job" },
        { href: "/jobs", label: "My jobs" },
      ];

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const topLink = "text-sm font-semibold text-[#B43C0A] no-underline hover:underline";

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-[#E2DCCF] bg-[#F4F1EA]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="text-xl font-extrabold tracking-tight text-[#1C1B19] no-underline">
            [APP NAME]
          </Link>

          <nav className="flex items-center gap-4">
            {/* Wider screens get the full set of links up here */}
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
                  <Link href={`/pros/${userId}`} className={topLink}>
                    My profile
                  </Link>
                )}
                <button type="button" onClick={logOut} className="text-sm font-medium text-[#4A4740] underline">
                  Log out
                </button>
              </>
            )}

            {ready && !userId && (
              <>
                <Link href="/login" className={topLink}>Log in</Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-[#B43C0A] px-3 py-2 text-sm font-semibold text-white no-underline"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Bottom tabs, phones only, signed in only */}
      {ready && userId && (
        <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-[#D9D3C6] bg-white sm:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`py-3 text-center text-xs font-semibold no-underline ${
                  active(t.href) ? "text-[#B43C0A]" : "text-[#5C584F]"
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