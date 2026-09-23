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
    setJobs((data as unknown as Job[]) ?? []);
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
    <main className="page">
      <div className="flex items-start justify-between gap-4">
        <h1 className="h1">Your jobs</h1>
        <Link href="/jobs/new" className="btn btn-primary btn-sm mt-1 flex shrink-0 items-center no-underline">
          Post a job
        </Link>
      </div>

      {jobs === null && <p className="text-sm text-[var(--ink-faint)]">Loading…</p>}

      {jobs?.length === 0 && (
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">
          You haven't posted anything yet. Post a job and pros nearby will send quotes, or{" "}
          <Link href="/" className="link">
            browse pros
          </Link>{" "}
          and message one directly.
        </p>
      )}

      {jobs?.map((job, i) => {
        const photo = job.job_post_media?.find((m) => m.kind === "photo");
        const count = job.quotes?.length ?? 0;
        return (
          <article
            key={job.id}
            className="rise flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-[17px] font-extrabold">{job.categories?.name ?? "Job"}</span>
                <span className="hint capitalize">
                  {job.size_tier} · {timingLabel[job.timing]} · {job.zip}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                  job.status === "open" ? "bg-[#e4efe6] text-[var(--forest)]" : "bg-[var(--sand)] text-[var(--ink-soft)]"
                }`}
              >
                {job.status}
              </span>
            </div>

            <div className="flex gap-3">
              {photo && (
                <img src={jobMediaUrl(photo.storage_path)} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              )}
              <p className="line-clamp-4 text-sm leading-relaxed">{job.description}</p>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--line-soft)] pt-3">
              <Link href={`/jobs/${job.id}`} className="link">
                {count === 0 ? "No quotes yet" : `See ${count} quote${count > 1 ? "s" : ""}`}
              </Link>
              <span className="hint">{budget(job)}</span>
            </div>

            {job.status === "open" && (
              <button type="button" onClick={() => closeJob(job)} className="w-fit text-xs font-medium text-[#8a2e08] underline">
                Close this job
              </button>
            )}
          </article>
        );
      })}
    </main>
  );
}