import { collection } from "@/lib/storage";
import type { Song, TrackRole } from "@/library/song";

export interface TickRange {
  startTick: number;
  endTick: number;
}

export interface TrackMix {
  muted: boolean;
  solo: boolean;
  /** 0–1 when set by hand; null follows the track on screen (see trackVolume). */
  volume: number | null;
}

export interface TrainerSettings {
  enabled: boolean;
  /** Speed added after each completed set of passes. */
  step: number;
  /** Speed at which the trainer stops increasing. */
  target: number;
  /** Clean loop passes required before the speed increases. */
  passesPerStep: number;
}

export type PlaybackSource = { kind: "synth" } | { kind: "video"; videoId: string };

export type NotationMode = "tab" | "tabAndScore";

/** Everything a player remembers about how a song is practiced. Persisted per song. */
export interface PracticeSettings {
  partId: number | undefined;
  speed: number;
  pitch: number;
  /** Overall playback volume, 0–1; applies to tab audio and synced videos alike. */
  volume: number;
  metronome: boolean;
  countIn: boolean;
  loopEnabled: boolean;
  loopRange: TickRange | null;
  trainer: TrainerSettings;
  source: PlaybackSource;
  syncOffsetMs: number;
  mixer: Record<number, TrackMix>;
  /** Format of `mixer`; 2 added automatic track volumes. */
  mixerVersion: number;
  notation: NotationMode;
  zoom: number;
  videoVisible: boolean;
}

export const SPEED_RANGE = { min: 0.25, max: 1.5, step: 0.05 } as const;
export const PITCH_RANGE = { min: -12, max: 12, step: 1 } as const;
export const VOLUME_RANGE = { min: 0, max: 1, step: 0.05 } as const;
export const ZOOM_RANGE = { min: 0.6, max: 1.6, step: 0.1 } as const;

export const DEFAULT_TRACK_MIX: TrackMix = { muted: false, solo: false, volume: null };

/** Tracks other than the one on screen play this much quieter, so the part being practiced stands out. */
export const BACKGROUND_TRACK_LEVEL = 0.5;

/** The volume a track plays at: its own setting, or full when on screen and lowered otherwise. */
export function trackVolume(mix: TrackMix, shown: boolean): number {
  return mix.volume ?? (shown ? 1 : BACKGROUND_TRACK_LEVEL);
}

const MIXER_VERSION = 2;

/** Before automatic volumes, 100% was the default and can't be told apart from untouched. */
function migrateMixer(mixer: Record<number, TrackMix>): Record<number, TrackMix> {
  return Object.fromEntries(
    Object.entries(mixer).map(([partId, mix]) => [partId, mix.volume === 1 ? { ...mix, volume: null } : mix]),
  );
}

const PREFERRED_ROLES: TrackRole[] = ["guitar", "bass", "drums", "other", "vocals"];

/** The track a player most likely wants: Songsterr's popular pick if captured, else the first guitar. */
export function defaultPartId(song: Song): number | undefined {
  const captured = new Set(song.catalog.filter((t) => t.captured).map((t) => t.partId));
  if (song.defaultPartId !== undefined && captured.has(song.defaultPartId)) return song.defaultPartId;
  for (const role of PREFERRED_ROLES) {
    const entry = song.catalog.find((t) => t.captured && t.role === role);
    if (entry) return entry.partId;
  }
  return captured.values().next().value;
}

export function defaultPracticeSettings(song: Song): PracticeSettings {
  return {
    partId: defaultPartId(song),
    speed: 1,
    pitch: 0,
    volume: 1,
    metronome: false,
    countIn: false,
    loopEnabled: false,
    loopRange: null,
    trainer: { enabled: false, step: 0.05, target: 1, passesPerStep: 2 },
    source: { kind: "synth" },
    syncOffsetMs: 0,
    mixer: {},
    mixerVersion: MIXER_VERSION,
    notation: "tab",
    zoom: 1,
    videoVisible: true,
  };
}

const repository = collection<PracticeSettings>("practice");

export async function loadPracticeSettings(song: Song): Promise<PracticeSettings> {
  const stored = await repository.get(song.id);
  const defaults = defaultPracticeSettings(song);
  if (!stored) return defaults;
  // Merging over defaults keeps older saved settings valid when new fields are added.
  const settings = { ...defaults, ...stored };
  if (stored.mixerVersion === MIXER_VERSION) return settings;
  return { ...settings, mixer: migrateMixer(stored.mixer ?? {}), mixerVersion: MIXER_VERSION };
}

export function savePracticeSettings(songId: string, settings: PracticeSettings): Promise<void> {
  return repository.put(songId, settings);
}
