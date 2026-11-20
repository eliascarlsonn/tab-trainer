import { useEffect, useRef, useState } from "react";
import { routes } from "@/app/useHashRoute";
import type { Song } from "@/library/song";
import { useLibrary } from "@/library/useLibrary";
import { PlayerEngine } from "@/player/engine/PlayerEngine";
import { loadPracticeSettings, savePracticeSettings, type PracticeSettings } from "@/practice/practiceSettings";
import { EngineProvider } from "./engineContext";
import { LoadingOverlay } from "./LoadingOverlay";
import { MixerSheet } from "./MixerSheet";
import { PlayerHeader } from "./PlayerHeader";
import { TransportDock } from "./dock/TransportDock";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { VideoPanel } from "./VideoPanel";
import styles from "./PlayerScreen.module.css";

const SAVE_DELAY_MS = 400;

export function PlayerScreen({ songId }: { songId: string }) {
  const song = useLibrary((s) => s.songs[songId]);
  const markPlayed = useLibrary((s) => s.markPlayed);
  const [settings, setSettings] = useState<PracticeSettings | null>(null);

  useEffect(() => {
    if (!song) return;
    void loadPracticeSettings(song).then(setSettings);
    void markPlayed(song.id);
    // Only re-run when a different song is opened.
  }, [song?.id]);

  if (!song) {
    return (
      <div className={styles.missing}>
        <p>This song is not in your library anymore.</p>
        <a href={routes.library()}>Back to your songs</a>
      </div>
    );
  }
  return settings ? <PlayerView song={song} initialSettings={settings} /> : null;
}

/** Saves practice settings shortly after they stop changing. */
function usePersistSettings(engine: PlayerEngine | null, songId: string) {
  useEffect(() => {
    if (!engine) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = engine.store.subscribe((state, previous) => {
      if (state.settings === previous.settings) return;
      clearTimeout(timer);
      timer = setTimeout(() => void savePracticeSettings(songId, state.settings), SAVE_DELAY_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
      void savePracticeSettings(songId, engine.store.getState().settings);
    };
  }, [engine, songId]);
}

function PlayerView({ song, initialSettings }: { song: Song; initialSettings: PracticeSettings }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [engine, setEngine] = useState<PlayerEngine | null>(null);

  useEffect(() => {
    const instance = new PlayerEngine(hostRef.current!, scrollRef.current!, song, initialSettings);
    setEngine(instance);
    return () => instance.destroy();
    // The engine is created once per opened song; later changes flow through its own methods.
  }, []);

  usePersistSettings(engine, song.id);

  return (
    <div className={styles.shell}>
      <div ref={scrollRef} className={styles.scroll}>
        <div ref={hostRef} className={styles.score} />
      </div>
      {engine && (
        <EngineProvider engine={engine}>
          <PlayerChrome song={song} />
        </EngineProvider>
      )}
    </div>
  );
}

/** Everything around the score; needs the engine, so it mounts once the engine exists. */
function PlayerChrome({ song }: { song: Song }) {
  const [mixerOpen, setMixerOpen] = useState(false);
  useKeyboardShortcuts();

  return (
    <>
      <PlayerHeader song={song} onOpenMixer={() => setMixerOpen(true)} />
      <VideoPanel />
      <TransportDock song={song} />
      <MixerSheet song={song} open={mixerOpen} onClose={() => setMixerOpen(false)} />
      <LoadingOverlay />
    </>
  );
}
