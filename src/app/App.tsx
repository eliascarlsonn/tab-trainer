import { lazy, Suspense, useEffect } from "react";
import { LibraryScreen } from "@/features/library/LibraryScreen";
import { useLibrary } from "@/library/useLibrary";
import { useHashRoute } from "./useHashRoute";

// The player pulls in alphaTab (the bulk of the bundle), so it loads only when a song is opened.
const PlayerScreen = lazy(() =>
  import("@/features/player/PlayerScreen").then((module) => ({ default: module.PlayerScreen })),
);

export function App() {
  const route = useHashRoute();
  const loaded = useLibrary((s) => s.loaded);
  const load = useLibrary((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return null;
  if (route.name === "library") return <LibraryScreen />;
  return (
    <Suspense fallback={null}>
      <PlayerScreen key={route.songId} songId={route.songId} />
    </Suspense>
  );
}
