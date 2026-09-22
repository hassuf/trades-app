export type RateItem = {
  id: string;
  title: string;
  description: string | null;
  unit: "flat" | "hourly";
  size_tier: "small" | "medium" | "large" | null;
  price_min_cents: number;
  price_max_cents: number | null;
};

export function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

// "$120–180", "$120", or "$95/hr"
export function formatPrice(item: RateItem) {
  const min = money(item.price_min_cents);
  if (item.unit === "hourly") return `${min}/hr`;
    if (!item.price_max_cents) return `${min}+`;
  if (item.price_max_cents !== item.price_min_cents) {
    return `${min}–${money(item.price_max_cents).slice(1)}`;
  }
  return min;

export const tierLabel: Record<string, string> = {
  small: "Small job",
  medium: "Medium job",
  large: "Large job",
};