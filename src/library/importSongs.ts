import { HarFormatError, tryParseJson } from "@/songsterr/har";
import { extractSongsFromHar } from "@/songsterr/harImport";
import { songFromScoreFile } from "./scoreFile";
import { mergeSongs, songFromCapture, type Song } from "./song";

export interface ImportOutcome {
  songs: Song[];
  errors: { fileName: string; message: string }[];
}

const isCaptureFile = (file: File) => /\.(har|json)$/i.test(file.name);

async function readCapture(file: File): Promise<Song[]> {
  const json = tryParseJson(await file.text());
  if (json === undefined) throw new HarFormatError("This file is not a HAR capture.");
  return extractSongsFromHar(json).map((captured) => songFromCapture(captured));
}

/** Songsterr captures are HAR (JSON) files; everything else is tried as a score file. */
async function readSongs(file: File): Promise<Song[]> {
  return isCaptureFile(file) ? readCapture(file) : [await songFromScoreFile(file)];
}

/**
 * Reads Songsterr captures and score files and merges their songs into the library.
 * `existing` looks up the current library entry so new tracks extend it.
 */
export async function importSongs(
  files: readonly File[],
  existing: (id: string) => Song | undefined,
): Promise<ImportOutcome> {
  const imported = new Map<string, Song>();
  const errors: ImportOutcome["errors"] = [];

  for (const file of files) {
    try {
      for (const song of await readSongs(file)) {
        const base = imported.get(song.id) ?? existing(song.id);
        imported.set(song.id, base ? mergeSongs(base, song) : song);
      }
    } catch (error) {
      errors.push({ fileName: file.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { songs: [...imported.values()], errors };
}
