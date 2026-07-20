// Migration test — docs/03-data-models.md §3.1: "run each migration against
// a fixture DB from the previous version and assert the expected
// columns/rows exist after." Uses better-sqlite3 (pure Node, no native RN
// runtime needed) behind a thin adapter exposing just the two
// expo-sqlite methods migrations/index.ts actually calls, so this runs
// under plain Jest without an Expo/device environment.
import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";
import { runMigrations } from "./index";

function makeTestDb(): SQLiteDatabase {
  const raw = new Database(":memory:");
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    getFirstAsync: async <T>(sql: string) => {
      if (/^\s*PRAGMA/i.test(sql)) {
        const name = sql.match(/PRAGMA\s+(\w+)/i)?.[1] ?? "";
        const result = raw.pragma(name);
        return (Array.isArray(result) ? result[0] : result) as T;
      }
      return raw.prepare(sql).get() as T;
    },
  } as unknown as SQLiteDatabase;
}

function tableNames(raw: Database.Database): string[] {
  return raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row: any) => row.name);
}

describe("001_initial migration", () => {
  it("creates all expected tables and bumps schema_version to 1", async () => {
    const rawDb = new Database(":memory:");
    const db = {
      execAsync: async (sql: string) => {
        rawDb.exec(sql);
      },
      getFirstAsync: async <T>(sql: string) => {
        const name = sql.match(/PRAGMA\s+(\w+)/i)?.[1] ?? "";
        const result = rawDb.pragma(name);
        return (Array.isArray(result) ? result[0] : result) as T;
      },
    } as unknown as SQLiteDatabase;

    await runMigrations(db);

    const tables = tableNames(rawDb);
    expect(tables).toEqual(
      expect.arrayContaining([
        "clothing_items",
        "shoe_items",
        "umbrella_items",
        "vehicle_items",
        "saved_locations",
        "saved_routes",
        "environment_annotations",
        "journeys",
        "warmth_calibration",
        "advanced_warmth_thresholds",
      ])
    );

    const version = rawDb.pragma("user_version", { simple: true });
    expect(version).toBe(1);
  });

  it("is idempotent — running twice never errors and leaves schema_version at 1", async () => {
    const db = makeTestDb();
    await runMigrations(db);
    await expect(runMigrations(db)).resolves.not.toThrow();
    const version = await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version"
    );
    expect(version?.user_version).toBe(1);
  });

  it("creates the indices from docs/03-data-models.md §3.2", async () => {
    const rawDb = new Database(":memory:");
    const db = {
      execAsync: async (sql: string) => {
        rawDb.exec(sql);
      },
      getFirstAsync: async <T>(sql: string) => {
        const name = sql.match(/PRAGMA\s+(\w+)/i)?.[1] ?? "";
        const result = rawDb.pragma(name);
        return (Array.isArray(result) ? result[0] : result) as T;
      },
    } as unknown as SQLiteDatabase;

    await runMigrations(db);

    const indices = rawDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
      .all()
      .map((row: any) => row.name);

    expect(indices).toEqual(
      expect.arrayContaining([
        "idx_journeys_depart_time",
        "idx_saved_locations_last_used_at",
        "idx_journeys_origin_id",
        "idx_journeys_destination_id",
        "idx_saved_routes_last_used_at",
      ])
    );
  });
});
