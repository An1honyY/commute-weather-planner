import { freezeIfDue, freezeJourneyByIdIfDue, scheduleForJourney } from "./leaveBy";
import { recommendGear } from "./recommend";
import { recordWear, toRecommendationSnapshot } from "./wearTracking";
import { scheduleLeaveByNotification } from "./notifications";
import { getJourney, updateJourney } from "../db/repositories/journeys";
import { listClothing } from "../db/repositories/clothing";
import { listShoes } from "../db/repositories/shoes";
import { listUmbrellas } from "../db/repositories/umbrellas";
import { getWarmthCalibration } from "../db/repositories/calibration";
import { getCarryPreferenceDefault } from "../db/repositories/settings";
import { getAdvancedThresholds } from "../db/repositories/advancedThresholds";
import type { Journey } from "../types";

// leaveBy.ts is pure orchestration — every dependency it loads/calls is
// mocked here so this test exercises only its own logic (which inputs get
// loaded, the idempotency guard, the leave-by-time gate), the same "explicit
// factory, not auto-mock" reasoning as planJourney.test.ts (this module's
// import chain also reaches expo-sqlite via the journeys/clothing/shoes
// repos).
jest.mock("./recommend", () => ({ ...jest.requireActual("./recommend"), recommendGear: jest.fn() }));
jest.mock("./wearTracking", () => ({ recordWear: jest.fn(), toRecommendationSnapshot: jest.fn() }));
jest.mock("./notifications", () => ({
  ...jest.requireActual("./notifications"),
  scheduleLeaveByNotification: jest.fn(),
}));
jest.mock("../db/repositories/journeys", () => ({ getJourney: jest.fn(), updateJourney: jest.fn() }));
jest.mock("../db/repositories/clothing", () => ({ listClothing: jest.fn() }));
jest.mock("../db/repositories/shoes", () => ({ listShoes: jest.fn() }));
jest.mock("../db/repositories/umbrellas", () => ({ listUmbrellas: jest.fn() }));
jest.mock("../db/repositories/calibration", () => ({ getWarmthCalibration: jest.fn() }));
jest.mock("../db/repositories/settings", () => ({ getCarryPreferenceDefault: jest.fn() }));
jest.mock("../db/repositories/advancedThresholds", () => ({ getAdvancedThresholds: jest.fn() }));

const mockRecommendGear = recommendGear as jest.Mock;
const mockRecordWear = recordWear as jest.Mock;
const mockToSnapshot = toRecommendationSnapshot as jest.Mock;
const mockScheduleLeaveBy = scheduleLeaveByNotification as jest.Mock;
const mockGetJourney = getJourney as jest.Mock;
const mockUpdateJourney = updateJourney as jest.Mock;
const mockListClothing = listClothing as jest.Mock;
const mockListShoes = listShoes as jest.Mock;
const mockListUmbrellas = listUmbrellas as jest.Mock;
const mockGetCalibration = getWarmthCalibration as jest.Mock;
const mockGetCarryPreferenceDefault = getCarryPreferenceDefault as jest.Mock;
const mockGetAdvancedThresholds = getAdvancedThresholds as jest.Mock;

const HOME = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };

function journey(departTime: string, overrides: Partial<Journey> = {}): Journey {
  return { id: "journey-1", origin: HOME, destination: WORK, departTime, legs: [], ...overrides };
}

const FAKE_RECOMMENDATION = { layers: [], accessories: [], notes: [] };
const FAKE_SNAPSHOT = { layerNames: [], accessoryNames: [], shoeName: null, umbrellaName: null, notes: [], snapshotAt: "2026-07-20T08:00:00.000Z" };

describe("leaveBy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListClothing.mockResolvedValue([]);
    mockListShoes.mockResolvedValue([]);
    mockListUmbrellas.mockResolvedValue([]);
    mockGetCalibration.mockResolvedValue({ offsetLevels: 0, sampleCount: 0 });
    mockGetCarryPreferenceDefault.mockResolvedValue("no-preference");
    mockGetAdvancedThresholds.mockResolvedValue({});
    mockRecommendGear.mockReturnValue(FAKE_RECOMMENDATION);
    mockToSnapshot.mockReturnValue(FAKE_SNAPSHOT);
  });

  describe("scheduleForJourney", () => {
    it("loads recommendGear's inputs, resolves carryPreference (journey override wins), and schedules", async () => {
      mockGetCarryPreferenceDefault.mockResolvedValue("avoid-spares");
      const j = journey(new Date(Date.now() + 3_600_000).toISOString(), { carryPreference: "no-preference" });

      await scheduleForJourney(j);

      expect(mockRecommendGear).toHaveBeenCalledWith(
        j,
        { clothing: [], shoes: [], umbrellas: [] },
        { offsetLevels: 0, sampleCount: 0 },
        "no-preference", // the Journey's own override, not the Settings default
        {}
      );
      expect(mockScheduleLeaveBy).toHaveBeenCalledWith(j, FAKE_RECOMMENDATION);
    });

    it("never throws even if a dependency rejects", async () => {
      mockListClothing.mockRejectedValue(new Error("db unavailable"));
      const j = journey(new Date(Date.now() + 3_600_000).toISOString());
      await expect(scheduleForJourney(j)).resolves.toBeUndefined();
      expect(mockScheduleLeaveBy).not.toHaveBeenCalled();
    });
  });

  describe("freezeIfDue", () => {
    it("no-ops (returns the journey unchanged) when leave-by time hasn't passed yet", async () => {
      const j = journey(new Date(Date.now() + 3_600_000).toISOString()); // 1 hour out, well before the 10-min leave-by trigger
      const result = await freezeIfDue(j);

      expect(result).toBe(j);
      expect(mockRecordWear).not.toHaveBeenCalled();
      expect(mockUpdateJourney).not.toHaveBeenCalled();
    });

    it("no-ops when a recommendationSnapshot already exists (idempotent — never records wear twice)", async () => {
      const j = journey(new Date(Date.now() - 3_600_000).toISOString(), { recommendationSnapshot: FAKE_SNAPSHOT });
      const result = await freezeIfDue(j);

      expect(result).toBe(j);
      expect(mockRecordWear).not.toHaveBeenCalled();
    });

    it("freezes the snapshot, records wear, and persists once leave-by time has passed", async () => {
      const j = journey(new Date(Date.now() - 3_600_000).toISOString()); // departed an hour ago — well past leave-by
      const result = await freezeIfDue(j);

      expect(mockRecordWear).toHaveBeenCalledWith(FAKE_RECOMMENDATION, j, 18); // resolved warmOutdoorC default
      expect(result.recommendationSnapshot).toBe(FAKE_SNAPSHOT);
      expect(mockUpdateJourney).toHaveBeenCalledWith(result);
    });
  });

  describe("freezeJourneyByIdIfDue", () => {
    it("loads the journey then delegates to freezeIfDue; no-ops if the journey no longer exists", async () => {
      mockGetJourney.mockResolvedValue(undefined);
      await freezeJourneyByIdIfDue("missing-journey");
      expect(mockRecordWear).not.toHaveBeenCalled();

      const j = journey(new Date(Date.now() - 3_600_000).toISOString());
      mockGetJourney.mockResolvedValue(j);
      await freezeJourneyByIdIfDue(j.id);
      expect(mockRecordWear).toHaveBeenCalled();
    });
  });
});
