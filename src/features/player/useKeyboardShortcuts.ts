import { useEffect } from "react";
import type { PlayerEngine } from "@/player/engine/PlayerEngine";
import { SPEED_RANGE } from "@/practice/practiceSettings";
import { useEngine } from "./engineContext";

type Shortcut = (engine: PlayerEngine) => void;

const settingsOf = (engine: PlayerEngine) => engine.store.getState().settings;

/** Key → action. Kept as data so the list can also be shown to the user. */
export const SHORTCUTS: Record<string, { label: string; run: Shortcut }> = {
  " ": { label: "Play or pause", run: (e) => e.playPause() },
  ArrowLeft: { label: "Previous bar", run: (e) => e.skipBars(-1) },
  ArrowRight: { label: "Next bar", run: (e) => e.skipBars(1) },
  l: { label: "Loop on or off", run: (e) => e.setLoopEnabled(!settingsOf(e).loopEnabled) },
  b: { label: "Loop the current bar", run: (e) => e.loopCurrentBar() },
  "[": { label: "Slower", run: (e) => e.setSpeed(settingsOf(e).speed - SPEED_RANGE.step) },
  "]": { label: "Faster", run: (e) => e.setSpeed(settingsOf(e).speed + SPEED_RANGE.step) },
  m: { label: "Metronome", run: (e) => e.setMetronome(!settingsOf(e).metronome) },
  c: { label: "Count-in", run: (e) => e.setCountIn(!settingsOf(e).countIn) },
  v: { label: "Show or hide video", run: (e) => e.setVideoVisible(!settingsOf(e).videoVisible) },
};

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable);
}

export function useKeyboardShortcuts() {
  const engine = useEngine();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const shortcut = SHORTCUTS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (!shortcut) return;
      // Sliders use the arrow keys themselves.
      if (e.key.startsWith("Arrow") && (e.target as HTMLElement).getAttribute("role") === "slider") return;
      e.preventDefault();
      shortcut.run(engine);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);
}
