import { cx } from "@/lib/cx";
import styles from "./LedSwitch.module.css";

interface LedSwitchProps {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  /** LED color when on. Teal is reserved for loop-related switches. */
  tone?: "amber" | "teal";
  disabled?: boolean;
  title?: string;
}

/** A labeled toggle with a pilot light, like an amp's channel switch. */
export function LedSwitch({ label, on, onChange, tone = "amber", disabled, title }: LedSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title}
      className={cx(styles.switch, on && styles.on, styles[tone])}
      onClick={() => onChange(!on)}
    >
      <span className={styles.led} aria-hidden="true" />
      {label}
    </button>
  );
}
