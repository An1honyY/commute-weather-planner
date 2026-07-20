// Repository round-trip tests. expo-sqlite's web backend doesn't actually
// initialize in this project's browser dev-preview (see App.tsx's comment
// on the startup timeout), so CRUD persistence can't be visually confirmed
// there — this test exercises the real SQL in src/db/repositories/ against
// better-sqlite3 instead, the same adapter pattern migrations/001_initial.test.ts
// already uses, by mocking ../index's getDb to hand back a migrated
// in-memory db. jest.mock is hoisted above these imports, so getDb is
// already a jest.fn() by the time any repository module evaluates it.
import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";
import { runMigrations } from "../../../migrations";
import { getDb } from "../index";
import { createLocation, deleteLocation, listLocations, updateLocation } from "./locations";
import { createClothing, deleteClothing, listClothing, updateClothing } from "./clothing";
import { createShoe, listShoes } from "./shoes";
import { createUmbrella, listUmbrellas } from "./umbrellas";
import { createVehicle, listVehicles } from "./vehicles";
import {
  getCrashReportingEnabled,
  isOnboardingCompleted,
  setCrashReportingEnabled,
  setOnboardingCompleted,
} from "./settings";
import { getWarmthCalibration, seedWarmthCalibration } from "./calibration";
import { newId } from "../rowMapping";
import type { SavedLocation } from "../../types";

jest.mock("../index", () => ({ getDb: jest.fn() }));

function makeTestDb(): SQLiteDatabase {
  const raw = new Database(":memory:");
  return {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      raw.prepare(sql).run(...(params as never[]));
    },
    getFirstAsync: async <T>(sql: string, ...params: unknown[]) => {
      if (/^\s*PRAGMA/i.test(sql)) {
        const name = sql.match(/PRAGMA\s+(\w+)/i)?.[1] ?? "";
        const result = raw.pragma(name);
        return (Array.isArray(result) ? result[0] : result) as T;
      }
      return raw.prepare(sql).get(...(params as never[])) as T;
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]) => {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
  } as unknown as SQLiteDatabase;
}

describe("repository round-trips", () => {
  beforeEach(async () => {
    const db = makeTestDb();
    await runMigrations(db);
    (getDb as jest.Mock).mockResolvedValue(db);
  });

  it("locations: create, list (favorites-first ordering), update, delete", async () => {
    const home = await createLocation({
      label: "Home",
      address: "1 Queen St",
      lat: -36.8485,
      lng: 174.7633,
      isFavorite: false,
      hasReliableClimateControl: undefined,
    });
    const work = await createLocation({
      label: "Work",
      address: "2 Queen St",
      lat: -36.85,
      lng: 174.76,
      isFavorite: true,
      hasReliableClimateControl: false,
    });

    let all: SavedLocation[] = await listLocations();
    expect(all.map((l) => l.id)).toEqual([work.id, home.id]); // favorite first

    await updateLocation({ ...home, isFavorite: true });
    all = await listLocations();
    expect(all.every((l) => l.isFavorite)).toBe(true);

    await deleteLocation(work.id);
    all = await listLocations();
    expect(all.map((l) => l.id)).toEqual([home.id]);
  });

  it("clothing: create with caller-supplied id, round-trips tags/booleans/optional fields", async () => {
    const id = newId();
    await createClothing({
      id,
      name: "Blue rain shell",
      type: "jacket",
      warmth: 6,
      waterproof: true,
      windproof: true,
      packable: false,
      substitutesForMidlayer: true,
      tags: ["cycling"],
    });

    let all = await listClothing();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      id,
      name: "Blue rain shell",
      waterproof: true,
      substitutesForMidlayer: true,
      tags: ["cycling"],
    });
    expect(all[0].unavailableUntil).toBeUndefined();

    await updateClothing({ ...all[0], unavailableUntil: "2026-08-01T00:00:00.000Z", unavailableReason: "laundry" });
    all = await listClothing();
    expect(all[0].unavailableReason).toBe("laundry");

    await deleteClothing(id);
    all = await listClothing();
    expect(all).toHaveLength(0);
  });

  it("shoes, umbrellas, vehicles: create + list round-trip their type-specific fields", async () => {
    await createShoe({ id: newId(), name: "Trail runners", type: "sneaker", waterproof: true, grip: "high" });
    const shoes = await listShoes();
    expect(shoes[0]).toMatchObject({ name: "Trail runners", grip: "high", waterproof: true });

    await createUmbrella({ id: newId(), name: "Golf umbrella", type: "golf", windRating: "high" });
    const umbrellas = await listUmbrellas();
    expect(umbrellas[0]).toMatchObject({ name: "Golf umbrella", windRating: "high" });

    await createVehicle({ id: newId(), name: "Honda Civic", type: "car", weatherProtection: "full" });
    const vehicles = await listVehicles();
    expect(vehicles[0]).toMatchObject({ name: "Honda Civic", weatherProtection: "full" });
  });

  it("settings: onboarding-completed and crash-reporting flags default false and persist", async () => {
    expect(await isOnboardingCompleted()).toBe(false);
    expect(await getCrashReportingEnabled()).toBe(false);

    await setOnboardingCompleted();
    await setCrashReportingEnabled(true);

    expect(await isOnboardingCompleted()).toBe(true);
    expect(await getCrashReportingEnabled()).toBe(true);
  });

  it("calibration: seedWarmthCalibration sets the global offset and all three seasonal buckets", async () => {
    await seedWarmthCalibration(1); // "Cold" self-report, §7.5.1
    const calibration = await getWarmthCalibration();
    expect(calibration.offsetLevels).toBe(1);
    expect(calibration.seasonalOffsets).toEqual({ summer: 1, winter: 1, shoulder: 1 });
    expect(calibration.sampleCount).toBe(0); // a self-report seed, not a real feedback event
  });
});
