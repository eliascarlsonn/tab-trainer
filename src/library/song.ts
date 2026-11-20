import type { CapturedSong } from "@/songsterr/harImport";
import type { SsTrack, SsTrackInfo, SsVideoFeature, SsVideoPoints } from "@/songsterr/types";
import { SS_DRUMS_INSTRUMENT_ID } from "@/songsterr/types";

export type VideoKind = "original" | "backing" | "solo" | "playthrough" | "alternative";

export interface VideoSource {
  videoId: string;
  kind: VideoKind;
  /** Video time (seconds) at the start of each measure, in playback order. */
  points: number[];
}

export type TrackRole = "guitar" | "bass" | "drums" | "vocals" | "other";

/** One entry in a song's full track list, captured or not. */
export interface TrackEntry {
  partId: number;
  name: string;
  instrument: string;
  role: TrackRole;
  captured: boolean;
}

/** A song in the local library. Persisted as-is. */
export interface Song {
  id: string;
  songId: number;
  revisionId: number;
  title: string;
  artist: string;
  /** Raw captured tab data, one entry per track, sorted by partId. */
  tracks: SsTrack[];
  /** Complete track list of the song (including tracks that were not captured). */
  catalog: TrackEntry[];
  videos: VideoSource[];
  defaultPartId: number | undefined;
  importedAt: number;
  lastPlayedAt: number | undefined;
}

const UNTITLED = "Untitled song";
const UNKNOWN_ARTIST = "Unknown artist";

const VIDEO_KIND_ORDER: VideoKind[] = ["original", "backing", "solo", "playthrough", "alternative"];

const toVideoKind = (feature: SsVideoFeature): VideoKind => feature ?? "original";

export function songIdFor(songId: number): string {
  return `songsterr-${songId}`;
}

export function trackRole(info: Pick<SsTrackInfo, "instrument" | "instrumentId" | "isVocalTrack">): TrackRole {
  if (info.instrumentId === SS_DRUMS_INSTRUMENT_ID) return "drums";
  if (info.isVocalTrack) return "vocals";
  const instrument = info.instrument.toLowerCase();
  if (instrument.includes("bass")) return "bass";
  if (instrument.includes("guitar")) return "guitar";
  return "other";
}

const PART_WORDS =
  /guitar|bass|vocal|drum|percussion|key|piano|organ|synth|lead|rhythm|clean|solo|harmony|acoustic|overdub|effect|delay|reverb|string|horn|choir|dialogue|intro/i;

export interface TrackNameParts {
  /** What is played, e.g. "Lead Guitar". */
  part: string;
  /** Who plays it, when the name says so. */
  musician: string | undefined;
}

/**
 * Songsterr names tracks "Musician | Gear | Part", but the order and the number of
 * segments vary. The part is the last segment that reads like a musical role.
 */
export function splitTrackName(name: string): TrackNameParts {
  const segments = name
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) return { part: segments[0] ?? name, musician: undefined };

  const [musician, ...rest] = segments;
  const part = rest.findLast((s) => PART_WORDS.test(s)) ?? rest.at(-1)!;
  return { part, musician };
}

function buildCatalog(captured: CapturedSong): TrackEntry[] {
  const capturedIds = new Set(captured.tracks.map((t) => t.partId));
  const infos: (SsTrackInfo & { partId: number })[] = captured.meta
    ? captured.meta.tracks.map((info, partId) => ({ ...info, partId }))
    : captured.tracks.map((t) => ({ ...t, isVocalTrack: false }));

  return infos.map((info) => ({
    partId: info.partId,
    name: info.name,
    instrument: info.instrument,
    role: trackRole(info),
    captured: capturedIds.has(info.partId),
  }));
}

function buildVideos(videos: SsVideoPoints[]): VideoSource[] {
  const seen = new Set<string>();
  // Sort before de-duplicating so a video listed under several kinds keeps its most specific one.
  return videos
    .map((v) => ({ videoId: v.videoId, kind: toVideoKind(v.feature), points: v.points }))
    .sort((a, b) => VIDEO_KIND_ORDER.indexOf(a.kind) - VIDEO_KIND_ORDER.indexOf(b.kind))
    .filter((v) => !seen.has(v.videoId) && !!seen.add(v.videoId));
}

export function songFromCapture(captured: CapturedSong, now = Date.now()): Song {
  return {
    id: songIdFor(captured.songId),
    songId: captured.songId,
    revisionId: captured.revisionId,
    title: captured.meta?.title ?? UNTITLED,
    artist: captured.meta?.artist ?? UNKNOWN_ARTIST,
    tracks: captured.tracks,
    catalog: buildCatalog(captured),
    videos: buildVideos(captured.videos),
    defaultPartId: captured.meta?.popularTrack ?? captured.meta?.defaultTrack,
    importedAt: now,
    lastPlayedAt: undefined,
  };
}

/**
 * Combines a fresh capture with an existing library entry of the same song.
 * A newer revision replaces the old data; the same revision gains any newly captured tracks.
 */
export function mergeSongs(existing: Song, incoming: Song): Song {
  if (incoming.revisionId !== existing.revisionId) {
    return { ...incoming, importedAt: existing.importedAt, lastPlayedAt: existing.lastPlayedAt };
  }

  const tracks = new Map(existing.tracks.map((t) => [t.partId, t]));
  for (const track of incoming.tracks) tracks.set(track.partId, track);
  const capturedIds = new Set(tracks.keys());

  return {
    ...existing,
    title: incoming.title !== UNTITLED ? incoming.title : existing.title,
    artist: incoming.artist !== UNKNOWN_ARTIST ? incoming.artist : existing.artist,
    tracks: [...tracks.values()].sort((a, b) => a.partId - b.partId),
    catalog: (incoming.catalog.length >= existing.catalog.length ? incoming.catalog : existing.catalog).map(
      (entry) => ({ ...entry, captured: capturedIds.has(entry.partId) }),
    ),
    videos: incoming.videos.length > 0 ? incoming.videos : existing.videos,
  };
}
