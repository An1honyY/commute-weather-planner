import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";
import { up as up001 } from "./001_initial";
import { up } from "./003_calibration_toasts";

describe("003_calibration_toasts migration", () => {
  it("adds calibration_toasts_shown to warmth_calibration", async () => {
    const raw = new Database(":memory:");
    const db = { execAsync: async (sql: string) => raw.exec(sql) } as unknown as SQLiteDatabase;

    await up001(db);
    await up(db);

    const columns = raw
      .prepare("PRAGMA table_info(warmth_calibration)")
      .all()
      .map((row: any) => row.name);
    expect(columns).toContain("calibration_toasts_shown");
  });
});
