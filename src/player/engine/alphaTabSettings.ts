import { LayoutMode, NotationElement, PlayerMode, StaveProfile, type json } from "@coderline/alphatab";
import type { PlaybackSource } from "@/practice/practiceSettings";

const ASSET_BASE = import.meta.env.BASE_URL;

/** Score colors come from the CSS design tokens so the tab always matches the app theme. */
function scoreColors() {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return {
    mainGlyphColor: token("--score-ink"),
    secondaryGlyphColor: token("--score-ink-soft"),
    scoreInfoColor: token("--score-ink"),
    staffLineColor: token("--score-line"),
    barSeparatorColor: token("--score-line-strong"),
    barNumberColor: token("--score-ink-faint"),
  };
}

export function playerModeFor(source: PlaybackSource): PlayerMode {
  return source.kind === "video" ? PlayerMode.EnabledExternalMedia : PlayerMode.EnabledSynthesizer;
}

/** The score header is drawn by the app itself, so alphaTab's own title block is hidden. */
const HIDDEN_ELEMENTS = [
  NotationElement.ScoreTitle,
  NotationElement.ScoreSubTitle,
  NotationElement.ScoreArtist,
  NotationElement.ScoreAlbum,
  NotationElement.ScoreWords,
  NotationElement.ScoreMusic,
  NotationElement.ScoreWordsAndMusic,
  NotationElement.ScoreCopyright,
  NotationElement.TrackNames,
];

export interface AlphaTabSettingsOptions {
  scrollElement: HTMLElement;
  zoom: number;
  source: PlaybackSource;
}

export function createAlphaTabSettings({ scrollElement, zoom, source }: AlphaTabSettingsOptions): json.SettingsJson {
  return {
    core: {
      fontDirectory: `${ASSET_BASE}font/`,
    },
    display: {
      scale: zoom,
      layoutMode: LayoutMode.Page,
      staveProfile: StaveProfile.Default,
      resources: scoreColors(),
    },
    notation: {
      elements: new Map(HIDDEN_ELEMENTS.map((element) => [element, false])),
    },
    player: {
      playerMode: playerModeFor(source),
      soundFont: `${ASSET_BASE}soundfont/sonivox.sf2`,
      scrollElement,
      enableCursor: true,
      enableAnimatedBeatCursor: true,
      enableElementHighlighting: true,
      enableSeekToClick: true,
      enablePlaybackRangeSelection: true,
      resetPlaybackRangeOnClick: false,
      scrollOffsetY: -120,
    },
  };
}
