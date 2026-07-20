import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";
import { up } from "./002_app_settings";

describe("002_app_settings migration", () => {
  it("creates the app_settings table", async () => {
    const raw = new Database(":memory:");
    const db = { execAsync: async (sql: string) => raw.exec(sql) } as unknown as SQLiteDatabase;

    await up(db);

    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row: any) => row.name);
    expect(tables).toContain("app_settings");
  });
});
