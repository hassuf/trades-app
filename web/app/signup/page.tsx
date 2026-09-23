"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "pro" | "homeowner";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<Role>("pro");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    if (!data.session) {
      setError("Account created. Confirm your email, then log in.");
      return;
    }
    router.push(role === "pro" ? "/pro/setup" : "/");
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">Create your account</h1>
        <p className="lede">Pros list their rates and past work. Homeowners browse and book.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-[var(--sand)] p-1" role="radiogroup" aria-label="Account type">
        {(["pro", "homeowner"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={`press h-11 flex-1 rounded-lg text-sm font-semibold ${
              role === r ? "bg-[var(--card)] text-[var(--ink)]" : "text-[var(--ink-soft)]"
            }`}
          >
            {r === "pro" ? "I do the work" : "I need work done"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="field">
          Full name
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span className="hint">At least 8 characters.</span>
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-sm text-[var(--ink-soft)]">
        Already have an account?{" "}
        <Link href="/login" className="link">
          Log in
        </Link>
      </p>
    </main>
  );
}