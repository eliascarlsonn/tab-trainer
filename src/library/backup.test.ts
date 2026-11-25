import { describe, expect, it } from "vitest";
import { backupFileName, createBackup, isBackup, readBackup } from "./backup";
import type { FileSong, SongsterrSong } from "./song";
import type { PracticeSettings } from "@/practice/practiceSettings";

const base = { catalog: [], videos: [], defaultPartId: undefined, importedAt: 1, lastPlayedAt: 2 };

const fileSong: FileSong = {
  ...base,
  origin: "file",
  id: "file-abc",
  title: "Riff",
  artist: "Me",
  fileName: "riff.gp",
  data: new Uint8Array([0, 1, 2, 250, 255]),
  favorite: true,
};

const capturedSong = {
  ...base,
  origin: "songsterr",
  id: "songsterr-1",
  songId: 1,
  revisionId: 2,
  title: "Song",
  artist: "Band",
  tracks: [],
} as SongsterrSong;

describe("backup", () => {
  it("round-trips songs, including score file bytes, and practice settings", () => {
    const practice = { "file-abc": { speed: 0.8 } as PracticeSettings };
    const json: unknown = JSON.parse(createBackup({ songs: [fileSong, capturedSong], practice }));
    expect(isBackup(json)).toBe(true);
    if (!isBackup(json)) return;
    const restored = readBackup(json);
    expect(restored.songs).toEqual([fileSong, capturedSong]);
    expect(restored.songs[0]).toMatchObject({ data: expect.any(Uint8Array) });
    expect(restored.practice).toEqual(practice);
  });

  it("carries large score files", () => {
    const data = new Uint8Array(200_000).map((_, i) => i % 256);
    const json: unknown = JSON.parse(createBackup({ songs: [{ ...fileSong, data }], practice: {} }));
    if (!isBackup(json)) throw new Error("not a backup");
    expect((readBackup(json).songs[0] as FileSong).data).toEqual(data);
  });

  it("is not mistaken for other JSON files", () => {
    expect(isBackup({ log: { entries: [] } })).toBe(false);
    expect(isBackup(null)).toBe(false);
  });

  it("refuses backups from a newer version", () => {
    expect(() =>
      readBackup({ format: "tab-trainer-backup", version: 99, exportedAt: 0, songs: [], practice: {} }),
    ).toThrow(/newer version/);
  });

  it("names the file after the day", () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe("tab-trainer-backup-2026-11-05.json");
  });
});
