import type { synth } from "@coderline/alphatab";
import { YtState, type YtPlayer } from "./youtubeApi";

const SEEK_SETTLE_MS = 1500;

/**
 * Lets alphaTab use a YouTube video as its time axis.
 * alphaTab drives the video through this handler; while the video plays,
 * its current time is pumped back into alphaTab every animation frame.
 */
export class YouTubeMediaHandler implements synth.IExternalMediaHandler {
  private frame = 0;
  /** YouTube starts unstarted videos when seeking; such plays are undone until this time. */
  private holdPausedUntil = 0;

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
    if (this.video.getPlayerState() !== YtState.Playing) this.holdPausedUntil = performance.now() + SEEK_SETTLE_MS;
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
    this.output.updatePosition(this.video.getCurrentTime() * 1000);
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
