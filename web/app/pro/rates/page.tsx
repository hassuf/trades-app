"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, tierLabel, type RateItem } from "@/lib/format";

type Category = { id: number; name: string };
type Tier = "" | "small" | "medium" | "large";

const tierHints: Record<string, string> = {
  small: "A few hours",
  medium: "A day or two",
  large: "Multi-day project",
};

export default function RatesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<RateItem[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState<"flat" | "hourly">("flat");
  const [tier, setTier] = useState<Tier>("");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadItems(id: string) {
    const { data } = await supabase
      .from("rate_items")
      .select("*")
      .eq("pro_id", id)
      .order("sort_order")
      .order("created_at");
    setItems(data ?? []);
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

      await loadItems(auth.user.id);
    }
    load();
  }, []);

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategoryId("");
    setUnit("flat");
    setTier("");
    setPriceFrom("");
    setPriceTo("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const min = Math.round(Number(priceFrom) * 100);
    const max = unit === "flat" && priceTo ? Math.round(Number(priceTo) * 100) : null;

    if (!priceFrom || isNaN(min) || min < 0) {
      setError("Enter a starting price.");
      return;
    }
    if (max !== null && max < min) {
      setError("The top of your price range can't be lower than the bottom.");
      return;
    }

    setError(null);
    setSaving(true);
    const { error: insertError } = await supabase.from("rate_items").insert({
      pro_id: userId,
      title,
      description: description || null,
      category_id: categoryId ? Number(categoryId) : null,
      unit,
      size_tier: unit === "flat" && tier ? tier : null,
      price_min_cents: min,
      price_max_cents: max,
      sort_order: items.length,
    });
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    resetForm();
    await loadItems(userId);
  }

  async function handleDelete(item: RateItem) {
    if (!userId) return;
    if (!confirm(`Remove "${item.title}" from your rate card?`)) return;
    await supabase.from("rate_items").delete().eq("id", item.id);
    await loadItems(userId);
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">Your rate card</h1>
        <p className="lede">
          List the jobs you do most with a price range. Homeowners see these before they message you, and the
          final price is always confirmed on site.
        </p>
      </div>

      {/* Current rate card */}
      <section className="panel">
        {items.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--ink-faint)]">Nothing listed yet. Add your first job below.</p>
        ) : (
          items.map((item, i) => (
            <div key={item.id} className="rise row" style={{ animationDelay: `${0.04 * i}s` }}>
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">{item.title}</span>
                {item.description && <span className="hint">{item.description}</span>}
                {item.size_tier && (
                  <span className="w-fit rounded-full bg-[var(--paper)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-soft)]">
                    {tierLabel[item.size_tier]}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[15px] font-semibold">{formatPrice(item)}</span>
                <button type="button" onClick={() => handleDelete(item)} className="text-xs font-medium text-[#8a2e08] underline">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Add a line */}
      <form onSubmit={handleAdd} className="flex flex-col gap-5">
        <h2 className="h2">Add a job</h2>

        <label className="field">
          Job name
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Add a new outlet" required />
        </label>

        <label className="field">
          Details <span className="hint">Optional. What's included or assumed.</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Existing circuit, finished wall" />
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

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">How do you charge for it?</legend>
          <div className="flex gap-2">
            <button type="button" aria-pressed={unit === "flat"} onClick={() => setUnit("flat")} className={`pill ${unit === "flat" ? "pill-on" : ""}`}>
              Price for the job
            </button>
            <button type="button" aria-pressed={unit === "hourly"} onClick={() => setUnit("hourly")} className={`pill ${unit === "hourly" ? "pill-on" : ""}`}>
              Hourly rate
            </button>
          </div>
        </fieldset>

        {unit === "flat" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">
              Job size <span className="hint">Shown on your browse card.</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {(["small", "medium", "large"] as Tier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tier === t}
                  onClick={() => setTier(tier === t ? "" : t)}
                  className={`pill capitalize ${tier === t ? "pill-on" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tier && <span className="hint">{tierHints[tier]}</span>}
          </fieldset>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            {unit === "hourly" ? "Rate per hour ($)" : "Price from ($)"}
            <input className="input" type="number" min={0} step="1" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)} required />
          </label>
          {unit === "flat" && (
            <label className="field">
              Up to ($)
              <input className="input" type="number" min={0} step="1" value={priceTo} onChange={(e) => setPriceTo(e.target.value)} placeholder="Optional" />
            </label>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving || !userId} className="btn btn-primary">
          {saving ? "Adding…" : "Add to rate card"}
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