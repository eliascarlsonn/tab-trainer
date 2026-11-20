export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** The entry in `values` closest to `target`. */
export function nearest(values: readonly number[], target: number): number {
  return values.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), values[0] ?? target);
}
