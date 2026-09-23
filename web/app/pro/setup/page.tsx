"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = { id: number; name: string };

export default function ProSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [picked, setPicked] = useState<number[]>([]);

  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("15");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [insured, setInsured] = useState(false);

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

      const { data: cats } = await supabase.from("categories").select("id, name").order("id");
      setCategories(cats ?? []);

      const { data: pro } = await supabase.from("pros").select("*").eq("id", auth.user.id).maybeSingle();
      if (pro) {
        setBusinessName(pro.business_name ?? "");
        setBio(pro.bio ?? "");
        setYears(pro.years_experience?.toString() ?? "");
        setZip(pro.service_zip ?? "");
        setRadius(pro.service_radius_miles?.toString() ?? "15");
        setLicenseNumber(pro.license_number ?? "");
        setLicenseState(pro.license_state ?? "");
        setInsured(pro.insured ?? false);
      }

      const { data: mine } = await supabase.from("pro_categories").select("category_id").eq("pro_id", auth.user.id);
      setPicked((mine ?? []).map((m) => m.category_id));
    }
    load();
  }, []);

  function toggleCategory(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (picked.length === 0) {
      setError("Pick at least one type of work you do.");
      return;
    }
    setError(null);
    setSaving(true);

    const { error: proError } = await supabase.from("pros").upsert({
      id: userId,
      business_name: businessName || null,
      bio: bio || null,
      years_experience: years ? Number(years) : null,
      service_zip: zip,
      service_radius_miles: Number(radius),
      license_number: licenseNumber || null,
      license_state: licenseState || null,
      insured,
    });
    if (proError) {
      setSaving(false);
      setError(proError.message);
      return;
    }

    await supabase.from("pro_categories").delete().eq("pro_id", userId);
    const { error: catError } = await supabase
      .from("pro_categories")
      .insert(picked.map((category_id) => ({ pro_id: userId, category_id })));

    setSaving(false);
    if (catError) {
      setError(catError.message);
      return;
    }
    router.push(`/pros/${userId}`);
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">Set up your business</h1>
        <p className="lede">This is what homeowners see on your profile. You can change it any time.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-sm font-semibold">What work do you do?</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = picked.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCategory(c.id)}
                  className={`pill ${on ? "pill-on" : ""}`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="field">
          Business name <span className="hint">Leave blank to use your own name.</span>
          <input className="input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </label>

        <label className="field">
          About your work
          <textarea
            className="area"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you specialize in, how long you've done it, what customers can expect."
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="field">
            Years of experience
            <input className="input" type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} />
          </label>
          <label className="field">
            Your ZIP code
            <input className="input" inputMode="numeric" value={zip} onChange={(e) => setZip(e.target.value)} required />
          </label>
        </div>

        <label className="field">
          How far will you travel?
          <select className="input" value={radius} onChange={(e) => setRadius(e.target.value)}>
            {["5", "10", "15", "25", "40"].map((m) => (
              <option key={m} value={m}>
                {m} miles
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-[1fr_96px] gap-3">
          <label className="field">
            License number
            <input className="input" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </label>
          <label className="field">
            State
            <input
              className="input"
              maxLength={2}
              placeholder="DC"
              value={licenseState}
              onChange={(e) => setLicenseState(e.target.value.toUpperCase())}
            />
          </label>
        </div>

        <label className="flex items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={insured}
            onChange={(e) => setInsured(e.target.checked)}
            className="h-5 w-5 accent-[var(--rust)]"
          />
          I carry liability insurance
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving || !userId} className="btn btn-primary">
          {saving ? "Saving…" : "Save and view my profile"}
        </button>
      </form>
    </main>
  );
}