import { METRONOME_SOUNDS, type MetronomeSound } from "./clickSounds";

/** How the metronome sounds: one choice for every song, remembered in this browser. */
export interface MetronomePrefs {
  sound: MetronomeSound;
  volume: number;
}

export const METRONOME_VOLUME_RANGE = { min: 0, max: 1, step: 0.05 } as const;

const DEFAULT_PREFS: MetronomePrefs = { sound: "click", volume: 0.8 };
const STORAGE_KEY = "tab-trainer:metronome";

export function loadMetronomePrefs(): MetronomePrefs {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<MetronomePrefs> | null;
    const sound = METRONOME_SOUNDS.some((s) => s.id === stored?.sound) ? stored!.sound! : DEFAULT_PREFS.sound;
    const volume = typeof stored?.volume === "number" ? stored.volume : DEFAULT_PREFS.volume;
    return { sound, volume };
  } catch {
    // Storage can be unavailable (e.g. private mode); fall back to the defaults.
    return DEFAULT_PREFS;
  }
}

export function saveMetronomePrefs(prefs: MetronomePrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not saved; the choice still applies until the page is reloaded.
  }
}
