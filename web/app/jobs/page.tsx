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
  status: string;
  created_at: string;
  categories: { name: string } | null;
  job_post_media: { id: string; kind: string; storage_path: string }[];
  quotes: { id: string }[];
};

export default function MyJobsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [jobs, setJobs] = useState<Job[] | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("job_posts")
      .select(
        `id, description, size_tier, budget_min_cents, budget_max_cents, timing, zip, status, created_at,
         categories(name), job_post_media(id, kind, storage_path), quotes(id)`
      )
      .eq("homeowner_id", auth.user.id)
      .order("created_at", { ascending: false });
    setJobs((data as Job[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function closeJob(job: Job) {
    if (!confirm("Close this job? Pros won't be able to send new quotes.")) return;
    await supabase.from("job_posts").update({ status: "closed" }).eq("id", job.id);
    await load();
  }

  function budget(job: Job) {
    if (job.budget_min_cents && job.budget_max_cents)
      return `${money(job.budget_min_cents)}–${money(job.budget_max_cents).slice(1)}`;
    if (job.budget_min_cents) return `${money(job.budget_min_cents)}+`;
    if (job.budget_max_cents) return `Up to ${money(job.budget_max_cents)}`;
    return "No budget set";
  }

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Your jobs</h1>
          <Link
            href="/jobs/new"
            className="mt-1 shrink-0 rounded-xl bg-[#B43C0A] px-4 py-2.5 text-sm font-semibold text-white no-underline"
          >
            Post a job
          </Link>
        </div>

        {jobs === null && <p className="text-sm text-[#5C584F]">Loading…</p>}

        {jobs?.length === 0 && (
          <p className="rounded-2xl border border-[#E2DCCF] bg-white p-5 text-sm text-[#5C584F]">
            You haven't posted anything yet. Post a job and pros nearby will send quotes, or{" "}
            <Link href="/" className="font-semibold text-[#B43C0A] underline">
              browse pros
            </Link>{" "}
            and message one directly.
          </p>
        )}

        {jobs?.map((job) => {
          const photo = job.job_post_media?.find((m) => m.kind === "photo");
          const count = job.quotes?.length ?? 0;
          return (
            <article key={job.id} className="flex flex-col gap-3 rounded-2xl border border-[#E2DCCF] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-bold">{job.categories?.name ?? "Job"}</span>
                  <span className="text-xs text-[#5C584F]">
                    {job.size_tier} · {timingLabel[job.timing]} · {job.zip}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    job.status === "open" ? "bg-[#E4EFE6] text-[#2F6B3A]" : "bg-[#E6E1D6] text-[#4A4740]"
                  }`}
                >
                  {job.status}
                </span>
              </div>

              <div className="flex gap-3">
                {photo && (
                  <img
                    src={jobMediaUrl(photo.storage_path)}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                )}
                <p className="line-clamp-4 text-sm leading-relaxed">{job.description}</p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[#EDE8DD] pt-3">
                <span className="text-sm font-semibold">
                  {count === 0 ? "No quotes yet" : `${count} quote${count > 1 ? "s" : ""}`}
                </span>
                <span className="text-xs text-[#5C584F]">{budget(job)}</span>
              </div>

              {job.status === "open" && (
                <button
                  type="button"
                  onClick={() => closeJob(job)}
                  className="w-fit text-xs font-medium text-[#8A2E08] underline"
                >
                  Close this job
                </button>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}