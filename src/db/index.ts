import * as SQLite from "expo-sqlite";
import { runMigrations } from "../../migrations";

const DB_NAME = "commute-weather-planner.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Opens the app's single SQLite database and runs any pending migrations.
// Call once at app startup, before any screen reads from SQLite; safe to
// call multiple times since the promise is memoized.
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await runMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}
