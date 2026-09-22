"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sizeHint } from "@/lib/format";

type Category = { id: number; name: string };
type Size = "small" | "medium" | "large";

const MAX_FILES = 6;
const MAX_MB = 50;

export default function NewJobPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [size, setSize] = useState<Size>("small");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [timing, setTiming] = useState("flexible");
  const [zip, setZip] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setUserId(auth.user.id);

      const { data: cats } = await supabase.from("categories").select("id, name").order("id");
      setCategories(cats ?? []);

      // Prefill their ZIP if we already know it.
      const { data: profile } = await supabase.from("profiles").select("zip").eq("id", auth.user.id).maybeSingle();
      if (profile?.zip) setZip(profile.zip);
    }
    load();
  }, []);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const combined = [...files, ...picked];
    if (combined.length > MAX_FILES) {
      setError(`Add up to ${MAX_FILES} photos or videos.`);
      setInputKey((k) => k + 1);
      return;
    }
    const tooBig = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`"${tooBig.name}" is over ${MAX_MB} MB. Use a smaller file.`);
      setInputKey((k) => k + 1);
      return;
    }
    setError(null);
    setFiles(combined);
    setInputKey((k) => k + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const min = budgetMin ? Math.round(Number(budgetMin) * 100) : null;
    const max = budgetMax ? Math.round(Number(budgetMax) * 100) : null;
    if (min !== null && max !== null && max < min) {
      setError("The top of your budget can't be lower than the bottom.");
      return;
    }
    setError(null);

    setStatus("Posting job…");
    const { data: job, error: jobError } = await supabase
      .from("job_posts")
      .insert({
        homeowner_id: userId,
        category_id: Number(categoryId),
        description,
        size_tier: size,
        budget_min_cents: min,
        budget_max_cents: max,
        timing,
        zip,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      setStatus(null);
      setError(jobError?.message ?? "Couldn't post the job.");
      return;
    }

    // Save their ZIP for next time.
    await supabase.from("profiles").update({ zip }).eq("id", userId);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(`Uploading ${i + 1} of ${files.length}…`);
      const isVideo = file.type.startsWith("video/");
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const path = `${userId}/${job.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("jobs").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) {
        setStatus(null);
        setError(`"${file.name}" didn't upload: ${uploadError.message}. Your job was posted; add photos by editing it.`);
        return;
      }
      await supabase.from("job_post_media").insert({
        job_post_id: job.id,
        kind: isVideo ? "video" : "photo",
        storage_path: path,
      });
    }

    setStatus(null);
    router.push("/jobs");
  }

  const input =
    "h-12 w-full rounded-xl border border-[#D9D3C6] bg-white px-3 text-[15px] font-normal text-[#1C1B19] outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20";
  const busy = status !== null;

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Post a job</h1>
          <p className="text-[15px] text-[#4A4740]">
            Describe what you need. Pros nearby who do this work send you quotes, and you compare them
            alongside their prices and past jobs.
          </p>
        </div>

        <label className="flex flex-col gap-2 text-sm font-semibold">
          What kind of work?
          <select className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">Choose one</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold">
          Describe the job
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="e.g. Add one outlet on the bedroom wall next to the bed. Nearest outlet is about 6 ft away on the same wall."
            className="w-full resize-none rounded-xl border border-[#D9D3C6] bg-white p-3 text-[15px] font-normal outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20"
          />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="media" className="text-sm font-semibold">
              Photos or a quick video
            </label>
            <span className="text-xs text-[#5C584F]">
              {files.length} of {MAX_FILES}
            </span>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative">
                  {f.type.startsWith("video/") ? (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-[#2A2824] text-[11px] text-white">
                      Video
                    </div>
                  ) : (
                    <img src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full rounded-lg object-cover" />
                  )}
                  <button
                    type="button"
                    aria-label="Remove this file"
                    onClick={() => setFiles((prev) => prev.filter((_, n) => n !== i))}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-sm font-bold shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length < MAX_FILES && (
            <input
              key={inputKey}
              id="media"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
              multiple
              onChange={handleFiles}
              className="text-sm file:mr-3 file:h-10 file:rounded-full file:border file:border-[#1C1B19] file:bg-white file:px-4 file:text-sm file:font-semibold"
            />
          )}
          <span className="text-xs text-[#5C584F]">Pros quote more accurately when they can see the space.</span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">How big is it?</legend>
          <div className="flex flex-col gap-2">
            {(["small", "medium", "large"] as Size[]).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={size === s}
                onClick={() => setSize(s)}
                className={`flex min-h-[60px] items-center justify-between gap-3 rounded-xl bg-white px-4 py-2 text-left ${
                  size === s ? "border-2 border-[#B43C0A]" : "border border-[#D9D3C6]"
                }`}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold capitalize">{s}</span>
                  <span className="text-xs text-[#5C584F]">{sizeHint[s]}</span>
                </span>
                <span
                  className={`h-5 w-5 shrink-0 rounded-full ${
                    size === s ? "border-[6px] border-[#B43C0A]" : "border-2 border-[#9C958A]"
                  }`}
                />
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Budget from ($)
            <input className={input} type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="Optional" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Up to ($)
            <input className={input} type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="Optional" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            When?
            <select className={input} value={timing} onChange={(e) => setTiming(e.target.value)}>
              <option value="this_week">This week</option>
              <option value="next_2_weeks">Next 2 weeks</option>
              <option value="flexible">Flexible</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            ZIP code
            <input className={input} inputMode="numeric" value={zip} onChange={(e) => setZip(e.target.value)} required />
          </label>
        </div>
        <span className="-mt-3 text-xs text-[#5C584F]">
          Your exact address is only shared with the pro you book.
        </span>

        {error && <p className="rounded-lg bg-[#FBE9E2] px-3 py-2 text-sm text-[#8A2E08]">{error}</p>}

        <button
          type="submit"
          disabled={busy || !userId}
          className="h-12 rounded-xl bg-[#B43C0A] text-base font-semibold text-white disabled:opacity-60"
        >
          {status ?? "Post job and get quotes"}
        </button>
        <span className="-mt-3 text-center text-xs text-[#5C584F]">Free to post. You pay only when you book.</span>
      </form>
    </main>
  );
}