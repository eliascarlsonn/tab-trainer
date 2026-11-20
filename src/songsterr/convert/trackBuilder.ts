import { model } from "@coderline/alphatab";
import type { SsKeySignature, SsMeasure, SsTrack } from "../types";
import { SS_DRUMS_INSTRUMENT_ID } from "../types";
import { buildBeat, ChordRegistry } from "./beatBuilder";
import type { StaffContext } from "./noteBuilder";

const PERCUSSION_CHANNEL = 9;
const MAX_MELODIC_CHANNELS = 15;
const MAX_TRACK_VOLUME = 16;
const CENTER_BALANCE = 8;

const CLEFS: Record<string, model.Clef> = {
  G2: model.Clef.G2,
  F4: model.Clef.F4,
  C3: model.Clef.C3,
  C4: model.Clef.C4,
};

export interface TrackOptions {
  isVocal: boolean;
}

/** Each melodic track gets its own MIDI channel, skipping the percussion channel. */
function melodicChannel(trackIndex: number): number {
  const channel = trackIndex % MAX_MELODIC_CHANNELS;
  return channel >= PERCUSSION_CHANNEL ? channel + 1 : channel;
}

function configurePlayback(track: model.Track, source: SsTrack, isDrums: boolean, trackIndex: number) {
  const info = track.playbackInfo;
  const channel = isDrums ? PERCUSSION_CHANNEL : melodicChannel(trackIndex);
  info.primaryChannel = channel;
  info.secondaryChannel = channel;
  info.program = isDrums ? 0 : source.instrumentId;
  info.volume = Math.round(MAX_TRACK_VOLUME * 0.9);
  info.balance = CENTER_BALANCE;
}

function configureStaff(staff: model.Staff, source: SsTrack, isDrums: boolean, options: TrackOptions) {
  staff.isPercussion = isDrums;
  staff.capo = source.capo ?? 0;
  staff.stringTuning = new model.Tuning("", isDrums ? [] : (source.tuning ?? []), false);
  staff.showTablature = !isDrums && !options.isVocal;
  staff.showStandardNotation = isDrums || options.isVocal;
}

function defaultClef(isDrums: boolean, source: SsTrack): model.Clef {
  if (isDrums) return model.Clef.Neutral;
  return source.instrument.toLowerCase().includes("bass") ? model.Clef.F4 : model.Clef.G2;
}

function emptyVoice(): model.Voice {
  const voice = new model.Voice();
  const beat = new model.Beat();
  beat.isEmpty = true;
  beat.duration = model.Duration.Whole;
  voice.addBeat(beat);
  return voice;
}

function applyKeySignature(bar: model.Bar, key: SsKeySignature) {
  const sign = key.transposeAs === "b" ? -1 : 1;
  bar.keySignature = (sign * Math.abs(key.accidentalCount)) as model.KeySignature;
  bar.keySignatureType = key.mode === "minor" ? model.KeySignatureType.Minor : model.KeySignatureType.Major;
}

function buildBar(
  measure: SsMeasure,
  voiceCount: number,
  clef: model.Clef,
  context: StaffContext,
  chords: ChordRegistry,
) {
  const bar = new model.Bar();
  bar.clef = clef;
  if (measure.keySignature && !context.isDrums) applyKeySignature(bar, measure.keySignature);
  for (let i = 0; i < voiceCount; i++) {
    const source = measure.voices[i];
    if (!source || source.beats.length === 0) {
      bar.addVoice(emptyVoice());
      continue;
    }
    const voice = new model.Voice();
    for (const beat of source.beats) voice.addBeat(buildBeat(beat, context, chords));
    bar.addVoice(voice);
  }
  return bar;
}

export function buildTrack(source: SsTrack, trackIndex: number, options: TrackOptions): model.Track {
  const isDrums = source.instrumentId === SS_DRUMS_INSTRUMENT_ID;
  const track = new model.Track();
  track.name = source.name;
  track.shortName = source.instrument;
  configurePlayback(track, source, isDrums, trackIndex);

  const staff = new model.Staff();
  track.addStaff(staff);
  configureStaff(staff, source, isDrums, options);

  const context: StaffContext = { stringCount: source.strings, isDrums };
  const chords = new ChordRegistry(staff);
  const voiceCount = Math.max(1, ...source.measures.map((m) => m.voices.length));
  let clef = defaultClef(isDrums, source);

  for (const measure of source.measures) {
    if (!isDrums && measure.clef) clef = CLEFS[measure.clef] ?? clef;
    staff.addBar(buildBar(measure, voiceCount, clef, context, chords));
  }
  return track;
}
