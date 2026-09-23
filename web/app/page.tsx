import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, mediaUrl, type RateItem } from "@/lib/format";
import SaveButton from "@/components/save-button";

type Media = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number };

// Cheapest flat price, used to sort and to show a "from" line.
function cheapest(rates: RateItem[]) {
  const flat = rates.filter((r) => r.unit === "flat");
  if (flat.length === 0) return null;
  return flat.reduce((a, b) => (a.price_min_cents <= b.price_min_cents ? a : b));
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: categories } = await supabase.from("categories").select("id, slug, name").order("id");

    const { data: prosData, error: prosError } = await supabase
    .from("pros")
    .select(
      `id, business_name, bio, service_zip, service_radius_miles, years_experience,
       license_verified, license_state, insured,
              profiles!pros_id_fkey(full_name),
       pro_categories(categories(slug, name)),
       rate_items(id, title, description, unit, size_tier, price_min_cents, price_max_cents),
       portfolio_items(id, title, neighborhood, portfolio_media(id, kind, storage_path, sort_order))`
    );

      console.log("PROS QUERY", { count: prosData?.length, error: prosError });
  let pros = (prosData as any[]) ?? [];

  if (category) {
    pros = pros.filter((p) => (p.pro_categories ?? []).some((pc: any) => pc.categories?.slug === category));
  }

  if (q) {
    const needle = q.toLowerCase();
    pros = pros.filter((p) => {
      const haystack = [
        p.business_name,
        p.profiles?.full_name,
        p.bio,
        ...(p.pro_categories ?? []).map((pc: any) => pc.categories?.name),
        ...(p.rate_items ?? []).map((r: RateItem) => r.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  // Cheapest entry price first; pros with no rate card go last.
  pros.sort((a, b) => {
    const ca = cheapest(a.rate_items ?? [])?.price_min_cents ?? Infinity;
    const cb = cheapest(b.rate_items ?? [])?.price_min_cents ?? Infinity;
    return ca - cb;
  });

  const chip = (on: boolean) =>
    `chip flex h-[38px] shrink-0 items-center rounded-full border px-[15px] text-sm font-medium no-underline ${
      on
        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]"
        : "border-[#ddd4c2] bg-[var(--card)] text-[var(--ink)]"
    }`;

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-[var(--dark)] px-5 py-6 text-[#fbf8f1]">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <h1 className="rise font-display text-[28px] font-extrabold leading-[1.1]">
            See the price
            <br />
            before you call
          </h1>
          <p className="rise text-sm leading-relaxed text-[#d8d2c4]" style={{ animationDelay: "0.07s" }}>
            Local trades publish what they charge and show the work they just finished.
          </p>
          <form action="/" className="rise flex h-[46px] items-center gap-2.5 rounded-xl bg-[var(--card)] px-3.5" style={{ animationDelay: "0.14s" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b665c" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              name="q"
              defaultValue={q ?? ""}
              aria-label="Search for a job or a trade"
              placeholder="Outlet install, deck, bathroom…"
              className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none"
            />
          </form>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-[var(--line)] bg-[var(--card)]">
        <div className="mx-auto grid max-w-md grid-cols-3">
          {[
            { label: "Prices up front", color: "var(--rust)" },
            { label: "Licenses checked", color: "var(--forest)" },
            { label: "Pay when it's done", color: "var(--rust)" },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`flex flex-col items-center gap-1.5 px-2.5 py-3 ${i < 2 ? "border-r border-[#e8e1d3]" : ""}`}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5 9-10" />
              </svg>
              <span className="text-center text-[11px] font-medium leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-md px-5">
        {/* Category filter */}
        <div className="rail flex gap-2 py-3.5">
          <Link href="/" className={chip(!category)}>All</Link>
          {(categories ?? []).map((c) => (
            <Link key={c.id} href={`/?category=${c.slug}`} className={chip(category === c.slug)}>
              {c.name}
            </Link>
          ))}
        </div>

        <div className="flex items-baseline justify-between pb-3">
          <span className="font-display text-[15px] font-semibold">
            {pros.length} {pros.length === 1 ? "pro" : "pros"} {q ? `for "${q}"` : "near you"}
          </span>
          <span className="text-[13px] font-medium text-[var(--rust)]">Lowest price first</span>
        </div>

        {pros.length === 0 && (
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
            Nothing here yet.{" "}
            <Link href="/signup" className="font-semibold text-[var(--rust)] underline">
              List your work
            </Link>{" "}
            to be the first, or{" "}
            <Link href="/jobs/new" className="font-semibold text-[var(--rust)] underline">
              post a job
            </Link>{" "}
            and let pros come to you.
          </p>
        )}

        {/* Pro cards */}
        <div className="flex flex-col gap-4 pb-6">
          {pros.map((pro: any, i: number) => {
            const name = pro.business_name || pro.profiles?.full_name || "Unnamed pro";
            const initials = name
              .split(" ")
              .slice(0, 2)
              .map((w: string) => w[0])
              .join("")
              .toUpperCase();
            const trades: string[] = (pro.pro_categories ?? []).map((pc: any) => pc.categories?.name).filter(Boolean);
            const rates: RateItem[] = pro.rate_items ?? [];
            const hourly = rates.find((r) => r.unit === "hourly");
            const entry = cheapest(rates);
            const rows = [entry, hourly].filter(Boolean) as RateItem[];

            const jobs = pro.portfolio_items ?? [];
            const cover = jobs
              .flatMap((j: any) => (j.portfolio_media ?? []).map((m: Media) => ({ ...m, job: j })))
              .sort((a: Media, b: Media) => a.sort_order - b.sort_order)[0];

            const badge = pro.license_verified
              ? `License verified${pro.license_state ? ` (${pro.license_state})` : ""}${pro.insured ? ", insured" : ""}`
              : pro.insured
              ? "Insured"
              : null;

            return (
              <Link
                key={pro.id}
                href={`/pros/${pro.id}`}
                className="card rise overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--card)] no-underline"
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                {/* Cover */}
                <div className="relative h-[150px] overflow-hidden bg-[var(--sand)]">
                  {cover ? (
                    cover.kind === "video" ? (
                      <video src={mediaUrl(cover.storage_path)} className="shot h-full w-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={mediaUrl(cover.storage_path)} alt="" className="shot h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--ink-faint)]">
                      No photos yet
                    </div>
                  )}
                                    <SaveButton proId={pro.id} />
                  {cover?.job && (
                    <span className="absolute left-2.5 top-2.5 rounded-md bg-[var(--card)] px-2 py-1 text-[11px] font-semibold">
                      {[cover.job.title, cover.job.neighborhood].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>

                {/* Identity */}
                <div className="flex gap-2.5 px-4 pt-3.5">
                  <div className="font-display flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-[var(--sand)] text-[15px] font-extrabold text-[#6b5a3e]">
                    {initials}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-display text-base font-extrabold text-[var(--ink)]">{name}</span>
                    <span className="text-[12.5px] text-[var(--ink-faint)]">
                      {[trades.join(", "), pro.years_experience != null ? `${pro.years_experience} yrs` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {badge && (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--forest)]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                        {badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Rate card preview */}
                {rows.length > 0 ? (
                  <div className="mx-4 mt-3 overflow-hidden rounded-[11px] border border-[#e8e1d3]">
                    {rows.map((r, n) => (
                      <div
                        key={r.id}
                        className={`flex items-center justify-between gap-2.5 px-3 py-2.5 ${
                          n < rows.length - 1 ? "border-b border-[var(--line-soft)]" : ""
                        }`}
                      >
                        <span className="text-[12.5px] text-[var(--ink)]">{r.title}</span>
                        <span className="text-[12.5px] font-semibold text-[var(--ink)]">{formatPrice(r)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mx-4 mt-3 rounded-[11px] bg-[var(--paper)] px-3 py-2.5 text-[12.5px] text-[var(--ink-faint)]">
                    No prices listed yet
                  </p>
                )}

                <div className="flex items-center justify-between gap-2.5 px-4 pb-4 pt-3">
                  <span className="text-xs text-[var(--ink-faint)]">
                    Within {pro.service_radius_miles} mi of {pro.service_zip}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--rust)]">See profile</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Post a job band */}
        <div className="mb-6 flex flex-col gap-2.5 rounded-[18px] bg-[var(--sand)] p-[18px]">
          <span className="font-display text-lg font-extrabold">Can't find the right fit?</span>
          <span className="text-sm leading-relaxed text-[var(--ink-soft)]">
            Describe the job once and pros who do that work send you a price.
          </span>
          <Link
            href="/jobs/new"
            className="press w-fit rounded-[10px] bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--card)] no-underline"
          >
            Post a job
          </Link>
        </div>
      </div>
    </main>
  );
}