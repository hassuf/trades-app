"use client";

import { useState } from "react";
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

  const input =
    "h-12 w-full rounded-xl border border-[#D9D3C6] bg-white px-3 text-[15px] text-[#1C1B19] outline-none focus:border-[#B43C0A] focus:ring-2 focus:ring-[#B43C0A]/20";

  return (
    <main className="min-h-screen bg-[#F4F1EA] px-5 py-10 text-[#1C1B19]">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Create your account</h1>
          <p className="text-[15px] text-[#4A4740]">
            Pros list their rates and past work. Homeowners browse and book.
          </p>
        </div>

        <div className="flex gap-1 rounded-xl bg-[#E6E1D6] p-1" role="radiogroup" aria-label="Account type">
          {(["pro", "homeowner"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              onClick={() => setRole(r)}
              className={`h-11 flex-1 rounded-lg text-sm font-semibold ${
                role === r ? "bg-white text-[#1C1B19]" : "text-[#4A4740]"
              }`}
            >
              {r === "pro" ? "I do the work" : "I need work done"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Full name
            <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Email
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Password
            <input
              className={input}
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="text-xs font-normal text-[#5C584F]">At least 8 characters.</span>
          </label>

          {error && <p className="rounded-lg bg-[#FBE9E2] px-3 py-2 text-sm text-[#8A2E08]">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-xl bg-[#B43C0A] text-base font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
                <p className="text-sm text-[#4A4740]">
          Already have an account?{" "}
          <a href="/login" className="font-semibold text-[#B43C0A] underline">
            Log in
          </a>
        </p>
      </div>
    </main>
  );
}