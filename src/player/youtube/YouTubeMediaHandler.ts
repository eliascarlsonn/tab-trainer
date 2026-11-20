import type { synth } from "@coderline/alphatab";
import { YtState, type YtPlayer } from "./youtubeApi";

const SEEK_SETTLE_MS = 1500;
/** How long YouTube may take to report a seek's new time before its own clock is trusted again. */
const SEEK_REPORT_TIMEOUT_MS = 3000;
/** A reported time this close to the seek target means YouTube has caught up. */
const SEEK_REPORT_TOLERANCE_MS = 500;

/**
 * Lets alphaTab use a YouTube video as its time axis.
 * alphaTab drives the video through this handler; while the video plays,
 * its current time is pumped back into alphaTab every animation frame.
 */
export class YouTubeMediaHandler implements synth.IExternalMediaHandler {
  private frame = 0;
  /** YouTube starts unstarted videos when seeking; such plays are undone until this time. */
  private holdPausedUntil = 0;
  /**
   * YouTube seeks asynchronously: right after `seekTo`, `getCurrentTime()` still returns the old
   * time. Reporting that would snap alphaTab's cursor back, so the target is reported instead.
   */
  private pendingSeek: { timeMs: number; until: number } | undefined;

  constructor(
    private readonly video: YtPlayer,
    private readonly output: synth.IExternalMediaSynthOutput,
  ) {}

  get backingTrackDuration(): number {
    return this.video.getDuration() * 1000;
  }

  get playbackRate(): number {
    return this.video.getPlaybackRate();
  }

  set playbackRate(value: number) {
    this.video.setPlaybackRate(value);
  }

  get masterVolume(): number {
    return this.video.getVolume() / 100;
  }

  set masterVolume(value: number) {
    this.video.setVolume(value * 100);
  }

  seekTo(time: number): void {
    const now = performance.now();
    if (this.video.getPlayerState() !== YtState.Playing) this.holdPausedUntil = now + SEEK_SETTLE_MS;
    this.pendingSeek = { timeMs: time, until: now + SEEK_REPORT_TIMEOUT_MS };
    this.video.seekTo(time / 1000, true);
    this.reportPosition();
  }

  play(): void {
    this.holdPausedUntil = 0;
    this.video.playVideo();
  }

  pause(): void {
    this.video.pauseVideo();
  }

  /**
   * Must be forwarded from the YouTube player's `onStateChange`.
   * Returns false when the change was an artifact of seeking and should be ignored.
   */
  onVideoStateChange(state: number): boolean {
    if (state === YtState.Playing && performance.now() < this.holdPausedUntil) {
      this.video.pauseVideo();
      return false;
    }
    if (state === YtState.Playing) this.startPumping();
    else this.stopPumping();
    return true;
  }

  dispose(): void {
    this.stopPumping();
  }

  private reportPosition() {
    this.output.updatePosition(this.currentTimeMs());
  }

  private currentTimeMs(): number {
    const actual = this.video.getCurrentTime() * 1000;
    const seek = this.pendingSeek;
    if (!seek) return actual;
    const caughtUp = Math.abs(actual - seek.timeMs) < SEEK_REPORT_TOLERANCE_MS;
    if (caughtUp || performance.now() > seek.until) {
      this.pendingSeek = undefined;
      return actual;
    }
    return seek.timeMs;
  }

  private startPumping() {
    if (this.frame) return;
    const tick = () => {
      this.reportPosition();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stopPumping() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.reportPosition();
  }
}
