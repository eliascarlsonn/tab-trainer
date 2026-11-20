import { useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { cx } from "@/lib/cx";
import { clamp } from "@/lib/math";
import styles from "./Knob.module.css";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Value restored on double-click. */
  defaultValue: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** Restricts the knob to these values (e.g. speeds a video supports). */
  options?: readonly number[] | null;
  disabled?: boolean;
  /** Short note shown instead of the value when disabled. */
  disabledNote?: string;
}

const SWEEP = 270;
const START_ANGLE = -135;
const PIXELS_PER_RANGE = 180;
const SIZE = 64;
const CENTER = SIZE / 2;
const RADIUS = 26;

function polar(angle: number, radius = RADIUS) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function arcPath(from: number, to: number) {
  const a = polar(from);
  const b = polar(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${b.x} ${b.y}`;
}

/** Rotary control modeled on an amplifier knob: drag vertically, scroll, or use arrow keys. */
export function Knob({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  format,
  onChange,
  options,
  disabled,
  disabledNote,
}: KnobProps) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  const ratio = (clamp(value, min, max) - min) / (max - min);
  const angle = START_ANGLE + ratio * SWEEP;
  const zeroAngle = START_ANGLE + ((clamp(defaultValue, min, max) - min) / (max - min)) * SWEEP;

  /** Moves by `steps` increments, honoring discrete options when present. */
  const nudge = (steps: number) => {
    if (options?.length) {
      const index = options.findIndex((o) => o >= value - 1e-6);
      const current = index === -1 ? options.length - 1 : index;
      onChange(options[clamp(current + steps, 0, options.length - 1)]!);
    } else {
      onChange(clamp(value + steps * step, min, max));
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, value };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const delta = ((drag.current.y - e.clientY) / PIXELS_PER_RANGE) * (max - min);
    const raw = clamp(drag.current.value + delta, min, max);
    onChange(options?.length ? raw : Math.round(raw / step) * step);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 5,
      PageDown: -5,
    };
    if (e.key in keys) {
      e.preventDefault();
      nudge(keys[e.key]!);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      onChange(e.key === "Home" ? min : max);
    }
  };

  const onWheel = (e: WheelEvent) => {
    if (!disabled) nudge(e.deltaY < 0 ? 1 : -1);
  };

  const pointer = polar(angle, RADIUS - 9);
  const pointerBase = polar(angle, 6);

  return (
    <div className={cx(styles.knob, disabled && styles.disabled)}>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        aria-disabled={disabled}
        className={styles.dial}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={() => !disabled && onChange(defaultValue)}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <path d={arcPath(START_ANGLE, START_ANGLE + SWEEP)} className={styles.track} />
          {!disabled && Math.abs(angle - zeroAngle) > 0.5 && (
            <path d={arcPath(Math.min(angle, zeroAngle), Math.max(angle, zeroAngle))} className={styles.value} />
          )}
          <circle cx={CENTER} cy={CENTER} r={RADIUS - 6} className={styles.cap} />
          <line x1={pointerBase.x} y1={pointerBase.y} x2={pointer.x} y2={pointer.y} className={styles.pointer} />
        </svg>
      </div>
      <span className={styles.readout}>{disabled && disabledNote ? disabledNote : format(value)}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
