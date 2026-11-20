import type { model } from "@coderline/alphatab";
import { playbackOrder } from "./playbackOrder";

/**
 * Converts per-bar video timestamps (one per played bar, in playback order)
 * into alphaTab sync points. `offsetSeconds` shifts the whole mapping for
 * manual fine-tuning of the sync.
 */
export function buildSyncPoints(
  masterBars: readonly model.MasterBar[],
  barStartTimes: readonly number[],
  offsetSeconds = 0,
): model.FlatSyncPoint[] {
  const occurrences = new Map<number, number>();
  const order = playbackOrder(masterBars);
  const count = Math.min(order.length, barStartTimes.length);

  return order.slice(0, count).map((barIndex, i) => {
    const barOccurence = occurrences.get(barIndex) ?? 0;
    occurrences.set(barIndex, barOccurence + 1);
    return {
      barIndex,
      barOccurence,
      barPosition: 0,
      millisecondOffset: Math.max(0, (barStartTimes[i]! + offsetSeconds) * 1000),
    };
  });
}
