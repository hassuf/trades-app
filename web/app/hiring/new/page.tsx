"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: number; name: string };

export default function NewHirePage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hireType, setHireType] = useState<"subcontract" | "employee" | "day_rate">("subcontract");
  const [payUnit, setPayUnit] = useState<"hourly" | "daily" | "per_job" | "salary">("hourly");
  const [payMin, setPayMin] = useState("");
  const [payMax, setPayMax] = useState("");
  const [zip, setZip] = useState("");
  const [starts, setStarts] = useState("");
  const [duration, setDuration] = useState("");
  const [needsLicense, setNeedsLicense] = useState(false);
  const [needsInsurance, setNeedsInsurance] = useState(false);
  const [needsTools, setNeedsTools] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      setUserId(auth.user.id);

      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .order("sort_order")
        .order("id");
      setCategories(cats ?? []);

      const { data: pro } = await supabase.from("pros").select("service_zip").eq("id", auth.user.id).maybeSingle();
      if (pro?.service_zip) setZip(pro.service_zip);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const min = payMin ? Math.round(Number(payMin) * 100) : null;
    const max = payMax ? Math.round(Number(payMax) * 100) : null;
    if (min !== null && max !== null && max < min) {
      setError("The top of the pay range can't be lower than the bottom.");
      return;
    }
    setError(null);
    setSaving(true);

    const { error: insertError } = await supabase.from("hire_posts").insert({
      poster_id: userId,
      category_id: Number(categoryId),
      title,
      description,
      hire_type: hireType,
      pay_unit: payUnit,
      pay_min_cents: min,
      pay_max_cents: max,
      zip,
      starts: starts || null,
      duration: duration || null,
      needs_license: needsLicense,
      needs_insurance: needsInsurance,
      needs_tools: needsTools,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push("/hiring/mine");
  }

  const payLabel =
    payUnit === "hourly" ? "per hour" : payUnit === "daily" ? "per day" : payUnit === "salary" ? "per year" : "for the job";

  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">Post a role</h1>
        <p className="lede">
          Looking for a sub, a second pair of hands, or someone full time? Post what you need and pros in that
          trade will see it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <label className="field">
          What trade do you need?
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">Choose one</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">What kind of arrangement?</legend>
          <div className="flex flex-wrap gap-2">
            {([
              ["subcontract", "Subcontract"],
              ["day_rate", "Day work"],
              ["employee", "Employee"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={hireType === value}
                onClick={() => setHireType(value)}
                className={`pill ${hireType === value ? "pill-on" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          Role title
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Electrician for a three-week rowhouse gut"
            required
          />
        </label>

        <label className="field">
          What's the work?
          <textarea
            className="area"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="The scope, what's already done, how many people are on site, and what you expect them to bring."
          />
        </label>

        <div className="flex flex-col gap-3">
          <label className="field">
            How is it paid?
            <select className="input" value={payUnit} onChange={(e) => setPayUnit(e.target.value as any)}>
              <option value="hourly">Hourly</option>
              <option value="daily">Day rate</option>
              <option value="per_job">Fixed for the job</option>
              <option value="salary">Salary</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              From ($) <span className="hint">{payLabel}</span>
              <input className="input" type="number" min={0} value={payMin} onChange={(e) => setPayMin(e.target.value)} required />
            </label>
            <label className="field">
              Up to ($)
              <input className="input" type="number" min={0} value={payMax} onChange={(e) => setPayMax(e.target.value)} placeholder="Optional" />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Starts
            <input className="input" value={starts} onChange={(e) => setStarts(e.target.value)} placeholder="e.g. Next week" />
          </label>
          <label className="field">
            How long?
            <input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. Three weeks" />
          </label>
        </div>

        <label className="field">
          ZIP code of the site
          <input className="input" inputMode="numeric" value={zip} onChange={(e) => setZip(e.target.value)} required />
        </label>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1 text-sm font-semibold">What do they need to bring?</legend>
          <label className="flex items-center gap-3 text-[15px]">
            <input type="checkbox" checked={needsLicense} onChange={(e) => setNeedsLicense(e.target.checked)} className="h-5 w-5 accent-[var(--rust)]" />
            Their own license
          </label>
          <label className="flex items-center gap-3 text-[15px]">
            <input type="checkbox" checked={needsInsurance} onChange={(e) => setNeedsInsurance(e.target.checked)} className="h-5 w-5 accent-[var(--rust)]" />
            Their own insurance
          </label>
          <label className="flex items-center gap-3 text-[15px]">
            <input type="checkbox" checked={needsTools} onChange={(e) => setNeedsTools(e.target.checked)} className="h-5 w-5 accent-[var(--rust)]" />
            Their own tools and transport
          </label>
        </fieldset>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving || !userId} className="btn btn-primary">
          {saving ? "Posting…" : "Post this role"}
        </button>
        <span className="hint -mt-4 text-center">Free to post. No fee to apply.</span>
      </form>
    </main>
  );
}