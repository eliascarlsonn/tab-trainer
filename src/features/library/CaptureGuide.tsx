import styles from "./CaptureGuide.module.css";

const STEPS = [
  { title: "Open the song", body: "Go to the song on songsterr.com in Chrome or Edge." },
  { title: "Start recording", body: "Press F12, open the Network tab, tick Disable cache, then reload the page." },
  {
    title: "Load what you need",
    body: "Click through every track you want to practice. Turn on the video if you want to play along with it.",
  },
  {
    title: "Export and drop",
    body: "Click the download arrow (Export HAR) in the Network tab and drop the file here.",
  },
];

/** The capture workflow is a real sequence, so the steps are numbered. */
export function CaptureGuide() {
  return (
    <ol className={styles.steps}>
      {STEPS.map((step, i) => (
        <li key={step.title} className={styles.step}>
          <span className={styles.number}>{i + 1}</span>
          <div>
            <h3 className={styles.title}>{step.title}</h3>
            <p className={styles.body}>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
