import type { model } from "@coderline/alphatab";
import { UNKNOWN_ARTIST, type FileSong, type TrackEntry, type TrackRole } from "./song";

/** Score formats alphaTab reads. It detects the format from the content, not the extension. */
export const SCORE_FILE_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx", ".musicxml", ".mxl", ".xml"];

export class UnreadableScoreError extends Error {
  constructor() {
    super("This file isn't a Guitar Pro, MusicXML or Songsterr capture file.");
  }
}

/** General MIDI program families, eight programs each. */
const GM_FAMILIES = [
  "Piano",
  "Chromatic percussion",
  "Organ",
  "Guitar",
  "Bass",
  "Strings",
  "Ensemble",
  "Brass",
  "Reed",
  "Pipe",
  "Synth lead",
  "Synth pad",
  "Synth effects",
  "Ethnic",
  "Percussive",
  "Sound effects",
];

function roleOf(track: model.Track): TrackRole {
  const name = track.name.toLowerCase();
  const family = Math.floor(track.playbackInfo.program / 8);
  if (track.staves.some((s) => s.isPercussion)) return "drums";
  if (/vocal|voice|voz|singer/.test(name)) return "vocals";
  if (family === 4 || name.includes("bass")) return "bass";
  if (family === 3 || name.includes("guitar")) return "guitar";
  return "other";
}

function instrumentOf(track: model.Track): string {
  if (track.staves.some((s) => s.isPercussion)) return "Drums";
  return GM_FAMILIES[Math.floor(track.playbackInfo.program / 8)] ?? "Instrument";
}

export function catalogFromScore(score: model.Score): TrackEntry[] {
  return score.tracks.map((track) => ({
    partId: track.index,
    name: track.name.trim() || `Track ${track.index + 1}`,
    instrument: instrumentOf(track),
    role: roleOf(track),
    captured: true,
  }));
}

/** The same file always gets the same id, so importing it twice updates one library entry. */
async function contentId(data: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource));
  const hex = [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `file-${hex}`;
}

const withoutExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

/** Reads a Guitar Pro or MusicXML file into a library song. */
export async function songFromScoreFile(file: File, now = Date.now()): Promise<FileSong> {
  const data = new Uint8Array(await file.arrayBuffer());
  // alphaTab is large; the library screen only loads it once a score file is imported.
  const { importer } = await import("@coderline/alphatab");

  let score: model.Score;
  try {
    score = importer.ScoreLoader.loadScoreFromBytes(data);
  } catch {
    throw new UnreadableScoreError();
  }
  if (score.tracks.length === 0) throw new UnreadableScoreError();

  return {
    origin: "file",
    id: await contentId(data),
    fileName: file.name,
    data,
    title: score.title.trim() || withoutExtension(file.name),
    artist: score.artist.trim() || UNKNOWN_ARTIST,
    catalog: catalogFromScore(score),
    videos: [],
    defaultPartId: undefined,
    importedAt: now,
    lastPlayedAt: undefined,
  };
}
