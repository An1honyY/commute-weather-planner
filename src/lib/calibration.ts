// §7.5 — personal calibration from post-journey feedback, plus the toast
// gating (§4.2/§9.1.1) and staleness decay (§7.5.3) that build on it.
// recommendGear()/weather.ts's resolveWarmthOffset() is the read side; this
// module is the write side — the only place WarmthCalibration is mutated
// from feedback or from time passing.
import { clamp } from "./utils";
import { getSeason } from "./weather";
import { getWarmthCalibration, saveWarmthCalibration } from "../db/repositories/calibration";
import type { GearFeedback, WarmthCalibration } from "../types";

export const WARMTH_CALIBRATION_STEP = 0.5; // §7.5 — how much one feedback event shifts offsetLevels
export const CALIBRATION_DECAY_AFTER_DAYS = 60; // §7.5.3
export const CALIBRATION_DECAY_STEP = 0.25; // §7.5.3
const CALIBRATION_TOAST_MAX_SHOWN = 3; // §7.5 — "the first ~3 occurrences," then stop

// §7.5 — a "much_too_*" report moves the offset twice as far as the
// adjacent plain "too_*" option; "just_right" still resets the decay clock.
const FEEDBACK_STEP_MULTIPLIER: Record<GearFeedback, number> = {
  much_too_cold: 2,
  too_cold: 1,
  just_right: 0,
  too_warm: -1,
  much_too_warm: -2,
};

export interface GearFeedbackResult {
  calibration: WarmthCalibration;
  // Set only when the "we noticed" toast (§4.2/§9.1.1) should show this
  // time — "warmer" means the offset moved negative (dial back a layer),
  // "colder" means it moved positive (bring an extra layer).
  toast: { direction: "warmer" | "colder" } | null;
}

// §7.5 — applies one post-journey GearFeedback event to the running
// global + seasonal offsets, persists it, and reports whether the one-time
// calibration toast should show. `journeyDepartTime` resolves the season
// the feedback journey actually happened in, not "now" (§7.5.1).
export async function recordGearFeedback(feedback: GearFeedback, journeyDepartTime: string): Promise<GearFeedbackResult> {
  const current = await getWarmthCalibration();
  const season = getSeason(journeyDepartTime);
  const multiplier = FEEDBACK_STEP_MULTIPLIER[feedback];
  const now = new Date().toISOString();

  if (multiplier === 0) {
    const next: WarmthCalibration = { ...current, lastFeedbackAt: now };
    await saveWarmthCalibration(next);
    return { calibration: next, toast: null };
  }

  const delta = multiplier * WARMTH_CALIBRATION_STEP;
  const seasonalOffsets = current.seasonalOffsets ?? {
    summer: current.offsetLevels,
    winter: current.offsetLevels,
    shoulder: current.offsetLevels,
  };
  const seasonalSampleCounts = current.seasonalSampleCounts ?? { summer: 0, winter: 0, shoulder: 0 };
  const nextSeasonalOffset = clamp(seasonalOffsets[season] + delta, -2, 2);
  const offsetActuallyChanged = nextSeasonalOffset !== seasonalOffsets[season];

  const toastsShown = current.calibrationToastsShown ?? 0;
  const showToast = offsetActuallyChanged && toastsShown < CALIBRATION_TOAST_MAX_SHOWN;

  const next: WarmthCalibration = {
    ...current,
    offsetLevels: clamp(current.offsetLevels + delta, -2, 2),
    sampleCount: current.sampleCount + 1,
    seasonalOffsets: { ...seasonalOffsets, [season]: nextSeasonalOffset },
    seasonalSampleCounts: { ...seasonalSampleCounts, [season]: seasonalSampleCounts[season] + 1 },
    lastFeedbackAt: now,
    calibrationToastsShown: showToast ? toastsShown + 1 : toastsShown,
  };
  await saveWarmthCalibration(next);
  return { calibration: next, toast: showToast ? { direction: delta < 0 ? "warmer" : "colder" } : null };
}

// §7.5.3 — nudges a stale bucket CALIBRATION_DECAY_STEP closer to 0,
// never overshooting past 0 into the opposite sign. Pure function so it's
// trivially testable without a DB — runCalibrationDecayIfDue() below is the
// DB-touching wrapper.
export function decayCalibration(calibration: WarmthCalibration, now: Date = new Date()): WarmthCalibration {
  if (!calibration.lastFeedbackAt) return calibration;
  const daysSince = (now.getTime() - new Date(calibration.lastFeedbackAt).getTime()) / 86_400_000;
  if (daysSince < CALIBRATION_DECAY_AFTER_DAYS) return calibration;

  const decayToward = (v: number): number => {
    if (v === 0) return 0;
    const next = v - Math.sign(v) * CALIBRATION_DECAY_STEP;
    return Math.sign(next) === Math.sign(v) ? next : 0;
  };

  return {
    ...calibration,
    offsetLevels: decayToward(calibration.offsetLevels),
    seasonalOffsets: calibration.seasonalOffsets && {
      summer: decayToward(calibration.seasonalOffsets.summer),
      winter: decayToward(calibration.seasonalOffsets.winter),
      shoulder: decayToward(calibration.seasonalOffsets.shoulder),
    },
    windSensitivityOffset:
      calibration.windSensitivityOffset !== undefined ? decayToward(calibration.windSensitivityOffset) : calibration.windSensitivityOffset,
  };
}

// §7.5.3 — "run the check on app foreground." Cheap, local-only; a no-op
// write when nothing was actually stale. Also the function a future dev-menu
// "run calibration decay now" trigger (§12.2) should call directly.
export async function runCalibrationDecayIfDue(): Promise<WarmthCalibration> {
  const current = await getWarmthCalibration();
  const next = decayCalibration(current);
  if (next !== current) await saveWarmthCalibration(next);
  return next;
}
