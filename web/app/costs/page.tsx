import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { money, type RateItem } from "@/lib/format";

export const metadata = {
  title: "What things cost in your area",
  description: "Real published rates from local trades, not national averages.",
};

export default async function CostsIndexPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: categories } = await supabase.from("categories").select("id, slug, name").order("id");

  const { data: prosData } = await supabase
    .from("pros")
    .select(
      `id, service_zip,
       pro_categories(categories(slug)),
       rate_items(id, title, unit, size_tier, price_min_cents, price_max_cents)`
    );

  const pros = (prosData as any[]) ?? [];

  // Group published prices by trade.
  const byTrade: Record<string, { flat: RateItem[]; hourly: RateItem[]; proCount: number }> = {};
  pros.forEach((p) => {
    const rates: RateItem[] = p.rate_items ?? [];
    (p.pro_categories ?? []).forEach((pc: any) => {
      const slug = pc.categories?.slug;
      if (!slug) return;
      byTrade[slug] ??= { flat: [], hourly: [], proCount: 0 };
      byTrade[slug].proCount += 1;
      rates.forEach((r) => {
        if (r.unit === "hourly") byTrade[slug].hourly.push(r);
        else byTrade[slug].flat.push(r);
      });
    });
  });

  function range(slug: string) {
    const t = byTrade[slug];
    if (!t) return null;
    if (t.flat.length > 0) {
      const lows = t.flat.map((r) => r.price_min_cents);
      const highs = t.flat.map((r) => r.price_max_cents ?? r.price_min_cents);
      return `${money(Math.min(...lows))}–${money(Math.max(...highs)).slice(1)}`;
    }
    if (t.hourly.length > 0) {
      const lows = t.hourly.map((r) => r.price_min_cents);
      return `${money(Math.min(...lows))}/hr`;
    }
    return null;
  }

  const anyData = Object.keys(byTrade).length > 0;

  return (
    <main className="min-h-screen">
      <section className="bg-[var(--dark)] text-[#fbf8f1]">
        <div className="mx-auto max-w-[1440px] px-5 py-10 lg:px-14 lg:py-14">
          <div className="flex max-w-[680px] flex-col gap-4">
            <span className="text-[13.5px] font-semibold text-[#f0b49a]">Prices near you</span>
            <h1 className="font-display text-[32px] font-extrabold leading-[1.06] lg:text-[46px]">
              What this work
              <br />
              actually costs here
            </h1>
            <p className="text-[15px] leading-relaxed text-[#d8d2c4] lg:text-[17px]">
              These aren't national averages. Every number comes from a rate card a local pro published
              themselves, and it updates the moment they change it.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-14 lg:py-11">
        {!anyData && (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
            No published prices yet. Once pros list their rate cards, their prices show up here.{" "}
            <Link href="/signup" className="link">List your work</Link> to be the first.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(categories ?? []).map((c, i) => {
            const r = range(c.slug);
            const count = byTrade[c.slug]?.proCount ?? 0;
            return (
              <Link
                key={c.id}
                href={`/costs/${c.slug}`}
                className="card rise flex flex-col gap-1.5 rounded-[15px] border border-[var(--line)] bg-[var(--card)] px-5 py-[18px] no-underline"
                style={{ animationDelay: `${0.04 * i}s` }}
              >
                <span className="text-[15.5px] font-semibold text-[var(--ink)]">{c.name}</span>
                <span className="font-display text-[22px] font-extrabold text-[var(--ink)]">
                  {r ?? "No prices yet"}
                </span>
                <span className="text-[12.5px] text-[var(--ink-faint)]">
                  {count === 0
                    ? "No pros listed"
                    : `${count} ${count === 1 ? "pro" : "pros"} publishing rates`}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-11 flex flex-col items-start justify-between gap-6 rounded-[20px] bg-[var(--dark)] p-8 text-[#fbf8f1] lg:flex-row lg:items-center lg:p-10">
          <div className="flex max-w-[680px] flex-col gap-2">
            <span className="font-display text-[22px] font-extrabold lg:text-[26px]">
              Nobody here paid to be on this page
            </span>
            <span className="text-[14.5px] leading-relaxed text-[#d8d2c4] lg:text-[15px]">
              Pros don't buy leads or bid against each other. They publish a rate, show their work, and pay a
              share only after a job is finished.
            </span>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link href="/" className="press rounded-xl bg-[var(--rust)] px-6 py-3.5 text-[15px] font-semibold text-white no-underline">
              Browse pros
            </Link>
            <Link href="/signup" className="press rounded-xl border border-[#fbf8f1] px-6 py-3.5 text-[15px] font-semibold text-[#fbf8f1] no-underline">
              List your work
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}