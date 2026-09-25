import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, mediaUrl, money, type RateItem } from "@/lib/format";
import SaveButton from "@/components/save-button";
import ViewToggle from "@/components/view-toggle";

type Media = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number };

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "general-contracting": (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V8l7-5 7 5v13" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  electrical: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  handyman: (
    <>
      <path d="M3 20l7-7" />
      <path d="M13 7l4-4 4 4-4 4z" />
      <path d="M10 13l3 3" />
    </>
  ),
  plumbing: (
    <>
      <path d="M7 4v6a5 5 0 0 0 5 5h2" />
      <path d="M14 12h6v6h-6z" />
    </>
  ),
  hvac: (
    <>
      <rect x="3" y="4" width="18" height="9" rx="2" />
      <path d="M7 17v2M12 17v3M17 17v2" />
    </>
  ),
  bathroom: (
    <>
      <path d="M4 12h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M8 12V6a2 2 0 0 1 4 0" />
    </>
  ),
  carpentry: (
    <>
      <path d="M4 18l10-10" />
      <path d="M12 4l8 8-4 4-8-8z" />
    </>
  ),
  drywall: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M9 4v16" />
    </>
  ),
  painting: (
    <>
      <path d="M4 6h13v5H4z" />
      <path d="M17 8h3v4l-6 3v4" />
    </>
  ),
  flooring: (
    <>
      <path d="M3 8h18M3 14h18" />
      <path d="M8 4v4M15 8v6M10 14v6" />
    </>
  ),
  roofing: (
    <>
      <path d="M2 12L12 4l10 8" />
      <path d="M5 12v8h14v-8" />
    </>
  ),
  gutters: (
    <>
      <path d="M3 6l9-3 9 3" />
      <path d="M4 10h16v3H4z" />
      <path d="M8 13v7M16 13v4" />
    </>
  ),
  "windows-doors": (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M12 3v18M4 12h16" />
    </>
  ),
  masonry: (
    <>
      <path d="M3 7h18M3 12h18M3 17h18" />
      <path d="M8 7v5M16 12v5" />
    </>
  ),
  concrete: (
    <>
      <path d="M4 16h16l-2 5H6z" />
      <circle cx="9" cy="7" r="3" />
      <path d="M12 9l5 3" />
    </>
  ),
  decks: (
    <>
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M7 4v16" />
      <path d="M17 4v16" />
    </>
  ),
  fencing: (
    <>
      <path d="M4 20V9l2-3 2 3v11M14 20V9l2-3 2 3v11" />
      <path d="M2 12h20M2 16h20" />
    </>
  ),
  landscaping: (
    <>
      <path d="M12 20v-7" />
      <path d="M12 13c-4 0-6-2-6-5 3 0 6 2 6 5zM12 13c4 0 6-2 6-5-3 0-6 2-6 5z" />
    </>
  ),
  "tree-service": (
    <>
      <path d="M12 21v-5" />
      <path d="M12 16a5 5 0 0 1-4-8 4 4 0 0 1 8 0 5 5 0 0 1-4 8z" />
    </>
  ),
  appliance: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M5 9h14" />
      <circle cx="12" cy="15" r="3" />
    </>
  ),
};

