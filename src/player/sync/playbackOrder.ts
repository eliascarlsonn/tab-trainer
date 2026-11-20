import type { model } from "@coderline/alphatab";

type RepeatInfo = Pick<model.MasterBar, "isRepeatStart" | "repeatCount" | "alternateEndings">;

/** Hard stop against malformed repeat data producing an endless sequence. */
const MAX_PLAYED_BARS = 20_000;

/**
 * Lists master bar indices in the order they are played, expanding repeats
 * and honoring alternate endings (volta brackets).
 */
export function playbackOrder(masterBars: readonly RepeatInfo[]): number[] {
  const order: number[] = [];
  const timesPlayed = new Map<number, number>();
  let groupStart = 0;
  let pass = 0;

  for (let i = 0; i < masterBars.length && order.length < MAX_PLAYED_BARS;) {
    const bar = masterBars[i]!;

    if (bar.isRepeatStart && i !== groupStart) {
      groupStart = i;
      pass = 0;
    }
    if (bar.alternateEndings && !(bar.alternateEndings & (1 << pass))) {
      i++;
      continue;
    }

    order.push(i);

    if (bar.repeatCount > 0) {
      const played = (timesPlayed.get(i) ?? 0) + 1;
      if (played < bar.repeatCount) {
        timesPlayed.set(i, played);
        pass++;
        i = groupStart;
        continue;
      }
      timesPlayed.delete(i);
      groupStart = i + 1;
      pass = 0;
    }
    i++;
  }
  return order;
}
