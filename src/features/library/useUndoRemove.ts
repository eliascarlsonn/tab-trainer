import { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "@/library/song";
import { useLibrary } from "@/library/useLibrary";

/** How long "Undo" stays offered after a song is removed. */
const UNDO_MS = 8000;

/**
 * Removes songs right away and keeps the last one in memory for a few seconds, so it can be put
 * back exactly as it was (its practice settings are never deleted).
 */
export function useUndoRemove() {
  const removeSong = useLibrary((s) => s.remove);
  const restoreSong = useLibrary((s) => s.restore);
  const [removed, setRemoved] = useState<Song | null>(null);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const remove = useCallback(
    async (song: Song) => {
      await removeSong(song.id);
      clearTimeout(timer.current);
      setRemoved(song);
      timer.current = window.setTimeout(() => setRemoved(null), UNDO_MS);
    },
    [removeSong],
  );

  const undo = useCallback(async () => {
    if (!removed) return;
    clearTimeout(timer.current);
    setRemoved(null);
    await restoreSong(removed);
  }, [removed, restoreSong]);

  return { removed, remove, undo };
}
