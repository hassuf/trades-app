"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

type Row = {
  id: string;
  title: string;
  description: string;
  hire_type: string;
  pay_unit: string;
  pay_min_cents: number | null;
  pay_max_cents: number | null;
  zip: string;
  starts: string | null;
  duration: string | null;
  status: string;
  categories: { name: string } | null;
  hire_applications: { id: string; pro_id: string; message: string | null; created_at: string }[];
};

export default function MyRolesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("hire_posts")
      .select(
        `id, title, description, hire_type, pay_unit, pay_min_cents, pay_max_cents, zip, starts, duration, status,
         categories(name), hire_applications(id, pro_id, message, created_at)`
      )
      .eq("poster_id", auth.user.id)
      .order("created_at", { ascending: false });

    const list = (data as unknown as Row[]) ?? [];
    setRows(list);

    const proIds = list.flatMap((r) => (r.hire_applications ?? []).map((a) => a.pro_id));
    if (proIds.length) {
      const map: Record<string, string> = {};
      const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", proIds);
      (people ?? []).forEach((p) => {
        map[p.id] = p.full_name;
      });
      const { data: biz } = await supabase.from("pros").select("id, business_name").in("id", proIds);
      (biz ?? []).forEach((p) => {
        if (p.business_name) map[p.id] = p.business_name;
      });
      setNames(map);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await supabase.from("hire_posts").update({ status }).eq("id", id);
    await load();
  }

  function pay(r: Row) {
    if (!r.pay_min_cents) return "Pay not listed";
    const unit =
      r.pay_unit === "hourly" ? "/hr" : r.pay_unit === "daily" ? "/day" : r.pay_unit === "salary" ? "/yr" : "";
    const base =
      r.pay_max_cents && r.pay_max_cents !== r.pay_min_cents
        ? `${money(r.pay_min_cents)}–${money(r.pay_max_cents).slice(1)}`
        : money(r.pay_min_cents);
    return base + unit;
  }

  const typeLabel: Record<string, string> = {
    subcontract: "Subcontract",
    employee: "Employee",
    day_rate: "Day work",
  };

  return (
    <main className="page">
      <div className="flex items-start justify-between gap-4">
        <h1 className="h1">Roles you posted</h1>
        <Link href="/hiring/new" className="btn btn-primary btn-sm mt-1 flex shrink-0 items-center no-underline">
          Post a role
        </Link>
      </div>

      {rows === null && <p className="text-sm text-[var(--ink-faint)]">Loading…</p>}

      {rows?.length === 0 && (
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">
          You haven't posted any roles yet. Looking for a sub or a second pair of hands on a job?{" "}
          <Link href="/hiring/new" className="link">Post a role</Link>.
        </p>
      )}

      {rows?.map((r, i) => (
        <article
          key={r.id}
          className="rise flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
          style={{ animationDelay: `${0.05 * i}s` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[17px] font-extrabold">{r.title}</span>
              <span className="hint">
                {r.categories?.name} · {typeLabel[r.hire_type]} · {pay(r)} · {r.zip}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                r.status === "open" ? "bg-[#e4efe6] text-[var(--forest)]" : "bg-[var(--sand)] text-[var(--ink-soft)]"
              }`}
            >
              {r.status}
            </span>
          </div>

          <p className="line-clamp-3 text-sm leading-relaxed">{r.description}</p>

          <div className="border-t border-[var(--line-soft)] pt-3">
            <span className="text-sm font-semibold">
              {r.hire_applications?.length === 0
                ? "No applications yet"
                : `${r.hire_applications.length} applied`}
            </span>

            {r.hire_applications?.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-2.5">
                {r.hire_applications.map((a) => (
                  <div key={a.id} className="rounded-xl bg-[var(--paper)] p-3">
                    <Link href={`/pros/${a.pro_id}`} className="text-sm font-semibold text-[var(--rust)] underline">
                      {names[a.pro_id] ?? "A pro"}
                    </Link>
                    {a.message && <p className="mt-1 text-[13.5px] leading-relaxed">{a.message}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {r.status === "open" && (
              <>
                <button type="button" onClick={() => setStatus(r.id, "filled")} className="text-xs font-semibold text-[var(--rust)] underline">
                  Mark as filled
                </button>
                <button type="button" onClick={() => setStatus(r.id, "closed")} className="text-xs font-medium text-[#8a2e08] underline">
                  Close
                </button>
              </>
            )}
            {r.status !== "open" && (
              <button type="button" onClick={() => setStatus(r.id, "open")} className="text-xs font-semibold text-[var(--rust)] underline">
                Reopen
              </button>
            )}
          </div>
        </article>
      ))}
    </main>
  );
}