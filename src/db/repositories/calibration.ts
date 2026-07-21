import { getDb } from "../index";
import { fromSqlJson, toSqlJson } from "../rowMapping";
import type { WarmthCalibration } from "../../types";

interface CalibrationRow {
  offset_levels: number;
  sample_count: number;
  seasonal_offsets: string | null;
  seasonal_sample_counts: string | null;
  wind_sensitivity_offset: number | null;
  wind_sensitivity_sample_count: number | null;
  last_feedback_at: string | null;
  calibration_toasts_shown: number | null;
}

const DEFAULT_CALIBRATION: WarmthCalibration = { offsetLevels: 0, sampleCount: 0 };

function fromRow(row: CalibrationRow): WarmthCalibration {
  return {
    offsetLevels: row.offset_levels,
    sampleCount: row.sample_count,
    seasonalOffsets: fromSqlJson(row.seasonal_offsets),
    seasonalSampleCounts: fromSqlJson(row.seasonal_sample_counts),
    windSensitivityOffset: row.wind_sensitivity_offset ?? undefined,
    windSensitivitySampleCount: row.wind_sensitivity_sample_count ?? undefined,
    lastFeedbackAt: row.last_feedback_at ?? undefined,
    calibrationToastsShown: row.calibration_toasts_shown ?? undefined,
  };
}

export async function getWarmthCalibration(): Promise<WarmthCalibration> {
  const db = await getDb();
  const row = await db.getFirstAsync<CalibrationRow>("SELECT * FROM warmth_calibration WHERE id = 1");
  return row ? fromRow(row) : DEFAULT_CALIBRATION;
}

export async function saveWarmthCalibration(calibration: WarmthCalibration): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO warmth_calibration
      (id, offset_levels, sample_count, seasonal_offsets, seasonal_sample_counts,
       wind_sensitivity_offset, wind_sensitivity_sample_count, last_feedback_at, calibration_toasts_shown)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       offset_levels = excluded.offset_levels,
       sample_count = excluded.sample_count,
       seasonal_offsets = excluded.seasonal_offsets,
       seasonal_sample_counts = excluded.seasonal_sample_counts,
       wind_sensitivity_offset = excluded.wind_sensitivity_offset,
       wind_sensitivity_sample_count = excluded.wind_sensitivity_sample_count,
       last_feedback_at = excluded.last_feedback_at,
       calibration_toasts_shown = excluded.calibration_toasts_shown`,
    calibration.offsetLevels,
    calibration.sampleCount,
    toSqlJson(calibration.seasonalOffsets),
    toSqlJson(calibration.seasonalSampleCounts),
    calibration.windSensitivityOffset ?? null,
    calibration.windSensitivitySampleCount ?? null,
    calibration.lastFeedbackAt ?? null,
    calibration.calibrationToastsShown ?? null
  );
}

// §7.5.2 — the Settings-level wind-sensitivity control (Section 9.1.1)
// writes directly here rather than through the feedback loop, since it has
// no natural post-journey feedback event of its own to hang off.
export async function setWindSensitivityOffset(value: number): Promise<void> {
  const current = await getWarmthCalibration();
  await saveWarmthCalibration({ ...current, windSensitivityOffset: value });
}

// Onboarding's self-report step (docs/04-screens-navigation.md §4.1, §7.5.1)
// — seeds the global offset and all three seasonal buckets at once, but
// deliberately doesn't bump sampleCount: this is a starting guess, not a
// real feedback event, so Settings' "Adjusted from N check-ins" transparency
// display (§9.1.1) stays accurate to actual post-journey feedback.
export async function seedWarmthCalibration(offsetLevels: number): Promise<void> {
  await saveWarmthCalibration({
    offsetLevels,
    sampleCount: 0,
    seasonalOffsets: { summer: offsetLevels, winter: offsetLevels, shoulder: offsetLevels },
    seasonalSampleCounts: { summer: 0, winter: 0, shoulder: 0 },
  });
}
