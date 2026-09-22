"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setLoading(false);
      setError("That email and password don't match an account. Check them and try again.");
      return;
    }

    // Send pros to their profile, pros who haven't finished setup to the setup form,
    // and homeowners to the home page.
    const uid = data.user.id;
    const { data: pro } = await supabase.from("pros").select("id").eq("id", uid).maybeSingle();
    if (pro) {
      router.push(`/pros/${uid}`);
    } else {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      router.push(profile?.role === "homeowner" ? "/" : "/pro/setup");
    }
    router.refresh();
  }

  const input =
    "h-12 w-full rounded-xl border border-[#D9D3C6] bg-white px-3 text-[15px] font-normal text-[#1C1B19] outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20";

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Log in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Email
            <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Password
            <input
              className={input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="rounded-lg bg-[#FBE9E2] px-3 py-2 text-sm text-[#8A2E08]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-[#B43C0A] text-base font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-sm text-[#4A4740]">
          New here?{" "}
          <a href="/signup" className="font-semibold text-[#B43C0A] underline">
            Create an account
          </a>
        </p>
      </div>
    </main>
  );
}