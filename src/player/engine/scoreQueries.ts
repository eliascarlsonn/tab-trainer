import type { model } from "@coderline/alphatab";
import type { SectionMarker } from "./engineState";

export function sectionsOf(score: model.Score): SectionMarker[] {
  return score.masterBars.flatMap((bar) => (bar.section ? [{ barIndex: bar.index, title: bar.section.text }] : []));
}

/** Bar range covered by a section: from its marker up to the next one. */
export function sectionBarRange(sections: readonly SectionMarker[], index: number, barCount: number) {
  const section = sections[index];
  if (!section) return undefined;
  const next = sections[index + 1];
  return { startBar: section.barIndex, endBar: (next?.barIndex ?? barCount) - 1 };
}

function firstVoiceBeats(track: model.Track, barIndex: number): model.Beat[] {
  return track.staves[0]?.bars[barIndex]?.voices[0]?.beats ?? [];
}

/** First and last beat spanning the given bars in a track, used to place loop markers. */
export function beatsSpanning(track: model.Track, startBar: number, endBar: number) {
  const start = firstVoiceBeats(track, startBar)[0];
  const end = firstVoiceBeats(track, endBar).at(-1);
  return start && end ? { start, end } : undefined;
}

export function isMelodic(track: model.Track): boolean {
  return !track.staves[0]?.isPercussion;
}
