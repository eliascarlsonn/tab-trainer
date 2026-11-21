import { useEffect } from "react";
import { useLibrary } from "@/library/useLibrary";
import { CAPTURE_MESSAGES, type CaptureMessage } from "@/songsterr/bookmarklet";
import { navigate, routes } from "./useHashRoute";

/** Only songs sent from a Songsterr page are accepted. */
const SONGSTERR_ORIGIN = /^https:\/\/(www\.)?songsterr\.com$/;

/**
 * Receives songs from the "Send to Tab Trainer" bookmarklet: answers its pings, imports the
 * capture it sends, reports back, and opens the song.
 */
export function useCaptureReceiver() {
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (!SONGSTERR_ORIGIN.test(event.origin) || !event.source) return;
      const data = event.data as CaptureMessage | null;
      const reply = (message: CaptureMessage) => (event.source as Window).postMessage(message, event.origin);

      if (data?.type === CAPTURE_MESSAGES.ping) return reply({ type: CAPTURE_MESSAGES.ready });
      if (data?.type !== CAPTURE_MESSAGES.capture) return;
      try {
        // A song can arrive while the app is still starting; merge it into the stored library.
        if (!useLibrary.getState().loaded) await useLibrary.getState().load();
        const file = new File([JSON.stringify(data.har)], data.fileName || "songsterr.har", {
          type: "application/json",
        });
        const { songs, errors } = await useLibrary.getState().importFiles([file]);
        const song = songs[0];
        if (!song) throw new Error(errors[0]?.message ?? "No tabs were found in that song.");
        reply({ type: CAPTURE_MESSAGES.imported, message: song.title });
        navigate(routes.song(song.id));
      } catch (error) {
        reply({ type: CAPTURE_MESSAGES.failed, message: error instanceof Error ? error.message : String(error) });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
