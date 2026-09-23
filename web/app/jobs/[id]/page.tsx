"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, jobMediaUrl, mediaUrl, money, timingLabel, type RateItem } from "@/lib/format";
import MessageButton from "@/components/message-button";

type Quote = {
  id: string;
  pro_id: string;
  price_min_cents: number;
  price_max_cents: number | null;
  message: string | null;
  status: string;
  created_at: string;
};

type Pro = {
  id: string;
  business_name: string | null;
  service_zip: string;
  years_experience: number | null;
  license_verified: boolean;
  license_state: string | null;
  insured: boolean;
  profiles: { full_name: string } | null;
  rate_items: RateItem[];
  portfolio_items: { id: string; portfolio_media: { id: string; kind: string; storage_path: string; sort_order: number }[] }[];
};

export default function JobQuotesPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [job, setJob] = useState<any>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pros, setPros] = useState<Record<string, Pro>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    const { data: jobData } = await supabase
      .from("job_posts")
      .select("*, categories(name), job_post_media(id, kind, storage_path)")
      .eq("id", params.id)
      .maybeSingle();
    setJob(jobData);

    const { data: quoteData } = await supabase
      .from("quotes")
      .select("*")
      .eq("job_post_id", params.id)
      .order("price_min_cents");
        const list = (quoteData as unknown as Quote[]) ?? [];
    setQuotes(list);

    if (list.length > 0) {
      const { data: proData } = await supabase
        .from("pros")
        .select(
          `id, business_name, service_zip, years_experience, license_verified, license_state, insured,
           profiles(full_name),
           rate_items(id, title, description, unit, size_tier, price_min_cents, price_max_cents),
           portfolio_items(id, portfolio_media(id, kind, storage_path, sort_order))`
        )
        .in("id", list.map((q) => q.pro_id));
      const byId: Record<string, Pro> = {};
            ((proData as unknown as Pro[]) ?? []).forEach((p) => {
        byId[p.id] = p;
      });
      setPros(byId);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [params.id]);

  function range(q: Quote) {
    if (q.price_max_cents && q.price_max_cents !== q.price_min_cents)
      return `${money(q.price_min_cents)}–${money(q.price_max_cents).slice(1)}`;
    if (!q.price_max_cents) return `${money(q.price_min_cents)}+`;
    return money(q.price_min_cents);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4F1EA] px-5 py-10">
        <p className="mx-auto max-w-md text-sm text-[#5C584F]">Loading…</p>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-[#F4F1EA] px-5 py-10">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <p className="text-sm text-[#5C584F]">This job isn't available.</p>
          <Link href="/jobs" className="text-sm font-semibold text-[#B43C0A] underline">
            Back to your jobs
          </Link>
        </div>
      </main>
    );
  }

  const photos = job.job_post_media ?? [];

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <Link href="/jobs" className="text-sm font-semibold text-[#B43C0A] underline">
          Back to your jobs
        </Link>

        {/* The job itself */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{job.categories?.name ?? "Job"}</h1>
            <span className="text-xs text-[#5C584F]">
              {job.size_tier} · {timingLabel[job.timing]} · {job.zip} · {job.status}
            </span>
          </div>
          <p className="text-[15px] leading-relaxed">{job.description}</p>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((m: any) =>
                m.kind === "video" ? (
                  <video key={m.id} src={jobMediaUrl(m.storage_path)} className="aspect-square w-full rounded-lg bg-[#2A2824] object-cover" muted playsInline controls preload="metadata" />
                ) : (
                  <img key={m.id} src={jobMediaUrl(m.storage_path)} alt="" className="aspect-square w-full rounded-lg object-cover" />
                )
              )}
            </div>
          )}
        </section>

        <h2 className="text-lg font-bold">
          {quotes.length === 0 ? "No quotes yet" : `${quotes.length} quote${quotes.length > 1 ? "s" : ""}`}
        </h2>

        {quotes.length === 0 && (
          <p className="rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#5C584F]">
            Pros in your area who do this work will see your job and send prices here. Meanwhile you can{" "}
            <Link href="/" className="font-semibold text-[#B43C0A] underline">
              browse pros
            </Link>{" "}
            and message someone directly.
          </p>
        )}

        {/* Quotes, cheapest first */}
        {quotes.map((q) => {
          const pro = pros[q.pro_id];
          const name = pro?.business_name || pro?.profiles?.full_name || "Pro";
          const rates = pro?.rate_items ?? [];
          const relevant = rates.filter((r) => r.size_tier === job.size_tier || r.unit === "hourly").slice(0, 3);
          const media = (pro?.portfolio_items ?? [])
            .flatMap((item) => item.portfolio_media ?? [])
            .sort((a, b) => a.sort_order - b.sort_order)
            .slice(0, 3);

          return (
            <article key={q.id} className="flex flex-col gap-3 rounded-2xl border border-[#E2DCCF] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <Link href={`/pros/${q.pro_id}`} className="text-[17px] font-bold text-[#1C1B19] no-underline underline-offset-2 hover:underline">
                    {name}
                  </Link>
                  <span className="text-xs text-[#5C584F]">
                    {[
                      pro?.license_verified ? `License verified (${pro.license_state})` : null,
                      pro?.insured ? "Insured" : null,
                      pro?.years_experience != null ? `${pro.years_experience} yrs` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <span className="shrink-0 text-lg font-bold">{range(q)}</span>
              </div>

              {q.message && <p className="text-sm leading-relaxed">{q.message}</p>}

              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {media.map((m) =>
                    m.kind === "video" ? (
                      <video key={m.id} src={mediaUrl(m.storage_path)} className="aspect-[4/3] w-full rounded-lg bg-[#2A2824] object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img key={m.id} src={mediaUrl(m.storage_path)} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                    )
                  )}
                </div>
              )}

              {relevant.length > 0 && (
                <div className="flex flex-col gap-1 rounded-xl bg-[#F4F1EA] p-3">
                  <span className="text-[11px] font-semibold text-[#5C584F]">From their rate card</span>
                  {relevant.map((r) => (
                    <div key={r.id} className="flex justify-between gap-3 text-xs">
                      <span>{r.title}</span>
                      <span className="font-semibold">{formatPrice(r)}</span>
                    </div>
                  ))}
                </div>
              )}

                            <div className="flex items-center gap-4">
                <MessageButton proId={q.pro_id} jobPostId={job.id} label="Message" />
                <Link href={`/pros/${q.pro_id}`} className="text-sm font-semibold text-[#B43C0A] underline">
                  See full profile
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}