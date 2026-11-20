import { model } from "@coderline/alphatab";
import type { SsBeat, SsBendPoint, SsNote } from "../types";
import {
  ACCENTUATIONS,
  BEND_TONE_PER_QUARTER,
  HARMONIC_TYPES,
  SLIDE_IN_TYPES,
  SLIDE_OUT_TYPES,
  VIBRATO_TYPES,
} from "./mappings";

export interface StaffContext {
  stringCount: number;
  isDrums: boolean;
}

export function toBendPoint(point: SsBendPoint): model.BendPoint {
  return new model.BendPoint(point.position, point.tone / BEND_TONE_PER_QUARTER);
}

function applyPitch(note: model.Note, source: SsNote, staff: StaffContext) {
  const fret = source.fret ?? 0;
  if (staff.isDrums) {
    // Songsterr stores the General MIDI percussion key in `fret`, which matches
    // alphaTab's built-in GP7 articulation ids.
    note.percussionArticulation = fret;
    return;
  }
  // Songsterr counts strings from the highest (0); alphaTab from the lowest (1).
  note.string = staff.stringCount - (source.string ?? 0);
  note.fret = fret;
}

function applyArticulation(note: model.Note, source: SsNote, beat: SsBeat) {
  note.isTieDestination = !!source.tie;
  note.isDead = !!source.dead;
  note.isGhost = !!source.ghost;
  note.isStaccato = !!source.staccato;
  note.isHammerPullOrigin = !!source.hp;
  note.isPalmMute = !!beat.palmMute;
  note.isLetRing = !!beat.letRing;
  if (source.accentuated) note.accentuated = ACCENTUATIONS[source.accentuated] ?? model.AccentuationType.Normal;
  if (source.leftHandVibrato) note.vibrato = VIBRATO_TYPES[source.leftHandVibrato];
}

function applyTechniques(note: model.Note, source: SsNote) {
  if (source.slide) {
    note.slideOutType = SLIDE_OUT_TYPES[source.slide] ?? model.SlideOutType.None;
    note.slideInType = SLIDE_IN_TYPES[source.slide] ?? model.SlideInType.None;
  }
  if (source.harmonic) {
    note.harmonicType = HARMONIC_TYPES[source.harmonic];
    note.harmonicValue = source.harmonicFret ?? 0;
  }
  for (const point of source.bend?.points ?? []) note.addBendPoint(toBendPoint(point));
}

export function buildNote(source: SsNote, beat: SsBeat, staff: StaffContext): model.Note {
  const note = new model.Note();
  applyPitch(note, source, staff);
  applyArticulation(note, source, beat);
  if (!staff.isDrums) applyTechniques(note, source);
  return note;
}
