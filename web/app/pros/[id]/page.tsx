import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { formatPrice, mediaUrl, monthLabel, tierLabel, type RateItem } from "@/lib/format";
import BookingSheet from "@/components/booking-sheet";
import ProjectList, { projectRanges, type Project } from "@/components/project-list";
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
  const flatRates = rateItems.filter((r) => r.unit === "flat");
  const hourly = rateItems.find((r) => r.unit === "hourly") ?? null;

  const { data: jobsData } = await supabase
    .from("portfolio_items")
    .select("id, title, neighborhood, completed_on, description, portfolio_media(id, kind, storage_path, sort_order)")
    .eq("pro_id", id)
    .order("completed_on", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  const jobs = (jobsData as any[]) ?? [];

  // Whole-project work, for contractors who take it on.
  const { data: projectData } = pro.takes_projects
    ? await supabase
        .from("gc_projects")
        .select(
          "id, title, scope, neighborhood, completed_on, final_cost_cents, duration_weeks, included, categories(name), gc_project_media(id, kind, storage_path, sort_order)"
        )
        .eq("pro_id", id)
        .order("completed_on", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    : { data: [] };
  const projects = (projectData as unknown as Project[]) ?? [];
  const ranges = projectRanges(projects);

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

  const strip = jobs
    .flatMap((j) => (j.portfolio_media ?? []).map((m: Media) => ({ ...m, job: j })))
    .sort((a, b) => a.sort_order - b.sort_order);
  const cover = strip[0];
  const mosaic = strip.slice(1, 5);

  const tile = (m: any, className: string) =>
    m.kind === "video" ? (
      <video
        key={m.id}
        src={mediaUrl(m.storage_path)}
        className={`${className} bg-[var(--dark)] object-cover`}
        muted
        playsInline
        controls
        preload="metadata"
      />
    ) : (
      <img key={m.id} src={mediaUrl(m.storage_path)} alt="" className={`${className} object-cover`} />
    );

  return (
    <main className="min-h-screen pb-24 lg:pb-10">
      <div className="mx-auto max-w-[1440px] lg:px-14">
        {/* Breadcrumb, desktop */}
        <div className="hidden pt-4 text-[13.5px] text-[var(--ink-faint)] lg:block">
          <Link href="/" className="text-[var(--rust)] no-underline hover:underline">Browse</Link>
          <span className="px-2 text-[#9c958a]">/</span>
          <span>{trades[0] ?? "Pros"}</span>
          <span className="px-2 text-[#9c958a]">/</span>
          <span>{name}</span>
        </div>

        {/* Gallery: one cover on phones, mosaic on desktop */}
        <section className="lg:pt-4">
          <div className="relative h-[210px] overflow-hidden bg-[var(--sand)] lg:hidden">
            {cover ? (
              tile(cover, "h-full w-full")
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--ink-faint)]">No photos yet</div>
            )}
            {cover?.job && (
              <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[var(--card)] px-2 py-1 text-[11px] font-semibold">
                {[cover.job.title, cover.job.neighborhood].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr] lg:grid-rows-2 lg:gap-2" style={{ height: "352px" }}>
            <div className="relative row-span-2 overflow-hidden rounded-l-2xl bg-[var(--sand)]">
              {cover ? (
                tile(cover, "h-full w-full")
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--ink-faint)]">No photos yet</div>
              )}
              {cover?.job && (
                <span className="absolute bottom-3.5 left-3.5 rounded-[7px] bg-[var(--card)] px-2.5 py-1.5 text-xs font-semibold">
                  {[cover.job.title, cover.job.neighborhood, monthLabel(cover.job.completed_on)]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
            </div>
            {[0, 1, 2, 3].map((n) => {
              const m = mosaic[n];
              const corner =
                n === 1 ? "rounded-tr-2xl" : n === 3 ? "rounded-br-2xl" : "";
              return (
                <div key={n} className={`relative overflow-hidden bg-[var(--sand)] ${corner}`}>
                  {m ? tile(m, "h-full w-full") : null}
                  {n === 3 && strip.length > 5 && (
                    <span className="absolute bottom-3 right-3 rounded-[9px] bg-[var(--card)] px-3 py-2 text-[12.5px] font-semibold">
                      {strip.length} photos and clips
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Two columns on desktop */}
        <div className="flex flex-col gap-8 px-5 lg:flex-row lg:gap-11 lg:px-0 lg:pt-8">
          {/* Left column */}
          <div className="flex flex-1 flex-col gap-6 lg:gap-7">
            {/* Identity */}
            <section className="flex gap-3 pt-4 lg:pt-0 lg:gap-4">
              <div className="font-display flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--sand)] text-lg font-extrabold text-[#6b5a3e] lg:h-[60px] lg:w-[60px] lg:rounded-2xl lg:text-xl">
                {initials}
              </div>
              <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-[25px] font-extrabold leading-tight lg:text-[34px]">{name}</h1>
                {pro.business_name && pro.profiles?.full_name && (
                  <span className="text-sm text-[var(--ink-soft)] lg:text-[15px]">Run by {pro.profiles.full_name}</span>
                )}
                <span className="text-sm text-[var(--ink-soft)] lg:text-[15px]">
                  {[
                    trades[0],
                    pro.years_experience != null ? `${pro.years_experience} years` : null,
                    `serves within ${pro.service_radius_miles} mi of ${pro.service_zip}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-[13px] font-semibold lg:text-[13.5px]">
                  {pro.license_number &&
                    (pro.license_verified ? (
                      <span className="flex items-center gap-1.5 text-[var(--forest)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                        License verified{pro.license_state ? `, ${pro.license_state}` : ""}
                      </span>
                    ) : (
                      <span className="font-medium text-[var(--ink-faint)]">License pending verification</span>
                    ))}
                  {pro.insured && <span className="text-[var(--forest)]">Carries liability insurance</span>}
                  {pro.takes_projects && (
                    <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--card)]">
                      Takes whole projects
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Trades */}
            {trades.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {trades.map((t) => (
                  <span key={t} className="rounded-full bg-[var(--sand)] px-3 py-1.5 text-[12.5px] font-medium lg:px-[13px] lg:py-[7px] lg:text-[13.5px]">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {pro.bio && (
              <p className="max-w-[640px] whitespace-pre-line text-[15px] leading-relaxed lg:text-base lg:leading-[1.6]">
                {pro.bio}
              </p>
            )}
                    {/* Whole projects */}
        {pro.takes_projects && (
          <>
            <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] lg:rounded-[18px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-[#e8e1d3] px-4 py-3 lg:px-[22px] lg:py-4">
                <h2 className="font-display text-sm font-semibold lg:text-xl lg:font-extrabold">
                  What projects like yours have cost
                </h2>
                <span className="text-[11.5px] text-[var(--ink-faint)] lg:text-[12.5px]">
                  From finished jobs, not estimates
                </span>
              </div>

              {ranges.length === 0 ? (
                <p className="px-4 py-4 text-sm text-[var(--ink-faint)]">No finished projects posted yet.</p>
              ) : (
                ranges.map((r, i) => (
                  <div
                    key={r.name}
                    className={`flex items-center justify-between gap-4 px-4 py-3 lg:px-[22px] lg:py-[15px] ${
                      i < ranges.length - 1 ? "border-b border-[var(--line-soft)]" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium lg:text-base lg:font-semibold">{r.name}</span>
                      <span className="text-[11.5px] text-[var(--ink-faint)] lg:text-[13px]">
                        {r.count} finished{r.weeks ? `, ${r.weeks}` : ""}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold lg:text-[17px]">{r.cost ?? "Cost not listed"}</span>
                  </div>
                ))
              )}

              {(pro.crew_size || pro.subs_out) && (
                <div className="border-t border-[#e8e1d3] bg-[var(--paper)] px-4 py-3 text-[13px] text-[var(--ink-soft)] lg:px-[22px]">
                  {[
                    pro.crew_size ? `Crew of ${pro.crew_size}` : null,
                    pro.subs_out ? `Subs out: ${pro.subs_out}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
            </section>

            {pro.project_blurb && (
              <section className="flex flex-col gap-2">
                <h2 className="font-display text-[15px] font-semibold lg:text-xl lg:font-extrabold">How they work</h2>
                <p className="whitespace-pre-line text-[15px] leading-relaxed lg:text-base">{pro.project_blurb}</p>
              </section>
            )}

            <section className="flex flex-col gap-3.5">
              <h2 className="font-display text-[15px] font-semibold lg:text-xl lg:font-extrabold">
                Finished projects
              </h2>
              <ProjectList projects={projects} />
            </section>
          </>
        )}

            {/* Rate card */}
            <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] lg:rounded-[18px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-[#e8e1d3] px-4 py-3 lg:px-[22px] lg:py-4">
                <h2 className="font-display text-sm font-semibold lg:text-xl lg:font-extrabold">Rate card</h2>
                {rateItems.length > 0 && (
                  <span className="text-[11.5px] text-[var(--ink-faint)] lg:text-[12.5px]">
                    Final price confirmed on site before any work starts
                  </span>
                )}
              </div>
              {rateItems.length === 0 ? (
                <p className="px-4 py-4 text-sm text-[var(--ink-faint)]">
                  {pro.takes_projects
                    ? "No fixed prices. Every project gets quoted after a walkthrough."
                    : "No prices listed yet."}
                </p>
              ) : (
                rateItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`rise flex items-center justify-between gap-4 px-4 py-3 lg:gap-5 lg:px-[22px] lg:py-[15px] ${
                      i < rateItems.length - 1 ? "border-b border-[var(--line-soft)]" : ""
                    }`}
                    style={{ animationDelay: `${0.04 * i}s` }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium lg:text-base lg:font-semibold">{item.title}</span>
                      {item.description && (
                        <span className="text-[11.5px] text-[var(--ink-faint)] lg:text-[13px]">{item.description}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 lg:gap-[18px]">
                      {item.size_tier && (
                        <span className="hidden rounded-xl bg-[var(--paper)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-soft)] lg:inline">
                          {tierLabel[item.size_tier]}
                        </span>
                      )}
                      <span className="text-sm font-semibold lg:min-w-[116px] lg:text-[17px] lg:text-right">
                        {formatPrice(item)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Past jobs */}
            <section className="flex flex-col gap-3.5">
              <h2 className="font-display text-[15px] font-semibold lg:text-xl lg:font-extrabold">Past jobs</h2>
              {jobs.length === 0 ? (
                <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
                  No past jobs posted yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {jobs.map((job, i) => {
                    const first = [...(job.portfolio_media ?? [])].sort(
                      (a: Media, b: Media) => a.sort_order - b.sort_order
                    )[0];
                    const count = (job.portfolio_media ?? []).length;
                    return (
                      <div
                        key={job.id}
                        className="card rise overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--card)]"
                        style={{ animationDelay: `${0.04 * i}s` }}
                      >
                        <div className="h-[132px] overflow-hidden bg-[var(--sand)]">
                          {first ? tile(first, "shot h-full w-full") : null}
                        </div>
                        <div className="flex flex-col gap-0.5 px-3.5 pb-3.5 pt-3">
                          <span className="text-[14.5px] font-semibold leading-tight">{job.title}</span>
                          <span className="text-[12.5px] text-[var(--ink-faint)]">
                            {[job.neighborhood, monthLabel(job.completed_on)].filter(Boolean).join(", ")}
                          </span>
                          {count > 1 && <span className="text-xs text-[#6b665c]">{count} photos and clips</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Reviews */}
            <section className="flex flex-col gap-3.5">
              <h2 className="font-display text-[15px] font-semibold lg:text-xl lg:font-extrabold">Reviews</h2>
              <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
                No reviews yet. Reviews appear here after a completed job, showing the quote alongside what was
                actually paid.
              </p>
            </section>

            <OwnerLinks proId={id} />
          </div>

          {/* Right column */}
          <div className="lg:w-[356px] lg:shrink-0">
            <BookingSheet proId={id} proName={name} rates={flatRates} hourly={hourly} />

            <div className="mt-[18px] hidden flex-col gap-2.5 rounded-2xl bg-[var(--sand)] p-[18px] lg:flex">
              <span className="font-display text-base font-extrabold">Comparing a few pros?</span>
              <span className="text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
                Save this one from the browse page and come back to your shortlist.
              </span>
              <Link href="/" className="link w-fit">
                Back to browse
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}