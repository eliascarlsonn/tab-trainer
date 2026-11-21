import { useMemo, useState } from "react";
import { bookmarkletHref } from "@/songsterr/bookmarklet";
import styles from "./CaptureGuide.module.css";

const STEPS = [
  { title: "Open the song", body: "Go to the song on songsterr.com." },
  { title: "Record", body: "Press F12, open the Network tab, tick Disable cache, then reload the page." },
  {
    title: "Export and drop",
    body: "Click the download arrow (Export HAR) in the Network tab and drop the file here.",
  },
];

/** The bookmarklet first; the manual capture workflow is a real sequence, so its steps are numbered. */
export function CaptureGuide() {
  // Built with this app's own address, so the bookmark sends songs back to wherever it's hosted.
  const href = useMemo(() => bookmarkletHref(`${location.origin}${import.meta.env.BASE_URL}`), []);
  const [clicked, setClicked] = useState(false);

  return (
    <div className={styles.guide}>
      <section className={styles.quick}>
        <div>
          <h3 className={styles.title}>One click from Songsterr</h3>
          <p className={styles.quickBody}>
            Drag this button to your bookmarks bar. Then open a song on songsterr.com and click the bookmark: the song
            opens here with all its tracks and synced videos.
          </p>
          {clicked && (
            <p className={styles.hint} role="status">
              Drag the button to your bookmarks bar instead of clicking it. If the bar is hidden, press Ctrl+Shift+B.
            </p>
          )}
        </div>
        <a
          // React refuses javascript: URLs in JSX, so the bookmark's URL is set on the element directly.
          ref={(link) => link?.setAttribute("href", href)}
          className={styles.bookmarklet}
          title="Drag to your bookmarks bar"
          onClick={(e) => {
            e.preventDefault();
            setClicked(true);
          }}
        >
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={20} height={20} />
          Send to Tab Trainer
        </a>
      </section>

      <h3 className={styles.manualTitle}>Or capture a song by hand</h3>
      <ol className={styles.steps}>
        {STEPS.map((step, i) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.number}>{i + 1}</span>
            <div>
              <h4 className={styles.title}>{step.title}</h4>
              <p className={styles.body}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
