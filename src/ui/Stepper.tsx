import { clamp } from "@/lib/math";
import { IconButton } from "./Button";
import styles from "./Stepper.module.css";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

/** A labeled value with − and + buttons, for precise settings. */
export function Stepper({ label, value, min, max, step, format, onChange }: StepperProps) {
  const change = (direction: number) => onChange(Math.round(clamp(value + direction * step, min, max) * 1000) / 1000);
  return (
    <div className={styles.stepper}>
      <span className={styles.label}>{label}</span>
      <div className={styles.control}>
        <IconButton
          icon="minus"
          label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => change(-1)}
        />
        <span className={styles.value}>{format(value)}</span>
        <IconButton
          icon="plus"
          label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => change(1)}
        />
      </div>
    </div>
  );
}
