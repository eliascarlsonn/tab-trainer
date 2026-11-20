import { describe, expect, it } from "vitest";
import { completePass } from "./speedTrainer";

const settings = { enabled: true, step: 0.1, target: 1, passesPerStep: 2 };

describe("completePass", () => {
  it("waits for the required number of passes", () => {
    expect(completePass(settings, 0.6, { passes: 0 })).toEqual({ progress: { passes: 1 } });
  });

  it("speeds up once enough passes are completed", () => {
    expect(completePass(settings, 0.6, { passes: 1 })).toEqual({ progress: { passes: 0 }, speed: 0.7 });
  });

  it("never exceeds the target speed", () => {
    expect(completePass(settings, 0.95, { passes: 1 }).speed).toBe(1);
  });

  it("does nothing when disabled or already at target", () => {
    expect(completePass({ ...settings, enabled: false }, 0.6, { passes: 1 }).speed).toBeUndefined();
    expect(completePass(settings, 1, { passes: 1 }).speed).toBeUndefined();
  });
});
