import { HarFormatError, tryParseJson } from "@/songsterr/har";
import { extractSongsFromHar } from "@/songsterr/harImport";
import { mergeSongs, songFromCapture, type Song } from "./song";

export interface ImportOutcome {
  songs: Song[];
  errors: { fileName: string; message: string }[];
}

async function readCapture(file: File): Promise<Song[]> {
  const json = tryParseJson(await file.text());
  if (json === undefined) throw new HarFormatError("This file is not a HAR capture.");
  return extractSongsFromHar(json).map((captured) => songFromCapture(captured));
}

/**
 * Reads HAR files and merges their songs into the library.
 * `existing` looks up the current library entry so new tracks extend it.
 */
export async function importCaptures(
  files: readonly File[],
  existing: (id: string) => Song | undefined,
): Promise<ImportOutcome> {
  const imported = new Map<string, Song>();
  const errors: ImportOutcome["errors"] = [];

  for (const file of files) {
    try {
      for (const song of await readCapture(file)) {
        const base = imported.get(song.id) ?? existing(song.id);
        imported.set(song.id, base ? mergeSongs(base, song) : song);
      }
    } catch (error) {
      errors.push({ fileName: file.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { songs: [...imported.values()], errors };
}
