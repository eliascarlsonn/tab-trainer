/** alphaTab's MIDI resolution: ticks per quarter note. */
export const QUARTER_TICKS = 960;

/** One bar as played, in MIDI ticks (a repeated bar appears once per pass). */
export interface PlayedBar {
  start: number;
  end: number;
  numerator: number;
  denominator: number;
}

export interface MetronomeBeat {
  tick: number;
  /** The first beat of a bar. */
  accent: boolean;
}

/**
 * Every metronome click in playback order: one per time-signature beat (so 6/8 clicks six
 * eighths), with the bar's first beat accented. Short bars (pickups) get only the beats they hold.
 */
export function beatGrid(bars: readonly PlayedBar[]): MetronomeBeat[] {
  const beats: MetronomeBeat[] = [];
  for (const bar of bars) {
    const step = (QUARTER_TICKS * 4) / bar.denominator;
    for (let i = 0, tick = bar.start; tick < bar.end; i++, tick += step) {
      beats.push({ tick: Math.round(tick), accent: i === 0 });
    }
  }
  return beats;
}

/** Index of the first beat at or after `tick` (beats are sorted by tick). */
export function firstBeatFrom(beats: readonly MetronomeBeat[], tick: number): number {
  let low = 0;
  let high = beats.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (beats[mid]!.tick < tick) low = mid + 1;
    else high = mid;
  }
  return low;
}
