"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { jobMediaUrl, money, timingLabel } from "@/lib/format";

type Job = {
  id: string;
  description: string;
  size_tier: string;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  timing: string;
  zip: string;
  created_at: string;
  category_id: number;
  categories: { name: string } | null;
  job_post_media: { id: string; kind: string; storage_path: string }[];
};

type MyQuote = {
  id: string;
  job_post_id: string;
  price_min_cents: number;
  price_max_cents: number | null;
  message: string | null;
  status: string;
};

export default function AvailableJobsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [myQuotes, setMyQuotes] = useState<Record<string, MyQuote>>({});

  const [openForm, setOpenForm] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    setUserId(auth.user.id);

    const { data: pro } = await supabase.from("pros").select("id").eq("id", auth.user.id).maybeSingle();
    if (!pro) {
      router.push("/pro/setup");
      return;
    }

    // Which trades this pro does.
    const { data: mine } = await supabase.from("pro_categories").select("category_id").eq("pro_id", auth.user.id);
    const categoryIds = (mine ?? []).map((m) => m.category_id);

    if (categoryIds.length === 0) {
      setJobs([]);
      return;
    }

    const { data: openJobs } = await supabase
      .from("job_posts")
      .select(
        `id, description, size_tier, budget_min_cents, budget_max_cents, timing, zip, created_at, category_id,
         categories(name), job_post_media(id, kind, storage_path)`
      )
      .eq("status", "open")
      .in("category_id", categoryIds)
      .order("created_at", { ascending: false });
        setJobs((openJobs as unknown as Job[]) ?? []);

    // Quotes this pro already sent.
    const { data: quotes } = await supabase
      .from("quotes")
      .select("id, job_post_id, price_min_cents, price_max_cents, message, status")
      .eq("pro_id", auth.user.id);
    const byJob: Record<string, MyQuote> = {};
    (quotes ?? []).forEach((q: MyQuote) => {
      byJob[q.job_post_id] = q;
    });
    setMyQuotes(byJob);
  }

  useEffect(() => {
    load();
  }, []);

  function startQuote(job: Job) {
    const existing = myQuotes[job.id];
    setOpenForm(job.id);
    setPriceMin(existing ? String(Math.round(existing.price_min_cents / 100)) : "");
    setPriceMax(existing?.price_max_cents ? String(Math.round(existing.price_max_cents / 100)) : "");
    setMessage(existing?.message ?? "");
    setError(null);
  }

  async function sendQuote(job: Job) {
    if (!userId) return;
    const min = Math.round(Number(priceMin) * 100);
    const max = priceMax ? Math.round(Number(priceMax) * 100) : null;

    if (!priceMin || isNaN(min) || min <= 0) {
      setError("Enter a starting price.");
      return;
    }
    if (max !== null && max < min) {
      setError("The top of your range can't be lower than the bottom.");
      return;
    }
    setError(null);
    setSending(true);

    const existing = myQuotes[job.id];
    const fields = { price_min_cents: min, price_max_cents: max, message: message || null };

    const { error: saveError } = existing
      ? await supabase.from("quotes").update(fields).eq("id", existing.id)
      : await supabase.from("quotes").insert({ job_post_id: job.id, pro_id: userId, ...fields });

    setSending(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setOpenForm(null);
    await load();
  }

  async function withdrawQuote(job: Job) {
    const existing = myQuotes[job.id];
    if (!existing) return;
    if (!confirm("Withdraw your quote for this job?")) return;
    await supabase.from("quotes").delete().eq("id", existing.id);
    await load();
  }

  function budget(job: Job) {
    if (job.budget_min_cents && job.budget_max_cents)
      return `Budget ${money(job.budget_min_cents)}–${money(job.budget_max_cents).slice(1)}`;
    if (job.budget_min_cents) return `Budget ${money(job.budget_min_cents)}+`;
    if (job.budget_max_cents) return `Budget up to ${money(job.budget_max_cents)}`;
    return "No budget set";
  }

  function quoteRange(q: MyQuote) {
    if (q.price_max_cents && q.price_max_cents !== q.price_min_cents)
      return `${money(q.price_min_cents)}–${money(q.price_max_cents).slice(1)}`;
    if (!q.price_max_cents) return `${money(q.price_min_cents)}+`;
    return money(q.price_min_cents);
  }

  const input =
    "h-12 w-full rounded-xl border border-[#D9D3C6] bg-white px-3 text-[15px] font-normal text-[#1C1B19] outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20";

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Jobs looking for a pro</h1>
          <p className="text-[15px] text-[#4A4740]">
            Open jobs in the trades you listed. Send a price range and the homeowner compares it with your
            rate card and past work.
          </p>
        </div>

        {jobs === null && <p className="text-sm text-[#5C584F]">Loading…</p>}

        {jobs?.length === 0 && (
          <p className="rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#5C584F]">
            Nothing open right now in your trades. Check back, or make sure your trades are up to date in{" "}
            <Link href="/pro/setup" className="font-semibold text-[#B43C0A] underline">
              business details
            </Link>
            .
          </p>
        )}

        {jobs?.map((job) => {
          const mine = myQuotes[job.id];
          const photos = job.job_post_media ?? [];
          return (
            <article key={job.id} className="flex flex-col gap-3 rounded-2xl border border-[#E2DCCF] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-bold">{job.categories?.name ?? "Job"}</span>
                  <span className="text-xs text-[#5C584F]">
                    {job.size_tier} · {timingLabel[job.timing]} · {job.zip}
                  </span>
                </div>
                {mine && (
                  <span className="shrink-0 rounded-full bg-[#E4EFE6] px-2.5 py-1 text-[11px] font-semibold text-[#2F6B3A]">
                    Quoted {quoteRange(mine)}
                  </span>
                )}
              </div>

              <p className="text-sm leading-relaxed">{job.description}</p>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((m) =>
                    m.kind === "video" ? (
                      <video
                        key={m.id}
                        src={jobMediaUrl(m.storage_path)}
                        className="aspect-square w-full rounded-lg bg-[#2A2824] object-cover"
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

              <span className="text-xs text-[#5C584F]">{budget(job)}</span>

              {openForm === job.id ? (
                <div className="flex flex-col gap-3 border-t border-[#EDE8DD] pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-2 text-sm font-semibold">
                      Your price from ($)
                      <input className={input} type="number" min={0} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} required />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-semibold">
                      Up to ($)
                      <input className={input} type="number" min={0} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Optional" />
                    </label>
                  </div>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Message
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="What's included, what you'd need to check on site, when you could start."
                      className="w-full resize-none rounded-xl border border-[#D9D3C6] bg-white p-3 text-[15px] font-normal outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20"
                    />
                  </label>

                  {error && <p className="rounded-lg bg-[#FBE9E2] px-3 py-2 text-sm text-[#8A2E08]">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => sendQuote(job)}
                      disabled={sending}
                      className="h-11 flex-1 rounded-xl bg-[#B43C0A] text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {sending ? "Sending…" : mine ? "Update quote" : "Send quote"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenForm(null)}
                      className="h-11 rounded-xl border border-[#D9D3C6] px-4 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4 border-t border-[#EDE8DD] pt-3">
                  <button
                    type="button"
                    onClick={() => startQuote(job)}
                    className="rounded-xl bg-[#B43C0A] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    {mine ? "Edit quote" : "Send a quote"}
                  </button>
                  {mine && (
                    <button type="button" onClick={() => withdrawQuote(job)} className="text-xs font-medium text-[#8A2E08] underline">
                      Withdraw
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}