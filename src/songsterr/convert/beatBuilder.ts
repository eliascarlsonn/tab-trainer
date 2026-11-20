import { model } from "@coderline/alphatab";
import type { SsBeat } from "../types";
import {
  BRUSH_TYPES,
  CRESCENDO_TYPES,
  DYNAMICS,
  GRACE_TYPES,
  PICK_STROKES,
  VIBRATO_TYPES,
  tremoloMarks,
  tupletDenominator,
} from "./mappings";
import { buildNote, toBendPoint, type StaffContext } from "./noteBuilder";

/** Registers chord names on the staff, reusing ids for repeated chords. */
export class ChordRegistry {
  constructor(private readonly staff: model.Staff) {}

  idFor(name: string): string {
    if (!this.staff.hasChord(name)) {
      const chord = new model.Chord();
      chord.name = name;
      chord.showDiagram = false;
      chord.showFingering = false;
      this.staff.addChord(name, chord);
    }
    return name;
  }
}

function applyRhythm(beat: model.Beat, source: SsBeat) {
  beat.duration = source.type as model.Duration;
  beat.dots = source.dots ?? 0;
  if (source.tuplet) {
    beat.tupletNumerator = source.tuplet;
    beat.tupletDenominator = tupletDenominator(source.tuplet);
  }
  if (source.graceNote) beat.graceType = GRACE_TYPES[source.graceNote];
}

function applyExpression(beat: model.Beat, source: SsBeat) {
  if (source.velocity && source.velocity in DYNAMICS) beat.dynamics = DYNAMICS[source.velocity]!;
  if (source.gradualVelocity) beat.crescendo = CRESCENDO_TYPES[source.gradualVelocity];
  if (source.text?.text) beat.text = source.text.text;
}

function applyTechniques(beat: model.Beat, source: SsBeat) {
  if (source.pickStroke) beat.pickStroke = PICK_STROKES[source.pickStroke];
  if (source.brushStroke) beat.brushType = BRUSH_TYPES[source.brushStroke.direction];
  if (source.vibratoWithTremoloBar) beat.vibrato = VIBRATO_TYPES[source.vibratoWithTremoloBar];
  beat.tap = !!source.tapping;
  beat.slap = !!source.slapping;
  beat.pop = !!source.popping;

  if (source.tremolo) {
    const tremolo = new model.TremoloPickingEffect();
    tremolo.marks = tremoloMarks(source.tremolo[1]);
    beat.tremoloPicking = tremolo;
  }
  for (const point of source.tremoloBar?.points ?? []) beat.addWhammyBarPoint(toBendPoint(point));
}

export function buildBeat(source: SsBeat, staff: StaffContext, chords: ChordRegistry): model.Beat {
  const beat = new model.Beat();
  applyRhythm(beat, source);
  applyExpression(beat, source);
  applyTechniques(beat, source);
  if (source.chord?.text) beat.chordId = chords.idFor(source.chord.text);

  for (const note of source.notes) {
    if (!note.rest) beat.addNote(buildNote(note, source, staff));
  }
  return beat;
}
