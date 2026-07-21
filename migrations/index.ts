// Migration runner — Section 3.1. Runs once at app startup, before any
// screen reads from SQLite. Each migration is numbered and runs only if
// the stored schema_version is below its version, then bumps the version.
import type { SQLiteDatabase } from "expo-sqlite";
import * as m001 from "./001_initial";
import * as m002 from "./002_app_settings";
import * as m003 from "./003_calibration_toasts";

interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

// Ordered oldest to newest. Append new migrations here — never reorder or
// remove an entry once shipped.
const migrations: Migration[] = [m001, m002, m003];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  let currentVersion = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;
    await migration.up(db);
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    currentVersion = migration.version;
  }
}
