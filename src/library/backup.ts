import type { PracticeSettings } from "@/practice/practiceSettings";
import { normalizeSong, type FileSong, type Song } from "./song";

/**
 * A backup is one JSON file with every song and its practice settings, so a library can be moved
 * to another browser or restored after the browser's data was cleared. It's read back through the
 * normal import, which recognises it by `format`.
 */
const FORMAT = "tab-trainer-backup";
const VERSION = 1;

/** Score files are bytes; JSON carries them as base64. */
type StoredSong = Exclude<Song, FileSong> | (Omit<FileSong, "data"> & { data: string });

interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: number;
  songs: StoredSong[];
  /** Practice settings by song id. */
  practice: Record<string, PracticeSettings>;
}

export interface Backup {
  songs: Song[];
  practice: Record<string, PracticeSettings>;
}

const CHUNK = 0x8000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createBackup(backup: Backup, now = Date.now()): string {
  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: now,
    songs: backup.songs.map((song) => (song.origin === "file" ? { ...song, data: toBase64(song.data) } : song)),
    practice: backup.practice,
  };
  return JSON.stringify(file);
}

export function isBackup(json: unknown): json is BackupFile {
  return typeof json === "object" && json !== null && (json as { format?: unknown }).format === FORMAT;
}

export class BackupFormatError extends Error {}

export function readBackup(file: BackupFile): Backup {
  if (file.version > VERSION) {
    throw new BackupFormatError(
      "This backup was made by a newer version of Tab Trainer. Reload the page and try again.",
    );
  }
  if (!Array.isArray(file.songs)) throw new BackupFormatError("This backup file is damaged.");
  const songs = file.songs
    .filter((song) => typeof song?.id === "string")
    .map((song) => normalizeSong(song.origin === "file" ? { ...song, data: fromBase64(song.data) } : song));
  return { songs, practice: file.practice ?? {} };
}

export function backupFileName(now = new Date()): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  return `tab-trainer-backup-${day}.json`;
}
