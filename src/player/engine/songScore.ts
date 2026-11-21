import { importer, type model, type Settings } from "@coderline/alphatab";
import type { Song } from "@/library/song";
import { buildScore } from "@/songsterr/convert/scoreBuilder";

export interface SongScore {
  score: model.Score;
  /** Score track index for each partId in the song's catalog. */
  trackIndexByPart: Map<number, number>;
}

/** Builds the playable alphaTab score for a library song, whichever way it was imported. */
export function scoreForSong(song: Song, settings: Settings): SongScore {
  if (song.origin === "file") {
    const score = importer.ScoreLoader.loadScoreFromBytes(song.data, settings);
    return { score, trackIndexByPart: new Map(score.tracks.map((t) => [t.index, t.index])) };
  }
  const vocalPartIds = new Set(song.catalog.filter((t) => t.role === "vocals").map((t) => t.partId));
  return {
    score: buildScore({ ...song, vocalPartIds }, settings),
    trackIndexByPart: new Map(song.tracks.map((t, i) => [t.partId, i])),
  };
}
