import { model } from "@coderline/alphatab";
import type { Fraction, SsMeasure, SsTrack } from "../types";
import { FERMATA_TYPES, QUARTER_TEMPO_REFERENCE, TICKS_PER_QUARTER } from "./mappings";

const DEFAULT_SIGNATURE: Fraction = [4, 4];

function barDurationTicks([numerator, denominator]: Fraction): number {
  return numerator * (4 / denominator) * TICKS_PER_QUARTER;
}

function repeatCount(measure: SsMeasure): number {
  const close = measure.repeatClose;
  if (close === undefined) return 0;
  const times = typeof close === "number" ? close : close.times;
  return Math.max(2, times ?? 2);
}

/** Alternate endings are a bitmask where bit n means "played on repeat pass n+1". */
function alternateEndingMask(endings: number[] | undefined): number {
  return (endings ?? []).reduce((mask, ending) => mask | (1 << (ending - 1)), 0);
}

function buildMasterBar(measure: SsMeasure, signature: Fraction): model.MasterBar {
  const masterBar = new model.MasterBar();
  [masterBar.timeSignatureNumerator, masterBar.timeSignatureDenominator] = signature;
  masterBar.isRepeatStart = !!measure.repeatStart;
  masterBar.repeatCount = repeatCount(measure);
  masterBar.alternateEndings = alternateEndingMask(measure.alternateEnding);

  if (measure.marker?.text) {
    const section = new model.Section();
    section.text = measure.marker.text;
    masterBar.section = section;
  }
  return masterBar;
}

function applyAutomations(masterBars: model.MasterBar[], track: SsTrack, signatures: Fraction[]) {
  const ratioIn = (measure: number, position: number) => position / barDurationTicks(signatures[measure]!);

  for (const tempo of track.automations?.tempo ?? []) {
    const bar = masterBars[tempo.measure];
    if (!bar) continue;
    bar.tempoAutomations.push(
      model.Automation.buildTempoAutomation(false, ratioIn(tempo.measure, tempo.position), tempo.bpm, QUARTER_TEMPO_REFERENCE),
    );
  }

  for (const source of track.automations?.fermata ?? []) {
    const fermata = new model.Fermata();
    fermata.type = FERMATA_TYPES[source.type];
    fermata.length = source.length;
    masterBars[source.measure]?.addFermata(source.position, fermata);
  }
}

/**
 * Builds the song-wide bar structure (time signatures, sections, repeats, tempo)
 * from a reference track. Songsterr duplicates this data in every track.
 */
export function buildMasterBars(reference: SsTrack): model.MasterBar[] {
  let signature = DEFAULT_SIGNATURE;
  const signatures = reference.measures.map((measure) => (signature = measure.signature ?? signature));
  const masterBars = reference.measures.map((measure, i) => buildMasterBar(measure, signatures[i]!));
  applyAutomations(masterBars, reference, signatures);
  return masterBars;
}
