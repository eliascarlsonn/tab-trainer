import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { cx } from "@/lib/cx";
import { clamp, roundTo } from "@/lib/math";
import styles from "./Knob.module.css";

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Value restored on double-click. */
  defaultValue: number;
  /**
   * Where the lit arc starts. Defaults to `min`, so the arc fills up to the pointer like a level.
   * Pass the center (e.g. 0 for ±semitones) for bipolar controls that light up outward from it.
   */
  origin?: number;
  /**
   * The value shown with the pointer straight up. Defaults to halfway between `min` and `max`; for a
   * lopsided range (e.g. 25–150% speed) each half of the sweep then covers its own side of it.
   */
  center?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Short note shown instead of the value when disabled. */
  disabledNote?: string;
  /** Lets the value be typed in after clicking the readout. */
  entry?: KnobEntry;
}

export interface KnobEntry {
  /** The value as it appears in the text field, e.g. "85" for 0.85. */
  toText: (value: number) => string;
  /** Reads typed text back; undefined when it isn't a number. */
  fromText: (text: string) => number | undefined;
  /** Unit shown after the field, e.g. "%". */
  suffix?: string;
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
  origin = min,
  center = (min + max) / 2,
  format,
  onChange,
  disabled,
  disabledNote,
  entry,
}: KnobProps) {
  const drag = useRef<{ y: number; ratio: number } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  // Blur also fires after Enter/Escape; this makes sure the draft is applied at most once.
  const editing = useRef(false);

  const startEditing = () => {
    if (!entry || disabled) return;
    editing.current = true;
    setDraft(entry.toText(value));
  };

  const finishEditing = (apply: boolean) => {
    if (!editing.current) return;
    editing.current = false;
    const typed = apply && draft !== null ? entry?.fromText(draft) : undefined;
    setDraft(null);
    if (typed !== undefined && Number.isFinite(typed)) onChange(clamp(typed, min, max));
  };

  // Clicking the tab doesn't move focus (alphaTab handles the pointer), so blur alone would leave
  // the field open; any press outside it applies the value.
  const entryRef = useRef<HTMLSpanElement>(null);
  const finishRef = useRef(finishEditing);
  finishRef.current = finishEditing;
  const isEditing = draft !== null;
  useEffect(() => {
    if (!isEditing) return;
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (!entryRef.current?.contains(e.target as Node)) finishRef.current(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [isEditing]);
  /** Position along the sweep (0–1), with `center` at 0.5. */
  const toRatio = (v: number) => {
    const c = clamp(v, min, max);
    return c <= center ? ((c - min) / (center - min)) * 0.5 : 0.5 + ((c - center) / (max - center)) * 0.5;
  };
  const fromRatio = (r: number) => {
    const c = clamp(r, 0, 1);
    return c <= 0.5 ? min + (c / 0.5) * (center - min) : center + ((c - 0.5) / 0.5) * (max - center);
  };
  const angle = START_ANGLE + toRatio(value) * SWEEP;
  const originAngle = START_ANGLE + toRatio(origin) * SWEEP;

  /** Moves by `steps` increments, landing on the step grid even if the value was off it. */
  const nudge = (steps: number) => onChange(clamp(roundTo(value + steps * step, step), min, max));

  const onPointerDown = (e: PointerEvent) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, ratio: toRatio(value) };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return;
    // Dragging turns the dial evenly, so each half of the sweep takes the same distance.
    const ratio = drag.current.ratio + (drag.current.y - e.clientY) / PIXELS_PER_RANGE;
    onChange(clamp(roundTo(fromRatio(ratio), step), min, max));
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
          {!disabled && Math.abs(angle - originAngle) > 0.5 && (
            <path d={arcPath(Math.min(angle, originAngle), Math.max(angle, originAngle))} className={styles.value} />
          )}
          <circle cx={CENTER} cy={CENTER} r={RADIUS - 6} className={styles.cap} />
          <line x1={pointerBase.x} y1={pointerBase.y} x2={pointer.x} y2={pointer.y} className={styles.pointer} />
        </svg>
      </div>
      {draft !== null ? (
        <span ref={entryRef} className={styles.entry}>
          <input
            className={styles.entryField}
            value={draft}
            inputMode="decimal"
            aria-label={`${label}, type a value`}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finishEditing(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishEditing(true);
              else if (e.key === "Escape") {
                e.stopPropagation();
                finishEditing(false);
              }
            }}
          />
          {entry?.suffix && <span className={styles.entrySuffix}>{entry.suffix}</span>}
        </span>
      ) : entry && !disabled ? (
        <button
          type="button"
          className={cx(styles.readout, styles.editable)}
          title="Click to type a value"
          aria-label={`${label} ${format(value)}, click to type a value`}
          onClick={startEditing}
        >
          {format(value)}
        </button>
      ) : (
        <span className={styles.readout}>{disabled && disabledNote ? disabledNote : format(value)}</span>
      )}
      <span className={styles.label}>{label}</span>
    </div>
  );
}
