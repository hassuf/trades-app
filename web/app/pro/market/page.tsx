"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, money, type RateItem } from "@/lib/format";

type Line = {
  item: RateItem;
  tradeName: string;
  others: number[];      // other pros' starting prices for the same job
  proCount: number;
  cheaper: number;       // how many are below you
};

type Gap = { title: string; tradeName: string; count: number; typical: string };

export default function MarketPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [tradeNames, setTradeNames] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      const me = auth.user.id;

      const { data: proRow } = await supabase.from("pros").select("id").eq("id", me).maybeSingle();
      if (!proRow) {
        setIsPro(false);
        setLoading(false);
        return;
      }
      setIsPro(true);

      // Which trades I'm in.
      const { data: mine } = await supabase
        .from("pro_categories")
        .select("category_id, categories(name)")
        .eq("pro_id", me);
      const myTradeIds = (mine ?? []).map((m: any) => m.category_id);
      const nameById: Record<number, string> = {};
      (mine ?? []).forEach((m: any) => {
        if (m.categories?.name) nameById[m.category_id] = m.categories.name;
      });
      setTradeNames(Object.values(nameById));

      if (myTradeIds.length === 0) {
        setLoading(false);
        return;
      }

      // Everyone in those trades, and what they charge.
      const { data: peers } = await supabase
        .from("pro_categories")
        .select("pro_id, category_id, pros(rate_items(id, title, description, unit, size_tier, price_min_cents, price_max_cents, category_id))")
        .in("category_id", myTradeIds);

      // Collect every flat-price line by job title, within each trade.
      type Bucket = { proIds: Set<string>; prices: number[]; tradeId: number };
      const market: Record<string, Bucket> = {};

      (peers ?? []).forEach((row: any) => {
        const rates: RateItem[] = row.pros?.rate_items ?? [];
        rates.forEach((r: any) => {
          if (r.unit !== "flat") return;
          // Only count a line if it belongs to this trade.
          if (r.category_id && r.category_id !== row.category_id) return;
          const key = `${row.category_id}::${r.title.trim().toLowerCase()}`;
          market[key] ??= { proIds: new Set(), prices: [], tradeId: row.category_id };
          market[key].proIds.add(row.pro_id);
          market[key].prices.push(r.price_min_cents);
        });
      });

      // My own rate card.
      const { data: myRates } = await supabase
        .from("rate_items")
        .select("*")
        .eq("pro_id", me)
        .order("sort_order")
        .order("created_at");

      const myLines: Line[] = [];
      const myTitles = new Set<string>();

      ((myRates as RateItem[]) ?? []).forEach((item: any) => {
        if (item.unit !== "flat") return;
        const tradeId = item.category_id ?? myTradeIds[0];
        const key = `${tradeId}::${item.title.trim().toLowerCase()}`;
        myTitles.add(key);
        const bucket = market[key];
        if (!bucket) {
          myLines.push({ item, tradeName: nameById[tradeId] ?? "", others: [], proCount: 1, cheaper: 0 });
          return;
        }
        // Prices from everyone except me.
        const others = bucket.prices.filter((p, i) => true);
        const cheaper = others.filter((p) => p < item.price_min_cents).length;
        myLines.push({
          item,
          tradeName: nameById[tradeId] ?? "",
          others,
          proCount: bucket.proIds.size,
          cheaper,
        });
      });

      setLines(myLines);

      // Jobs others price that I don't.
      const gapList: Gap[] = Object.entries(market)
        .filter(([key, b]) => !myTitles.has(key) && b.proIds.size >= 2)
        .map(([key, b]) => {
          const title = key.split("::")[1];
          const sorted = [...b.prices].sort((a, x) => a - x);
          const mid = sorted[Math.floor(sorted.length / 2)];
          return {
            title: title.charAt(0).toUpperCase() + title.slice(1),
            tradeName: nameById[b.tradeId] ?? "",
            count: b.proIds.size,
            typical: money(mid),
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      setGaps(gapList);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <main className="page">
        <p className="text-sm text-[var(--ink-faint)]">Loading…</p>
      </main>
    );
  }

  if (!isPro) {
    return (
      <main className="page">
        <h1 className="h1">Where your prices sit</h1>
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">
          This is for trades listed on FairWork.{" "}
          <Link href="/pro/setup" className="link">Set up your listing</Link> to see it.
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-2">
        <h1 className="h1">Where your prices sit</h1>
        <p className="lede">
          What others in {tradeNames.join(" and ") || "your trade"} publish for the same jobs near you. Nobody
          is named, and nobody sees your position but you.
        </p>
      </div>

      {lines.length === 0 && (
        <p className="panel p-5 text-sm text-[var(--ink-faint)]">
          Nothing to compare yet. Add some fixed prices to your{" "}
          <Link href="/pro/rates" className="link">rate card</Link> and they'll show up here.
        </p>
      )}

      {/* Your lines, with the local range */}
      <div className="flex flex-col gap-4">
        {lines.map((line, i) => {
          const { item, others, proCount, cheaper } = line;
          const mine = item.price_min_cents;
          const all = [...others, mine];
          const low = Math.min(...all);
          const high = Math.max(...all);
          const span = Math.max(high - low, 1);
          const myPos = ((mine - low) / span) * 100;
          const alone = proCount <= 1 || others.length === 0;

          // A plain reading of where they sit.
          const verdict = alone
            ? "You're the only one publishing a price for this."
            : cheaper === 0
            ? "You're the lowest published price for this job."
            : cheaper === others.length
            ? "You're the highest published price for this job."
            : `${cheaper} of ${others.length} others are below you.`;

          return (
            <section
              key={item.id}
              className="rise flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 lg:p-5"
              style={{ animationDelay: `${0.04 * i}s` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15.5px] font-semibold">{item.title}</span>
                  <span className="hint">
                    {line.tradeName}
                    {item.description ? ` · ${item.description}` : ""}
                  </span>
                </div>
                <span className="font-display shrink-0 text-[17px] font-extrabold">{formatPrice(item)}</span>
              </div>

              {!alone && (
                <>
                  {/* Range bar */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="relative h-1.5 rounded-full bg-[var(--sand)]">
                      <span
                        className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-[var(--rust)] bg-[var(--card)]"
                        style={{ left: `calc(${myPos}% - 8px)` }}
                      />
                      {others.map((p, n) => (
                        <span
                          key={n}
                          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#9c958a]"
                          style={{ left: `calc(${((p - low) / span) * 100}% - 4px)` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[11.5px] text-[var(--ink-faint)]">
                      <span>{money(low)}</span>
                      <span>{money(high)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-soft)] pt-3">
                    <span className="text-[13px] font-medium text-[var(--ink)]">{verdict}</span>
                    <span className="hint">{proCount} trades price this</span>
                  </div>
                </>
              )}

              {alone && (
                <p className="border-t border-[var(--line-soft)] pt-3 text-[13px] text-[var(--ink-soft)]">
                  {verdict} That's not a bad thing, it just means there's nothing to compare against yet.
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* Jobs others price that you don't */}
      {gaps.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="h2">Jobs others price that you don't</h2>
            <p className="hint">
              Homeowners search by job. If it's not on your rate card, you don't come up.
            </p>
          </div>
          <div className="panel">
            {gaps.map((g, i) => (
              <div
                key={g.title + i}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  i < gaps.length - 1 ? "border-b border-[var(--line-soft)]" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-medium">{g.title}</span>
                  <span className="hint">
                    {g.tradeName} · {g.count} trades price it
                  </span>
                </div>
                <span className="shrink-0 text-sm font-semibold">{g.typical}</span>
              </div>
            ))}
          </div>
          <Link href="/pro/rates" className="link">Add to your rate card</Link>
        </section>
      )}

      <p className="rounded-2xl bg-[var(--sand)] p-4 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
        Being the cheapest isn't the goal. Homeowners here can see your past work and your reviews next to your
        price, and most of them pick on trust rather than the lowest number. This is just so you're not pricing
        blind.
      </p>
    </main>
  );
}