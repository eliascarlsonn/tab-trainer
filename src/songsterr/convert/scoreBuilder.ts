import { model, Settings } from "@coderline/alphatab";
import type { SsTrack } from "../types";
import { buildMasterBars } from "./masterBarBuilder";
import { buildTrack } from "./trackBuilder";

export interface ScoreSource {
  title: string;
  artist: string;
  tracks: SsTrack[];
  /** partIds of vocal tracks, rendered as standard notation instead of tab. */
  vocalPartIds: ReadonlySet<number>;
}

/** Converts captured Songsterr tracks into a complete, playable alphaTab score. */
export function buildScore(source: ScoreSource, settings: Settings = new Settings()): model.Score {
  const [reference] = source.tracks;
  if (!reference) throw new Error("A score needs at least one track.");

  const score = new model.Score();
  score.title = source.title;
  score.artist = source.artist;

  for (const masterBar of buildMasterBars(reference)) score.addMasterBar(masterBar);
  source.tracks.forEach((track, index) => {
    score.addTrack(buildTrack(track, index, { isVocal: source.vocalPartIds.has(track.partId) }));
  });

  score.finish(settings);
  return score;
}
