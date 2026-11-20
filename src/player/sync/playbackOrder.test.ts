import { describe, expect, it } from "vitest";
import { playbackOrder } from "./playbackOrder";

const bar = (overrides: Partial<{ isRepeatStart: boolean; repeatCount: number; alternateEndings: number }> = {}) => ({
  isRepeatStart: false,
  repeatCount: 0,
  alternateEndings: 0,
  ...overrides,
});

describe("playbackOrder", () => {
  it("plays straight through without repeats", () => {
    expect(playbackOrder([bar(), bar(), bar()])).toEqual([0, 1, 2]);
  });

  it("repeats a section the requested number of times", () => {
    const bars = [bar(), bar({ isRepeatStart: true }), bar({ repeatCount: 3 }), bar()];
    expect(playbackOrder(bars)).toEqual([0, 1, 2, 1, 2, 1, 2, 3]);
  });

  it("repeats from the beginning when no start marker exists", () => {
    expect(playbackOrder([bar(), bar({ repeatCount: 2 }), bar()])).toEqual([0, 1, 0, 1, 2]);
  });

  it("takes the matching alternate ending on each pass", () => {
    const bars = [
      bar({ isRepeatStart: true }),
      bar({ alternateEndings: 0b01, repeatCount: 2 }),
      bar({ alternateEndings: 0b10 }),
      bar(),
    ];
    expect(playbackOrder(bars)).toEqual([0, 1, 0, 2, 3]);
  });

  it("handles consecutive repeat groups", () => {
    const bars = [bar({ isRepeatStart: true }), bar({ repeatCount: 2 }), bar({ isRepeatStart: true }), bar({ repeatCount: 2 })];
    expect(playbackOrder(bars)).toEqual([0, 1, 0, 1, 2, 3, 2, 3]);
  });
});
