"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MenuDrawer from "@/components/menu-drawer";
import SideSwitch from "@/components/side-switch";

type Category = { id: number; slug: string; name: string };

export default function NavBar() {
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [initials, setInitials] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [side, setSide] = useState<"homeowner" | "trade">("homeowner");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, slug, name")
        .order("sort_order")
        .order("id");
      setCategories(cats ?? []);

      const { data: auth } = await supabase.auth.getUser();
      let pro = false;

      if (auth.user) {
        setUserId(auth.user.id);
        const { data: proRow } = await supabase.from("pros").select("id").eq("id", auth.user.id).maybeSingle();
        pro = !!proRow;
        setIsPro(pro);
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

      // The chooser wins; otherwise fall back to what their account is.
      let chosen: "homeowner" | "trade" | null = null;
      try {
        const saved = localStorage.getItem("fw-side");
        if (saved === "homeowner" || saved === "trade") chosen = saved;
      } catch {}
      if (params.get("view") === "trade") chosen = "trade";
      setSide(chosen ?? (pro ? "trade" : "homeowner"));

      setReady(true);
    }
    load();
  }, [pathname, params]);

  async function logOut() {
    await supabase.auth.signOut();
    setUserId(null);
    setIsPro(false);
    setInitials("");
    router.push("/");
    router.refresh();
  }

  const isTrade = side === "trade";

  const tabs = isTrade
    ? [
        { href: "/?view=trade", label: "Work" },
        { href: "/hiring", label: "Hiring" },
        { href: "/messages", label: "Messages" },
      ]
    : [
        { href: "/", label: "Browse" },
        { href: "/jobs", label: "My jobs" },
        { href: "/messages", label: "Messages" },
      ];

  const active = (href: string) => {
    const path = href.split("?")[0];
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  };
  const activeIndex = tabs.findIndex((t) => active(t.href));

  const navLink = "text-[15px] font-medium text-[var(--ink)] no-underline hover:text-[var(--rust)]";
  const accentLink = "text-[15px] font-semibold text-[var(--rust)] no-underline hover:text-[var(--rust-dark)]";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 lg:px-14 lg:py-4">
          <div className="flex items-center gap-3 lg:gap-10">
            <div className="lg:hidden">
              <MenuDrawer categories={categories} side={side} />
            </div>

            <Link
              href={isTrade ? "/?view=trade" : "/"}
              className="font-display text-xl font-extrabold text-[var(--ink)] no-underline lg:text-[23px]"
            >
              FairWork
            </Link>

            {/* Sections differ by side */}
            <div className="hidden items-center gap-7 lg:flex">
              {ready && isTrade && (
                <>
                  <Link href="/pro/jobs-available" className={navLink}>Find work</Link>
                  <Link href="/hiring" className={navLink}>Hiring board</Link>
                   <Link href="/costs" className={navLink}>Going rates</Link>
                  <Link href="/pro/market" className={navLink}>My pricing</Link>
                </>
              )}
              {ready && !isTrade && (
                <>
                  <Link href="/" className={navLink}>Browse trades</Link>
                  <Link href="/costs" className={navLink}>Going rates</Link>
                  <Link href="/jobs/new" className={navLink}>Post a job</Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <SideSwitch />

            {ready && !userId && (
              <>
                <Link href="/signup" className={`hidden lg:inline ${accentLink}`}>
                  {isTrade ? "List your work" : "Sign up free"}
                </Link>
                <Link href="/login" className={`hidden sm:inline ${navLink}`}>Log in</Link>
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

                {isTrade ? (
                  <>
                    {isPro && (
                      <Link href={`/pros/${userId}`} className={`hidden lg:inline ${accentLink}`}>My profile</Link>
                    )}
                    {!isPro && (
                      <Link href="/pro/setup" className={`hidden lg:inline ${accentLink}`}>Set up your listing</Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link href="/jobs" className={`hidden lg:inline ${navLink}`}>My jobs</Link>
                    <Link
                      href="/jobs/new"
                      className="press hidden rounded-[11px] bg-[var(--rust)] px-[18px] py-[11px] text-[15px] font-semibold text-white no-underline lg:inline"
                    >
                      Post a job
                    </Link>
                  </>
                )}

                <button type="button" onClick={logOut} className="press hidden text-[15px] font-medium text-[var(--ink-soft)] underline lg:inline">
                  Log out
                </button>
                {initials && (
                  <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--sand)] text-[13px] font-semibold text-[#6b5a3e]">
                    {initials}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </header>

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