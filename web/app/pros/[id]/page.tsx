import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, mediaUrl, monthLabel, tierLabel, type RateItem } from "@/lib/format";
import BookingSheet from "@/components/booking-sheet";
import OwnerLinks from "@/components/owner-links";

type Media = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number };

export default async function ProProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: pro } = await supabase
    .from("pros")
        .select("*, profiles!pros_id_fkey(full_name), pro_categories(categories(name))")
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
    .select("id, title, neighborhood, completed_on, description, portfolio_media(id, kind, storage_path, sort_order)")
    .eq("pro_id", id)
    .order("completed_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const jobs = (jobsData as any[]) ?? [];

  const name: string = pro.business_name || pro.profiles?.full_name || "Unnamed pro";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();
  const trades: string[] = (pro.pro_categories ?? [])
    .map((pc: { categories: { name: string } | null }) => pc.categories?.name)
    .filter(Boolean);

  // Every photo and clip across their jobs, for the strip at the top.
  const strip = jobs
    .flatMap((j) => (j.portfolio_media ?? []).map((m: Media) => ({ ...m, job: j })))
    .sort((a, b) => a.sort_order - b.sort_order);
  const cover = strip[0];

  return (
    <main className="min-h-screen pb-24">
      {/* Cover */}
      <section className="relative h-[210px] overflow-hidden bg-[var(--sand)]">
        {cover ? (
          cover.kind === "video" ? (
            <video src={mediaUrl(cover.storage_path)} className="h-full w-full object-cover" muted playsInline controls preload="metadata" />
          ) : (
            <img src={mediaUrl(cover.storage_path)} alt="" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--ink-faint)]">
            No photos yet
          </div>
        )}
        {cover?.job && (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[var(--card)] px-2 py-1 text-[11px] font-semibold">
            {[cover.job.title, cover.job.neighborhood].filter(Boolean).join(", ")}
          </span>
        )}
      </section>

      {/* Photo rail */}
      {strip.length > 1 && (
        <div className="rail mx-auto flex max-w-md gap-2 px-5 pt-3">
          {strip.slice(1, 9).map((m) =>
            m.kind === "video" ? (
              <video
                key={m.id}
                src={mediaUrl(m.storage_path)}
                className="h-[84px] w-[116px] rounded-[11px] bg-[var(--dark)] object-cover"
                muted
                playsInline
                controls
                preload="metadata"
              />
            ) : (
              <img key={m.id} src={mediaUrl(m.storage_path)} alt="" className="h-[84px] w-[116px] rounded-[11px] object-cover" />
            )
          )}
        </div>
      )}

      <div className="mx-auto max-w-md px-5">
        {/* Identity */}
        <section className="flex gap-3 pt-4">
          <div className="font-display flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--sand)] text-lg font-extrabold text-[#6b5a3e]">
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[25px] font-extrabold leading-tight">{name}</h1>
            {pro.business_name && pro.profiles?.full_name && (
              <span className="text-sm text-[var(--ink-soft)]">Run by {pro.profiles.full_name}</span>
            )}
            <span className="text-sm text-[var(--ink-soft)]">
              Serves within {pro.service_radius_miles} mi of {pro.service_zip}
              {pro.years_experience != null && `, ${pro.years_experience} years`}
            </span>
          </div>
        </section>

        {/* Badges */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-3 text-[13px] font-semibold">
          {pro.license_number &&
            (pro.license_verified ? (
              <span className="flex items-center gap-1.5 text-[var(--forest)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
                License verified{pro.license_state ? ` (${pro.license_state})` : ""}
              </span>
            ) : (
              <span className="font-medium text-[var(--ink-faint)]">License pending verification</span>
            ))}
          {pro.insured && <span className="text-[var(--forest)]">Insured</span>}
        </div>

        {/* Trades */}
        {trades.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-3">
            {trades.map((t) => (
              <span key={t} className="rounded-full bg-[var(--sand)] px-3 py-1.5 text-[12.5px] font-medium">
                {t}
              </span>
            ))}
          </div>
        )}

        {pro.bio && <p className="whitespace-pre-line pt-4 text-[15px] leading-relaxed">{pro.bio}</p>}

        {/* Rate card */}
        <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]">
          <div className="flex items-baseline justify-between border-b border-[#e8e1d3] px-4 py-3">
            <h2 className="font-display text-sm font-semibold">Rate card</h2>
            {rateItems.length > 0 && (
              <span className="text-[11.5px] text-[var(--ink-faint)]">Final price confirmed on site</span>
            )}
          </div>
          {rateItems.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[var(--ink-faint)]">No prices listed yet.</p>
          ) : (
            rateItems.map((item, i) => (
              <div
                key={item.id}
                className={`rise flex items-center justify-between gap-3 px-4 py-3 ${
                  i < rateItems.length - 1 ? "border-b border-[var(--line-soft)]" : ""
                }`}
                style={{ animationDelay: `${0.05 * i}s` }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{item.title}</span>
                  {item.description && (
                    <span className="text-[11.5px] text-[var(--ink-faint)]">{item.description}</span>
                  )}
                  {item.size_tier && (
                    <span className="text-[11px] font-medium text-[var(--ink-soft)]">{tierLabel[item.size_tier]}</span>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold">{formatPrice(item)}</span>
              </div>
            ))
          )}
        </section>

        {/* Past jobs */}
        <section className="pt-6">
          <h2 className="font-display pb-3 text-[15px] font-semibold">Past jobs</h2>
          {jobs.length === 0 ? (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
              No past jobs posted yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {jobs.map((job, i) => {
                const first = [...(job.portfolio_media ?? [])].sort(
                  (a: Media, b: Media) => a.sort_order - b.sort_order
                )[0];
                const count = (job.portfolio_media ?? []).length;
                return (
                  <div key={job.id} className="rise flex flex-col gap-1.5" style={{ animationDelay: `${0.04 * i}s` }}>
                    <div className="overflow-hidden rounded-xl bg-[var(--sand)]">
                      {first ? (
                        first.kind === "video" ? (
                          <video
                            src={mediaUrl(first.storage_path)}
                            className="aspect-[4/3] w-full bg-[var(--dark)] object-cover"
                            muted
                            playsInline
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <img src={mediaUrl(first.storage_path)} alt={job.title} className="aspect-[4/3] w-full object-cover" />
                        )
                      ) : (
                        <div className="aspect-[4/3] w-full" />
                      )}
                    </div>
                    <span className="text-sm font-semibold leading-tight">{job.title}</span>
                    <span className="text-[11.5px] text-[var(--ink-faint)]">
                      {[job.neighborhood, monthLabel(job.completed_on)].filter(Boolean).join(", ")}
                    </span>
                    {count > 1 && (
                      <span className="text-[11.5px] text-[var(--ink-faint)]">{count} photos and clips</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section className="pt-6">
          <h2 className="font-display pb-3 text-[15px] font-semibold">Reviews</h2>
          <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
            No reviews yet. Reviews appear here after a completed job, with the work and the price paid.
          </p>
        </section>

        <div className="pt-6">
          <OwnerLinks proId={id} />
        </div>

        <div className="pt-4">
          <Link href="/" className="text-sm font-semibold text-[var(--rust)] underline">
            Back to browse
          </Link>
        </div>
      </div>

          <BookingSheet proId={id} proName={name} />
    </main>
  );
}