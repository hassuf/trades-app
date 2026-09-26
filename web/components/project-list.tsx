import { mediaUrl, money, monthLabel } from "@/lib/format";

export type ProjectMedia = { id: string; kind: "photo" | "video"; storage_path: string; sort_order: number };
export type Project = {
  id: string;
  title: string;
  scope: string;
  neighborhood: string | null;
  completed_on: string | null;
  final_cost_cents: number | null;
  duration_weeks: number | null;
  included: string | null;
  categories: { name: string } | null;
  gc_project_media: ProjectMedia[];
};

// Group by project type so we can say "bathrooms: $9k–25k, 3–5 weeks, 6 done".
export function projectRanges(projects: Project[]) {
  const groups: Record<string, { costs: number[]; weeks: number[]; count: number }> = {};
  projects.forEach((p) => {
    const key = p.categories?.name ?? "Other work";
    groups[key] ??= { costs: [], weeks: [], count: 0 };
    groups[key].count += 1;
    if (p.final_cost_cents) groups[key].costs.push(p.final_cost_cents);
    if (p.duration_weeks) groups[key].weeks.push(p.duration_weeks);
  });

  return Object.entries(groups)
    .map(([name, g]) => ({
      name,
      count: g.count,
      cost:
        g.costs.length === 0
          ? null
          : g.costs.length === 1
          ? money(g.costs[0])
          : `${money(Math.min(...g.costs))}–${money(Math.max(...g.costs)).slice(1)}`,
      weeks:
        g.weeks.length === 0
          ? null
          : g.weeks.length === 1
          ? `${g.weeks[0]} weeks`
          : `${Math.min(...g.weeks)}–${Math.max(...g.weeks)} weeks`,
    }))
    .sort((a, b) => b.count - a.count);
}

export default function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <p className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 text-sm text-[var(--ink-faint)]">
        No projects posted yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {projects.map((p, i) => {
        const media = [...(p.gc_project_media ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        const cover = media[0];
        const rest = media.slice(1, 5);

        return (
          <article
            key={p.id}
            className="rise overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            {cover && (
              <div className="relative h-[210px] overflow-hidden bg-[var(--sand)] lg:h-[280px]">
                {cover.kind === "video" ? (
                  <video src={mediaUrl(cover.storage_path)} className="h-full w-full bg-[var(--dark)] object-cover" muted playsInline controls preload="metadata" />
                ) : (
                  <img src={mediaUrl(cover.storage_path)} alt={p.title} className="h-full w-full object-cover" />
                )}
              </div>
            )}

            {rest.length > 0 && (
              <div className="rail flex gap-2 px-4 pt-3">
                {rest.map((m) =>
                  m.kind === "video" ? (
                    <video key={m.id} src={mediaUrl(m.storage_path)} className="h-[72px] w-[96px] rounded-lg bg-[var(--dark)] object-cover" muted playsInline controls preload="metadata" />
                  ) : (
                    <img key={m.id} src={mediaUrl(m.storage_path)} alt="" className="h-[72px] w-[96px] rounded-lg object-cover" />
                  )
                )}
              </div>
            )}

            <div className="flex flex-col gap-3 p-4 lg:p-5">
              <div className="flex flex-col gap-1">
                <span className="font-display text-[18px] font-extrabold leading-tight lg:text-xl">{p.title}</span>
                <span className="hint">
                  {[p.categories?.name, p.neighborhood, monthLabel(p.completed_on)].filter(Boolean).join(" · ")}
                </span>
              </div>

              {/* The numbers, which are the point */}
              <div className="flex flex-wrap gap-2">
                {p.final_cost_cents && (
                  <span className="rounded-xl bg-[var(--paper)] px-3 py-2">
                    <span className="block text-[11px] font-medium text-[var(--ink-faint)]">Final cost</span>
                    <span className="font-display text-[17px] font-extrabold">{money(p.final_cost_cents)}</span>
                  </span>
                )}
                {p.duration_weeks && (
                  <span className="rounded-xl bg-[var(--paper)] px-3 py-2">
                    <span className="block text-[11px] font-medium text-[var(--ink-faint)]">Took</span>
                    <span className="font-display text-[17px] font-extrabold">{p.duration_weeks} weeks</span>
                  </span>
                )}
              </div>

              <p className="whitespace-pre-line text-[15px] leading-relaxed">{p.scope}</p>

              {p.included && (
                <p className="text-[13px] text-[var(--ink-soft)]">
                  <span className="font-semibold">Included:</span> {p.included}
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}