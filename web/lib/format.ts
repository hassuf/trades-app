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

// "$120–180", "$2,000+", "$150", or "$95/hr"
export function formatPrice(item: RateItem) {
  const min = money(item.price_min_cents);
  if (item.unit === "hourly") return `${min}/hr`;
  if (!item.price_max_cents) return `${min}+`;
  if (item.price_max_cents !== item.price_min_cents) {
    return `${min}–${money(item.price_max_cents).slice(1)}`;
  }
  return min;
}

export const tierLabel: Record<string, string> = {
  small: "Small job",
  medium: "Medium job",
  large: "Large job",
};

// Web address for an uploaded photo or video.
export function mediaUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/portfolio/${path}`;
}

// "2026-03-01" -> "Mar 2026"
export function monthLabel(date: string | null) {
  if (!date) return null;
  const [y, m] = date.split("-").map(Number);
  return new Date(y, m - 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}