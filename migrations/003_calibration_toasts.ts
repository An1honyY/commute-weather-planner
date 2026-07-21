// Additive migration (Section 3.1) — §7.5's calibration-toast gating needs
// a persisted counter so "show only the first ~3 times" survives restarts.
import type { SQLiteDatabase } from "expo-sqlite";

export const version = 3;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE warmth_calibration ADD COLUMN calibration_toasts_shown INTEGER;
  `);
}
