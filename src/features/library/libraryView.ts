import { useCallback, useEffect, useState } from "react";
import { SONG_ORDERS, type SongOrder } from "@/library/librarySort";

/** How the library list is shown; remembered in this browser. */
export interface LibraryView {
  order: SongOrder;
  favoritesOnly: boolean;
}

const STORAGE_KEY = "tab-trainer:library-view";
const DEFAULT_VIEW: LibraryView = { order: "recent", favoritesOnly: false };

function loadView(): LibraryView {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<LibraryView> | null;
    return {
      order: SONG_ORDERS.some((o) => o.id === stored?.order) ? stored!.order! : DEFAULT_VIEW.order,
      favoritesOnly: stored?.favoritesOnly === true,
    };
  } catch {
    // Storage can be unavailable (e.g. private mode); fall back to the defaults.
    return DEFAULT_VIEW;
  }
}

export function useLibraryView() {
  const [view, setView] = useState(loadView);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
    } catch {
      // Not saved; the choice still applies until the page is reloaded.
    }
  }, [view]);
  const update = useCallback((patch: Partial<LibraryView>) => setView((v) => ({ ...v, ...patch })), []);
  return [view, update] as const;
}
