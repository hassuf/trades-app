import { mediaUrl } from "@/lib/format";

export type Media = {
  id: string;
  kind: "photo" | "video";
  storage_path: string;
  sort_order: number;
};

export type PortfolioJob = {
  id: string;
  title: string;
  neighborhood: string | null;
  completed_on: string | null;
  description?: string | null;
  portfolio_media: Media[];
};

export function sortedMedia(job: PortfolioJob) {
  return [...(job.portfolio_media ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export function mediaSummary(job: PortfolioJob) {
  const media = job.portfolio_media ?? [];
  const photos = media.filter((m) => m.kind === "photo").length;
  const videos = media.filter((m) => m.kind === "video").length;
  const parts = [];
  if (photos) parts.push(`${photos} photo${photos > 1 ? "s" : ""}`);
  if (videos) parts.push(`${videos} video${videos > 1 ? "s" : ""}`);
  return parts.join(", ");
}

export default function MediaCover({ job }: { job: PortfolioJob }) {
  const first = sortedMedia(job)[0];
  const box = "aspect-[4/3] w-full rounded-xl object-cover";

  if (!first) return <div className={`${box} bg-[#E6E1D6]`} />;

  if (first.kind === "video") {
    return (
      <video
        src={mediaUrl(first.storage_path)}
        className={`${box} bg-[#2A2824]`}
        muted
        playsInline
        controls
        preload="metadata"
        aria-label={`Video of ${job.title}`}
      />
    );
  }

  return <img src={mediaUrl(first.storage_path)} alt={job.title} className={box} />;
}