function cheapest(rates: RateItem[]) {
  const flat = rates.filter((r) => r.unit === "flat");
  if (flat.length === 0) return null;
  return flat.reduce((a, b) => (a.price_min_cents <= b.price_min_cents ? a : b));
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    verified?: string;
    insured?: string;
    media?: string;
    sort?: string;
  }>;
}) {
  const { category, q, verified, insured, media, sort } = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name")
    .order("sort_order")
    .order("id");

  const { data: prosData } = await supabase
    .from("pros")
    .select(
      `id, business_name, bio, service_zip, service_radius_miles, years_experience,
       license_verified, license_state, insured,
       profiles!pros_id_fkey(full_name),
       pro_categories(categories(slug, name)),
       rate_items(id, title, description, unit, size_tier, price_min_cents, price_max_cents, category_id),
       portfolio_items(id, title, neighborhood, portfolio_media(id, kind, storage_path, sort_order))`
    );

  const all = (prosData as any[]) ?? [];

  // Cheapest published price for each trade, using each rate line's own trade.
  const slugById: Record<number, string> = {};
  (categories ?? []).forEach((c) => {
    slugById[c.id] = c.slug;
  });

  const fromPrice: Record<string, number> = {};
  all.forEach((p) => {
    const proSlugs: string[] = (p.pro_categories ?? [])
      .map((pc: any) => pc.categories?.slug)
      .filter(Boolean);

    (p.rate_items ?? []).forEach((r: any) => {
      if (r.unit !== "flat") return;
      const slug = r.category_id
        ? slugById[r.category_id]
        : proSlugs.length === 1
        ? proSlugs[0]
        : null;
      if (!slug) return;
      if (!fromPrice[slug] || r.price_min_cents < fromPrice[slug]) {
        fromPrice[slug] = r.price_min_cents;
      }
    });
  });

  let pros = all;

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

  if (verified) pros = pros.filter((p) => p.license_verified);
  if (insured) pros = pros.filter((p) => p.insured);
  if (media) {
    pros = pros.filter((p) =>
      (p.portfolio_items ?? []).some((j: any) => (j.portfolio_media ?? []).length > 0)
    );
  }

  pros.sort((a, b) => {
    if (sort === "jobs") {
      return (b.portfolio_items?.length ?? 0) - (a.portfolio_items?.length ?? 0);
    }
    if (sort === "experience") {
      return (b.years_experience ?? 0) - (a.years_experience ?? 0);
    }
    const ca = cheapest(a.rate_items ?? [])?.price_min_cents ?? Infinity;
    const cb = cheapest(b.rate_items ?? [])?.price_min_cents ?? Infinity;
    return ca - cb;
  });

  const activeCategoryName = (categories ?? []).find((c) => c.slug === category)?.name;

  const chip = (on: boolean) =>
    `chip flex h-[38px] shrink-0 items-center rounded-full border px-[15px] text-sm font-medium no-underline ${
      on
        ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]"
        : "border-[#ddd4c2] bg-[var(--card)] text-[var(--ink)]"
    }`;

  return (
    <main className="min-h-screen">
      {/* ---------- Hero ---------- */}
      <section className="hero-pattern bg-[var(--dark)] text-[#fbf8f1]">
        <div className="mx-auto flex min-w-0 max-w-[1440px] flex-col gap-8 px-5 py-6 lg:flex-row lg:items-center lg:gap-14 lg:px-14 lg:py-13">
          <div className="flex flex-col gap-3 lg:w-[620px] lg:gap-5">
            <h1 className="rise font-display text-[28px] font-extrabold leading-[1.1] lg:text-[54px] lg:leading-[1.04]">
              See the price
              <br />
              before you call
            </h1>
            <p
              className="rise text-sm leading-relaxed text-[#d8d2c4] lg:max-w-[520px] lg:text-[18px]"
              style={{ animationDelay: "0.07s" }}
            >
              Local trades publish what they charge and show the work they just finished. No forms, no five
              callbacks, no paying to be seen.
            </p>

            <form action="/" className="rise flex gap-2" style={{ animationDelay: "0.14s" }}>
              <label className="flex h-[52px] flex-1 items-center gap-2.5 rounded-full bg-[var(--card)] pl-4 pr-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.18)] lg:h-[58px] lg:rounded-[13px] lg:pr-[18px]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b665c" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  name="q"
                  defaultValue={q ?? ""}
                  aria-label="What do you need done?"
                  placeholder="Outlet install, deck, bathroom…"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--ink)] outline-none lg:text-base"
                />
                {/* phones: round icon button inside the field */}
                <button
                  type="submit"
                  aria-label="Search"
                  className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--rust)] text-white lg:hidden"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </button>
              </label>
              {/* desktop: full button beside the field */}
              <button
                type="submit"
                className="press hidden h-[58px] shrink-0 rounded-[13px] bg-[var(--rust)] px-7 text-base font-semibold text-white lg:block"
              >
                Search
              </button>
            </form>

            <div className="hidden gap-7 pt-2 text-[13.5px] text-[#c9c2b2] lg:flex">
              {["Prices published up front", "Licenses checked by us", "Pay when the job is done"].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8fbf9f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Sample cards, desktop only */}
          {pros.length > 0 && (
            <div className="hidden flex-1 gap-4 lg:flex">
              {pros.slice(0, 2).map((pro: any, i: number) => {
                const name = pro.business_name || pro.profiles?.full_name || "Unnamed pro";
                const entry = cheapest(pro.rate_items ?? []);
                const cover = (pro.portfolio_items ?? [])
                  .flatMap((j: any) => (j.portfolio_media ?? []).map((m: Media) => ({ ...m, job: j })))
                  .sort((a: Media, b: Media) => a.sort_order - b.sort_order)[0];
                return (
                  <Link
                    key={pro.id}
                    href={`/pros/${pro.id}`}
                    className={`flex flex-1 flex-col overflow-hidden rounded-[18px] bg-[var(--card)] text-[var(--ink)] no-underline ${
                      i === 1 ? "hidden xl:flex" : ""
                    }`}
                  >
                    <div className="h-[176px] bg-[var(--sand)]">
                      {cover?.kind === "photo" && (
                        <img src={mediaUrl(cover.storage_path)} alt="" className="h-full w-full object-cover" />
                      )}
                      {cover?.kind === "video" && (
                        <video src={mediaUrl(cover.storage_path)} className="h-full w-full bg-[var(--dark)] object-cover" muted playsInline preload="metadata" />
                      )}
                    </div>
                    <div className="p-[18px]">
                      <div className="font-display text-[17px] font-extrabold">{name}</div>
                      {cover?.job && (
                        <div className="mt-1 text-[13px] text-[var(--ink-faint)]">
                          {[cover.job.title, cover.job.neighborhood].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {entry && (
                        <div className="mt-3 flex justify-between border-t border-[#e8e1d3] pt-3 text-[13.5px]">
                          <span>{entry.title}</span>
                          <span className="font-semibold">{formatPrice(entry)}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Category rail ---------- */}
      <section className="border-b border-[var(--line)] bg-[var(--card)]">
        {/* phones: trust strip */}
        <div className="mx-auto grid w-full max-w-md grid-cols-3 lg:hidden">                    {["Prices up front", "Licenses checked", "Pay after the job"].map((label, i) => (
            <div
              key={label}
              className={`flex flex-col items-center gap-1.5 px-2.5 py-3 ${i < 2 ? "border-r border-[#e8e1d3]" : ""}`}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={i === 1 ? "var(--forest)" : "var(--rust)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5 9-10" />
              </svg>
              <span className="text-center text-[10.5px] font-medium leading-tight text-balance">{label}</span>            </div>
          ))}
        </div>

        {/* desktop: scrolling trade rail */}
        <div className="rail mx-auto hidden max-w-[1440px] gap-3.5 px-14 py-6 lg:flex">
          {(categories ?? []).map((c) => {
            const from = fromPrice[c.slug];
            const on = category === c.slug;
            return (
              <Link
                key={c.id}
                href={on ? "/" : `/?category=${c.slug}`}
                className={`flex w-[132px] shrink-0 flex-col items-center gap-2 rounded-[14px] border px-2.5 py-4 text-center no-underline transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--card)] ${
                  on ? "border-[var(--ink)] bg-[var(--paper)]" : "border-[#e8e1d3] bg-[#f7f4ec]"
                }`}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--rust)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {CATEGORY_ICONS[c.slug] ?? <circle cx="12" cy="12" r="8" />}
                </svg>
                <span className="text-[13.5px] font-semibold leading-tight text-[var(--ink)]">{c.name}</span>
                <span className="text-xs text-[#6b665c]">{from ? `from ${money(from)}` : "no prices yet"}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------- Results ---------- */}
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 lg:flex-row lg:px-14 lg:py-9">
        {/* Filter rail, desktop only */}
        <aside className="hidden w-[248px] shrink-0 flex-col gap-6 lg:flex">
          <form action="/" className="flex flex-col gap-6">
            {category && <input type="hidden" name="category" value={category} />}
            {q && <input type="hidden" name="q" value={q} />}

            <div className="flex items-baseline justify-between">
              <span className="font-display text-base font-semibold">Filters</span>
              <Link href="/" className="text-[13px] font-medium text-[var(--rust)] no-underline">
                Clear all
              </Link>
            </div>

            <fieldset className="flex flex-col gap-2.5 border-t border-[var(--line)] pt-4">
              <legend className="mb-1 text-[13px] font-semibold">Trust</legend>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="verified" value="1" defaultChecked={!!verified} className="h-[17px] w-[17px] accent-[var(--rust)]" />
                License verified
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="insured" value="1" defaultChecked={!!insured} className="h-[17px] w-[17px] accent-[var(--rust)]" />
                Carries insurance
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="media" value="1" defaultChecked={!!media} className="h-[17px] w-[17px] accent-[var(--rust)]" />
                Has photos of past work
              </label>
            </fieldset>

            <label className="flex flex-col gap-2 border-t border-[var(--line)] pt-4 text-[13px] font-semibold">
              Sort by
              <select name="sort" defaultValue={sort ?? "price"} className="h-10 rounded-[10px] border border-[#ddd4c2] bg-[var(--card)] px-2.5 text-[13.5px] font-normal">
                <option value="price">Lowest price first</option>
                <option value="jobs">Most past jobs</option>
                <option value="experience">Most experience</option>
              </select>
            </label>

            <button type="submit" className="btn btn-dark btn-sm">Apply filters</button>
          </form>

          <div className="flex flex-col gap-2.5 rounded-[14px] bg-[var(--sand)] p-4">
            <span className="font-display text-[15px] font-extrabold">Can't find a fit?</span>
            <span className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
              Describe the job once and pros who do that work send you a price.
            </span>
            <Link href="/jobs/new" className="press rounded-[10px] bg-[var(--ink)] px-3.5 py-2.5 text-center text-[13.5px] font-semibold text-[var(--card)] no-underline">
              Post a job
            </Link>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 py-4 lg:gap-[18px] lg:py-0">
          {/* phone chips */}
          <div className="rail flex gap-2 lg:hidden">
            <Link href="/" className={chip(!category)}>All</Link>
            {(categories ?? []).map((c) => (
              <Link key={c.id} href={`/?category=${c.slug}`} className={chip(category === c.slug)}>
                {c.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-[15px] font-semibold lg:text-[22px] lg:font-extrabold">
                {activeCategoryName ? `${activeCategoryName} near you` : "Pros near you"}
              </h2>
              <span className="hidden text-[13.5px] text-[var(--ink-faint)] lg:block">
                {pros.length} {pros.length === 1 ? "pro" : "pros"}
                {q ? ` matching "${q}"` : ""}
              </span>
            </div>
            <ViewToggle />
          </div>

          {pros.length === 0 && (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
              Nothing matches that.{" "}
              <Link href="/" className="link">Clear the filters</Link>, or{" "}
              <Link href="/jobs/new" className="link">post a job</Link> and let pros come to you.
            </p>
          )}

          <div id="pro-grid" className="grid grid-cols-1 gap-4 lg:!grid-cols-2 lg:gap-[18px] xl:!grid-cols-3">
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

              const allMedia = (pro.portfolio_items ?? []).flatMap((j: any) =>
                (j.portfolio_media ?? []).map((m: Media) => ({ ...m, job: j }))
              );
              const cover = allMedia.sort((a: Media, b: Media) => a.sort_order - b.sort_order)[0];
              const hasVideo = allMedia.some((m: Media) => m.kind === "video");

              return (
                <Link
                  key={pro.id}
                  href={`/pros/${pro.id}`}
                  className="card rise flex flex-col overflow-hidden rounded-[17px] border border-[var(--line)] bg-[var(--card)] no-underline"
                  style={{ animationDelay: `${0.05 * i}s` }}
                >
                  <div className="card-cover relative h-[150px] overflow-hidden bg-[var(--sand)] lg:h-[146px]">
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
                      <span className="absolute left-2.5 top-2.5 rounded-md bg-[var(--card)] px-2 py-1 text-[10.5px] font-semibold">
                        {[cover.job.title, cover.job.neighborhood].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {hasVideo && (
                      <span className="absolute bottom-2.5 right-2.5 rounded-md bg-[var(--ink)]/82 px-2 py-1 text-[10.5px] font-semibold text-[var(--card)]">
                        Video
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2.5 px-4 pt-3.5">
                    <div className="font-display flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[var(--sand)] text-sm font-extrabold text-[#6b5a3e]">
                      {initials}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="card-name font-display text-[15.5px] font-extrabold text-[var(--ink)]">{name}</span>
                      <span className="card-meta truncate text-xs text-[var(--ink-faint)]">
                        {[trades.join(", "), pro.years_experience != null ? `${pro.years_experience} yrs` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>

                  {rows.length > 0 ? (
                    <div className="card-rates mx-4 mt-3 overflow-hidden rounded-[10px] border border-[#e8e1d3]">
                      {rows.map((r, n) => (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between gap-2 px-2.5 py-2 ${
                            n < rows.length - 1 ? "border-b border-[var(--line-soft)]" : ""
                          }`}
                        >
                          <span className="text-[12.5px] text-[var(--ink)]">{r.title}</span>
                          <span className="text-[12.5px] font-semibold text-[var(--ink)]">{formatPrice(r)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="card-rates mx-4 mt-3 rounded-[10px] bg-[var(--paper)] px-2.5 py-2 text-[12.5px] text-[var(--ink-faint)]">
                      No prices listed yet
                    </p>
                  )}

                  <div className="card-foot mt-auto flex items-center justify-between gap-2.5 px-4 pb-3.5 pt-3">
                    <span className={`text-[11.5px] font-semibold ${pro.license_verified ? "text-[var(--forest)]" : "text-[var(--ink-faint)]"}`}>
                      {pro.license_verified
                        ? `License verified${pro.license_state ? ` (${pro.license_state})` : ""}`
                        : pro.insured
                        ? "Insured"
                        : "Not verified yet"}
                    </span>
                    <span className="text-[12.5px] text-[var(--ink-faint)]">
                      {pro.service_radius_miles} mi of {pro.service_zip}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* phone post-a-job band */}
          <div className="mt-2 flex flex-col gap-2.5 rounded-[18px] bg-[var(--sand)] p-[18px] lg:hidden">
            <span className="font-display text-lg font-extrabold">Can't find the right fit?</span>
            <span className="text-sm leading-relaxed text-[var(--ink-soft)]">
              Describe the job once and pros who do that work send you a price.
            </span>
            <Link href="/jobs/new" className="press w-fit rounded-[10px] bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--card)] no-underline">
              Post a job
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- Footer ---------- */}
      <footer className="mt-10 bg-[var(--dark)] text-[#d8d2c4]">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 px-5 py-8 lg:flex-row lg:px-14">
          <div className="flex max-w-[300px] flex-col gap-2">
            <span className="font-display text-[19px] font-extrabold text-[#fbf8f1]">FairWork</span>
            <span className="text-[13.5px] leading-relaxed">
              Prices from local trades, and the work they finished last month.
            </span>
          </div>
          <div className="flex gap-16 text-[13.5px]">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[#fbf8f1]">For homeowners</span>
              <Link href="/" className="text-[#d8d2c4] no-underline hover:underline">Browse pros</Link>
              <Link href="/costs" className="text-[#d8d2c4] no-underline hover:underline">Going rates</Link>
              <Link href="/jobs/new" className="text-[#d8d2c4] no-underline hover:underline">Post a job</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[#fbf8f1]">For pros</span>
              <Link href="/signup" className="text-[#d8d2c4] no-underline hover:underline">List your work</Link>
              <Link href="/pro/rates" className="text-[#d8d2c4] no-underline hover:underline">Your rate card</Link>
              <Link href="/pro/jobs-available" className="text-[#d8d2c4] no-underline hover:underline">Find work</Link>
              <Link href="/hiring" className="text-[#d8d2c4] no-underline hover:underline">Hiring board</Link>            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}