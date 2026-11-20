import { splitTrackName, type TrackEntry, type VideoKind, type VideoSource } from "@/library/song";

const VIDEO_KIND_LABELS: Record<VideoKind, string> = {
  original: "Original recording",
  backing: "Backing track",
  solo: "Solo",
  playthrough: "Playthrough",
  alternative: "Alternative",
};

/** Human labels for videos; repeated kinds get a running number ("Backing track 2"). */
export function videoLabels(videos: readonly VideoSource[]): Map<string, string> {
  const totals = new Map<VideoKind, number>();
  for (const v of videos) totals.set(v.kind, (totals.get(v.kind) ?? 0) + 1);

  const seen = new Map<VideoKind, number>();
  return new Map(
    videos.map((v) => {
      const n = (seen.get(v.kind) ?? 0) + 1;
      seen.set(v.kind, n);
      const base = VIDEO_KIND_LABELS[v.kind];
      return [v.videoId, (totals.get(v.kind) ?? 0) > 1 ? `${base} ${n}` : base];
    }),
  );
}

export function trackTitle(entry: Pick<TrackEntry, "name">): string {
  return splitTrackName(entry.name).part;
}

/** Secondary line for a track: who plays it, or the instrument when the name has no musician. */
export function trackSubtitle(entry: Pick<TrackEntry, "name" | "instrument">): string {
  return splitTrackName(entry.name).musician ?? entry.instrument;
}
