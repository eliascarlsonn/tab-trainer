import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSyncPoints } from "@/player/sync/syncPoints";
import { songFromCapture } from "@/library/song";
import { buildScore } from "./convert/scoreBuilder";
import { extractSongsFromHar, NothingCapturedError } from "./harImport";

/** Private capture, never committed. Tests are skipped when it is absent. */
const SAMPLE = new URL("../../samples/master-of-puppets.har", import.meta.url);
const hasSample = existsSync(SAMPLE);

describe("extractSongsFromHar", () => {
  it("rejects files that are not HAR captures", () => {
    expect(() => extractSongsFromHar({ foo: 1 })).toThrow(/not a HAR/);
  });

  it("reports when a HAR contains no tabs", () => {
    expect(() => extractSongsFromHar({ log: { entries: [] } })).toThrow(NothingCapturedError);
  });
});

describe.runIf(hasSample)("sample capture", () => {
  const [captured] = extractSongsFromHar(JSON.parse(readFileSync(SAMPLE, "utf8")));
  const song = songFromCapture(captured!);

  it("extracts song metadata, tracks and videos", () => {
    expect(song.title).toBe("Master of Puppets");
    expect(song.artist).toBe("Metallica");
    expect(song.tracks).toHaveLength(11);
    expect(song.catalog.every((t) => t.captured)).toBe(true);
    expect(song.videos[0]?.kind).toBe("original");
  });

  it("classifies track roles", () => {
    const roles = song.catalog.map((t) => t.role);
    expect(roles).toContain("drums");
    expect(roles).toContain("bass");
    expect(roles).toContain("vocals");
    expect(roles.filter((r) => r === "guitar").length).toBeGreaterThan(2);
  });

  it("builds a complete alphaTab score", () => {
    const vocalPartIds = new Set(song.catalog.filter((t) => t.role === "vocals").map((t) => t.partId));
    const score = buildScore({ ...song, vocalPartIds });

    expect(score.masterBars).toHaveLength(song.tracks[0]!.measures.length);
    expect(score.tracks).toHaveLength(11);
    expect(score.masterBars[0]!.tempoAutomations[0]?.value).toBe(212);
    expect(score.masterBars.some((b) => b.section?.text.startsWith("Intro"))).toBe(true);

    const drums = score.tracks.find((t) => t.staves[0]!.isPercussion)!;
    expect(drums.playbackInfo.primaryChannel).toBe(9);

    const notes = score.tracks.flatMap((t) => t.staves[0]!.bars.flatMap((b) => b.voices.flatMap((v) => v.beats.flatMap((bt) => bt.notes))));
    expect(notes.length).toBeGreaterThan(10_000);
    expect(notes.some((n) => n.hasBend)).toBe(true);
  });

  it("maps the original video onto every bar", () => {
    const score = buildScore({ ...song, vocalPartIds: new Set() });
    const points = buildSyncPoints(score.masterBars, song.videos[0]!.points);
    expect(points).toHaveLength(score.masterBars.length);
    expect(points[1]!.millisecondOffset).toBeGreaterThan(points[0]!.millisecondOffset);
  });
});
