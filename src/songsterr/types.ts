/**
 * Raw Songsterr data shapes, as found in a browser HAR capture.
 * Only fields the app actually consumes are typed; everything is optional
 * because the format is undocumented and varies between revisions.
 */

export type Fraction = [numerator: number, denominator: number];

export interface SsBendPoint {
  position: number;
  tone: number;
}

export interface SsBend {
  tone: number;
  points: SsBendPoint[];
}

export type SsSlide = "shift" | "legato" | "downwards" | "upwards" | "below" | "above";
export type SsHarmonic = "natural" | "artificial" | "pinch" | "tap" | "semi" | "feedback";
export type SsVibrato = "slight" | "wide";

export interface SsNote {
  rest?: boolean;
  string?: number;
  fret?: number;
  tie?: boolean;
  dead?: boolean;
  ghost?: boolean;
  staccato?: boolean;
  accentuated?: number;
  hp?: boolean;
  slide?: SsSlide;
  harmonic?: SsHarmonic;
  harmonicFret?: number;
  bend?: SsBend;
  leftHandVibrato?: SsVibrato;
}

export interface SsText {
  text: string;
}

export interface SsBeat {
  type: number;
  duration?: Fraction;
  dots?: number;
  rest?: boolean;
  notes: SsNote[];
  tuplet?: number;
  graceNote?: "onBeat" | "beforeBeat";
  palmMute?: boolean;
  letRing?: boolean;
  pickStroke?: "down" | "up";
  velocity?: string;
  text?: SsText;
  chord?: SsText;
  tremolo?: Fraction;
  tremoloBar?: { points: SsBendPoint[] };
  vibratoWithTremoloBar?: SsVibrato;
  gradualVelocity?: "crescendo" | "decrescendo";
  brushStroke?: { direction: "up" | "down" };
  tapping?: boolean;
  slapping?: boolean;
  popping?: boolean;
}

export interface SsVoice {
  rest?: boolean;
  beats: SsBeat[];
}

export interface SsKeySignature {
  accidentalCount: number;
  mode: "major" | "minor";
  transposeAs?: "#" | "b";
}

export interface SsMeasure {
  voices: SsVoice[];
  signature?: Fraction;
  marker?: SsText;
  rest?: boolean;
  clef?: string;
  keySignature?: SsKeySignature | null;
  repeatStart?: boolean;
  /** Closes a repeat: the number of times the section is played (observed as e.g. `repeat: 2`). */
  repeat?: number;
  /** Older guess at the repeat-close field; never seen in a capture, still read as a fallback. */
  repeatClose?: number | { times?: number };
  alternateEnding?: number[];
}

export interface SsTempoAutomation {
  measure: number;
  position: number;
  bpm: number;
}

export interface SsFermataAutomation {
  measure: number;
  position: number;
  type: "short" | "medium" | "long";
  length: number;
}

export interface SsLyricsLine {
  line: number;
  offset?: number;
  text: string;
}

export interface SsTrack {
  partId: number;
  songId: number;
  revisionId: number;
  name: string;
  instrumentId: number;
  instrument: string;
  strings: number;
  frets: number;
  tuning?: number[];
  capo?: number;
  measures: SsMeasure[];
  automations?: {
    tempo?: SsTempoAutomation[];
    fermata?: SsFermataAutomation[];
  };
  newLyrics?: SsLyricsLine[];
}

export interface SsTrackInfo {
  name: string;
  instrument: string;
  instrumentId: number;
  tuning?: number[];
  difficulty?: number;
  isVocalTrack?: boolean;
  isEmpty?: boolean;
}

export interface SsSongMeta {
  songId: number;
  revisionId: number;
  artist: string;
  title: string;
  tracks: SsTrackInfo[];
  defaultTrack?: number;
  popularTrack?: number;
  tags?: string[];
}

/** `null` feature marks the original recording. */
export type SsVideoFeature = "alternative" | "backing" | "solo" | "playthrough" | null;

export interface SsVideoPoints {
  videoId: string;
  feature: SsVideoFeature;
  status: string;
  /** Video time in seconds at the start of each measure, in playback order. */
  points: number[];
}

/** Songsterr's instrument id for drum kits. */
export const SS_DRUMS_INSTRUMENT_ID = 1024;
