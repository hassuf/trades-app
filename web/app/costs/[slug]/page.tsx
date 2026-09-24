import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { money, type RateItem } from "@/lib/format";

type ProRow = {
  id: string;
  business_name: string | null;
  years_experience: number | null;
  license_verified: boolean;
  insured: boolean;
  profiles: { full_name: string } | null;
  pro_categories: { categories: { slug: string } | null }[];
  rate_items: RateItem[];
};

export default async function TradeCostsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: category } = await supabase
    .from("categories")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!category) notFound();

  const { data: categories } = await supabase.from("categories").select("id, slug, name").order("id");

  const { data: prosData } = await supabase
    .from("pros")
    .select(
      `id, business_name, years_experience, license_verified, insured,
       profiles!pros_id_fkey(full_name),
       pro_categories(categories(slug)),
       rate_items(id, title, description, unit, size_tier, price_min_cents, price_max_cents)`
    );

  // Only pros who do this trade.
  const pros = ((prosData as unknown as ProRow[]) ?? []).filter((p) =>
    (p.pro_categories ?? []).some((pc) => pc.categories?.slug === slug)
  );

  // Group their flat-price jobs by name.
  type Group = { title: string; note: string | null; lows: number[]; highs: number[]; proIds: Set<string> };
  const groups: Record<string, Group> = {};
  const hourlyRates: { pro: ProRow; rate: RateItem }[] = [];

  pros.forEach((p) => {
    (p.rate_items ?? []).forEach((r) => {
      if (r.unit === "hourly") {
        hourlyRates.push({ pro: p, rate: r });
        return;
      }
      const key = r.title.trim().toLowerCase();
      groups[key] ??= { title: r.title.trim(), note: r.description, lows: [], highs: [], proIds: new Set() };
      groups[key].lows.push(r.price_min_cents);
      groups[key].highs.push(r.price_max_cents ?? r.price_min_cents);
      groups[key].proIds.add(p.id);
    });
  });

  const rows = Object.values(groups)
    .map((g) => ({
      title: g.title,
      note: g.note,
      low: Math.min(...g.lows),
      high: Math.max(...g.highs),
      typicalLow: Math.round(g.lows.reduce((a, b) => a + b, 0) / g.lows.length),
      typicalHigh: Math.round(g.highs.reduce((a, b) => a + b, 0) / g.highs.length),
      count: g.proIds.size,
    }))
    .sort((a, b) => a.low - b.low);

  const headline = rows[0] ?? null;
  const cheapestHourly = [...hourlyRates].sort((a, b) => a.rate.price_min_cents - b.rate.price_min_cents);

  // Three cheapest pros for the headline job.
  const shortlist = headline
    ? pros
        .map((p) => {
          const match = (p.rate_items ?? []).find(
            (r) => r.unit === "flat" && r.title.trim().toLowerCase() === headline.title.toLowerCase()
          );
          return match ? { pro: p, rate: match } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.rate.price_min_cents - b.rate.price_min_cents)
        .slice(0, 3)
    : [];

  const proName = (p: ProRow) => p.business_name || p.profiles?.full_name || "Unnamed pro";
  const initialsOf = (n: string) =>
    n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-14">
        {/* Header */}
        <div className="flex flex-col gap-6 pt-8 lg:flex-row lg:items-end lg:gap-14 lg:pt-11">
          <div className="flex max-w-[660px] flex-col gap-3.5">
            <Link href="/costs" className="link">All trades</Link>
            <h1 className="font-display text-[32px] font-extrabold leading-[1.06] lg:text-[44px]">
              What {category.name.toLowerCase()} work
              <br />
              costs around here
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--ink-soft)] lg:text-[17px]">
              Published rates from the {pros.length} {pros.length === 1 ? "pro" : "pros"} listed for{" "}
              {category.name.toLowerCase()} on this site. Not estimates, and not national averages.
            </p>
          </div>

          {headline && (
            <div className="flex flex-1 flex-col gap-1.5 rounded-[18px] bg-[var(--dark)] p-6 text-[#fbf8f1] lg:p-[26px]">
              <span className="text-[13px] text-[#c9c2b2]">Range for {headline.title.toLowerCase()}</span>
              <span className="font-display text-[34px] font-extrabold leading-tight lg:text-[40px]">
                {money(headline.low)} – {money(headline.high).slice(1)}
              </span>
              <span className="text-[13.5px] leading-relaxed text-[#c9c2b2]">
                {headline.count === 1
                  ? "One pro publishes a price for this so far."
                  : `Lowest and highest published price among ${headline.count} pros.`}
              </span>
            </div>
          )}
        </div>

        {/* Table + rail */}
        <div className="flex flex-col gap-8 pt-8 lg:flex-row lg:gap-8">
          <div className="flex-1 overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--card)]">
            <div className="hidden grid-cols-[2.2fr_1fr_1fr_1.1fr] border-b border-[var(--line)] bg-[#f7f4ec] px-[22px] py-3.5 text-[12.5px] font-semibold text-[var(--ink-faint)] lg:grid">
              <span>Job</span>
              <span>Lowest here</span>
              <span>Typical</span>
              <span className="text-right">Pros who do it</span>
            </div>

            {rows.length === 0 && (
              <p className="px-5 py-5 text-sm text-[var(--ink-faint)]">
                No {category.name.toLowerCase()} prices published yet.{" "}
                <Link href="/signup" className="link">List your work</Link> to be the first.
              </p>
            )}

            {rows.map((r, i) => (
              <div
                key={r.title}
                className={`flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-[#f7f4ec] lg:grid lg:grid-cols-[2.2fr_1fr_1fr_1.1fr] lg:gap-0 lg:px-[22px] lg:py-3.5 ${
                  i < rows.length - 1 ? "border-b border-[var(--line-soft)]" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15.5px] font-semibold">{r.title}</span>
                  {r.note && <span className="text-[12.5px] text-[var(--ink-faint)]">{r.note}</span>}
                </div>
                <div className="flex gap-6 lg:contents">
                  <span className="self-center text-[15px] font-semibold text-[var(--forest)]">
                    <span className="lg:hidden">Lowest </span>
                    {money(r.low)}
                  </span>
                  <span className="self-center text-[15px]">
                    <span className="lg:hidden">Typical </span>
                    {r.typicalLow === r.typicalHigh
                      ? money(r.typicalLow)
                      : `${money(r.typicalLow)}–${money(r.typicalHigh).slice(1)}`}
                  </span>
                  <span className="self-center text-[13.5px] text-[var(--ink-faint)] lg:text-right">
                    {r.count} {r.count === 1 ? "pro" : "pros"}
                  </span>
                </div>
              </div>
            ))}

            {cheapestHourly.length > 0 && (
              <div className="border-t border-[var(--line)] bg-[#f7f4ec] px-5 py-4 lg:px-[22px]">
                <span className="text-[13px] font-semibold">Hourly rates</span>
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-[var(--ink-soft)]">
                  {cheapestHourly.slice(0, 4).map(({ pro, rate }) => (
                    <span key={pro.id}>
                      {proName(pro)}: <span className="font-semibold text-[var(--ink)]">{money(rate.price_min_cents)}/hr</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-[var(--line)] px-5 py-4 text-[12.5px] leading-relaxed text-[var(--ink-faint)] lg:px-[22px]">
              Every price here is one a pro published themselves. The final price is confirmed on site, because
              no two houses are the same.
            </div>
          </div>

          {/* Side rail */}
          <aside className="flex w-full shrink-0 flex-col gap-[18px] lg:w-[320px]">
            {shortlist.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
                <span className="font-display text-[17px] font-extrabold">
                  Cheapest for {headline?.title.toLowerCase()}
                </span>
                {shortlist.map((s: any) => {
                  const n = proName(s.pro);
                  return (
                    <Link
                      key={s.pro.id}
                      href={`/pros/${s.pro.id}`}
                      className="flex items-center gap-3 border-b border-[var(--line-soft)] py-2 no-underline last:border-b-0"
                    >
                      <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--sand)] text-[13px] font-extrabold text-[#6b5a3e]">
                        {initialsOf(n)}
                      </span>
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold text-[var(--ink)]">{n}</span>
                        <span className="text-xs text-[var(--ink-faint)]">
                          {[
                            s.pro.years_experience != null ? `${s.pro.years_experience} yrs` : null,
                            s.pro.license_verified ? "verified" : s.pro.insured ? "insured" : null,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-[var(--ink)]">{money(s.rate.price_min_cents)}</span>
                    </Link>
                  );
                })}
                <Link href={`/?category=${slug}`} className="link">
                  See all {category.name.toLowerCase()} pros
                </Link>
              </div>
            )}

            <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
              <span className="font-display text-[17px] font-extrabold">What moves the price</span>
              <span className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                Older wiring, plaster walls, a long run from the panel, and permit requirements are what turn a
                small job into a medium one. A pro will tell you which apply once they see photos.
              </span>
            </div>

            <div className="flex flex-col gap-2.5 rounded-2xl bg-[var(--sand)] p-5">
              <span className="font-display text-[17px] font-extrabold">Not sure which job yours is?</span>
              <span className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                Post it with a photo and pros who do this work send you a price.
              </span>
              <Link href="/jobs/new" className="press rounded-[11px] bg-[var(--ink)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--card)] no-underline">
                Post a job
              </Link>
            </div>
          </aside>
        </div>

        {/* Other trades */}
        <div className="flex flex-col gap-4 pb-12 pt-10">
          <span className="font-display text-xl font-extrabold lg:text-[22px]">Prices for other work</span>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(categories ?? [])
              .filter((c) => c.slug !== slug)
              .slice(0, 4)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/costs/${c.slug}`}
                  className="card flex flex-col gap-1.5 rounded-[15px] border border-[var(--line)] bg-[var(--card)] px-5 py-[18px] no-underline"
                >
                  <span className="text-[15.5px] font-semibold text-[var(--ink)]">{c.name}</span>
                  <span className="text-[12.5px] text-[var(--ink-faint)]">See published rates</span>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}