import { describe, expect, it } from "vitest";
import { sortSongs } from "./librarySort";
import type { Song } from "./song";

const song = (title: string, artist: string, importedAt: number, lastPlayedAt?: number) =>
  ({ id: title, title, artist, importedAt, lastPlayedAt }) as Song;

const songs = [
  song("Master of Puppets", "Metallica", 1, 50),
  song("Hot for Teacher", "Van Halen", 3),
  song("Come Together", "The Beatles", 2, 10),
  song("Enter Sandman", "Metallica", 4, 5),
];
const titles = (order: Parameters<typeof sortSongs>[1]) => sortSongs(songs, order).map((s) => s.title);

describe("sortSongs", () => {
  it("puts the most recently played first, counting unplayed songs from when they were added", () => {
    expect(titles("recent")).toEqual(["Master of Puppets", "Come Together", "Enter Sandman", "Hot for Teacher"]);
  });

  it("puts the newest import first", () => {
    expect(titles("added")).toEqual(["Enter Sandman", "Hot for Teacher", "Come Together", "Master of Puppets"]);
  });

  it("sorts titles alphabetically", () => {
    expect(titles("title")).toEqual(["Come Together", "Enter Sandman", "Hot for Teacher", "Master of Puppets"]);
  });

  it("sorts by artist ignoring a leading 'The', then by title", () => {
    expect(titles("artist")).toEqual(["Come Together", "Enter Sandman", "Master of Puppets", "Hot for Teacher"]);
  });

  it("ignores case and orders numbers naturally", () => {
    const mixed = [song("track 10", "a", 0), song("Track 2", "a", 0), song("apple", "a", 0)];
    expect(sortSongs(mixed, "title").map((s) => s.title)).toEqual(["apple", "Track 2", "track 10"]);
  });
});
