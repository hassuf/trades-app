"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

type Row = {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  hire_type: string;
  pay_unit: string;
  pay_min_cents: number | null;
  pay_max_cents: number | null;
  zip: string;
  starts: string | null;
  duration: string | null;
  needs_license: boolean;
  needs_insurance: boolean;
  needs_tools: boolean;
  created_at: string;
  category_id: number;
  categories: { slug: string; name: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  subcontract: "Subcontract",
  employee: "Employee",
  day_rate: "Day work",
};

export default function HiringBoardPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  const trade = params.get("trade") ?? "";
  const type = params.get("type") ?? "";
  const mineOnly = params.get("mine") === "1";

  const [me, setMe] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [myTradeIds, setMyTradeIds] = useState<number[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [categories, setCategories] = useState<{ id: number; slug: string; name: string }[]>([]);
  const [applied, setApplied] = useState<Record<string, string>>({});

  const [openForm, setOpenForm] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    setMe(auth.user?.id ?? null);

    const { data: cats } = await supabase
      .from("categories")
      .select("id, slug, name")
      .order("sort_order")
      .order("id");
    setCategories(cats ?? []);

    if (auth.user) {
      const { data: pro } = await supabase.from("pros").select("id").eq("id", auth.user.id).maybeSingle();
      setIsPro(!!pro);
      const { data: mine } = await supabase.from("pro_categories").select("category_id").eq("pro_id", auth.user.id);
      setMyTradeIds((mine ?? []).map((m) => m.category_id));

      const { data: apps } = await supabase
        .from("hire_applications")
        .select("id, hire_post_id")
        .eq("pro_id", auth.user.id);
      const map: Record<string, string> = {};
      (apps ?? []).forEach((a: any) => {
        map[a.hire_post_id] = a.id;
      });
      setApplied(map);
    }

    let query = supabase
      .from("hire_posts")
      .select(
        `id, poster_id, title, description, hire_type, pay_unit, pay_min_cents, pay_max_cents, zip,
         starts, duration, needs_license, needs_insurance, needs_tools, created_at, category_id,
         categories(slug, name)`
      )
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (type) query = query.eq("hire_type", type);

    const { data } = await query;
    setRows((data as unknown as Row[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [type]);

  async function apply(row: Row) {
    if (!me) {
      router.push("/login");
      return;
    }
    if (!isPro) {
      setError("You need a pro profile to apply. Set one up first.");
      return;
    }
    setSending(true);
    const { error: applyError } = await supabase
      .from("hire_applications")
      .insert({ hire_post_id: row.id, pro_id: me, message: message || null });
    setSending(false);
    if (applyError) {
      setError(applyError.message);
      return;
    }
    setOpenForm(null);
    setMessage("");
    setError(null);
    await load();
  }

  async function withdraw(row: Row) {
    if (!confirm("Withdraw your application?")) return;
    await supabase.from("hire_applications").delete().eq("id", applied[row.id]);
    await load();
  }

  function pay(r: Row) {
    if (!r.pay_min_cents) return "Pay not listed";
    const unit =
      r.pay_unit === "hourly" ? "/hr" : r.pay_unit === "daily" ? "/day" : r.pay_unit === "salary" ? "/yr" : "";
    const base =
      r.pay_max_cents && r.pay_max_cents !== r.pay_min_cents
        ? `${money(r.pay_min_cents)}–${money(r.pay_max_cents).slice(1)}`
        : money(r.pay_min_cents);
    return base + unit;
  }

  let visible = rows ?? [];
  if (trade) visible = visible.filter((r) => r.categories?.slug === trade);
  if (mineOnly && myTradeIds.length) visible = visible.filter((r) => myTradeIds.includes(r.category_id));

  const chip = (on: boolean) =>
    `chip flex h-[38px] shrink-0 items-center rounded-full border px-[15px] text-sm font-medium no-underline ${
      on
        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]"
        : "border-[#ddd4c2] bg-[var(--card)] text-[var(--ink)]"
    }`;

  const q = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { trade, type, mine: mineOnly ? "1" : "", ...next };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    const s = p.toString();
    return s ? `/hiring?${s}` : "/hiring";
  };

  return (
    <main className="min-h-screen">
      <section className="hero-pattern bg-[var(--dark)] text-[#fbf8f1]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-8 lg:px-14 lg:py-12">
          <span className="text-[13.5px] font-semibold text-[#f0b49a]">Looking for work?</span>
          <h1 className="font-display text-[28px] font-extrabold leading-[1.1] lg:text-[44px]">
            Crews hiring right now
          </h1>
          <p className="max-w-[620px] text-sm leading-relaxed text-[#d8d2c4] lg:text-[17px]">
            Contractors post the trades they need on a job: subs for a few weeks, day work, or someone full
            time. Free to apply, and nobody pays for the lead.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              href="/hiring/new"
              className="press rounded-xl bg-[var(--rust)] px-5 py-3 text-sm font-semibold text-white no-underline"
            >
              Post a role
            </Link>
            <Link
              href="/hiring/mine"
              className="press rounded-xl border border-[#fbf8f1] px-5 py-3 text-sm font-semibold text-[#fbf8f1] no-underline"
            >
              Roles you posted
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-6 lg:px-14 lg:py-9">
        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="rail flex gap-2">
            <Link href={q({ type: "" })} className={chip(!type)}>All work</Link>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <Link key={value} href={q({ type: value })} className={chip(type === value)}>
                {label}
              </Link>
            ))}
            {isPro && (
              <Link href={q({ mine: mineOnly ? "" : "1" })} className={chip(mineOnly)}>
                My trades only
              </Link>
            )}
          </div>

          <div className="rail flex gap-2">
            <Link href={q({ trade: "" })} className={chip(!trade)}>All trades</Link>
            {categories.map((c) => (
              <Link key={c.id} href={q({ trade: c.slug })} className={chip(trade === c.slug)}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[15px] font-semibold lg:text-[22px] lg:font-extrabold">
            {visible.length} {visible.length === 1 ? "role" : "roles"} open
          </h2>
        </div>

        {error && <p className="error">{error}</p>}

        {rows === null && <p className="text-sm text-[var(--ink-faint)]">Loading…</p>}

        {rows !== null && visible.length === 0 && (
          <p className="panel p-5 text-sm text-[var(--ink-faint)]">
            Nothing open matching that right now. Hiring yourself?{" "}
            <Link href="/hiring/new" className="link">Post a role</Link>.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((r, i) => {
            const mine = r.poster_id === me;
            const hasApplied = !!applied[r.id];
            return (
              <article
                key={r.id}
                className="rise flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5"
                style={{ animationDelay: `${0.04 * i}s` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-display text-[17px] font-extrabold leading-tight">{r.title}</span>
                    <span className="hint">
                      {r.categories?.name} · {TYPE_LABEL[r.hire_type]} · {r.zip}
                    </span>
                  </div>
                  <span className="font-display shrink-0 text-[17px] font-extrabold">{pay(r)}</span>
                </div>

                <p className="text-sm leading-relaxed">{r.description}</p>

                {(r.starts || r.duration) && (
                  <div className="flex gap-4 text-[13px] text-[var(--ink-soft)]">
                    {r.starts && <span>Starts {r.starts}</span>}
                    {r.duration && <span>{r.duration}</span>}
                  </div>
                )}

                {(r.needs_license || r.needs_insurance || r.needs_tools) && (
                  <div className="flex flex-wrap gap-2">
                    {r.needs_license && (
                      <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11.5px] font-medium">
                        Own license
                      </span>
                    )}
                    {r.needs_insurance && (
                      <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11.5px] font-medium">
                        Own insurance
                      </span>
                    )}
                    {r.needs_tools && (
                      <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11.5px] font-medium">
                        Own tools and transport
                      </span>
                    )}
                  </div>
                )}

                <div className="border-t border-[var(--line-soft)] pt-3">
                  {mine ? (
                    <Link href="/hiring/mine" className="link">
                      You posted this
                    </Link>
                  ) : hasApplied ? (
                    <div className="flex items-center gap-4">
                      <span className="rounded-full bg-[#e4efe6] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--forest)]">
                        Applied
                      </span>
                      <button type="button" onClick={() => withdraw(r)} className="text-xs font-medium text-[#8a2e08] underline">
                        Withdraw
                      </button>
                    </div>
                  ) : openForm === r.id ? (
                    <div className="flex flex-col gap-2.5">
                      <textarea
                        className="area"
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="What you've done like this, when you're free, and anything they should know."
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => apply(r)} disabled={sending} className="btn btn-primary btn-sm flex-1">
                          {sending ? "Sending…" : "Send application"}
                        </button>
                        <button type="button" onClick={() => setOpenForm(null)} className="btn btn-outline btn-sm">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenForm(r.id);
                        setMessage("");
                        setError(null);
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}