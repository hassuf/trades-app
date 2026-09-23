"use client";

import { useState } from "react";
import Link from "next/link";
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

  return (
    <main className="page">
      <h1 className="h1">Log in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-sm text-[var(--ink-soft)]">
        New here?{" "}
        <Link href="/signup" className="link">
          Create an account
        </Link>
      </p>
    </main>
  );
}