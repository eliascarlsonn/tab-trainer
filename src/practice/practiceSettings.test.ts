import { describe, expect, it } from "vitest";
import type { Song, VideoKind } from "@/library/song";
import { BACKGROUND_TRACK_LEVEL, DEFAULT_TRACK_MIX, defaultSource, trackVolume } from "./practiceSettings";

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

describe("defaultSource", () => {
  const song = (videos: { videoId: string; kind: VideoKind }[]) =>
    ({ videos: videos.map((v) => ({ ...v, points: [] })) }) as unknown as Song;

  it("plays along with the original recording when there is one", () => {
    const videos = [
      { videoId: "backing", kind: "backing" as const },
      { videoId: "orig", kind: "original" as const },
    ];
    expect(defaultSource(song(videos))).toEqual({ kind: "video", videoId: "orig" });
  });

  it("uses the tab audio when no original recording was captured", () => {
    expect(defaultSource(song([{ videoId: "backing", kind: "backing" }]))).toEqual({ kind: "synth" });
    expect(defaultSource(song([]))).toEqual({ kind: "synth" });
  });
});
