import { AlphaTabApi, model, synth } from "@coderline/alphatab";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Song } from "@/library/song";
import { clamp, nearest } from "@/lib/math";
import {
  DEFAULT_TRACK_MIX,
  PITCH_RANGE,
  SPEED_RANGE,
  ZOOM_RANGE,
  type NotationMode,
  type PlaybackSource,
  type PracticeSettings,
  type TickRange,
  type TrackMix,
  type TrainerSettings,
} from "@/practice/practiceSettings";
import { buildScore } from "@/songsterr/convert/scoreBuilder";
import { buildSyncPoints } from "../sync/syncPoints";
import { completePass } from "../trainer/speedTrainer";
import { YtState, type YtPlayer } from "../youtube/youtubeApi";
import { YouTubeMediaHandler } from "../youtube/YouTubeMediaHandler";
import { createAlphaTabSettings, playerModeFor } from "./alphaTabSettings";
import { initialEngineState, type EngineState } from "./engineState";
import { beatsSpanning, isMelodic, sectionBarRange, sectionsOf } from "./scoreQueries";

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

  constructor(
    host: HTMLElement,
    scrollElement: HTMLElement,
    private readonly song: Song,
    settings: PracticeSettings,
  ) {
    this.store = createStore<EngineState>(() => initialEngineState(settings));
    this.api = new AlphaTabApi(
      host,
      createAlphaTabSettings({ scrollElement, zoom: settings.zoom, source: settings.source }),
    );

    const vocalPartIds = new Set(song.catalog.filter((t) => t.role === "vocals").map((t) => t.partId));
    this.score = buildScore({ ...song, vocalPartIds }, this.api.settings);
    this.trackIndexByPart = new Map(song.tracks.map((t, i) => [t.partId, i]));

    this.bindEvents();
    this.applyNotation(settings.notation);
    this.applySyncPoints();
    this.store.setState({ sections: sectionsOf(this.score), barCount: this.score.masterBars.length });
    this.api.renderScore(this.score, [this.displayedTrack().index]);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  destroy(): void {
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
    api.playerReady.on(() => this.onPlayerReady());
    api.playerStateChanged.on((e) => set({ playing: e.state === synth.PlayerState.Playing }));
    api.playerFinished.on(() => this.onLoopPassCompleted());
    api.playedBeatChanged.on((beat) => set({ currentBar: beat.voice.bar.index }));
    api.playerPositionChanged.on((e) => {
      set({ currentTimeMs: e.currentTime, endTimeMs: e.endTime, tempo: e.modifiedTempo });
      // During playback the played-beat event tracks the bar; seeks have to look it up.
      if (e.isSeek) this.updateBarAt(e.currentTick);
    });
    api.playbackRangeChanged.on((e) => {
      const range = e.playbackRange;
      this.storeLoopRange(range ? { startTick: range.startTick, endTick: range.endTick } : null);
      if (range && !this.settings.loopEnabled) this.setLoopEnabled(true);
    });
  }

  private onPlayerReady() {
    const usesVideo = this.settings.source.kind === "video";
    this.store.setState({ canPlay: !usesVideo || !!this.media });
    this.applyPlaybackSettings();
  }

  /** Pushes every playback-related setting into alphaTab; safe to call repeatedly. */
  private applyPlaybackSettings() {
    const s = this.settings;
    const usesSynth = s.source.kind === "synth";
    this.api.playbackSpeed = s.speed;
    this.api.isLooping = s.loopEnabled;
    this.api.playbackRange = s.loopRange;
    this.api.metronomeVolume = usesSynth && s.metronome ? 1 : 0;
    this.api.countInVolume = usesSynth && s.countIn ? 1 : 0;
    this.applyMixer();
    this.applyPitch();
  }

  // ── Transport ────────────────────────────────────────────────────────────

  playPause(): void {
    if (this.store.getState().canPlay) this.api.playPause();
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
    const options = this.store.getState().speedOptions;
    const value = options ? nearest(options, speed) : clamp(speed, SPEED_RANGE.min, SPEED_RANGE.max);
    this.patchSettings({ speed: Math.round(value * 100) / 100 });
    this.api.playbackSpeed = this.settings.speed;
  }

  setPitch(semitones: number): void {
    this.patchSettings({ pitch: clamp(Math.round(semitones), PITCH_RANGE.min, PITCH_RANGE.max) });
    this.applyPitch();
  }

  setMetronome(enabled: boolean): void {
    this.patchSettings({ metronome: enabled });
    this.applyPlaybackSettings();
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
    this.patchSettings({ loopEnabled: enabled });
    this.api.isLooping = enabled;
    this.store.setState({ trainerPasses: 0 });
  }

  loopBars(startBar: number, endBar: number): void {
    const span = beatsSpanning(this.displayedTrack(), startBar, endBar);
    if (!span) return;
    this.api.highlightPlaybackRange(span.start, span.end);
    this.api.applyPlaybackRangeFromHighlight();
    this.setLoopEnabled(true);
    this.seekToBar(startBar);
  }

  loopSection(sectionIndex: number): void {
    const { sections, barCount } = this.store.getState();
    const range = sectionBarRange(sections, sectionIndex, barCount);
    if (range) this.loopBars(range.startBar, range.endBar);
  }

  loopCurrentBar(): void {
    const bar = this.store.getState().currentBar;
    this.loopBars(bar, bar);
  }

  clearLoop(): void {
    this.api.clearPlaybackRangeHighlight();
    this.api.playbackRange = null;
    this.storeLoopRange(null);
    this.setLoopEnabled(false);
  }

  private storeLoopRange(range: TickRange | null) {
    this.patchSettings({ loopRange: range });
    const beats = range && this.beatsInRange(range);
    this.store.setState({
      loopBars: beats ? { start: beats.start.voice.bar.index, end: beats.end.voice.bar.index } : null,
    });
  }

  private beatAt(tick: number): model.Beat | undefined {
    return this.api.tickCache?.findBeat(new Set([this.displayedTrack().index]), tick)?.beat;
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

  selectTrack(partId: number): void {
    if (!this.trackIndexByPart.has(partId)) return;
    this.patchSettings({ partId });
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
    for (const [partId, index] of this.trackIndexByPart) {
      const track = this.score.tracks[index]!;
      const mix = this.mixFor(partId);
      this.api.changeTrackMute([track], mix.muted);
      this.api.changeTrackSolo([track], mix.solo);
      this.api.changeTrackVolume([track], mix.volume);
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
      const staff = this.score.tracks[index]?.staves[0];
      if (!staff || staff.isPercussion || vocalParts.has(partId)) continue;
      staff.showStandardNotation = notation === "tabAndScore";
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
    this.patchSettings({ source });
    this.store.setState({ canPlay: false, speedOptions: null });

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
    this.store.setState({ canPlay: true, speedOptions: video.getAvailablePlaybackRates() });
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
