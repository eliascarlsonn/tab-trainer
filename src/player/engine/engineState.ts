import type { MetronomeSound } from "@/player/metronome/clickSounds";
import type { PracticeSettings } from "@/practice/practiceSettings";

export interface SectionMarker {
  barIndex: number;
  title: string;
}

export type EnginePhase = "loading" | "ready" | "error";

/** Where a loop edge is drawn, in pixels from the score host's top-left corner. */
export interface LoopEdge {
  x: number;
  top: number;
  height: number;
}

/** Live runtime state of the player, mirrored from alphaTab and the video. */
export interface EngineState {
  phase: EnginePhase;
  error: string | null;
  soundFontProgress: number;
  /** True once playback can start (audio loaded, or video attached). */
  canPlay: boolean;
  playing: boolean;
  currentTimeMs: number;
  endTimeMs: number;
  currentBar: number;
  barCount: number;
  /** Tempo at the cursor, including the speed setting. */
  tempo: number;
  sections: SectionMarker[];
  trainerPasses: number;
  /** Bars covered by the current loop range, for display. */
  loopBars: { start: number; end: number } | null;
  /** Drag handles for the loop's edges; null when nothing is highlighted. */
  loopEdges: { start: LoopEdge; end: LoopEdge } | null;
  /** The metronome's sound and volume, shared by all songs. */
  metronomeSound: MetronomeSound;
  metronomeVolume: number;
  /** A count-in bar is clicking before playback starts. */
  countingIn: boolean;
  settings: PracticeSettings;
}

export function initialEngineState(settings: PracticeSettings): EngineState {
  return {
    phase: "loading",
    error: null,
    soundFontProgress: 0,
    canPlay: false,
    playing: false,
    currentTimeMs: 0,
    endTimeMs: 0,
    currentBar: 0,
    barCount: 0,
    tempo: 0,
    sections: [],
    trainerPasses: 0,
    loopBars: null,
    loopEdges: null,
    metronomeSound: "click",
    metronomeVolume: 0.8,
    countingIn: false,
    settings,
  };
}
