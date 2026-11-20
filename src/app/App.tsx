import { useEffect } from "react";
import { LibraryScreen } from "@/features/library/LibraryScreen";
import { PlayerScreen } from "@/features/player/PlayerScreen";
import { useLibrary } from "@/library/useLibrary";
import { useHashRoute } from "./useHashRoute";

export function App() {
  const route = useHashRoute();
  const loaded = useLibrary((s) => s.loaded);
  const load = useLibrary((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return null;
  return route.name === "song" ? <PlayerScreen key={route.songId} songId={route.songId} /> : <LibraryScreen />;
}
