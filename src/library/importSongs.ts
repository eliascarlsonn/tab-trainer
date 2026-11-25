import type { PracticeSettings } from "@/practice/practiceSettings";
import { HarFormatError, tryParseJson } from "@/songsterr/har";
import { extractSongsFromHar } from "@/songsterr/harImport";
import { isBackup, readBackup, type Backup } from "./backup";
import { songFromScoreFile } from "./scoreFile";
import { mergeSongs, songFromCapture, type Song } from "./song";

export interface ImportOptions {
  /** Whether backups are restored; off for songs that arrive from another site. */
  backups?: boolean;
}

export interface ImportOutcome {
  /** New and updated songs to save. */
  songs: Song[];
  /** Practice settings that came with songs restored from a backup. */
  practice: Record<string, PracticeSettings>;
  /** Songs added from backups, and songs in them that were already in the library (left as they are). */
  restored: number;
  alreadyHad: number;
  errors: { fileName: string; message: string }[];
}

const isJsonFile = (file: File) => /\.(har|json)$/i.test(file.name);

type FileContents = { kind: "songs"; songs: Song[] } | { kind: "backup"; backup: Backup };

/** A JSON file is a Songsterr capture (HAR) or a library backup. */
async function readJson(file: File, backups: boolean): Promise<FileContents> {
  const json = tryParseJson(await file.text());
  if (json === undefined) throw new HarFormatError("This file is not a Songsterr capture or a Tab Trainer backup.");
  if (backups && isBackup(json)) return { kind: "backup", backup: readBackup(json) };
  return { kind: "songs", songs: extractSongsFromHar(json).map((captured) => songFromCapture(captured)) };
}

/** Everything that isn't JSON is tried as a score file. */
async function readFile(file: File, backups: boolean): Promise<FileContents> {
  return isJsonFile(file) ? readJson(file, backups) : { kind: "songs", songs: [await songFromScoreFile(file)] };
}

/**
 * Reads Songsterr captures, score files and backups, and merges their songs into the library.
 * `existing` looks up the current library entry so new tracks extend it. A backup only adds the
 * songs the library doesn't have, so restoring never overwrites newer work.
 */
export async function importSongs(
  files: readonly File[],
  existing: (id: string) => Song | undefined,
  { backups = true }: ImportOptions = {},
): Promise<ImportOutcome> {
  const imported = new Map<string, Song>();
  const outcome: ImportOutcome = { songs: [], practice: {}, restored: 0, alreadyHad: 0, errors: [] };

  for (const file of files) {
    try {
      const contents = await readFile(file, backups);
      if (contents.kind === "backup") {
        for (const song of contents.backup.songs) {
          if (imported.has(song.id) || existing(song.id)) {
            outcome.alreadyHad++;
            continue;
          }
          imported.set(song.id, song);
          const practice = contents.backup.practice[song.id];
          if (practice) outcome.practice[song.id] = practice;
          outcome.restored++;
        }
        continue;
      }
      for (const song of contents.songs) {
        const base = imported.get(song.id) ?? existing(song.id);
        imported.set(song.id, base ? mergeSongs(base, song) : song);
      }
    } catch (error) {
      outcome.errors.push({ fileName: file.name, message: error instanceof Error ? error.message : String(error) });
    }
  }
  outcome.songs = [...imported.values()];
  return outcome;
}
