"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mediaUrl, monthLabel } from "@/lib/format";
import MediaCover, { mediaSummary, sortedMedia, type Media, type PortfolioJob } from "@/components/media-cover";

type Category = { id: number; name: string };
type Job = PortfolioJob & { category_id: number | null };
type FileDetail = { file: File; isVideo: boolean; seconds: number | null };

const MAX_FILES = 8;
const MAX_MB = 50;
const MAX_VIDEO_SECONDS = 60;

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration || 0);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
}

export default function PastJobsPage() {
  const router = useRouter();
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [month, setMonth] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [keptMedia, setKeptMedia] = useState<Media[]>([]);
  const [removedMedia, setRemovedMedia] = useState<Media[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadJobs(id: string) {
    const { data } = await supabase
      .from("portfolio_items")
      .select(
        "id, title, category_id, neighborhood, completed_on, description, portfolio_media(id, kind, storage_path, sort_order)"
      )
      .eq("pro_id", id)
      .order("completed_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setJobs((data as unknown as Job[]) ?? []);
  }

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setUserId(auth.user.id);

      const { data: mine } = await supabase
        .from("pro_categories")
        .select("categories(id, name)")
        .eq("pro_id", auth.user.id);
      setCategories((mine ?? []).map((m: any) => m.categories).filter(Boolean));

      await loadJobs(auth.user.id);
    }
    load();
  }, []);

  function resetForm() {
    setTitle("");
    setCategoryId("");
    setNeighborhood("");
    setMonth("");
    setDescription("");
    setFiles([]);
    setInputKey((k) => k + 1);
    setEditingId(null);
    setKeptMedia([]);
    setRemovedMedia([]);
    setError(null);
  }

  function startEditing(job: Job) {
    setTitle(job.title);
    setCategoryId(job.category_id ? String(job.category_id) : "");
    setNeighborhood(job.neighborhood ?? "");
    setMonth(job.completed_on ? job.completed_on.slice(0, 7) : "");
    setDescription(job.description ?? "");
    setFiles([]);
    setInputKey((k) => k + 1);
    setEditingId(job.id);
    setKeptMedia(sortedMedia(job));
    setRemovedMedia([]);
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function removeExisting(media: Media) {
    setKeptMedia((prev) => prev.filter((m) => m.id !== media.id));
    setRemovedMedia((prev) => [...prev, media]);
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const combined = [...files, ...picked];
    if (keptMedia.length + combined.length > MAX_FILES) {
      setError(`A job can have up to ${MAX_FILES} photos and videos in total.`);
      setInputKey((k) => k + 1);
      return;
    }
    const tooBig = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`"${tooBig.name}" is over ${MAX_MB} MB. Use a shorter or smaller file.`);
      setInputKey((k) => k + 1);
      return;
    }
    setError(null);
    setFiles(combined);
    setInputKey((k) => k + 1);
  }

  async function uploadFiles(jobId: string, details: FileDetail[], startOrder: number) {
    for (let i = 0; i < details.length; i++) {
      const { file, isVideo, seconds } = details[i];
      setStatus(`Uploading ${i + 1} of ${details.length}…`);

      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const path = `${userId}/${jobId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("portfolio").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) throw new Error(`"${file.name}" didn't upload: ${uploadError.message}`);

      await supabase.from("portfolio_media").insert({
        portfolio_item_id: jobId,
        kind: isVideo ? "video" : "photo",
        storage_path: path,
        duration_seconds: seconds ? Math.min(Math.round(seconds), MAX_VIDEO_SECONDS) : null,
        sort_order: startOrder + i,
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (keptMedia.length + files.length === 0) {
      setError("Add at least one photo or video of the finished work.");
      return;
    }
    setError(null);

    setStatus("Checking files…");
    const details: FileDetail[] = await Promise.all(
      files.map(async (file) => {
        const isVideo = file.type.startsWith("video/");
        const seconds = isVideo ? await videoDuration(file) : null;
        return { file, isVideo, seconds };
      })
    );
    const longVideo = details.find((d) => d.seconds && d.seconds > MAX_VIDEO_SECONDS + 0.5);
    if (longVideo) {
      setStatus(null);
      setError(`"${longVideo.file.name}" is longer than ${MAX_VIDEO_SECONDS} seconds. Trim it and try again.`);
      return;
    }

    const fields = {
      title,
      category_id: categoryId ? Number(categoryId) : null,
      neighborhood: neighborhood || null,
      completed_on: month ? `${month}-01` : null,
      description: description || null,
    };

    try {
      if (editingId) {
        setStatus("Saving changes…");
        const { error: updateError } = await supabase.from("portfolio_items").update(fields).eq("id", editingId);
        if (updateError) throw new Error(updateError.message);

        if (removedMedia.length) {
          await supabase.storage.from("portfolio").remove(removedMedia.map((m) => m.storage_path));
          await supabase.from("portfolio_media").delete().in("id", removedMedia.map((m) => m.id));
        }

        const nextOrder = keptMedia.length ? Math.max(...keptMedia.map((m) => m.sort_order)) + 1 : 0;
        await uploadFiles(editingId, details, nextOrder);
      } else {
        setStatus("Saving job…");
        const { data: job, error: jobError } = await supabase
          .from("portfolio_items")
          .insert({ pro_id: userId, ...fields })
          .select("id")
          .single();
        if (jobError || !job) throw new Error(jobError?.message ?? "Couldn't save the job.");
        await uploadFiles(job.id, details, 0);
      }

      setStatus(null);
      resetForm();
      await loadJobs(userId);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      await loadJobs(userId);
    }
  }

  async function handleDelete(job: Job) {
    if (!userId) return;
    if (!confirm(`Remove "${job.title}" and all its photos and videos?`)) return;
    const paths = (job.portfolio_media ?? []).map((m) => m.storage_path);
    if (paths.length) await supabase.storage.from("portfolio").remove(paths);
    await supabase.from("portfolio_items").delete().eq("id", job.id);
    if (editingId === job.id) resetForm();
    await loadJobs(userId);
  }

  const busy = status !== null;
  const totalMedia = keptMedia.length + files.length;
  const thumb = "aspect-square w-full rounded-lg object-cover";
  const xButton =
    "press absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-sm font-bold text-[var(--ink)] shadow";

  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">Your past jobs</h1>
        <p className="lede">
          Show finished work. Before-and-after photos and short walkthrough clips help homeowners trust your
          prices.
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">No past jobs yet. Add your first one below.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {jobs.map((job, i) => (
            <div
              key={job.id}
              className={`rise flex flex-col gap-1.5 rounded-xl ${
                editingId === job.id ? "ring-2 ring-[var(--rust)] ring-offset-4 ring-offset-[var(--paper)]" : ""
              }`}
              style={{ animationDelay: `${0.04 * i}s` }}
            >
              <MediaCover job={job} />
              <span className="text-sm font-semibold leading-tight">{job.title}</span>
              <span className="hint">
                {[job.neighborhood, monthLabel(job.completed_on)].filter(Boolean).join(", ")}
              </span>
              <span className="hint">{mediaSummary(job)}</span>
              <div className="flex gap-4">
                <button type="button" onClick={() => startEditing(job)} className="py-1 text-xs font-semibold text-[var(--rust)] underline">
                  Edit
                </button>
                <button type="button" onClick={() => handleDelete(job)} className="py-1 text-xs font-medium text-[#8a2e08] underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex scroll-mt-20 flex-col gap-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="h2">{editingId ? "Edit past job" : "Add a past job"}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm font-medium text-[var(--ink-soft)] underline">
              Cancel
            </button>
          )}
        </div>

        <label className="field">
          What was the job?
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kitchen outlet add" required />
        </label>

        {categories.length > 0 && (
          <label className="field">
            Type of work
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose one</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Neighborhood
            <input className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="e.g. Shaw" />
          </label>
          <label className="field">
            Finished
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        </div>

        <label className="field">
          Details <span className="hint">Optional. What you did and any challenges.</span>
          <textarea className="area" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="media" className="text-sm font-semibold">
              Photos and videos
            </label>
            <span className="hint">
              {totalMedia} of {MAX_FILES}
            </span>
          </div>

          {totalMedia > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {keptMedia.map((m, i) => (
                <div key={m.id} className="relative">
                  {m.kind === "video" ? (
                    <video src={mediaUrl(m.storage_path)} className={`${thumb} bg-[var(--dark)]`} muted playsInline preload="metadata" />
                  ) : (
                    <img src={mediaUrl(m.storage_path)} alt="" className={thumb} />
                  )}
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-[var(--ink)]/85 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Cover
                    </span>
                  )}
                  <button type="button" aria-label="Remove this file" onClick={() => removeExisting(m)} className={xButton}>
                    ×
                  </button>
                </div>
              ))}
              {files.map((f, i) => (
                <div key={`new-${i}`} className="relative">
                  {f.type.startsWith("video/") ? (
                    <div className={`${thumb} flex items-center justify-center bg-[var(--dark)] text-[11px] text-white`}>
                      Video
                    </div>
                  ) : (
                    <img src={URL.createObjectURL(f)} alt={f.name} className={thumb} />
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-[var(--rust)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                    New
                  </span>
                  <button
                    type="button"
                    aria-label="Remove this file"
                    onClick={() => setFiles((prev) => prev.filter((_, n) => n !== i))}
                    className={xButton}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {totalMedia < MAX_FILES && (
            <input
              key={inputKey}
              id="media"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              multiple
              onChange={handleFiles}
              className="text-sm file:mr-3 file:h-10 file:rounded-full file:border file:border-[var(--ink)] file:bg-[var(--card)] file:px-4 file:text-sm file:font-semibold"
            />
          )}
          <span className="hint">Videos {MAX_VIDEO_SECONDS} seconds or shorter. The first one is the cover.</span>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy || !userId} className="btn btn-primary">
          {status ?? (editingId ? "Save changes" : "Add past job")}
        </button>
      </form>

      {userId && (
        <Link href={`/pros/${userId}`} className="link">
          View my profile
        </Link>
      )}
    </main>
  );
}