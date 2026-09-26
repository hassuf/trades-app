"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mediaUrl, money, monthLabel } from "@/lib/format";

type Category = { id: number; name: string };
type Media = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number };
type Project = {
  id: string;
  category_id: number | null;
  title: string;
  scope: string;
  neighborhood: string | null;
  completed_on: string | null;
  final_cost_cents: number | null;
  duration_weeks: number | null;
  included: string | null;
  gc_project_media: Media[];
};

const MAX_FILES = 10;
const MAX_MB = 50;

export default function ProjectsPage() {
  const router = useRouter();
  const supabase = createClient();
  const formRef = useRef<HTMLFormElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [takesProjects, setTakesProjects] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [scope, setScope] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [month, setMonth] = useState("");
  const [cost, setCost] = useState("");
  const [weeks, setWeeks] = useState("");
  const [included, setIncluded] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [inputKey, setInputKey] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [keptMedia, setKeptMedia] = useState<Media[]>([]);
  const [removedMedia, setRemovedMedia] = useState<Media[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadProjects(id: string) {
    const { data } = await supabase
      .from("gc_projects")
      .select(
        "id, category_id, title, scope, neighborhood, completed_on, final_cost_cents, duration_weeks, included, gc_project_media(id, kind, storage_path, sort_order)"
      )
      .eq("pro_id", id)
      .order("completed_on", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setProjects((data as unknown as Project[]) ?? []);
  }

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setUserId(auth.user.id);

      const { data: pro } = await supabase
        .from("pros")
        .select("takes_projects")
        .eq("id", auth.user.id)
        .maybeSingle();
      setTakesProjects(pro?.takes_projects ?? false);

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .order("sort_order")
        .order("id");
      setCategories(cats ?? []);

      await loadProjects(auth.user.id);
    }
    load();
  }, []);

  function resetForm() {
    setTitle("");
    setCategoryId("");
    setScope("");
    setNeighborhood("");
    setMonth("");
    setCost("");
    setWeeks("");
    setIncluded("");
    setFiles([]);
    setInputKey((k) => k + 1);
    setEditingId(null);
    setKeptMedia([]);
    setRemovedMedia([]);
    setError(null);
  }

  function startEditing(p: Project) {
    setTitle(p.title);
    setCategoryId(p.category_id ? String(p.category_id) : "");
    setScope(p.scope);
    setNeighborhood(p.neighborhood ?? "");
    setMonth(p.completed_on ? p.completed_on.slice(0, 7) : "");
    setCost(p.final_cost_cents ? String(Math.round(p.final_cost_cents / 100)) : "");
    setWeeks(p.duration_weeks?.toString() ?? "");
    setIncluded(p.included ?? "");
    setFiles([]);
    setInputKey((k) => k + 1);
    setEditingId(p.id);
    setKeptMedia([...(p.gc_project_media ?? [])].sort((a, b) => a.sort_order - b.sort_order));
    setRemovedMedia([]);
    setError(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const combined = [...files, ...picked];
    if (keptMedia.length + combined.length > MAX_FILES) {
      setError(`Up to ${MAX_FILES} photos and videos per project.`);
      setInputKey((k) => k + 1);
      return;
    }
    const tooBig = picked.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`"${tooBig.name}" is over ${MAX_MB} MB.`);
      setInputKey((k) => k + 1);
      return;
    }
    setError(null);
    setFiles(combined);
    setInputKey((k) => k + 1);
  }

  async function uploadFiles(projectId: string, startOrder: number) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(`Uploading ${i + 1} of ${files.length}…`);
      const isVideo = file.type.startsWith("video/");
      const ext = file.name.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg");
      const path = `${userId}/projects/${projectId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("portfolio")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw new Error(`"${file.name}" didn't upload: ${uploadError.message}`);

      await supabase.from("gc_project_media").insert({
        project_id: projectId,
        kind: isVideo ? "video" : "photo",
        storage_path: path,
        sort_order: startOrder + i,
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (keptMedia.length + files.length === 0) {
      setError("Add at least one photo of the finished project.");
      return;
    }
    setError(null);

    const fields = {
      title,
      category_id: categoryId ? Number(categoryId) : null,
      scope,
      neighborhood: neighborhood || null,
      completed_on: month ? `${month}-01` : null,
      final_cost_cents: cost ? Math.round(Number(cost) * 100) : null,
      duration_weeks: weeks ? Number(weeks) : null,
      included: included || null,
    };

    try {
      if (editingId) {
        setStatus("Saving changes…");
        const { error: updateError } = await supabase.from("gc_projects").update(fields).eq("id", editingId);
        if (updateError) throw new Error(updateError.message);

        if (removedMedia.length) {
          await supabase.storage.from("portfolio").remove(removedMedia.map((m) => m.storage_path));
          await supabase.from("gc_project_media").delete().in("id", removedMedia.map((m) => m.id));
        }
        const nextOrder = keptMedia.length ? Math.max(...keptMedia.map((m) => m.sort_order)) + 1 : 0;
        await uploadFiles(editingId, nextOrder);
      } else {
        setStatus("Saving project…");
        const { data: created, error: insertError } = await supabase
          .from("gc_projects")
          .insert({ pro_id: userId, ...fields })
          .select("id")
          .single();
        if (insertError || !created) throw new Error(insertError?.message ?? "Couldn't save the project.");
        await uploadFiles(created.id, 0);
      }

      setStatus(null);
      resetForm();
      await loadProjects(userId);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      await loadProjects(userId);
    }
  }

  async function handleDelete(p: Project) {
    if (!userId) return;
    if (!confirm(`Remove "${p.title}" and its photos?`)) return;
    const paths = (p.gc_project_media ?? []).map((m) => m.storage_path);
    if (paths.length) await supabase.storage.from("portfolio").remove(paths);
    await supabase.from("gc_projects").delete().eq("id", p.id);
    if (editingId === p.id) resetForm();
    await loadProjects(userId);
  }

  const busy = status !== null;
  const totalMedia = keptMedia.length + files.length;
  const thumb = "aspect-square w-full rounded-lg object-cover";
  const xButton =
    "press absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-sm font-bold text-[var(--ink)] shadow";

  if (userId && !takesProjects) {
    return (
      <main className="page">
        <h1 className="h1">Projects</h1>
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">
          This is for contractors who take on whole projects. Turn it on in{" "}
          <Link href="/pro/setup" className="link">business details</Link> and your profile will lead with past
          projects and what they cost, instead of a rate card.
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">Projects you've finished</h1>
        <p className="lede">
          For whole-project work, what a homeowner wants to know is what jobs like theirs actually cost and how
          long they took. Three real bathrooms tell them more than a starting price.
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">No projects yet. Add your first one below.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {projects.map((p, i) => {
            const cover = [...(p.gc_project_media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
            return (
              <article
                key={p.id}
                className={`rise flex gap-4 rounded-2xl border bg-[var(--card)] p-4 ${
                  editingId === p.id ? "border-[var(--rust)]" : "border-[var(--line)]"
                }`}
                style={{ animationDelay: `${0.04 * i}s` }}
              >
                <div className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-[var(--sand)]">
                  {cover && (
                    cover.kind === "video" ? (
                      <video src={mediaUrl(cover.storage_path)} className="h-full w-full bg-[var(--dark)] object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={mediaUrl(cover.storage_path)} alt="" className="h-full w-full object-cover" />
                    )
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] font-semibold">{p.title}</span>
                  <span className="hint">
                    {[p.neighborhood, monthLabel(p.completed_on)].filter(Boolean).join(", ")}
                  </span>
                  <span className="text-sm font-semibold">
                    {[
                      p.final_cost_cents ? money(p.final_cost_cents) : null,
                      p.duration_weeks ? `${p.duration_weeks} weeks` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No cost listed"}
                  </span>
                  <div className="flex gap-4 pt-1">
                    <button type="button" onClick={() => startEditing(p)} className="text-xs font-semibold text-[var(--rust)] underline">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(p)} className="text-xs font-medium text-[#8a2e08] underline">
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex scroll-mt-20 flex-col gap-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="h2">{editingId ? "Edit project" : "Add a project"}</h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm font-medium text-[var(--ink-soft)] underline">
              Cancel
            </button>
          )}
        </div>

        <label className="field">
          What was it?
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Full bathroom gut, 1920s rowhouse" required />
        </label>

        <label className="field">
          Type of project
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose one</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          Scope of work
          <textarea
            className="area"
            rows={4}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            required
            placeholder="What you did, what you found once you opened it up, and anything that changed along the way."
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Final cost ($) <span className="hint">What they actually paid</span>
            <input className="input" type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <label className="field">
            How many weeks?
            <input className="input" type="number" min={1} value={weeks} onChange={(e) => setWeeks(e.target.value)} />
          </label>
        </div>

        <label className="field">
          What was included <span className="hint">Optional. Helps explain the number.</span>
          <input className="input" value={included} onChange={(e) => setIncluded(e.target.value)} placeholder="e.g. Labor, materials, permit, mid-range fixtures" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Neighborhood
            <input className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="e.g. Capitol Hill" />
          </label>
          <label className="field">
            Finished
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="media" className="text-sm font-semibold">Photos and videos</label>
            <span className="hint">{totalMedia} of {MAX_FILES}</span>
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
                  <button
                    type="button"
                    aria-label="Remove this file"
                    onClick={() => {
                      setKeptMedia((prev) => prev.filter((x) => x.id !== m.id));
                      setRemovedMedia((prev) => [...prev, m]);
                    }}
                    className={xButton}
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.map((f, i) => (
                <div key={`new-${i}`} className="relative">
                  {f.type.startsWith("video/") ? (
                    <div className={`${thumb} flex items-center justify-center bg-[var(--dark)] text-[11px] text-white`}>Video</div>
                  ) : (
                    <img src={URL.createObjectURL(f)} alt={f.name} className={thumb} />
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-[var(--rust)] px-1.5 py-0.5 text-[10px] font-medium text-white">New</span>
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
          <span className="hint">Before and after shots work best. The first one is the cover.</span>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={busy || !userId} className="btn btn-primary">
          {status ?? (editingId ? "Save changes" : "Add project")}
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