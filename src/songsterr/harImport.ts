import { readHarResponses, tryParseJson, type HarResponse } from "./har";
import type { SsSongMeta, SsTrack, SsVideoPoints } from "./types";

/** Everything captured for one song revision. */
export interface CapturedSong {
  meta: SsSongMeta | undefined;
  songId: number;
  revisionId: number;
  tracks: SsTrack[];
  videos: SsVideoPoints[];
}

export class NothingCapturedError extends Error {
  constructor() {
    super(
      "No Songsterr tabs found in this file. Open a song with DevTools recording, click through the tracks you want, then export again.",
    );
  }
}

const STATE_SCRIPT = /<script[^>]*id="state"[^>]*>([\s\S]*?)<\/script>/;

const revisionKey = (songId: number, revisionId: number) => `${songId}:${revisionId}`;

function isTrack(value: unknown): value is SsTrack {
  const v = value as Partial<SsTrack> | null;
  return !!v && Array.isArray(v.measures) && typeof v.partId === "number" && typeof v.revisionId === "number";
}

function isSongMeta(value: unknown): value is SsSongMeta {
  const v = value as Partial<SsSongMeta> | null;
  return !!v && typeof v.title === "string" && typeof v.revisionId === "number" && Array.isArray(v.tracks);
}

function isVideoPointsList(value: unknown): value is (SsVideoPoints & { songId: number; revisionId: number })[] {
  return Array.isArray(value) && value.every((v) => typeof v?.videoId === "string" && Array.isArray(v?.points));
}

/** The song page embeds its initial app state, including song metadata, as JSON. */
function metaFromPageState(html: string): SsSongMeta | undefined {
  const match = STATE_SCRIPT.exec(html);
  const state = match?.[1] ? tryParseJson(match[1]) : undefined;
  const meta = (state as { meta?: { current?: unknown } } | undefined)?.meta?.current;
  return isSongMeta(meta) ? meta : undefined;
}

function classify(response: HarResponse, songs: Map<string, CapturedSong>) {
  const entry = (songId: number, revisionId: number): CapturedSong => {
    const key = revisionKey(songId, revisionId);
    let song = songs.get(key);
    if (!song) {
      song = { meta: undefined, songId, revisionId, tracks: [], videos: [] };
      songs.set(key, song);
    }
    return song;
  };

  if (response.mimeType.includes("html")) {
    const meta = metaFromPageState(response.body);
    if (meta) entry(meta.songId, meta.revisionId).meta = meta;
    return;
  }

  const json = tryParseJson(response.body);
  if (isTrack(json)) {
    const song = entry(json.songId, json.revisionId);
    if (!song.tracks.some((t) => t.partId === json.partId)) song.tracks.push(json);
  } else if (isSongMeta(json)) {
    entry(json.songId, json.revisionId).meta = json;
  } else if (isVideoPointsList(json) && json[0]) {
    const song = entry(json[0].songId, json[0].revisionId);
    song.videos = json.filter((v) => v.status === "done" && v.points.length > 0);
  }
}

/**
 * Extracts every song revision whose tab data appears in a HAR capture.
 * Revisions without at least one captured track are dropped.
 */
export function extractSongsFromHar(har: unknown): CapturedSong[] {
  const songs = new Map<string, CapturedSong>();
  for (const response of readHarResponses(har)) classify(response, songs);

  const result = [...songs.values()]
    .filter((song) => song.tracks.length > 0)
    .map((song) => ({ ...song, tracks: song.tracks.sort((a, b) => a.partId - b.partId) }));

  if (result.length === 0) throw new NothingCapturedError();
  return result;
}
