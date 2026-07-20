// Runner-level tests — docs/03-data-models.md §3.1. Covers the
// version-bumping/idempotency behavior shared across every migration,
// as opposed to any single migration's own schema shape (see e.g.
// 001_initial.test.ts).
import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";
import { runMigrations } from "./index";
import { version as latestVersion } from "./002_app_settings";

function makeTestDb(): { db: SQLiteDatabase; raw: Database.Database } {
  const raw = new Database(":memory:");
  const db = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    getFirstAsync: async <T>(sql: string) => {
      const name = sql.match(/PRAGMA\s+(\w+)/i)?.[1] ?? "";
      const result = raw.pragma(name);
      return (Array.isArray(result) ? result[0] : result) as T;
    },
  } as unknown as SQLiteDatabase;
  return { db, raw };
}

describe("migration runner", () => {
  it("runs every migration and bumps schema_version to the latest", async () => {
    const { db, raw } = makeTestDb();
    await runMigrations(db);
    expect(raw.pragma("user_version", { simple: true })).toBe(latestVersion);
  });

  it("is idempotent — running twice never errors and leaves schema_version at the latest", async () => {
    const { db } = makeTestDb();
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.not.toThrow();
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(row?.user_version).toBe(latestVersion);
  });

  it("only runs migrations above the stored version", async () => {
    const { db, raw } = makeTestDb();
    raw.pragma(`user_version = ${latestVersion}`); // simulate an already-migrated DB
    await expect(runMigrations(db)).resolves.not.toThrow();
    expect(raw.pragma("user_version", { simple: true })).toBe(latestVersion);
  });
});
