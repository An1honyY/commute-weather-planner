// Migration test — docs/03-data-models.md §3.1: "run each migration against
// a fixture DB from the previous version and assert the expected
// columns/rows exist after." Uses better-sqlite3 (pure Node, no native RN
// runtime needed) behind a thin adapter exposing the expo-sqlite methods
// migrations actually call, so this runs under plain Jest without an
// Expo/device environment. Tests migration 001's `up()` directly (not via
// the runner) since this file is about that migration's own schema shape,
// not the runner's version-bumping behavior — see migrations/index.test.ts
// for that.
import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";
import { up } from "./001_initial";

function makeTestDb(): { db: SQLiteDatabase; raw: Database.Database } {
  const raw = new Database(":memory:");
  const db = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
  } as unknown as SQLiteDatabase;
  return { db, raw };
}

describe("001_initial migration", () => {
  it("creates all expected tables", async () => {
    const { db, raw } = makeTestDb();
    await up(db);

    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row: any) => row.name);

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
  });

  it("is idempotent — running twice never errors", async () => {
    const { db } = makeTestDb();
    await up(db);
    await expect(up(db)).resolves.not.toThrow();
  });

  it("creates the indices from docs/03-data-models.md §3.2", async () => {
    const { db, raw } = makeTestDb();
    await up(db);

    const indices = raw
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
