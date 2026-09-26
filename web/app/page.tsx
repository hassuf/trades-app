import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, mediaUrl, money, type RateItem } from "@/lib/format";
import SaveButton from "@/components/save-button";
import ViewToggle from "@/components/view-toggle";
import SideChooser from "@/components/side-chooser";
import TradeHome from "@/components/trade-home";

type Media = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number };

const SYMPTOMS = [
  "My house is hot",
  "Something's leaking",
  "Lights cutting out",
  "Stain on my ceiling",
  "Redoing a room",
];

function cheapest(rates: RateItem[]) {
  const flat = rates.filter((r) => r.unit === "flat");
  if (flat.length === 0) return null;
  return flat.reduce((a, b) => (a.price_min_cents <= b.price_min_cents ? a : b));
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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
    view?: string;
  }>;
}) {
  const { category, q, verified, insured, media, sort, view } = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, name")
    .order("sort_order")
    .order("id");

  // Contractors see work, not competitors.
  if (view === "trade") {
    const { data: openJobs } = await supabase
      .from("job_posts")
      .select(
        `id, description, size_tier, budget_min_cents, budget_max_cents, timing, zip, created_at,
         categories(name), quotes(id)`
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(6);

    const { data: openRoles } = await supabase
      .from("hire_posts")
      .select(
        `id, title, description, hire_type, pay_unit, pay_min_cents, pay_max_cents, zip, starts,
         categories(name)`
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(6);

    return (
      <main className="min-h-screen">
        <TradeHome jobs={(openJobs as any[]) ?? []} roles={(openRoles as any[]) ?? []} />
      </main>
    );
  }

  const { data: prosData } = await supabase
    .from("pros")
    .select(
      `id, business_name, bio, service_zip, service_radius_miles, years_experience,
       license_verified, license_state, insured, takes_projects,
       profiles!pros_id_fkey(full_name),
       pro_categories(categories(slug, name)),
       rate_items(id, title, description, unit, size_tier, price_min_cents, price_max_cents, category_id),
       portfolio_items(id, title, neighborhood, completed_on, portfolio_media(id, kind, storage_path, sort_order))`
    );

  const all = (prosData as any[]) ?? [];

  // Cheapest published price per trade, using each rate line's own trade.
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
      const slug = r.category_id ? slugById[r.category_id] : proSlugs.length === 1 ? proSlugs[0] : null;
      if (!slug) return;
      if (!fromPrice[slug] || r.price_min_cents < fromPrice[slug]) fromPrice[slug] = r.price_min_cents;
    });
  });

  // Finished projects with a real cost, for the price wall.
  const { data: wallData } = await supabase
    .from("gc_projects")
    .select(
      `id, title, neighborhood, final_cost_cents, pro_id,
       gc_project_media(id, kind, storage_path, sort_order)`
    )
    .not("final_cost_cents", "is", null)
    .order("completed_on", { ascending: false, nullsFirst: false })
    .limit(8);

  const nameById: Record<string, string> = {};
  all.forEach((p) => {
    nameById[p.id] = p.business_name || p.profiles?.full_name || "A trade";
  });

  // Fill the wall out with past jobs when there aren't enough priced projects.
  type WallItem = {
    key: string;
    price: string | null;
    job: string;
    who: string;
    kind: "photo" | "video" | null;
    path: string | null;
    hasVideo: boolean;
  };

  const wall: WallItem[] = [];

  ((wallData as any[]) ?? []).forEach((p) => {
    const media = [...(p.gc_project_media ?? [])].sort((a: Media, b: Media) => a.sort_order - b.sort_order);
    const cover = media[0];
    wall.push({
      key: `proj-${p.id}`,
      price: p.final_cost_cents ? money(p.final_cost_cents) : null,
      job: p.title,
      who: [nameById[p.pro_id], p.neighborhood].filter(Boolean).join(" · "),
      kind: cover?.kind ?? null,
      path: cover?.storage_path ?? null,
      hasVideo: media.some((m: Media) => m.kind === "video"),
    });
  });

  if (wall.length < 8) {
    all.forEach((p) => {
      (p.portfolio_items ?? []).forEach((j: any) => {
        if (wall.length >= 8) return;
        const media = [...(j.portfolio_media ?? [])].sort((a: Media, b: Media) => a.sort_order - b.sort_order);
        const cover = media[0];
        if (!cover) return;
        const entry = cheapest(p.rate_items ?? []);
        wall.push({
          key: `job-${j.id}`,
          price: entry ? formatPrice(entry) : null,
          job: j.title,
          who: [nameById[p.id], j.neighborhood].filter(Boolean).join(" · "),
          kind: cover.kind,
          path: cover.storage_path,
          hasVideo: media.some((m: Media) => m.kind === "video"),
        });
      });
    });
  }

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
    pros = pros.filter((p) => (p.portfolio_items ?? []).some((j: any) => (j.portfolio_media ?? []).length > 0));
  }

  pros.sort((a, b) => {
    if (sort === "jobs") return (b.portfolio_items?.length ?? 0) - (a.portfolio_items?.length ?? 0);
    if (sort === "experience") return (b.years_experience ?? 0) - (a.years_experience ?? 0);
    const ca = cheapest(a.rate_items ?? [])?.price_min_cents ?? Infinity;
    const cb = cheapest(b.rate_items ?? [])?.price_min_cents ?? Infinity;
    return ca - cb;
  });

  const activeCategoryName = (categories ?? []).find((c) => c.slug === category)?.name;
  const filtered = !!(category || q || verified || insured || media);

  const chip = (on: boolean) =>
    `chip flex h-[38px] shrink-0 items-center rounded-full border px-[15px] text-sm font-medium no-underline ${
      on ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]" : "border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
    }`;

  // Hero collage uses the two best-photographed trades.
  const withPhotos = all.filter((p) =>
    (p.portfolio_items ?? []).some((j: any) => (j.portfolio_media ?? []).length > 0)
  );
  const heroA = withPhotos[0];
  const heroB = withPhotos[1];
  const coverOf = (p: any) => {
    const media = (p?.portfolio_items ?? [])
      .flatMap((j: any) => (j.portfolio_media ?? []).map((m: Media) => ({ ...m, job: j })))
      .sort((a: Media, b: Media) => a.sort_order - b.sort_order);
    return media[0];
  };
  const heroCoverA = coverOf(heroA);
  const heroCoverB = coverOf(heroB);
  const heroRateA = heroA ? cheapest(heroA.rate_items ?? []) : null;
  const heroRateB = heroB ? cheapest(heroB.rate_items ?? []) : null;

  return (
    <main className="min-h-screen">
      <SideChooser />

      {/* ---------- Hero ---------- */}
      <section className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 pb-10 pt-6 lg:flex-row lg:items-start lg:gap-14 lg:px-16 lg:pb-14 lg:pt-10">
        <div className="flex flex-col gap-4 lg:w-[620px] lg:gap-6 lg:pt-5">
          <span className="rise flex items-center gap-2 text-[13.5px] font-semibold text-[var(--forest)] lg:text-sm">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5 9-10" />
            </svg>
            No lead fees. Ever.
          </span>

          <h1 className="rise font-display text-[40px] font-black leading-[0.97] lg:text-[72px] lg:leading-[0.94]">
            Know the price before you let anyone in.
          </h1>

          <p className="rise max-w-[520px] text-base leading-relaxed text-[var(--ink-soft)] lg:text-[19px]" style={{ animationDelay: "0.07s" }}>
            Every trade here publishes what they charge and shows the work they finished last month. No forms.
            No five callbacks. Nobody paid to reach you.
          </p>

          <form
            action="/"
            className="rise flex h-14 max-w-[560px] items-center gap-3 rounded-full border border-[var(--line)] bg-[var(--card)] pl-5 pr-1.5 shadow-[0_2px_10px_rgba(26,24,20,0.05)] lg:h-16 lg:pl-[22px]"
            style={{ animationDelay: "0.14s" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7a7060" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              name="q"
              defaultValue={q ?? ""}
              aria-label="What do you need done?"
              placeholder="Outlet install, leaking tap, new deck…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--ink)] outline-none lg:text-[16.5px]"
            />
            <button
              type="submit"
              className="press h-11 shrink-0 rounded-full bg-[var(--rust)] px-5 text-sm font-semibold text-white lg:h-[50px] lg:px-7 lg:text-base"
            >
              Search
            </button>
          </form>

          <span className="rise text-sm text-[var(--ink-faint)] lg:text-[14.5px]" style={{ animationDelay: "0.2s" }}>
            or{" "}
            <Link href="/help" className="font-semibold text-[var(--rust)] underline">
              tell us what's broken
            </Link>{" "}
            and we'll work out who you need
          </span>
        </div>

        {/* Collage, desktop only */}
        {heroCoverA && (
          <div className="relative hidden h-[620px] flex-1 lg:block">
            <Link
              href={`/pros/${heroA.id}`}
              className="absolute left-6 top-0 block h-[480px] w-[400px] overflow-hidden rounded-[20px] bg-[var(--sand)] shadow-[0_18px_40px_rgba(26,24,20,0.16)] no-underline"
            >
              {heroCoverA.kind === "video" ? (
                <video src={mediaUrl(heroCoverA.storage_path)} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              ) : (
                <img src={mediaUrl(heroCoverA.storage_path)} alt="" className="h-full w-full object-cover" />
              )}
            </Link>

            {heroCoverB && (
              <Link
                href={`/pros/${heroB.id}`}
                className="absolute right-0 top-24 block h-[300px] w-[300px] overflow-hidden rounded-[20px] bg-[var(--sand)] shadow-[0_18px_40px_rgba(26,24,20,0.2)] no-underline"
              >
                {heroCoverB.kind === "video" ? (
                  <video src={mediaUrl(heroCoverB.storage_path)} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <img src={mediaUrl(heroCoverB.storage_path)} alt="" className="h-full w-full object-cover" />
                )}
              </Link>
            )}

            {heroRateA && (
              <div className="absolute left-0 top-[386px] w-[268px] rounded-2xl bg-[var(--card)] p-4 px-5 shadow-[0_14px_30px_rgba(26,24,20,0.16)]">
                <div className="mb-1 text-[12.5px] text-[var(--ink-faint)]">
                  {nameById[heroA.id]}
                  {heroA.license_verified ? " · verified" : ""}
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px]">{heroRateA.title}</span>
                  <span className="font-display text-xl font-bold">{formatPrice(heroRateA)}</span>
                </div>
              </div>
            )}

            {heroRateB && (
              <div className="absolute right-[34px] top-[452px] w-[250px] rounded-2xl bg-[var(--ink)] p-4 px-5 text-[var(--card)] shadow-[0_14px_30px_rgba(26,24,20,0.22)]">
                <div className="mb-1 text-[12.5px] text-[#c9c0ae]">{nameById[heroB.id]}</div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px]">{heroRateB.title}</span>
                  <span className="font-display text-xl font-bold">{formatPrice(heroRateB)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------- Trust band ---------- */}
      <section className="border-y border-[var(--line)] bg-[var(--card)]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-3">
          {[
            {
              title: "Prices published up front",
              body: "Not \u201crequest a quote\u201d. Actual numbers, written by the person doing the work.",
              colour: "var(--rust)",
              path: "M4 7h16M4 12h11M4 17h7",
            },
            {
              title: "We check every license",
              body: "By hand, against the board. The badge means something here.",
              colour: "var(--forest)",
              path: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z",
            },
            {
              title: "Pay when it's done",
              body: "You only pay once you say the job is finished.",
              colour: "var(--rust)",
              path: "M3 6h18v12H3zM3 10h18",
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className={`flex items-start gap-4 px-5 py-5 lg:px-10 lg:py-[26px] ${
                i < 2 ? "border-b border-[var(--line-soft)] lg:border-b-0 lg:border-r" : ""
              } ${i === 0 ? "lg:pl-16" : ""} ${i === 2 ? "lg:pr-16" : ""}`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={item.colour} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
                <path d={item.path} />
              </svg>
              <div>
                <div className="font-display mb-1 text-[17px] font-bold">{item.title}</div>
                <div className="text-sm leading-relaxed text-[var(--ink-faint)]">{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Not sure who you need ---------- */}
      <section className="border-b border-[var(--line)] bg-[var(--sand)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-5 lg:flex-row lg:items-center lg:gap-6 lg:px-16">
          <span className="font-display shrink-0 text-[17px] font-bold lg:text-lg">Not sure who you need?</span>
          <div className="rail flex flex-1 gap-2.5">
            {SYMPTOMS.map((s) => (
              <Link
                key={s}
                href="/help"
                className="chip shrink-0 rounded-full border border-[var(--line)] bg-[var(--card)] px-4 py-2.5 text-[14.5px] text-[var(--ink)] no-underline"
              >
                {s}
              </Link>
            ))}
          </div>
          <Link href="/help" className="hidden shrink-0 text-[14.5px] font-semibold text-[var(--rust)] no-underline hover:underline lg:block">
            All of them
          </Link>
        </div>
      </section>

      {/* ---------- Trades ---------- */}
      <section className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 pt-10 lg:px-16 lg:pt-13">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-2xl font-black lg:text-[34px]">Start with a trade</h2>
          <span className="text-sm text-[var(--ink-faint)]">{(categories ?? []).length} trades</span>
        </div>
        <div className="rail flex gap-3 lg:grid lg:grid-cols-6 lg:gap-3">
          {(categories ?? []).map((c) => {
            const from = fromPrice[c.slug];
            const on = category === c.slug;
            return (
              <Link
                key={c.id}
                href={on ? "/" : `/?category=${c.slug}`}
                className={`chip flex w-[150px] shrink-0 flex-col gap-1.5 rounded-[14px] border p-[18px] no-underline lg:w-auto ${
                  on ? "border-[var(--ink)] bg-[var(--sand)]" : "border-[var(--line)] bg-[#fdfaf3]"
                }`}
              >
                <span className="text-[15px] font-semibold text-[var(--ink)]">{c.name}</span>
                <span className="text-[13px] text-[var(--ink-faint)]">{from ? `from ${money(from)}` : "no prices yet"}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---------- Results ---------- */}
      <section className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 pt-12 lg:flex-row lg:gap-10 lg:px-16 lg:pt-14">
        {/* Filters */}
        <aside className="hidden w-[240px] shrink-0 flex-col gap-6 lg:flex">
          <form action="/" className="flex flex-col gap-5">
            {category && <input type="hidden" name="category" value={category} />}
            {q && <input type="hidden" name="q" value={q} />}

            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-bold">Filters</span>
              {filtered && (
                <Link href="/" className="text-[13px] font-medium text-[var(--rust)] no-underline">
                  Clear
                </Link>
              )}
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
              <select name="sort" defaultValue={sort ?? "price"} className="h-10 rounded-[10px] border border-[var(--line)] bg-[var(--card)] px-2.5 text-[13.5px] font-normal">
                <option value="price">Lowest price first</option>
                <option value="jobs">Most past jobs</option>
                <option value="experience">Most experience</option>
              </select>
            </label>

            <button type="submit" className="btn btn-dark btn-sm">Apply</button>
          </form>

          <div className="flex flex-col gap-2.5 rounded-[14px] bg-[var(--sand)] p-4">
            <span className="font-display text-base font-bold">Can't find a fit?</span>
            <span className="text-[13px] leading-relaxed text-[var(--ink-faint)]">
              Describe the job once and trades who do that work send you a price.
            </span>
            <Link href="/jobs/new" className="press rounded-[10px] bg-[var(--ink)] px-3.5 py-2.5 text-center text-[13.5px] font-semibold text-[var(--card)] no-underline">
              Post a job
            </Link>
          </div>
        </aside>

        {/* Cards */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="rail flex gap-2 lg:hidden">
            <Link href="/" className={chip(!category)}>All</Link>
            {(categories ?? []).map((c) => (
              <Link key={c.id} href={`/?category=${c.slug}`} className={chip(category === c.slug)}>
                {c.name}
              </Link>
            ))}
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-2xl font-black lg:text-[34px]">
                {activeCategoryName ?? "Near you"}
                {!activeCategoryName && !q ? ", cheapest first" : ""}
              </h2>
              <span className="text-sm text-[var(--ink-faint)]">
                {pros.length} {pros.length === 1 ? "trade" : "trades"}
                {q ? ` matching "${q}"` : ""}
              </span>
            </div>
            <ViewToggle />
          </div>

          {pros.length === 0 && (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
              Nothing matches that. <Link href="/" className="link">Clear the filters</Link>, or{" "}
              <Link href="/jobs/new" className="link">post a job</Link> and let trades come to you.
            </p>
          )}

          <div id="pro-grid" className="grid grid-cols-1 gap-5 lg:!grid-cols-2 xl:!grid-cols-3">
            {pros.map((pro: any, i: number) => {
              const name = nameById[pro.id];
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
                  className="card rise flex flex-col overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--card)] no-underline"
                  style={{ animationDelay: `${0.05 * i}s` }}
                >
                  <div className="card-cover relative h-[190px] overflow-hidden bg-[var(--sand)] lg:h-[210px]">
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
                      <span className="absolute left-3.5 top-3.5 rounded-full bg-[var(--card)] px-2.5 py-1.5 text-[11.5px] font-semibold">
                        {[cover.job.title, cover.job.neighborhood].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {hasVideo && (
                      <span className="absolute bottom-3.5 left-3.5 rounded-full bg-[var(--card)] px-2.5 py-1.5 text-[11.5px] font-semibold">
                        Video
                      </span>
                    )}
                    {pro.takes_projects && (
                      <span className="absolute bottom-3.5 right-3.5 rounded-full bg-[var(--ink)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--card)]">
                        Whole projects
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3.5 p-5">
                    <div>
                      <div className="card-name font-display text-xl font-bold leading-tight text-[var(--ink)]">
                        {name}
                      </div>
                      <div className="card-meta mt-1 truncate text-[13.5px] text-[var(--ink-faint)]">
                        {[trades.join(", "), pro.years_experience != null ? `${pro.years_experience} years` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>

                    {rows.length > 0 ? (
                      <div className="card-rates flex flex-col gap-2.5 border-t border-[var(--line-soft)] pt-3">
                        {rows.map((r) => (
                          <div key={r.id} className="flex items-baseline justify-between gap-3">
                            <span className="text-sm text-[var(--ink-soft)]">{r.title}</span>
                            <span className="font-display text-[17px] font-bold">{formatPrice(r)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="card-rates border-t border-[var(--line-soft)] pt-3 text-sm text-[var(--ink-faint)]">
                        No prices listed yet
                      </p>
                    )}

                    <span className={`card-foot text-[13px] font-semibold ${pro.license_verified ? "text-[var(--forest)]" : "text-[var(--ink-faint)]"}`}>
                      {pro.license_verified
                        ? `License verified${pro.license_state ? ` (${pro.license_state})` : ""}${pro.insured ? " · insured" : ""}`
                        : pro.insured
                        ? "Insured"
                        : `Within ${pro.service_radius_miles} mi of ${pro.service_zip}`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Price wall ---------- */}
      {wall.length > 0 && (
        <section className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 pt-14 lg:px-16 lg:pt-16">
          <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-end lg:gap-10">
            <div className="max-w-[640px]">
              <h2 className="font-display mb-2 text-2xl font-black lg:text-[34px]">
                Finished last month, and what it cost
              </h2>
              <p className="text-[15px] leading-relaxed text-[var(--ink-soft)] lg:text-base">
                Every number is what a homeowner in this city actually paid. Not an estimate, not an average.
              </p>
            </div>
            <Link href="/costs" className="shrink-0 text-[15px] font-semibold text-[var(--rust)] no-underline hover:underline">
              What things cost
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {wall.slice(0, 8).map((w) => (
              <Link
                key={w.key}
                href="/costs"
                className="card relative block h-[200px] overflow-hidden rounded-2xl bg-[var(--sand)] no-underline lg:h-[260px]"
              >
                {w.path &&
                  (w.kind === "video" ? (
                    <video src={mediaUrl(w.path)} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={mediaUrl(w.path)} alt="" className="h-full w-full object-cover" />
                  ))}
                <span className="scrim absolute inset-0" />
                <span className="absolute inset-x-4 bottom-4 flex flex-col gap-0.5">
                  {w.price && (
                    <span className="font-display text-xl font-black text-white lg:text-[26px]">{w.price}</span>
                  )}
                  <span className="text-[13.5px] font-semibold text-white">{w.job}</span>
                  <span className="truncate text-[12.5px] text-[#d8cfbe]">{w.who}</span>
                </span>
                {w.hasVideo && (
                  <span className="absolute right-3 top-3 rounded-full bg-[var(--card)]/94 px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink)]">
                    Video
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- The argument ---------- */}
      <section className="mx-auto max-w-[1440px] px-5 pt-14 lg:px-16 lg:pt-16">
        <div className="flex flex-col gap-8 rounded-[26px] bg-[var(--dark)] p-7 text-[var(--card)] lg:flex-row lg:gap-14 lg:p-14">
          <div className="lg:w-[480px]">
            <h2 className="font-display mb-4 text-[28px] font-black leading-[1.04] lg:text-[42px]">
              Nobody on this page paid to be here.
            </h2>
            <p className="text-[15px] leading-relaxed text-[#c9c0ae] lg:text-[16.5px]">
              Everywhere else sells your phone number to four contractors at once, then they race each other to
              call you first. That's why your phone won't stop and why the price is never the real price.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-5 lg:gap-[22px] lg:pt-1.5">
            {[
              ["01", "You browse, they don't chase", "You pick who to contact. One conversation, not five."],
              ["02", "The price is on the card", "Confirmed on site, because no two houses are the same. But you start from a real number."],
              ["03", "We only earn if the job happens", "A share of completed work. A wasted quote costs us too, which is rather the point."],
            ].map(([n, title, body]) => (
              <div key={n} className="flex gap-4">
                <span className="font-display w-7 shrink-0 text-[17px] font-bold text-[#e0894f]">{n}</span>
                <div>
                  <div className="mb-1 text-[16px] font-semibold lg:text-[17px]">{title}</div>
                  <div className="text-[14.5px] leading-relaxed text-[#c9c0ae]">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="mt-14 bg-[var(--sand)]">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 px-5 py-10 lg:flex-row lg:px-16 lg:py-11">
          <div className="max-w-[300px]">
            <div className="font-display mb-2.5 text-[22px] font-black">FairWork</div>
            <div className="text-sm leading-relaxed text-[var(--ink-faint)]">
              Prices from local trades, and the work they finished last month.
            </div>
          </div>
          <div className="flex gap-16 text-[14.5px] lg:gap-[72px]">
            <div className="flex flex-col gap-2.5">
              <span className="font-semibold">Homeowners</span>
              <Link href="/" className="text-[var(--ink-faint)] no-underline hover:underline">Browse trades</Link>
              <Link href="/help" className="text-[var(--ink-faint)] no-underline hover:underline">What do I need?</Link>
              <Link href="/costs" className="text-[var(--ink-faint)] no-underline hover:underline">What things cost</Link>
              <Link href="/jobs/new" className="text-[var(--ink-faint)] no-underline hover:underline">Post a job</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-semibold">Trades</span>
              <Link href="/signup" className="text-[var(--ink-faint)] no-underline hover:underline">List your work</Link>
              <Link href="/pro/jobs-available" className="text-[var(--ink-faint)] no-underline hover:underline">Find work</Link>
              <Link href="/hiring" className="text-[var(--ink-faint)] no-underline hover:underline">Hiring board</Link>
              <Link href="/pro/market" className="text-[var(--ink-faint)] no-underline hover:underline">Where my prices sit</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}