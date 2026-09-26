import Link from "next/link";
import { jobMediaUrl, money, timingLabel } from "@/lib/format";

type Job = {
  id: string;
  description: string;
  size_tier: string;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  timing: string;
  zip: string;
  created_at: string;
  categories: { name: string } | null;
  job_post_media: { id: string; kind: string; storage_path: string }[];
  quotes: { id: string }[];
};

type Role = {
  id: string;
  title: string;
  description: string;
  hire_type: string;
  pay_unit: string;
  pay_min_cents: number | null;
  pay_max_cents: number | null;
  zip: string;
  starts: string | null;
  categories: { name: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  subcontract: "Subcontract",
  employee: "Employee",
  day_rate: "Day work",
};

function budget(j: Job) {
  if (j.budget_min_cents && j.budget_max_cents)
    return `${money(j.budget_min_cents)}–${money(j.budget_max_cents).slice(1)}`;
  if (j.budget_min_cents) return `${money(j.budget_min_cents)}+`;
  if (j.budget_max_cents) return `Up to ${money(j.budget_max_cents)}`;
  return "No budget set";
}

function pay(r: Role) {
  if (!r.pay_min_cents) return "Pay not listed";
  const unit =
    r.pay_unit === "hourly" ? "/hr" : r.pay_unit === "daily" ? "/day" : r.pay_unit === "salary" ? "/yr" : "";
  const base =
    r.pay_max_cents && r.pay_max_cents !== r.pay_min_cents
      ? `${money(r.pay_min_cents)}–${money(r.pay_max_cents).slice(1)}`
      : money(r.pay_min_cents);
  return base + unit;
}

export default function TradeHome({ jobs, roles }: { jobs: Job[]; roles: Role[] }) {
  return (
    <>
      {/* Hero */}
      <section className="hero-pattern bg-[var(--dark)] text-[#fbf8f1]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-8 lg:px-14 lg:py-12">
          <h1 className="rise font-display text-[28px] font-extrabold leading-[1.1] lg:text-[44px]">
            Work near you, no lead fees
          </h1>
          <p className="rise max-w-[620px] text-sm leading-relaxed text-[#d8d2c4] lg:text-[17px]" style={{ animationDelay: "0.07s" }}>
            Homeowners post what they need and you quote it. Nobody buys the lead, nobody races you to the
            phone, and you only pay a share once a job is done.
          </p>
          <div className="rise flex flex-wrap gap-2.5 pt-1" style={{ animationDelay: "0.14s" }}>
            <Link href="/pro/jobs-available" className="press rounded-xl bg-[var(--rust)] px-5 py-3 text-sm font-semibold text-white no-underline">
              See all open jobs
            </Link>
            <Link href="/pro/rates" className="press rounded-xl border border-[#fbf8f1] px-5 py-3 text-sm font-semibold text-[#fbf8f1] no-underline">
              Update your rates
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1440px] flex-col gap-10 px-5 py-8 lg:px-14 lg:py-11">
        {/* Open jobs */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-extrabold lg:text-[22px]">Homeowners looking now</h2>
            <Link href="/pro/jobs-available" className="link">See all</Link>
          </div>

          {jobs.length === 0 ? (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
              Nothing open right now. Make sure your trades are up to date in{" "}
              <Link href="/pro/setup" className="link">business details</Link>.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {jobs.map((j, i) => {
                const photo = j.job_post_media?.find((m) => m.kind === "photo");
                const count = j.quotes?.length ?? 0;
                return (
                  <Link
                    key={j.id}
                    href="/pro/jobs-available"
                    className="card rise flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 no-underline"
                    style={{ animationDelay: `${0.04 * i}s` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-display text-[16px] font-extrabold text-[var(--ink)]">
                          {j.categories?.name ?? "Job"}
                        </span>
                        <span className="hint capitalize">
                          {j.size_tier} · {timingLabel[j.timing]} · {j.zip}
                        </span>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold text-[var(--ink)]">{budget(j)}</span>
                    </div>

                    <div className="flex gap-3">
                      {photo && (
                        <img src={jobMediaUrl(photo.storage_path)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                      )}
                      <p className="line-clamp-3 text-[13.5px] leading-relaxed text-[var(--ink)]">{j.description}</p>
                    </div>

                    <span className={`text-[12px] font-semibold ${count === 0 ? "text-[var(--forest)]" : "text-[var(--ink-faint)]"}`}>
                      {count === 0 ? "No quotes yet" : `${count} quote${count > 1 ? "s" : ""} in`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Hiring board */}
        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-lg font-extrabold lg:text-[22px]">Crews hiring</h2>
            <Link href="/hiring" className="link">See all</Link>
          </div>

          {roles.length === 0 ? (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
              No roles posted right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {roles.map((r, i) => (
                <Link
                  key={r.id}
                  href="/hiring"
                  className="card rise flex flex-col gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 no-underline"
                  style={{ animationDelay: `${0.04 * i}s` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-display text-[15.5px] font-extrabold leading-tight text-[var(--ink)]">
                      {r.title}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--ink)]">{pay(r)}</span>
                  </div>
                  <span className="hint">
                    {[r.categories?.name, TYPE_LABEL[r.hire_type], r.zip].filter(Boolean).join(" · ")}
                  </span>
                  <p className="line-clamp-2 text-[13.5px] leading-relaxed text-[var(--ink)]">{r.description}</p>
                  {r.starts && <span className="text-[12px] text-[var(--ink-faint)]">Starts {r.starts}</span>}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Your listing */}
        <section className="flex flex-col gap-3 rounded-2xl bg-[var(--sand)] p-5 lg:flex-row lg:items-center lg:justify-between lg:p-7">
          <div className="flex max-w-[560px] flex-col gap-1.5">
            <span className="font-display text-lg font-extrabold lg:text-xl">
              Homeowners find you by your prices
            </span>
            <span className="text-sm leading-relaxed text-[var(--ink-soft)]">
              The trades getting the most work here are the ones with a filled-in rate card and recent photos.
              It takes about ten minutes.
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2.5">
            <Link href="/pro/rates" className="press rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--card)] no-underline">
              Rate card
            </Link>
            <Link href="/pro/jobs" className="press rounded-xl border border-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] no-underline">
              Past jobs
            </Link>
          </div>
        </section>

        <p className="text-center text-sm text-[var(--ink-soft)]">
          Hiring someone yourself?{" "}
          <Link href="/hiring/new" className="link">Post a role</Link>
          {" · "}
          <Link href="/?view=homeowner" className="link">Browse trades instead</Link>
        </p>
      </div>
    </>
  );
}