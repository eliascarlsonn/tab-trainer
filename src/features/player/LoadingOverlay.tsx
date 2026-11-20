import { routes } from "@/app/useHashRoute";
import { useEngineState } from "./engineContext";
import styles from "./LoadingOverlay.module.css";

export function LoadingOverlay() {
  const phase = useEngineState((s) => s.phase);
  const error = useEngineState((s) => s.error);
  if (phase === "ready") return null;

  return (
    <div className={styles.overlay} role="status">
      {phase === "error" ? (
        <>
          <p className={styles.title}>This tab could not be displayed</p>
          <p className={styles.detail}>{error}</p>
          <a className={styles.link} href={routes.library()}>
            Back to your songs
          </a>
        </>
      ) : (
        <>
          <span className={styles.pilot} aria-hidden="true" />
          <p className={styles.title}>Preparing the tab</p>
        </>
      )}
    </div>
  );
}
