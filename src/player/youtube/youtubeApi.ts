/** Minimal typings for the subset of the YouTube IFrame Player API the app uses. */

export const YtState = {
  Ended: 0,
  Playing: 1,
  Paused: 2,
  Buffering: 3,
} as const;

export interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  setVolume(volume: number): void;
  getVolume(): number;
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  destroy(): void;
}

export interface YtPlayerOptions {
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YtPlayer }) => void;
    onStateChange?: (event: { data: number; target: YtPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YtNamespace {
  Player: new (element: HTMLElement, options: YtPlayerOptions) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = "https://www.youtube.com/iframe_api";
let loading: Promise<YtNamespace> | undefined;

/** Loads the IFrame API script once and resolves when it is ready. */
export function loadYouTubeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  loading ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      loading = undefined;
      reject(new Error("Could not load YouTube. Check your internet connection."));
    };
    document.head.append(script);
  });
  return loading;
}
