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

  useEffect(() => {
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
                          profiles!pros_id_fkey(full_name),
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
      <main className="page">
        <p className="text-sm text-[var(--ink-faint)]">Loading…</p>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="page">
        <p className="text-sm text-[var(--ink-faint)]">This job isn't available.</p>
        <Link href="/jobs" className="link">
          Back to your jobs
        </Link>
      </main>
    );
  }

  const photos = job.job_post_media ?? [];

  return (
    <main className="page">
      <Link href="/jobs" className="link">
        Back to your jobs
      </Link>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="h1">{job.categories?.name ?? "Job"}</h1>
          <span className="hint capitalize">
            {job.size_tier} · {timingLabel[job.timing]} · {job.zip} · {job.status}
          </span>
        </div>
        <p className="text-[15px] leading-relaxed">{job.description}</p>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((m: any) =>
              m.kind === "video" ? (
                <video
                  key={m.id}
                  src={jobMediaUrl(m.storage_path)}
                  className="aspect-square w-full rounded-lg bg-[var(--dark)] object-cover"
                  muted
                  playsInline
                  controls
                  preload="metadata"
                />
              ) : (
                <img key={m.id} src={jobMediaUrl(m.storage_path)} alt="" className="aspect-square w-full rounded-lg object-cover" />
              )
            )}
          </div>
        )}
      </section>

      <h2 className="h2">
        {quotes.length === 0 ? "No quotes yet" : `${quotes.length} quote${quotes.length > 1 ? "s" : ""}, cheapest first`}
      </h2>

      {quotes.length === 0 && (
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">
          Pros in your area who do this work will see your job and send prices here. Meanwhile you can{" "}
          <Link href="/" className="link">
            browse pros
          </Link>{" "}
          and message someone directly.
        </p>
      )}

      {quotes.map((q, i) => {
        const pro = pros[q.pro_id];
        const name = pro?.business_name || pro?.profiles?.full_name || "Pro";
        const rates = pro?.rate_items ?? [];
        const relevant = rates.filter((r) => r.size_tier === job.size_tier || r.unit === "hourly").slice(0, 3);
        const media = (pro?.portfolio_items ?? [])
          .flatMap((item) => item.portfolio_media ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .slice(0, 3);

        return (
          <article
            key={q.id}
            className="rise flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <Link href={`/pros/${q.pro_id}`} className="font-display text-[17px] font-extrabold text-[var(--ink)] no-underline hover:underline">
                  {name}
                </Link>
                <span className="hint">
                  {[
                    pro?.license_verified ? `License verified (${pro.license_state})` : null,
                    pro?.insured ? "Insured" : null,
                    pro?.years_experience != null ? `${pro.years_experience} yrs` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <span className="font-display shrink-0 text-lg font-extrabold">{range(q)}</span>
            </div>

            {q.message && <p className="text-sm leading-relaxed">{q.message}</p>}

            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m) =>
                  m.kind === "video" ? (
                    <video
                      key={m.id}
                      src={mediaUrl(m.storage_path)}
                      className="aspect-[4/3] w-full rounded-lg bg-[var(--dark)] object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img key={m.id} src={mediaUrl(m.storage_path)} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
                  )
                )}
              </div>
            )}

            {relevant.length > 0 && (
              <div className="flex flex-col gap-1 rounded-xl bg-[var(--paper)] p-3">
                <span className="text-[11px] font-semibold text-[var(--ink-faint)]">From their rate card</span>
                {relevant.map((r) => (
                  <div key={r.id} className="flex justify-between gap-3 text-xs">
                    <span>{r.title}</span>
                    <span className="font-semibold">{formatPrice(r)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 border-t border-[var(--line-soft)] pt-3">
              <MessageButton proId={q.pro_id} jobPostId={job.id} label="Message" variant="plain" />
              <Link href={`/pros/${q.pro_id}`} className="link">
                See full profile
              </Link>
            </div>
          </article>
        );
      })}
    </main>
  );
}