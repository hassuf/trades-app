import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, monthLabel, tierLabel, type RateItem } from "@/lib/format";
import MediaCover, { mediaSummary, type PortfolioJob } from "@/components/media-cover";
import OwnerLinks from "@/components/owner-links";

// Public profile page for a pro: /pros/<their id>
export default async function ProProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: pro } = await supabase
    .from("pros")
    .select("*, profiles(full_name), pro_categories(categories(name))")
    .eq("id", id)
    .maybeSingle();

  if (!pro) notFound();

  const { data: rates } = await supabase
    .from("rate_items")
    .select("*")
    .eq("pro_id", id)
    .order("sort_order")
    .order("created_at");
  const rateItems: RateItem[] = rates ?? [];

  const { data: jobsData } = await supabase
    .from("portfolio_items")
    .select("id, title, neighborhood, completed_on, portfolio_media(id, kind, storage_path, sort_order)")
    .eq("pro_id", id)
    .order("completed_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const jobs: PortfolioJob[] = jobsData ?? [];

  const name: string = pro.business_name || pro.profiles?.full_name || "Unnamed pro";
  const trades: string[] = (pro.pro_categories ?? [])
    .map((pc: { categories: { name: string } | null }) => pc.categories?.name)
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">{name}</h1>
          {pro.business_name && pro.profiles?.full_name && (
            <p className="text-[15px] text-[#4A4740]">Run by {pro.profiles.full_name}</p>
          )}
          <p className="text-[15px] text-[#4A4740]">
            Serves within {pro.service_radius_miles} miles of {pro.service_zip}
            {pro.years_experience != null && `, ${pro.years_experience} years of experience`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {trades.map((t) => (
            <span key={t} className="rounded-full bg-[#E6E1D6] px-3 py-1.5 text-sm font-medium">
              {t}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
          {pro.license_number &&
            (pro.license_verified ? (
              <span className="text-[#2F6B3A]">License verified ({pro.license_state})</span>
            ) : (
              <span className="text-[#5C584F]">License pending verification</span>
            ))}
          {pro.insured && <span className="text-[#2F6B3A]">Insured</span>}
        </div>

        {pro.bio && <p className="whitespace-pre-line text-[15px] leading-relaxed">{pro.bio}</p>}

        <section className="flex flex-col rounded-2xl border border-[#E2DCCF] bg-white p-5">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">Rate card</h2>
            {rateItems.length > 0 && (
              <span className="text-xs text-[#5C584F]">Final price confirmed on site</span>
            )}
          </div>
          {rateItems.length === 0 ? (
            <p className="text-sm text-[#5C584F]">No prices listed yet.</p>
          ) : (
            rateItems.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 py-3 ${
                  i < rateItems.length - 1 ? "border-b border-[#EDE8DD]" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{item.title}</span>
                  {item.description && <span className="text-xs text-[#5C584F]">{item.description}</span>}
                  {item.size_tier && (
                    <span className="text-[11px] font-medium text-[#4A4740]">{tierLabel[item.size_tier]}</span>
                  )}
                </div>
                <span className="shrink-0 text-[15px] font-semibold">{formatPrice(item)}</span>
              </div>
            ))
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Past jobs</h2>
          {jobs.length === 0 ? (
            <p className="rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#5C584F]">
              No past jobs posted yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="flex flex-col gap-1.5">
                  <MediaCover job={job} />
                  <span className="text-sm font-semibold">{job.title}</span>
                  <span className="text-xs text-[#5C584F]">
                    {[job.neighborhood, monthLabel(job.completed_on)].filter(Boolean).join(", ")}
                  </span>
                  <span className="text-xs text-[#5C584F]">{mediaSummary(job)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

               <OwnerLinks proId={id} />
      </div>
    </main>
  );
}