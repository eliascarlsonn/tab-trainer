import { describe, expect, it } from "vitest";
import { playbackOrder } from "@/player/sync/playbackOrder";
import type { SsMeasure, SsTrack } from "../types";
import { buildMasterBars } from "./masterBarBuilder";

function trackOf(measures: Partial<SsMeasure>[]): SsTrack {
  return { measures: measures.map((m) => ({ voices: [], ...m })) } as unknown as SsTrack;
}

describe("buildMasterBars", () => {
  it("reads Songsterr's `repeat` field as the repeat close", () => {
    // Shape taken from a real capture ("Wax Poetic", bars 10–18 played twice).
    const bars = buildMasterBars(trackOf([{}, { repeatStart: true }, {}, { repeat: 2 }, {}]));

    expect(bars[1]!.isRepeatStart).toBe(true);
    expect(bars[3]!.repeatCount).toBe(2);
    expect(playbackOrder(bars)).toEqual([0, 1, 2, 3, 1, 2, 3, 4]);
  });

  it("converts tempos counted in other note values to quarter notes per minute", () => {
    // "Hot for Teacher" is marked as 128 half notes per minute, i.e. 256 quarters.
    const track = trackOf([{}, {}]);
    track.automations = {
      tempo: [
        { measure: 0, position: 0, bpm: 128, type: 2 },
        { measure: 1, position: 0, bpm: 120, type: 8 },
      ],
    };
    const bars = buildMasterBars(track);
    expect(bars[0]!.tempoAutomations[0]?.value).toBe(256);
    expect(bars[1]!.tempoAutomations[0]?.value).toBe(60);
  });

  it("treats a tempo without a note value as quarter notes", () => {
    const track = trackOf([{}]);
    track.automations = { tempo: [{ measure: 0, position: 0, bpm: 212 }] };
    expect(buildMasterBars(track)[0]!.tempoAutomations[0]?.value).toBe(212);
  });

  it("still accepts the older `repeatClose` form", () => {
    const bars = buildMasterBars(trackOf([{ repeatStart: true }, { repeatClose: { times: 3 } }]));
    expect(bars[1]!.repeatCount).toBe(3);
  });
});
