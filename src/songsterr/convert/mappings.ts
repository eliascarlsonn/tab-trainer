import { model } from "@coderline/alphatab";
import type { SsHarmonic, SsSlide, SsVibrato } from "../types";

/** Songsterr bends use 100 per whole tone; alphaTab uses quarter tones. */
export const BEND_TONE_PER_QUARTER = 25;

/** Ticks per quarter note — shared by Songsterr automations and alphaTab. */
export const TICKS_PER_QUARTER = 960;

/** alphaTab's tempo reference for a quarter note. */
export const QUARTER_TEMPO_REFERENCE = 2;

export const GRACE_TYPES = {
  onBeat: model.GraceType.OnBeat,
  beforeBeat: model.GraceType.BeforeBeat,
} as const;

export const PICK_STROKES = {
  down: model.PickStroke.Down,
  up: model.PickStroke.Up,
} as const;

export const BRUSH_TYPES = {
  down: model.BrushType.BrushDown,
  up: model.BrushType.BrushUp,
} as const;

export const CRESCENDO_TYPES = {
  crescendo: model.CrescendoType.Crescendo,
  decrescendo: model.CrescendoType.Decrescendo,
} as const;

export const VIBRATO_TYPES: Record<SsVibrato, model.VibratoType> = {
  slight: model.VibratoType.Slight,
  wide: model.VibratoType.Wide,
};

export const HARMONIC_TYPES: Record<SsHarmonic, model.HarmonicType> = {
  natural: model.HarmonicType.Natural,
  artificial: model.HarmonicType.Artificial,
  pinch: model.HarmonicType.Pinch,
  tap: model.HarmonicType.Tap,
  semi: model.HarmonicType.Semi,
  feedback: model.HarmonicType.Feedback,
};

export const FERMATA_TYPES = {
  short: model.FermataType.Short,
  medium: model.FermataType.Medium,
  long: model.FermataType.Long,
} as const;

/** Slides leaving a note vs. sliding into it are separate concepts in alphaTab. */
export const SLIDE_OUT_TYPES: Partial<Record<SsSlide, model.SlideOutType>> = {
  shift: model.SlideOutType.Shift,
  legato: model.SlideOutType.Legato,
  downwards: model.SlideOutType.OutDown,
  upwards: model.SlideOutType.OutUp,
};

export const SLIDE_IN_TYPES: Partial<Record<SsSlide, model.SlideInType>> = {
  below: model.SlideInType.IntoFromBelow,
  above: model.SlideInType.IntoFromAbove,
};

export const ACCENTUATIONS: Record<number, model.AccentuationType> = {
  1: model.AccentuationType.Normal,
  2: model.AccentuationType.Heavy,
};

export const DYNAMICS: Record<string, model.DynamicValue> = {
  ppp: model.DynamicValue.PPP,
  pp: model.DynamicValue.PP,
  p: model.DynamicValue.P,
  mp: model.DynamicValue.MP,
  mf: model.DynamicValue.MF,
  f: model.DynamicValue.F,
  ff: model.DynamicValue.FF,
  fff: model.DynamicValue.FFF,
};

/** Tremolo picking: an 8th-note tremolo is one mark, 16th two, 32nd three. */
export function tremoloMarks(noteValue: number): number {
  return Math.max(1, Math.round(Math.log2(noteValue)) - 2);
}

/** The "normal" note count a tuplet replaces: largest power of two below it (3→2, 5→4, 6→4). */
export function tupletDenominator(numerator: number): number {
  return 2 ** Math.floor(Math.log2(numerator - 1));
}
