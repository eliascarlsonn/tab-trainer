import type { TrainerSettings } from "@/practice/practiceSettings";

export interface TrainerProgress {
  /** Loop passes completed at the current speed. */
  passes: number;
}

export interface TrainerStep {
  progress: TrainerProgress;
  /** New speed, when the trainer decided to speed up. */
  speed?: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Speed trainer rule: after every `passesPerStep` completed loop passes,
 * raise the speed by `step` until `target` is reached.
 */
export function completePass(settings: TrainerSettings, speed: number, progress: TrainerProgress): TrainerStep {
  if (!settings.enabled || speed >= settings.target) return { progress };

  const passes = progress.passes + 1;
  if (passes < settings.passesPerStep) return { progress: { passes } };

  return { progress: { passes: 0 }, speed: round2(Math.min(settings.target, speed + settings.step)) };
}
