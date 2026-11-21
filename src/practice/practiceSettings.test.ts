import { describe, expect, it } from "vitest";
import { BACKGROUND_TRACK_LEVEL, DEFAULT_TRACK_MIX, trackVolume } from "./practiceSettings";

describe("trackVolume", () => {
  it("plays the track on screen at full volume and lowers the others", () => {
    expect(trackVolume(DEFAULT_TRACK_MIX, true)).toBe(1);
    expect(trackVolume(DEFAULT_TRACK_MIX, false)).toBe(BACKGROUND_TRACK_LEVEL);
  });

  it("keeps a volume set by hand whichever track is on screen", () => {
    const mix = { ...DEFAULT_TRACK_MIX, volume: 0.8 };
    expect(trackVolume(mix, true)).toBe(0.8);
    expect(trackVolume(mix, false)).toBe(0.8);
  });
});
