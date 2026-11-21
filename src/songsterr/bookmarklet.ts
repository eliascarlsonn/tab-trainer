/**
 * The "Send to Tab Trainer" bookmarklet. Clicked on a songsterr.com song page, it collects that
 * song (page state, every track, video sync points) in the HAR format the importer already reads,
 * and hands it to the app through postMessage. If the app can't be reached it downloads the file.
 */

/** Messages between the bookmarklet (on songsterr.com) and the app. */
export const CAPTURE_MESSAGES = {
  ping: "tab-trainer:ping",
  ready: "tab-trainer:ready",
  capture: "tab-trainer:capture",
  imported: "tab-trainer:imported",
  failed: "tab-trainer:failed",
} as const;

export interface CaptureMessage {
  type: (typeof CAPTURE_MESSAGES)[keyof typeof CAPTURE_MESSAGES];
  har?: unknown;
  fileName?: string;
  message?: string;
}

/**
 * Runs inside the Songsterr page, not the app. It's turned into a bookmark with toString(), so it
 * must not use imports or anything outside its own body (message names are repeated literally).
 */
export async function sendSongToTabTrainer(appUrl: string): Promise<void> {
  const appOrigin = new URL(appUrl).origin;
  // Opened before any await: browsers only allow pop-ups during the click itself.
  const app = window.open(appUrl, "tab-trainer");
  const say = (text: string) => alert(`Tab Trainer: ${text}`);
  const give = (text: string) => {
    app?.close();
    say(text);
  };

  try {
    if (!/(^|\.)songsterr\.com$/.test(location.hostname)) {
      return give("open a song on songsterr.com, then click the bookmark again.");
    }
    // The page's server-rendered state holds the song details. Fetching the page again keeps them
    // right after moving between songs inside Songsterr, where the original state goes stale.
    const html = await (await fetch(location.href, { credentials: "include" })).text();
    const state = /<script[^>]*id="state"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
    const meta = state ? JSON.parse(state)?.meta?.current : undefined;
    if (!meta?.tracks?.length || !meta.image) return give("this page doesn't show a song's tab.");

    const { songId, revisionId, image } = meta;
    const path = `/${songId}/${revisionId}/${image}/`;
    // Tracks come from Songsterr's CDN; use the host the page itself loaded them from.
    const loaded = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => name.includes(path));
    const cdn = loaded ? new URL(loaded).origin : "https://dqsljvtekg760.cloudfront.net";

    const entries: unknown[] = [];
    const add = (url: string, mimeType: string, text: string) =>
      entries.push({ request: { method: "GET", url }, response: { status: 200, content: { mimeType, text } } });
    const fetchText = async (url: string, init?: RequestInit) => {
      const response = await fetch(url, init).catch(() => undefined);
      return response?.ok ? response.text() : undefined;
    };

    add(location.href, "text/html", html);
    const trackUrls: string[] = meta.tracks.map(
      (track: { partId?: number }, index: number) => `${cdn}${path}${track.partId ?? index}.json`,
    );
    const tracks = await Promise.all(trackUrls.map((url) => fetchText(url)));
    tracks.forEach((text, i) => text && add(trackUrls[i]!, "application/json", text));
    if (!tracks.some(Boolean)) return give("couldn't load this song's tracks.");
    const videosUrl = `${location.origin}/api/video-points/${songId}/${revisionId}/list`;
    const videos = await fetchText(videosUrl, { credentials: "include" });
    if (videos) add(videosUrl, "application/json", videos);

    const har = { log: { version: "1.2", creator: { name: "Tab Trainer bookmarklet", version: "1" }, entries } };
    const fileName = `${meta.artist} - ${meta.title}.har`.replace(/[\\/:*?"<>|]/g, "");
    const download = () => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(har)], { type: "application/json" }));
      link.download = fileName;
      link.click();
    };
    if (!app) {
      download();
      return say("pop-ups are blocked here, so the song was downloaded instead. Drop the file into Tab Trainer.");
    }

    // The app tab may still be loading: ping until it answers, then send the song once.
    const result = await new Promise<string | undefined>((resolve) => {
      let sent = false;
      const ping = setInterval(() => app.postMessage({ type: "tab-trainer:ping" }, appOrigin), 250);
      const timeout = setTimeout(() => finish(undefined), 20000);
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== appOrigin || event.source !== app) return;
        const type = event.data?.type;
        if (type === "tab-trainer:ready" && !sent) {
          sent = true;
          clearInterval(ping);
          app.postMessage({ type: "tab-trainer:capture", har, fileName }, appOrigin);
        } else if (type === "tab-trainer:imported") finish("");
        else if (type === "tab-trainer:failed") finish(String(event.data.message));
      };
      function finish(outcome: string | undefined) {
        clearInterval(ping);
        clearTimeout(timeout);
        removeEventListener("message", onMessage);
        resolve(outcome);
      }
      addEventListener("message", onMessage);
    });
    if (result === undefined) {
      app.close();
      download();
      say(`couldn't reach Tab Trainer at ${appUrl}, so the song was downloaded instead. Drop the file into the app.`);
    } else if (result) say(result);
  } catch (error) {
    say(`something went wrong: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** The bookmark's URL: the function above, called with the app's own address. */
export function bookmarkletHref(appUrl: string): string {
  return `javascript:${encodeURIComponent(`void (${sendSongToTabTrainer.toString()})(${JSON.stringify(appUrl)})`)}`;
}
