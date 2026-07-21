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
import { createClothing, deleteClothing, listClothing, updateClothing, updateClothingWearTracking } from "./clothing";
import { createShoe, listShoes, updateShoeWearTracking } from "./shoes";
import { createUmbrella, listUmbrellas } from "./umbrellas";
import { createVehicle, listVehicles } from "./vehicles";
import {
  dismissSetupTask,
  getCarryPreferenceDefault,
  getCrashReportingEnabled,
  getDefaultLocation,
  getDismissedSetupTasks,
  getThemePreference,
  isOnboardingCompleted,
  resetDismissedSetupTasks,
  resetOnboardingAndPreferences,
  setCarryPreferenceDefault,
  setCrashReportingEnabled,
  setDefaultLocation,
  setOnboardingCompleted,
  setThemePreference,
} from "./settings";
import { getAdvancedThresholds, saveAdvancedThresholds } from "./advancedThresholds";
import { getWarmthCalibration, saveWarmthCalibration, seedWarmthCalibration, setWindSensitivityOffset } from "./calibration";
import { createSavedRoute, deleteSavedRoute, listSavedRoutes, touchSavedRoute } from "./savedRoutes";
import {
  createJourney,
  deleteJourney,
  findRecentJourneyBetween,
  getJourney,
  listPastJourneys,
  listUpcomingJourneys,
  updateJourney,
} from "./journeys";
import { newId } from "../rowMapping";
import type { Journey, SavedLocation } from "../../types";

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

  it("settings: theme and carry-preference defaults default correctly and persist", async () => {
    expect(await getThemePreference()).toBe("system");
    expect(await getCarryPreferenceDefault()).toBe("no-preference");

    await setThemePreference("dark");
    await setCarryPreferenceDefault("avoid-spares");

    expect(await getThemePreference()).toBe("dark");
    expect(await getCarryPreferenceDefault()).toBe("avoid-spares");
  });

  it("settings: default location is unset until saved, then round-trips", async () => {
    expect(await getDefaultLocation()).toBeUndefined();

    await setDefaultLocation({ lat: -36.85, lng: 174.76, label: "Ponsonby" });

    expect(await getDefaultLocation()).toEqual({ lat: -36.85, lng: 174.76, label: "Ponsonby" });
  });

  it("settings: dismissed setup tasks accumulate, dedupe, and reset", async () => {
    expect(await getDismissedSetupTasks()).toEqual([]);

    await dismissSetupTask("gear");
    await dismissSetupTask("notifications");
    await dismissSetupTask("gear"); // duplicate dismiss shouldn't add a second entry

    expect(await getDismissedSetupTasks()).toEqual(["gear", "notifications"]);

    await resetDismissedSetupTasks();

    expect(await getDismissedSetupTasks()).toEqual([]);
  });

  it("settings: resetOnboardingAndPreferences clears first-run state", async () => {
    await setOnboardingCompleted();
    await setCrashReportingEnabled(true);
    await setThemePreference("dark");
    await setDefaultLocation({ lat: -36.85, lng: 174.76, label: "Ponsonby" });
    await dismissSetupTask("gear");

    await resetOnboardingAndPreferences();

    expect(await isOnboardingCompleted()).toBe(false);
    expect(await getCrashReportingEnabled()).toBe(false);
    expect(await getThemePreference()).toBe("system");
    expect(await getDefaultLocation()).toBeUndefined();
    expect(await getDismissedSetupTasks()).toEqual([]);
  });

  it("advanced warmth thresholds: default to {} (undefined fields) and persist a partial override", async () => {
    expect(await getAdvancedThresholds()).toEqual({});

    await saveAdvancedThresholds({ coolUpperC: 16 });
    expect(await getAdvancedThresholds()).toEqual({ coolUpperC: 16 });

    await saveAdvancedThresholds({});
    expect(await getAdvancedThresholds()).toEqual({});
  });

  it("calibration: seedWarmthCalibration sets the global offset and all three seasonal buckets", async () => {
    await seedWarmthCalibration(1); // "Cold" self-report, §7.5.1
    const calibration = await getWarmthCalibration();
    expect(calibration.offsetLevels).toBe(1);
    expect(calibration.seasonalOffsets).toEqual({ summer: 1, winter: 1, shoulder: 1 });
    expect(calibration.sampleCount).toBe(0); // a self-report seed, not a real feedback event
  });

  it("calibration: round-trips calibrationToastsShown and setWindSensitivityOffset patches only that field", async () => {
    await saveWarmthCalibration({ offsetLevels: -0.5, sampleCount: 2, calibrationToastsShown: 2 });
    expect((await getWarmthCalibration()).calibrationToastsShown).toBe(2);

    await setWindSensitivityOffset(1);
    const calibration = await getWarmthCalibration();
    expect(calibration.windSensitivityOffset).toBe(1);
    expect(calibration.offsetLevels).toBe(-0.5); // untouched by the wind-sensitivity write
    expect(calibration.calibrationToastsShown).toBe(2);
  });

  it("saved routes: create, list ordered by recency, touch bumps to front, delete", async () => {
    const gym = await createSavedRoute({ label: "Fast way to the gym", originId: "home", destinationId: "gym" });
    await new Promise((r) => setTimeout(r, 5));
    const work = await createSavedRoute({ label: "Commute", originId: "home", destinationId: "work" });

    let all = await listSavedRoutes();
    expect(all.map((r) => r.id)).toEqual([work.id, gym.id]); // most recently created first

    await touchSavedRoute(gym.id);
    all = await listSavedRoutes();
    expect(all[0].id).toBe(gym.id); // touching bumps it to the front

    await deleteSavedRoute(work.id);
    all = await listSavedRoutes();
    expect(all.map((r) => r.id)).toEqual([gym.id]);
  });

  it("journeys: create/get round-trips legs and waypoints, update persists new legs, findRecentJourneyBetween matches by id pair and recency", async () => {
    const home: SavedLocation = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
    const work: SavedLocation = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };
    const journey: Journey = {
      id: newId(),
      origin: home,
      destination: work,
      departTime: "2026-07-20T08:00:00.000Z",
      legs: [
        {
          id: newId(),
          mode: "walk",
          label: "Walk to Work",
          durationMin: 20,
          startTime: "2026-07-20T08:00:00.000Z",
          outdoor: true,
        },
      ],
    };

    await createJourney(journey);
    const fetched = await getJourney(journey.id);
    expect(fetched?.legs).toEqual(journey.legs);
    expect(fetched?.origin).toEqual(home);

    const updated: Journey = { ...journey, legs: [...journey.legs, { ...journey.legs[0], id: newId() }] };
    await updateJourney(updated);
    const refetched = await getJourney(journey.id);
    expect(refetched?.legs).toHaveLength(2);

    const recent = await findRecentJourneyBetween("home", "work", "2026-01-01T00:00:00.000Z");
    expect(recent?.id).toBe(journey.id);

    const tooOld = await findRecentJourneyBetween("home", "work", "2027-01-01T00:00:00.000Z");
    expect(tooOld).toBeUndefined();

    const wrongPair = await findRecentJourneyBetween("work", "home", "2026-01-01T00:00:00.000Z");
    expect(wrongPair).toBeUndefined();

    await deleteJourney(journey.id);
    expect(await getJourney(journey.id)).toBeUndefined();
  });

  it("journeys: listPastJourneys returns rows before the cutoff, most recent first, paginated", async () => {
    const home: SavedLocation = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
    const work: SavedLocation = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };
    const makeJourney = (departTime: string): Journey => ({
      id: newId(),
      origin: home,
      destination: work,
      departTime,
      legs: [],
    });

    const past1 = await createJourney(makeJourney("2026-07-18T08:00:00.000Z"));
    const past2 = await createJourney(makeJourney("2026-07-19T08:00:00.000Z"));
    const past3 = await createJourney(makeJourney("2026-07-20T08:00:00.000Z"));
    await createJourney(makeJourney("2026-07-22T08:00:00.000Z")); // future — excluded

    const cutoff = "2026-07-21T00:00:00.000Z";
    const firstPage = await listPastJourneys(cutoff, 2, 0);
    expect(firstPage.map((j) => j.id)).toEqual([past3.id, past2.id]);

    const secondPage = await listPastJourneys(cutoff, 2, 2);
    expect(secondPage.map((j) => j.id)).toEqual([past1.id]);
  });

  it("journeys: listUpcomingJourneys returns only future rows within the window, earliest first", async () => {
    const home: SavedLocation = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
    const work: SavedLocation = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };
    const makeJourney = (departTime: string): Journey => ({ id: newId(), origin: home, destination: work, departTime, legs: [] });

    await createJourney(makeJourney(new Date(Date.now() - 60_000).toISOString())); // past — excluded
    const soon = await createJourney(makeJourney(new Date(Date.now() + 60 * 60_000).toISOString()));
    const later = await createJourney(makeJourney(new Date(Date.now() + 5 * 60 * 60_000).toISOString()));
    await createJourney(makeJourney(new Date(Date.now() + 48 * 60 * 60_000).toISOString())); // outside window — excluded

    const upcoming = await listUpcomingJourneys(24);
    expect(upcoming.map((j) => j.id)).toEqual([soon.id, later.id]);
  });

  it("§7.16 wear tracking: updateClothingWearTracking/updateShoeWearTracking patch only the three tracked fields", async () => {
    const clothingId = newId();
    await createClothing({
      id: clothingId,
      name: "Wool base layer",
      type: "base",
      warmth: 4,
      waterproof: false,
      windproof: false,
      packable: true,
    });
    await updateClothingWearTracking(clothingId, {
      wearsSinceClean: 3,
      lastWornAt: "2026-07-20T08:00:00.000Z",
      needsCleaning: true,
    });
    const [clothing] = await listClothing();
    expect(clothing).toMatchObject({
      name: "Wool base layer", // untouched fields survive the targeted UPDATE
      wearsSinceClean: 3,
      lastWornAt: "2026-07-20T08:00:00.000Z",
      needsCleaning: true,
    });

    const shoeId = newId();
    await createShoe({ id: shoeId, name: "Trail runners", type: "sneaker", waterproof: true, grip: "high" });
    await updateShoeWearTracking(shoeId, {
      wearsSinceClean: 1,
      lastWornAt: "2026-07-20T08:00:00.000Z",
      needsCleaning: false,
    });
    const [shoe] = await listShoes();
    expect(shoe).toMatchObject({ name: "Trail runners", wearsSinceClean: 1, needsCleaning: false });
  });
});
