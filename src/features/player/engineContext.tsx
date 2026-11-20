import { createContext, useContext, type ReactNode } from "react";
import { useStore } from "zustand";
import type { EngineState } from "@/player/engine/engineState";
import type { PlayerEngine } from "@/player/engine/PlayerEngine";
import type { PracticeSettings } from "@/practice/practiceSettings";

const EngineContext = createContext<PlayerEngine | null>(null);

export function EngineProvider({ engine, children }: { engine: PlayerEngine; children: ReactNode }) {
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useEngine(): PlayerEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error("useEngine must be used inside <EngineProvider>.");
  return engine;
}

export function useEngineState<T>(selector: (state: EngineState) => T): T {
  return useStore(useEngine().store, selector);
}

export function useSetting<K extends keyof PracticeSettings>(key: K): PracticeSettings[K] {
  return useEngineState((s) => s.settings[key]);
}
