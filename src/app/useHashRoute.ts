import { useEffect, useState } from "react";

export type Route = { name: "library" } | { name: "song"; songId: string };

const SONG_PREFIX = "#/song/";

function parse(hash: string): Route {
  if (hash.startsWith(SONG_PREFIX)) {
    return { name: "song", songId: decodeURIComponent(hash.slice(SONG_PREFIX.length)) };
  }
  return { name: "library" };
}

export const routes = {
  library: () => "#/",
  song: (songId: string) => `${SONG_PREFIX}${encodeURIComponent(songId)}`,
};

export function navigate(hash: string) {
  window.location.hash = hash;
}

/** Hash-based routing keeps the browser back button working without a server. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
