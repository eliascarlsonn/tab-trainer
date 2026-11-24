import { firstBeatFrom, QUARTER_TICKS, type MetronomeBeat } from "./beatGrid";
import { playClick, type MetronomeSound } from "./clickSounds";

/** How far ahead clicks are scheduled on the audio clock. */
const LOOKAHEAD_MS = 120;
/** How often the scheduler runs. */
const SCHEDULE_EVERY_MS = 25;
/** A click found this late still sounds, immediately. */
const LATE_MS = 40;
/**
 * Right after playback starts or jumps, the first beat is found late: the rate has to be measured
 * from moving positions first. That beat (often the downbeat you pressed play on) still sounds.
 */
const START_LATE_MS = 150;
/** A position this far from the prediction is a jump (seek, loop wrap), not drift. */
const JUMP_MS = 100;
/** Position reports correct the prediction gently, so their jitter doesn't reach the clicks. */
const CORRECTION = 0.25;
/** Without a forward-moving position report for this long, playback is treated as stopped. */
const MOTION_TIMEOUT_MS = 150;
/** The first rate measurement after playback starts spans at least this long. */
const MIN_RATE_SAMPLE_MS = 50;
/** The playback rate is measured over this window and re-measured as it slides. */
const RATE_WINDOW_MS = 2000;

interface Range {
  startTick: number;
  endTick: number;
}

interface ScheduledClick {
  sources: AudioScheduledSourceNode[];
  when: number;
}

/**
 * The app's own metronome. It follows the score position (from alphaTab's synth, or from the
 * YouTube video through the sync points), so it works with either playback source, and plays its
 * clicks on its own audio context so the sound can be chosen.
 */
export class Metronome {
  private ctx: AudioContext | undefined;
  private beats: MetronomeBeat[] = [];
  private enabled = false;
  /** Predicted position: `tick` at `at` (performance.now), advancing `rate` ticks per ms. */
  private model: { tick: number; at: number } | undefined;
  private anchor: { tick: number; at: number } | undefined;
  private rate = 0;
  /** Next beat (index into `beats`) not yet scheduled. */
  private next = 0;
  /** No click has been scheduled since the last start or jump. */
  private justStarted = false;
  /** The last reported tick, and when the position last moved forward (performance.now). */
  private lastTick = -1;
  private lastMotionAt = 0;
  private lastReportAt = 0;
  /** Set once the first beats after a loop's wrap-around are scheduled ahead of time. */
  private wrap: { nextIndex: number } | undefined;
  private timer = 0;
  private scheduled: ScheduledClick[] = [];
  private countIn: { timer: number; resolve: (completed: boolean) => void } | undefined;

  constructor(
    private sound: MetronomeSound,
    private volume: number,
    /** The range playback wraps around in, while looping. */
    private readonly loop: () => Range | null,
    /** Ticks per ms at a tick when the score dictates it (the tab audio); undefined for videos. */
    private readonly expectedRate: (tick: number) => number | undefined,
  ) {}

