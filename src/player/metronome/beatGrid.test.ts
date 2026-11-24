import { describe, expect, it } from "vitest";
import { beatGrid, firstBeatFrom, QUARTER_TICKS } from "./beatGrid";

const BAR_4_4 = QUARTER_TICKS * 4;

describe("beatGrid", () => {
  it("clicks every quarter in 4/4 and accents the downbeat", () => {
    expect(beatGrid([{ start: 0, end: BAR_4_4, numerator: 4, denominator: 4 }])).toEqual([
      { tick: 0, accent: true },
      { tick: 960, accent: false },
      { tick: 1920, accent: false },
      { tick: 2880, accent: false },
    ]);
  });

  it("clicks every eighth in 6/8", () => {
    const beats = beatGrid([{ start: 0, end: QUARTER_TICKS * 3, numerator: 6, denominator: 8 }]);
    expect(beats.map((b) => b.tick)).toEqual([0, 480, 960, 1440, 1920, 2400]);
  });

  it("gives a short pickup bar only the beats it holds", () => {
    const beats = beatGrid([
      { start: 0, end: QUARTER_TICKS, numerator: 4, denominator: 4 },
      { start: QUARTER_TICKS, end: QUARTER_TICKS + BAR_4_4, numerator: 4, denominator: 4 },
    ]);
    expect(beats.slice(0, 3)).toEqual([
      { tick: 0, accent: true },
      { tick: 960, accent: true },
      { tick: 1920, accent: false },
    ]);
  });

  it("follows bars in playback order, so a repeated bar clicks again", () => {
    const bar = (start: number) => ({ start, end: start + BAR_4_4, numerator: 4, denominator: 4 });
    const downbeats = beatGrid([bar(0), bar(BAR_4_4), bar(2 * BAR_4_4)]).filter((b) => b.accent);
    expect(downbeats.map((b) => b.tick)).toEqual([0, BAR_4_4, 2 * BAR_4_4]);
  });
});

describe("firstBeatFrom", () => {
  const beats = beatGrid([{ start: 0, end: BAR_4_4, numerator: 4, denominator: 4 }]);

  it("finds the first beat at or after a tick", () => {
    expect(firstBeatFrom(beats, 0)).toBe(0);
    expect(firstBeatFrom(beats, 1)).toBe(1);
    expect(firstBeatFrom(beats, 1920)).toBe(2);
    expect(firstBeatFrom(beats, 5000)).toBe(4);
  });
});
