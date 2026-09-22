import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, mediaUrl, money, type RateItem } from "@/lib/format";

type Media = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number };

// Cheapest price for each job size, so the card can show three tiers.
function tierPrices(rates: RateItem[]) {
  const pick = (tier: "small" | "medium" | "large") => {
    const matches = rates.filter((r) => r.unit === "flat" && r.size_tier === tier);
    if (matches.length === 0) return null;
    const cheapest = matches.reduce((a, b) => (a.price_min_cents <= b.price_min_cents ? a : b));
    return formatPrice(cheapest);
  };
  return { small: pick("small"), medium: pick("medium"), large: pick("large") };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: categories } = await supabase.from("categories").select("id, slug, name").order("id");

  const { data: prosData } = await supabase
    .from("pros")
    .select(
      `id, business_name, service_zip, service_radius_miles, years_experience, license_verified, license_state, insured,
       profiles(full_name),
       pro_categories(categories(slug, name)),
       rate_items(id, title, description, unit, size_tier, price_min_cents, price_max_cents),
       portfolio_items(id, portfolio_media(id, kind, storage_path, sort_order))`
    )
    .order("created_at", { ascending: false });

  const all = prosData ?? [];

  // Keep only pros who do the selected type of work.
  const pros = category
    ? all.filter((p: any) =>
        (p.pro_categories ?? []).some((pc: any) => pc.categories?.slug === category)
      )
    : all;

  const chip = (on: boolean) =>
    `h-10 shrink-0 rounded-full border px-4 text-sm font-medium no-underline flex items-center ${
      on ? "border-[#1C1B19] bg-[#1C1B19] text-white" : "border-[#D9D3C6] bg-white text-[#1C1B19]"
    }`;

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-8 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-5">
                <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Find someone for the job</h1>
          <p className="text-[15px] text-[#4A4740]">
            See what pros charge and what their finished work looks like before you message them.
          </p>
          <Link
            href="/jobs/new"
            className="w-fit rounded-xl bg-[#B43C0A] px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            Post a job instead
          </Link>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href="/" className={chip(!category)}>
            All
          </Link>
          {(categories ?? []).map((c) => (
            <Link key={c.id} href={`/?category=${c.slug}`} className={chip(category === c.slug)}>
              {c.name}
            </Link>
          ))}
        </div>

        {pros.length === 0 && (
          <p className="rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#5C584F]">
            No pros listed for this yet.{" "}
            <Link href="/signup" className="font-semibold text-[#B43C0A] underline">
              List your work
            </Link>{" "}
            to be the first.
          </p>
        )}

        {/* Pro cards */}
        {pros.map((pro: any) => {
          const name = pro.business_name || pro.profiles?.full_name || "Unnamed pro";
          const trades: string[] = (pro.pro_categories ?? [])
            .map((pc: any) => pc.categories?.name)
            .filter(Boolean);
          const rates: RateItem[] = pro.rate_items ?? [];
          const tiers = tierPrices(rates);
          const hourly = rates.find((r) => r.unit === "hourly");

          const media: Media[] = (pro.portfolio_items ?? [])
            .flatMap((item: any) => item.portfolio_media ?? [])
            .sort((a: Media, b: Media) => a.sort_order - b.sort_order)
            .slice(0, 3);

          return (
            <Link
              key={pro.id}
              href={`/pros/${pro.id}`}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#E2DCCF] bg-white no-underline"
            >
              {/* Photo strip */}
              {media.length > 0 && (
                <div className="grid h-28 grid-cols-3 gap-0.5">
                  {media.map((m) =>
                    m.kind === "video" ? (
                      <video
                        key={m.id}
                        src={mediaUrl(m.storage_path)}
                        className="h-full w-full bg-[#2A2824] object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img key={m.id} src={mediaUrl(m.storage_path)} alt="" className="h-full w-full object-cover" />
                    )
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-bold">{name}</span>
                  <span className="text-[13px] text-[#5C584F]">
                    {trades.join(" · ") || "No trades listed"}
                  </span>
                </div>

                {/* Price tiers */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(["small", "medium", "large"] as const).map((tier) => (
                    <div key={tier} className="flex flex-col gap-0.5 rounded-lg bg-[#F4F1EA] p-2">
                      <span className="text-[11px] font-medium capitalize text-[#5C584F]">
                        {tier === "small" ? "Small job" : tier}
                      </span>
                      <span className="text-sm font-semibold">{tiers[tier] ?? "—"}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-[#4A4740]">
                  <span className="font-medium">
                    {pro.license_verified
                      ? `License verified (${pro.license_state})`
                      : pro.insured
                      ? "Insured"
                      : `Within ${pro.service_radius_miles} mi of ${pro.service_zip}`}
                  </span>
                  {hourly && <span className="font-medium">{money(hourly.price_min_cents)}/hr</span>}
                </div>
              </div>
            </Link>
          );
        })}

        <p className="pt-2 text-sm text-[#4A4740]">
          Do this work yourself?{" "}
          <Link href="/signup" className="font-semibold text-[#B43C0A] underline">
            List your rates and past jobs
          </Link>
          .
        </p>
      </div>
    </main>
  );
}