  /** Creates or resumes the audio context; browsers only allow that during a click or key press. */
  unlock(): void {
    this.ctx ??= new AudioContext({ latencyHint: "interactive" });
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  setBeats(beats: MetronomeBeat[]): void {
    this.beats = beats;
    this.restart();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.silence();
    this.updateTimer();
  }

  setSound(sound: MetronomeSound): void {
    this.sound = sound;
  }

  setVolume(volume: number): void {
    this.volume = volume;
  }

  /** Plays one accented click right away, to hear the current sound. */
  preview(): void {
    this.unlock();
    if (this.ctx) playClick(this.ctx, this.sound, this.ctx.currentTime + 0.01, true, this.volume);
  }

  /** Forgets the predicted position and rate, e.g. after a speed change; the next report starts over. */
  restart(): void {
    this.model = undefined;
    this.rate = 0;
    this.silence();
  }

  /** Pausing cancels clicks already scheduled; starting is picked up from the moving position. */
  setPlaying(playing: boolean): void {
    if (!playing) this.restart();
  }

  /**
   * A position report (they keep coming every few ms while playing). Clicks follow the position
   * only while it moves, which is also how the start of playback is detected: alphaTab reports the
   * start position a few times before the audio moves, and announces "playing" only afterwards.
   */
  onPosition(tick: number): void {
    const now = performance.now();
    // After a pause between reports (paused, buffering), the last one says nothing about speed.
    const fresh = now - this.lastReportAt > MOTION_TIMEOUT_MS;
    this.lastReportAt = now;
    const model = this.model;
    if (!model) return this.jumpTo(tick, now);
    const moved = tick > this.lastTick;
    this.lastTick = tick;

    if (!this.rate) {
      // The score gives the exact rate for the tab audio; a video's rate has to be measured.
      const expected = moved ? this.expectedRate(tick) : undefined;
      if (expected) {
        this.rate = expected;
        this.lastMotionAt = now;
      }
      if (expected || !moved || fresh) {
        // Measuring starts here: when playback starts moving (or will).
        this.anchor = { tick, at: now };
      } else if (now - this.anchor!.at >= MIN_RATE_SAMPLE_MS) {
        this.rate = (tick - this.anchor!.tick) / (now - this.anchor!.at);
        this.lastMotionAt = now;
      }
      this.model = { tick, at: now };
      return;
    }

    const predicted = model.tick + (now - model.at) * this.rate;
    if (Math.abs(tick - predicted) / this.rate > JUMP_MS) {
      // Running ahead of the prediction while reports keep coming means the rate is off (a video
      // creeps for a moment while it starts), not that playback jumped: measure it again.
      if (!fresh && tick > predicted) this.rate = 0;
      return this.jumpTo(tick, now);
    }
    if (moved) this.lastMotionAt = now;

    const anchor = this.anchor!;
    if (now - anchor.at > 250 && tick > anchor.tick) this.rate = (tick - anchor.tick) / (now - anchor.at);
    if (now - anchor.at > RATE_WINDOW_MS) this.anchor = { tick, at: now };
    this.model = { tick: predicted + (tick - predicted) * CORRECTION, at: now };
  }

  /**
   * Clicks one bar in and resolves true `leadMs` before the bar ends, so playback started then is
   * heard right on the next downbeat; resolves false if cancelled (pause pressed meanwhile).
   * Works whether or not the metronome itself is on.
   */
  playCountIn(beats: number, beatMs: number, leadMs: number): Promise<boolean> {
    this.cancelCountIn();
    this.unlock();
    const ctx = this.ctx!;
    const start = ctx.currentTime + 0.05;
    for (let i = 0; i < beats; i++) this.schedule(i === 0, start + (i * beatMs) / 1000);
    return new Promise((resolve) => {
      const timer = window.setTimeout(
        () => {
          this.countIn = undefined;
          resolve(true);
        },
        Math.max(0, 50 + beats * beatMs - leadMs),
      );
      this.countIn = { timer, resolve };
    });
  }

  get countingIn(): boolean {
    return !!this.countIn;
  }

  cancelCountIn(): void {
    if (!this.countIn) return;
    clearTimeout(this.countIn.timer);
    this.countIn.resolve(false);
    this.countIn = undefined;
    this.silence();
  }

  dispose(): void {
    this.cancelCountIn();
    clearInterval(this.timer);
    void this.ctx?.close();
  }

  private jumpTo(tick: number, now: number) {
    // After a seek the speed is unchanged, so the measured rate still holds.
    const rate = this.rate;
    const wrapped = this.wrap;
    const loop = this.loop();
    // Landing back at the loop start right after its first beats were scheduled ahead: keep those.
    const isPlannedWrap =
      !!wrapped && !!loop && tick >= loop.startTick && tick - loop.startTick < (JUMP_MS + LATE_MS) * (rate || 1);
    if (!isPlannedWrap) this.silence();
    this.wrap = undefined;
    this.model = { tick, at: now };
    this.anchor = { tick, at: now };
    this.rate = rate;
    this.justStarted = true;
    // A jump (seek, loop wrap) isn't movement; clicks resume once the position moves on from it.
    this.lastMotionAt = 0;
    this.lastTick = tick;
    // Look back far enough for the beat just passed; scheduling still drops it if it's too late.
    // Before the rate is known (playback just started), a quarter note stands in.
    const late = firstBeatFrom(this.beats, tick - (rate ? START_LATE_MS * rate : QUARTER_TICKS));
    this.next = isPlannedWrap ? Math.max(late, wrapped!.nextIndex) : late;
  }

  private updateTimer() {
    const run = this.enabled;
    if (run && !this.timer) this.timer = window.setInterval(() => this.scheduleAhead(), SCHEDULE_EVERY_MS);
    if (!run && this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private scheduleAhead() {
    const ctx = this.ctx;
    const model = this.model;
    if (!ctx || !model || !this.rate || !this.enabled) return;
    const rate = this.rate;
    const now = performance.now();
    // Paused, buffering, or just seeked: nothing to click until the position moves again.
    if (now - this.lastMotionAt > MOTION_TIMEOUT_MS) return;
    const tickNow = model.tick + (now - model.at) * rate;
    const horizon = tickNow + LOOKAHEAD_MS * rate;
    const loop = this.loop();
    const end = loop ? loop.endTick : Infinity;
    const clickAt = (delayMs: number) => ctx.currentTime + Math.max(0, delayMs) / 1000;

    while (this.next < this.beats.length) {
      const beat = this.beats[this.next]!;
      if (beat.tick > horizon || beat.tick >= end) break;
      this.next++;
      const delay = (beat.tick - tickNow) / rate;
      if (delay >= -(this.justStarted ? START_LATE_MS : LATE_MS)) this.schedule(beat.accent, clickAt(delay));
      this.justStarted = false;
    }

    // Within reach of a loop's end: schedule the loop start's first beats now, so the downbeat
    // after the wrap isn't late waiting for the position report that announces the jump.
    if (loop && horizon >= end && !this.wrap) {
      const overflow = horizon - end;
      let i = firstBeatFrom(this.beats, loop.startTick);
      for (; i < this.beats.length; i++) {
        const beat = this.beats[i]!;
        if (beat.tick > loop.startTick + overflow) break;
        this.schedule(beat.accent, clickAt((end - tickNow + beat.tick - loop.startTick) / rate));
      }
      this.wrap = { nextIndex: i };
    }
  }

  private schedule(accent: boolean, when: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.scheduled = this.scheduled.filter((click) => click.when > ctx.currentTime - 0.5);
    this.scheduled.push({ sources: playClick(ctx, this.sound, when, accent, this.volume), when });
  }

  /** Cancels clicks that haven't sounded yet. */
  private silence() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const click of this.scheduled) {
      if (click.when <= ctx.currentTime) continue;
      for (const source of click.sources) {
        try {
          source.stop(0);
        } catch {
          // Already stopped: nothing left to cancel.
        }
      }
    }
    this.scheduled = [];
    this.wrap = undefined;
  }
}
