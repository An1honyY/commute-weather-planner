// Additive migration (Section 3.1) — a small generic key/value settings
// table so later single-flag/single-value settings (crash-reporting
// opt-in, onboarding-completed, eventually themePreference/CarryPreference
// defaults in Phase 5) don't each need their own numbered migration.
import type { SQLiteDatabase } from "expo-sqlite";

export const version = 2;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);
}
