import { AlphaTabApi, model, synth, type PlaybackHighlightChangeEventArgs } from "@coderline/alphatab";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Song } from "@/library/song";
import { clamp } from "@/lib/math";
import {
  DEFAULT_TRACK_MIX,
  trackVolume,
  PITCH_RANGE,
  SPEED_RANGE,
  VOLUME_RANGE,
  ZOOM_RANGE,
  type NotationMode,
  type PlaybackSource,
  type PracticeSettings,
  type SavedLoop,
  type TickRange,
  type TrackMix,
  type TrainerSettings,
} from "@/practice/practiceSettings";
import { buildSyncPoints } from "../sync/syncPoints";
import { completePass } from "../trainer/speedTrainer";
import { YtState, type YtPlayer } from "../youtube/youtubeApi";
import { YouTubeMediaHandler } from "../youtube/YouTubeMediaHandler";
import { createAlphaTabSettings, playerModeFor } from "./alphaTabSettings";
import { initialEngineState, type EngineState } from "./engineState";
import { beatsSpanning, isMelodic, sectionBarRange, sectionsOf } from "./scoreQueries";
import { beatGrid, QUARTER_TICKS } from "../metronome/beatGrid";
import type { MetronomeSound } from "../metronome/clickSounds";
import { Metronome } from "../metronome/Metronome";
import { loadMetronomePrefs, METRONOME_VOLUME_RANGE, saveMetronomePrefs } from "../metronome/metronomePrefs";
import { scoreForSong } from "./songScore";

const beatOrder = (beat: model.Beat) => beat.absolutePlaybackStart;

/** How far (px) above and below the pointer to look for a line of tab when it's between lines. */
const LINE_SEARCH_RANGE = 240;
const LINE_SEARCH_STEP = 12;

/**
 * Owns one alphaTab instance for one song and exposes practice-oriented controls.
 * All observable state lives in `store`; UI code reads it and calls the methods below.
 */
export class PlayerEngine {
  readonly store: StoreApi<EngineState>;
  private readonly api: AlphaTabApi;
  private readonly score: model.Score;
  private readonly trackIndexByPart: Map<number, number>;
  private media: YouTubeMediaHandler | undefined;
  private readonly metronome: Metronome;
  /**
   * How long playback takes to be heard after it's started, per source, learned from each start:
   * the synth fills its audio buffer first (a few hundred ms), a paused video starts almost at once.
   * A count-in starts playback this much early so the music begins on the downbeat.
   */
  private readonly startupMs = { synth: 280, video: 30 };
  /** When playback was last asked to start, until the position is seen moving. */
  private playRequestedAt: number | undefined;
  private lastPositionTick = -1;
  /** Range last pushed into alphaTab's player; undefined until the player is (re)created. */
  private appliedRange: TickRange | null | undefined;
  /**
   * Ranges this engine pushed whose change events haven't come back yet. With the synth in a
   * worker they arrive asynchronously, so they must be told apart from the user's own selections.
   */
  private readonly pendingRangeEchoes: (TickRange | null)[] = [];
  /** Beats currently highlighted as the loop, kept so one edge can be dragged. */
  private highlighted: { start: model.Beat; end: model.Beat } | undefined;
  /** Set while the highlight is replaced by an empty one, so no handles are shown for it. */
  private clearingHighlight = false;
  /** Beat where a loop is being painted from, and whether the drag has left it yet. */
  private paintAnchor: model.Beat | undefined;
  private painting = false;

