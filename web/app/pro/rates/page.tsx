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

  const input =
    "h-12 w-full rounded-xl border border-[#D9D3C6] bg-white px-3 text-[15px] font-normal text-[#1C1B19] outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20";
  const pill = (on: boolean) =>
    `h-10 rounded-full border px-4 text-sm font-medium ${
      on ? "border-[#1C1B19] bg-[#1C1B19] text-white" : "border-[#D9D3C6] bg-white text-[#1C1B19]"
    }`;

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Your rate card</h1>
          <p className="text-[15px] text-[#4A4740]">
            List the jobs you do most with a price range. Homeowners see these before they message you,
            and the final price is always confirmed on site.
          </p>
        </div>

        {/* Current rate card */}
        <section className="flex flex-col rounded-2xl border border-[#E2DCCF] bg-white px-5 py-2">
          {items.length === 0 ? (
            <p className="py-4 text-sm text-[#5C584F]">Nothing listed yet. Add your first job below.</p>
          ) : (
            items.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 py-4 ${
                  i < items.length - 1 ? "border-b border-[#EDE8DD]" : ""
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold">{item.title}</span>
                  {item.description && <span className="text-xs text-[#5C584F]">{item.description}</span>}
                  {item.size_tier && (
                    <span className="w-fit rounded-full bg-[#F4F1EA] px-2 py-0.5 text-[11px] font-medium text-[#4A4740]">
                      {tierLabel[item.size_tier]}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[15px] font-semibold">{formatPrice(item)}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="text-xs font-medium text-[#8A2E08] underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Add a line */}
        <form onSubmit={handleAdd} className="flex flex-col gap-5">
          <h2 className="text-lg font-bold">Add a job</h2>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Job name
            <input
              className={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add a new outlet"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Details <span className="text-xs font-normal text-[#5C584F]">Optional. What's included or assumed.</span>
            <input
              className={input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Existing circuit, finished wall"
            />
          </label>

          {categories.length > 0 && (
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Type of work
              <select className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
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
              <button type="button" aria-pressed={unit === "flat"} onClick={() => setUnit("flat")} className={pill(unit === "flat")}>
                Price for the job
              </button>
              <button type="button" aria-pressed={unit === "hourly"} onClick={() => setUnit("hourly")} className={pill(unit === "hourly")}>
                Hourly rate
              </button>
            </div>
          </fieldset>

          {unit === "flat" && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">
                Job size <span className="font-normal text-[#5C584F]">(shown on your browse card)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {(["small", "medium", "large"] as Tier[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tier === t}
                    onClick={() => setTier(tier === t ? "" : t)}
                    className={pill(tier === t)}
                  >
                    {tierLabel[t as string].replace(" job", "")}
                  </button>
                ))}
              </div>
              {tier && <span className="text-xs text-[#5C584F]">{tierHints[tier]}</span>}
            </fieldset>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              {unit === "hourly" ? "Rate per hour ($)" : "Price from ($)"}
              <input
                className={input}
                type="number"
                min={0}
                step="1"
                value={priceFrom}
                onChange={(e) => setPriceFrom(e.target.value)}
                required
              />
            </label>
            {unit === "flat" && (
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Up to ($) <span className="sr-only">optional</span>
                <input
                  className={input}
                  type="number"
                  min={0}
                  step="1"
                  value={priceTo}
                  onChange={(e) => setPriceTo(e.target.value)}
                  placeholder="Optional"
                />
              </label>
            )}
          </div>

          {error && <p className="rounded-lg bg-[#FBE9E2] px-3 py-2 text-sm text-[#8A2E08]">{error}</p>}

          <button
            type="submit"
            disabled={saving || !userId}
            className="h-12 rounded-xl bg-[#B43C0A] text-base font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add to rate card"}
          </button>
        </form>

        {userId && (
          <Link href={`/pros/${userId}`} className="text-sm font-semibold text-[#B43C0A] underline">
            View my profile
          </Link>
        )}
      </div>
    </main>
  );
}