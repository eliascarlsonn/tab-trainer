import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { loadYouTubeApi } from "@/player/youtube/youtubeApi";
import { IconButton } from "@/ui/Button";
import { useEngine, useSetting } from "./engineContext";
import styles from "./VideoPanel.module.css";

const SYNC_NUDGE_MS = 50;

/**
 * Hosts the YouTube player while a video is the playback source.
 * It stays mounted when hidden, because the video still provides the audio.
 */
export function VideoPanel() {
  const source = useSetting("source");
  const visible = useSetting("videoVisible");
  if (source.kind !== "video") return null;

  return (
    <aside className={cx(styles.panel, !visible && styles.hidden)} aria-hidden={!visible}>
      <YouTubeFrame key={source.videoId} videoId={source.videoId} />
      <SyncNudge />
    </aside>
  );
}

function YouTubeFrame({ videoId }: { videoId: string }) {
  const engine = useEngine();
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let destroy = () => {};

    loadYouTubeApi()
      .then((YT) => {
        if (disposed || !host.current) return;
        const player = new YT.Player(host.current, {
          videoId,
          playerVars: { controls: 1, rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onReady: (e) => engine.attachVideo(e.target),
            onStateChange: (e) => engine.onVideoStateChange(e.data),
            onError: () => setError("This video can't be played here. Pick another one under Play along with."),
          },
        });
        destroy = () => player.destroy();
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      disposed = true;
      engine.detachVideo();
      destroy();
    };
  }, [engine, videoId]);

  return (
    <div className={styles.frame}>
      <div ref={host} />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function SyncNudge() {
  const engine = useEngine();
  const offset = useSetting("syncOffsetMs");
  const label = offset === 0 ? "In sync" : `${offset > 0 ? "+" : ""}${offset} ms`;

  return (
    <div className={styles.sync}>
      <span className={styles.syncLabel} title="Shift the tab if it runs ahead of or behind the video">
        Sync
      </span>
      <IconButton icon="minus" label="Tab earlier" onClick={() => engine.setSyncOffset(offset - SYNC_NUDGE_MS)} />
      <button type="button" className={styles.syncValue} onClick={() => engine.setSyncOffset(0)} title="Reset sync">
        {label}
      </button>
      <IconButton icon="plus" label="Tab later" onClick={() => engine.setSyncOffset(offset + SYNC_NUDGE_MS)} />
    </div>
  );
}