  constructor(
    private readonly host: HTMLElement,
    scrollElement: HTMLElement,
    private readonly song: Song,
    settings: PracticeSettings,
  ) {
    const prefs = loadMetronomePrefs();
    this.store = createStore<EngineState>(() => ({
      ...initialEngineState(settings),
      metronomeSound: prefs.sound,
      metronomeVolume: prefs.volume,
    }));
    // Loops wrap around the range alphaTab plays in, which is only set while looping is on.
    this.metronome = new Metronome(
      prefs.sound,
      prefs.volume,
      () => (this.settings.loopEnabled ? (this.appliedRange ?? null) : null),
      (tick) => (this.settings.source.kind === "synth" ? this.scoreTickRate(tick) : undefined),
    );
    this.api = new AlphaTabApi(
      host,
      createAlphaTabSettings({ scrollElement, zoom: settings.zoom, source: settings.source }),
    );

    ({ score: this.score, trackIndexByPart: this.trackIndexByPart } = scoreForSong(song, this.api.settings));

    this.bindEvents();
    this.applyNotation(settings.notation);
    this.applySyncPoints();
    this.store.setState({ sections: sectionsOf(this.score), barCount: this.score.masterBars.length });
    this.api.renderScore(this.score, [this.displayedTrack().index]);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  destroy(): void {
    this.metronome.dispose();
    this.media?.dispose();
    this.api.destroy();
  }

  private get settings(): PracticeSettings {
    return this.store.getState().settings;
  }

  private patchSettings(patch: Partial<PracticeSettings>) {
    this.store.setState((state) => ({ settings: { ...state.settings, ...patch } }));
  }

  private bindEvents() {
    const api = this.api;
    const set = this.store.setState;

    api.soundFontLoad.on((e) => set({ soundFontProgress: e.total ? e.loaded / e.total : 0 }));
    api.renderFinished.on(() => {
      set({ phase: "ready" });
      this.restoreLoopHighlight();
    });
    api.error.on((error) => set({ phase: "error", error: error.message }));
    api.playbackRangeHighlightChanged.on((e) => this.onHighlightChanged(e));
    api.playerReady.on(() => this.onPlayerReady());
    api.playerStateChanged.on((e) => {
      const playing = e.state === synth.PlayerState.Playing;
      set({ playing });
      this.metronome.setPlaying(playing);
    });
    api.midiLoaded.on(() => this.updateBeatGrid());
    api.playerFinished.on(() => this.onLoopPassCompleted());
    api.playedBeatChanged.on((beat) => set({ currentBar: beat.voice.bar.index }));
    api.playerPositionChanged.on((e) => {
      set({ currentTimeMs: e.currentTime, endTimeMs: e.endTime, tempo: e.modifiedTempo });
      this.metronome.onPosition(e.currentTick);
      this.learnStartupTime(e.currentTick);
      // During playback the played-beat event tracks the bar; seeks have to look it up.
      if (e.isSeek) this.updateBarAt(e.currentTick);
    });
    api.playbackRangeChanged.on((e) => {
      const range: TickRange | null = e.playbackRange
        ? { startTick: e.playbackRange.startTick, endTick: e.playbackRange.endTick }
        : null;
      const echo = this.pendingRangeEchoes.findIndex((r) => sameRange(r, range));
      if (echo >= 0) {
        this.pendingRangeEchoes.splice(0, echo + 1);
        return;
      }
      // A selection made on the tab (or via loopBars): alphaTab has already applied it.
      this.appliedRange = range;
      this.storeLoopRange(range);
      if (range && !this.settings.loopEnabled) this.setLoopEnabled(true);
    });
  }

  private onPlayerReady() {
    const usesVideo = this.settings.source.kind === "video";
    this.store.setState({ canPlay: !usesVideo || !!this.media });
    // A new player instance may not carry the old range over; push it again.
    this.appliedRange = undefined;
    this.applyPlaybackSettings();
  }

  /** Pushes every playback-related setting into alphaTab; safe to call repeatedly. */
  private applyPlaybackSettings() {
    const s = this.settings;
    this.api.playbackSpeed = s.speed;
    // With a video source alphaTab forwards this to the media handler, i.e. YouTube's own volume.
    this.api.masterVolume = s.volume;
    this.api.isLooping = s.loopEnabled;
    this.applyLoopRange();
    // The app's own metronome and count-in replace alphaTab's, which only work with the synth.
    this.api.metronomeVolume = 0;
    this.api.countInVolume = 0;
    this.metronome.setEnabled(s.metronome);
    this.applyMixer();
    this.applyPitch();
  }

  // ── Transport ────────────────────────────────────────────────────────────

  playPause(): void {
    const state = this.store.getState();
    if (!state.canPlay) return;
    // A key press or click: the moment browsers allow the metronome's audio to start.
    this.metronome.unlock();
    if (this.metronome.countingIn) {
      this.metronome.cancelCountIn();
      return;
    }
    if (!state.playing && this.settings.countIn) {
      void this.playAfterCountIn();
      return;
    }
    if (state.playing) this.api.pause();
    else this.requestPlay();
  }

  /** One bar of clicks in the current bar's time signature and tempo, then playback. */
  private async playAfterCountIn() {
    const state = this.store.getState();
    const bar = this.score.masterBars[state.currentBar] ?? this.score.masterBars[0]!;
    const tempo = state.tempo || this.score.tempo * this.settings.speed;
    const beatMs = (60000 / tempo) * (4 / bar.timeSignatureDenominator);
    this.store.setState({ countingIn: true });
    const lead = this.startupMs[this.settings.source.kind];
    const completed = await this.metronome.playCountIn(bar.timeSignatureNumerator, beatMs, lead);
    this.store.setState({ countingIn: false });
    if (completed) this.requestPlay();
  }

  private requestPlay() {
    this.playRequestedAt = performance.now();
    this.api.play();
  }

  /** Measures the time from asking playback to start until the position moves. */
  private learnStartupTime(tick: number) {
    const moved = tick > this.lastPositionTick;
    this.lastPositionTick = tick;
    if (this.playRequestedAt === undefined || !moved) return;
    const elapsed = performance.now() - this.playRequestedAt;
    this.playRequestedAt = undefined;
    if (elapsed > 2000) return; // stalled (e.g. a video buffering): not a startup time
    const kind = this.settings.source.kind;
    this.startupMs[kind] = Math.round((this.startupMs[kind] + elapsed) / 2);
  }

  /** How fast the tab audio moves through the score at a tick, in ticks per ms. */
  private scoreTickRate(tick: number): number | undefined {
    const bar = this.api.tickCache?.masterBars.find((lookup) => lookup.start <= tick && tick < lookup.end);
    return bar ? (bar.tempo * this.settings.speed * QUARTER_TICKS) / 60000 : undefined;
  }

  /** Every beat in playback order (repeats included), for the metronome. */
  private updateBeatGrid() {
    const bars = this.api.tickCache?.masterBars ?? [];
    this.metronome.setBeats(
      beatGrid(
        bars.map((lookup) => ({
          start: lookup.start,
          end: lookup.end,
          numerator: lookup.masterBar.timeSignatureNumerator,
          denominator: lookup.masterBar.timeSignatureDenominator,
        })),
      ),
    );
  }

  stop(): void {
    this.api.stop();
  }

  seekToBar(barIndex: number): void {
    const bar = this.score.masterBars[clamp(barIndex, 0, this.score.masterBars.length - 1)];
    const tickCache = this.api.tickCache;
    if (bar && tickCache) this.api.tickPosition = tickCache.getMasterBarStart(bar);
  }

  skipBars(delta: number): void {
    this.seekToBar(this.store.getState().currentBar + delta);
  }

  // ── Practice controls ────────────────────────────────────────────────────

  setSpeed(speed: number): void {
    // YouTube plays any rate in 0.25–2 (its preset list is just the menu), so videos share this range.
    const value = clamp(speed, SPEED_RANGE.min, SPEED_RANGE.max);
    this.patchSettings({ speed: Math.round(value * 100) / 100 });
    this.api.playbackSpeed = this.settings.speed;
    this.metronome.restart();
  }

  setPitch(semitones: number): void {
    this.patchSettings({ pitch: clamp(Math.round(semitones), PITCH_RANGE.min, PITCH_RANGE.max) });
    this.applyPitch();
  }

  setVolume(volume: number): void {
    const value = clamp(volume, VOLUME_RANGE.min, VOLUME_RANGE.max);
    this.patchSettings({ volume: Math.round(value * 100) / 100 });
    this.api.masterVolume = this.settings.volume;
  }

  setMetronome(enabled: boolean): void {
    this.patchSettings({ metronome: enabled });
    this.applyPlaybackSettings();
  }

  setMetronomeSound(sound: MetronomeSound): void {
    this.store.setState({ metronomeSound: sound });
    this.metronome.setSound(sound);
    this.metronome.preview();
    this.saveMetronomePrefs();
  }

  setMetronomeVolume(volume: number): void {
    const value = Math.round(clamp(volume, METRONOME_VOLUME_RANGE.min, METRONOME_VOLUME_RANGE.max) * 100) / 100;
    this.store.setState({ metronomeVolume: value });
    this.metronome.setVolume(value);
    this.saveMetronomePrefs();
  }

  private saveMetronomePrefs() {
    const { metronomeSound, metronomeVolume } = this.store.getState();
    saveMetronomePrefs({ sound: metronomeSound, volume: metronomeVolume });
  }

  setCountIn(enabled: boolean): void {
    this.patchSettings({ countIn: enabled });
    this.applyPlaybackSettings();
  }

  setTrainer(patch: Partial<TrainerSettings>): void {
    this.patchSettings({ trainer: { ...this.settings.trainer, ...patch } });
    this.store.setState({ trainerPasses: 0 });
  }

  private applyPitch() {
    const melodic = this.score.tracks.filter(isMelodic);
    this.api.changeTrackTranspositionPitch(melodic, this.settings.pitch);
  }

  // ── Looping ──────────────────────────────────────────────────────────────

  setLoopEnabled(enabled: boolean): void {
    this.markLoopEnabled(enabled);
    this.applyLoopRange();
  }

  private markLoopEnabled(enabled: boolean) {
    this.patchSettings({ loopEnabled: enabled });
    this.api.isLooping = enabled;
    this.store.setState({ trainerPasses: 0 });
  }

  /**
   * alphaTab confines playback to `playbackRange` whether or not it loops, so the saved range is
   * only handed to the player while looping is on; otherwise playback runs through the whole song.
   */
  private applyLoopRange() {
    const target = this.settings.loopEnabled ? this.settings.loopRange : null;
    if (this.appliedRange !== undefined && sameRange(this.appliedRange, target)) return;
    this.appliedRange = target;
    this.pendingRangeEchoes.push(target);
    if (this.pendingRangeEchoes.length > 8) this.pendingRangeEchoes.shift();
    this.api.playbackRange = target;
  }

  loopBars(startBar: number, endBar: number): void {
    const span = beatsSpanning(this.displayedTrack(), startBar, endBar);
    if (!span) return;
    // alphaTab applies the new range itself and reports it back (possibly asynchronously), so
    // only flip the flag here; re-pushing the stored range now would apply the old one.
    this.markLoopEnabled(true);
    this.api.highlightPlaybackRange(span.start, span.end);
    this.api.applyPlaybackRangeFromHighlight();
    this.seekToBar(startBar);
  }

  loopSection(sectionIndex: number): void {
    const { sections, barCount } = this.store.getState();
    const range = sectionBarRange(sections, sectionIndex, barCount);
    if (!range) return;
    this.loopBars(range.startBar, range.endBar);
    this.scrollToBar(range.startBar);
  }

  /**
   * Moves to a section's first bar. An active loop that doesn't contain it is switched off (its
   * range is kept), since alphaTab would otherwise hold the playhead inside the loop.
   */
  goToSection(sectionIndex: number): void {
    const { sections, loopBars } = this.store.getState();
    const section = sections[sectionIndex];
    if (!section) return;
    const outsideLoop = !loopBars || section.barIndex < loopBars.start || section.barIndex > loopBars.end;
    if (this.settings.loopEnabled && outsideLoop) this.setLoopEnabled(false);
    this.seekToBar(section.barIndex);
    this.scrollToBar(section.barIndex);
  }

  /**
   * alphaTab only follows the cursor while playing, and after a seek its cursor moves later, so
   * scroll to the bar's rendered position directly, the same way alphaTab's page scrolling does.
   */
  private scrollToBar(barIndex: number) {
    const bounds = this.api.boundsLookup?.findMasterBarByIndex(barIndex);
    if (!bounds) return;
    const ui = this.api.uiFacade;
    const { scrollOffsetY, scrollSpeed } = this.api.settings.player;
    ui.scrollToY(ui.getScrollContainer(), bounds.realBounds.y + scrollOffsetY, scrollSpeed);
  }

  loopCurrentBar(): void {
    const bar = this.store.getState().currentBar;
    this.loopBars(bar, bar);
  }

  clearLoop(): void {
    this.clearRangeHighlight();
    this.storeLoopRange(null);
    this.setLoopEnabled(false);
  }

  // ── Saved loops ──────────────────────────────────────────────────────────

  /** Keeps the current loop under a name. */
  saveLoop(name: string): void {
    const range = this.settings.loopRange;
    const bars = this.store.getState().loopBars;
    if (!range || !bars) return;
    const loop: SavedLoop = { id: crypto.randomUUID(), name: name.trim(), range: { ...range }, bars };
    this.patchSettings({ savedLoops: [...this.settings.savedLoops, loop] });
  }

  /** Makes a saved loop the current one and goes to its start. */
  playSavedLoop(id: string): void {
    const loop = this.settings.savedLoops.find((l) => l.id === id);
    const beats = loop && this.beatsInRange(loop.range);
    if (!beats) return;
    // As in loopBars: alphaTab applies the range itself and reports it back.
    this.markLoopEnabled(true);
    this.api.highlightPlaybackRange(beats.start, beats.end);
    this.api.applyPlaybackRangeFromHighlight();
    const bar = beats.start.voice.bar.index;
    this.seekToBar(bar);
    this.scrollToBar(bar);
  }

  deleteSavedLoop(id: string): void {
    this.patchSettings({ savedLoops: this.settings.savedLoops.filter((l) => l.id !== id) });
  }

  /**
   * alphaTab's clearPlaybackRangeHighlight only hides the markers: it keeps the selected beats and
   * redraws them after the next render (crashing if they're no longer rendered, e.g. after a track
   * switch). A zero-length selection is drawn as nothing, so it replaces the old one for good.
   */
  private clearRangeHighlight() {
    const beat = this.displayedTrack().staves[0]?.bars[0]?.voices[0]?.beats[0];
    this.clearingHighlight = true;
    if (beat) this.api.highlightPlaybackRange(beat, beat);
    else this.api.clearPlaybackRangeHighlight();
    this.clearingHighlight = false;
    this.highlighted = undefined;
    this.store.setState({ loopEdges: null });
  }

  // ── Loop edge handles ────────────────────────────────────────────────────

  /** alphaTab's highlight bounds are relative to its drawing surface, which sits inside the host's padding. */
  private surfaceOffset() {
    const surface = this.host.querySelector<HTMLElement>(".at-surface");
    return { x: surface?.offsetLeft ?? 0, y: surface?.offsetTop ?? 0 };
  }

  private onHighlightChanged(e: PlaybackHighlightChangeEventArgs) {
    const blocks = e.highlightBlocks ?? [];
    const first = blocks[0];
    const last = blocks.at(-1);
    if (this.clearingHighlight || !e.startBeat || !e.endBeat || !first || !last) {
      this.highlighted = undefined;
      this.store.setState({ loopEdges: null });
      return;
    }
    this.highlighted = { start: e.startBeat, end: e.endBeat };
    const offset = this.surfaceOffset();
    this.store.setState({
      loopEdges: {
        start: { x: offset.x + first.x, top: offset.y + first.y, height: first.h },
        end: { x: offset.x + last.x + last.w, top: offset.y + last.y, height: last.h },
      },
    });
  }

  /**
   * The displayed track's beat at a point (host coordinates). Between lines of tab the nearest
   * line is used, then `fallbackY` if no line is close.
   */
  private beatAtPoint(x: number, y: number, fallbackY?: number): model.Beat | undefined {
    const lookup = this.api.boundsLookup;
    if (!lookup) return undefined;
    const offset = this.surfaceOffset();
    const beatAt = (atY: number) => lookup.getBeatAtPos(x - offset.x, atY - offset.y);
    let hit = beatAt(y);
    for (let d = LINE_SEARCH_STEP; !hit && d <= LINE_SEARCH_RANGE; d += LINE_SEARCH_STEP) {
      hit = beatAt(y + d) ?? beatAt(y - d);
    }
    if (!hit && fallbackY !== undefined) hit = beatAt(fallbackY);
    return hit && hit.voice.bar.staff.track === this.displayedTrack() ? hit : undefined;
  }

  /**
   * Moves one edge of the highlighted loop to the beat at a point (host coordinates), as a live
   * preview; `finishLoopResize` turns it into the loop. `fallbackY` is the handle's own line, used
   * when the point is far from any line. With `wholeBars` the edge snaps to the start or end of
   * the bar under the point.
   */
  resizeLoop(edge: "start" | "end", x: number, y: number, fallbackY: number, wholeBars = false): void {
    const current = this.highlighted;
    const hit = current && this.beatAtPoint(x, y, fallbackY);
    if (!current || !hit) return;
    const barBeats = hit.voice.beats;
    const beat = wholeBars ? ((edge === "start" ? barBeats[0] : barBeats.at(-1)) ?? hit) : hit;

    let { start, end } = current;
    // An edge stops one beat short of the other: alphaTab draws nothing for a range that starts
    // and ends on the same beat, which would lose the handles mid-drag.
    if (edge === "start") start = beatOrder(beat) < beatOrder(end) ? beat : (end.previousBeat ?? start);
    else end = beatOrder(beat) > beatOrder(start) ? beat : (start.nextBeat ?? end);
    if (start !== current.start || end !== current.end) this.api.highlightPlaybackRange(start, end);
  }

  finishLoopResize(): void {
    if (this.highlighted) this.api.applyPlaybackRangeFromHighlight();
  }

  /**
   * Painting a new loop is alphaTab's own drag selection, which applies whatever is highlighted
   * when the button is released. These let the app adjust it while it's drawn: snapping to whole
   * bars, and following the pointer while the score scrolls underneath.
   */
  startLoopPaint(x: number, y: number): void {
    this.paintAnchor = this.beatAtPoint(x, y);
    this.painting = false;
  }

  /**
   * Re-highlights from where the drag started to the beat at a point. Runs after alphaTab's own
   * update for the same mouse move, so this version is the one applied on release.
   */
  paintLoop(x: number, y: number, wholeBars: boolean): void {
    const anchor = this.paintAnchor;
    const beat = anchor && this.beatAtPoint(x, y);
    if (!anchor || !beat) return;
    // Like alphaTab: staying on the first beat is still a click (which seeks), not a selection.
    if (beat === anchor && !wholeBars && !this.painting) return;
    this.painting = true;
    let [start, end] = beatOrder(anchor) <= beatOrder(beat) ? [anchor, beat] : [beat, anchor];
    if (wholeBars) {
      start = start.voice.beats[0] ?? start;
      end = end.voice.beats.at(-1) ?? end;
    }
    if (start === end) end = start.nextBeat ?? end;
    this.api.highlightPlaybackRange(start, end);
  }

  endLoopPaint(): void {
    this.paintAnchor = undefined;
    this.painting = false;
  }

  private storeLoopRange(range: TickRange | null) {
    this.patchSettings({ loopRange: range });
    const beats = range && this.beatsInRange(range);
    this.store.setState({
      loopBars: beats ? { start: beats.start.voice.bar.index, end: beats.end.voice.bar.index } : null,
    });
  }

  /**
   * The displayed track's beat at a tick, anywhere in the song. alphaTab's lookup skips beats past
   * the active loop's end, and a newly selected loop is reported before that range is replaced, so
   * the range is set aside while looking.
   */
  private beatAt(tick: number): model.Beat | undefined {
    const cache = this.api.tickCache;
    if (!cache) return undefined;
    const range = cache.playbackRange;
    cache.playbackRange = null;
    try {
      return cache.findBeat(new Set([this.displayedTrack().index]), tick)?.beat;
    } finally {
      cache.playbackRange = range;
    }
  }

  private updateBarAt(tick: number) {
    const beat = this.beatAt(tick);
    if (beat) this.store.setState({ currentBar: beat.voice.bar.index });
  }

  /** First and last displayed beat inside a tick range. */
  private beatsInRange(range: TickRange) {
    const start = this.beatAt(range.startTick);
    const end = this.beatAt(Math.max(range.startTick, range.endTick - 1));
    return start && end ? { start, end } : undefined;
  }

  /** Re-draws the saved loop's markers after a (re-)render. */
  private restoreLoopHighlight() {
    const range = this.settings.loopRange;
    const beats = range && this.beatsInRange(range);
    if (!beats) return;
    this.api.highlightPlaybackRange(beats.start, beats.end);
    this.storeLoopRange(range);
  }

  /** alphaTab reports "finished" each time a loop wraps around; each one is a completed pass. */
  private onLoopPassCompleted() {
    if (!this.settings.loopEnabled) return;
    const step = completePass(this.settings.trainer, this.settings.speed, {
      passes: this.store.getState().trainerPasses,
    });
    this.store.setState({ trainerPasses: step.progress.passes });
    if (step.speed !== undefined) this.setSpeed(step.speed);
  }

  // ── Tracks & mixer ───────────────────────────────────────────────────────

  private displayedTrack(): model.Track {
    const index = this.trackIndexByPart.get(this.settings.partId ?? -1) ?? 0;
    return this.score.tracks[index]!;
  }

  private displayedPartId(): number | undefined {
    const index = this.displayedTrack().index;
    for (const [partId, i] of this.trackIndexByPart) if (i === index) return partId;
    return undefined;
  }

  selectTrack(partId: number): void {
    if (!this.trackIndexByPart.has(partId) || partId === this.displayedPartId()) return;
    // A loop picked on one part (e.g. a lead solo) rarely makes sense on another; start fresh.
    this.clearLoop();
    this.patchSettings({ partId });
    this.applyMixer();
    this.api.renderTracks([this.displayedTrack()]);
  }

  mixFor(partId: number): TrackMix {
    return this.settings.mixer[partId] ?? DEFAULT_TRACK_MIX;
  }

  setTrackMix(partId: number, patch: Partial<TrackMix>): void {
    const mix = { ...this.mixFor(partId), ...patch };
    this.patchSettings({ mixer: { ...this.settings.mixer, [partId]: mix } });
    this.applyMixer();
  }

  private applyMixer() {
    const shown = this.displayedPartId();
    for (const [partId, index] of this.trackIndexByPart) {
      const track = this.score.tracks[index]!;
      const mix = this.mixFor(partId);
      this.api.changeTrackMute([track], mix.muted);
      this.api.changeTrackSolo([track], mix.solo);
      this.api.changeTrackVolume([track], trackVolume(mix, partId === shown));
    }
  }

  // ── Display ──────────────────────────────────────────────────────────────

  setNotation(notation: NotationMode): void {
    this.patchSettings({ notation });
    this.applyNotation(notation);
    this.api.render();
  }

  private applyNotation(notation: NotationMode) {
    const vocalParts = new Set(this.song.catalog.filter((t) => t.role === "vocals").map((t) => t.partId));
    for (const [partId, index] of this.trackIndexByPart) {
      if (vocalParts.has(partId)) continue;
      for (const staff of this.score.tracks[index]?.staves ?? []) {
        // Only stringed staves have a tab; drums, piano or notation-only imports keep their notation.
        if (staff.isPercussion || !staff.isStringed) continue;
        staff.showTablature = true;
        staff.showStandardNotation = notation === "tabAndScore";
      }
    }
  }

  setZoom(zoom: number): void {
    this.patchSettings({ zoom: clamp(Math.round(zoom * 10) / 10, ZOOM_RANGE.min, ZOOM_RANGE.max) });
    this.api.settings.display.scale = this.settings.zoom;
    this.api.updateSettings();
    this.api.render();
  }

  setVideoVisible(visible: boolean): void {
    this.patchSettings({ videoVisible: visible });
  }

  // ── Playback source (synth vs. synced video) ─────────────────────────────

  setSource(source: PlaybackSource): void {
    this.api.stop();
    this.detachVideo();
    this.patchSettings({ source, sourceChosen: true });
    this.store.setState({ canPlay: false });

    const mode = playerModeFor(source);
    if (this.api.settings.player.playerMode !== mode) {
      this.api.settings.player.playerMode = mode;
      this.api.updateSettings();
    }
    this.applySyncPoints();
    this.api.loadMidiForScore();
  }

  setSyncOffset(offsetMs: number): void {
    this.patchSettings({ syncOffsetMs: Math.round(offsetMs) });
    this.applySyncPoints();
  }

  private applySyncPoints() {
    const source = this.settings.source;
    const video = source.kind === "video" ? this.song.videos.find((v) => v.videoId === source.videoId) : undefined;
    const points = video ? buildSyncPoints(this.score.masterBars, video.points, this.settings.syncOffsetMs / 1000) : [];
    this.score.applyFlatSyncPoints(points);
    if (this.api.score) this.api.updateSyncPoints();
  }

  /** Connects a ready YouTube player as alphaTab's time source. */
  attachVideo(video: YtPlayer): void {
    const output = this.api.player?.output as synth.IExternalMediaSynthOutput | undefined;
    if (!output || this.settings.source.kind !== "video") return;

    this.media?.dispose();
    this.media = new YouTubeMediaHandler(video, output);
    output.handler = this.media;
    this.store.setState({ canPlay: true });
    this.setSpeed(this.settings.speed);
    this.applyPlaybackSettings();
  }

  detachVideo(): void {
    this.media?.dispose();
    this.media = undefined;
    const output = this.api.player?.output as synth.IExternalMediaSynthOutput | undefined;
    if (output && "handler" in output) output.handler = undefined;
  }

  /** Keeps alphaTab in step when the video is played or paused from its own controls. */
  onVideoStateChange(state: number): void {
    if (!this.media?.onVideoStateChange(state)) return;
    const playing = this.store.getState().playing;
    if (state === YtState.Playing && !playing) this.api.play();
    if ((state === YtState.Paused || state === YtState.Ended) && playing) this.api.pause();
  }
}

export function sameRange(a: TickRange | null, b: TickRange | null): boolean {
  return a === b || (!!a && !!b && a.startTick === b.startTick && a.endTick === b.endTick);
}
