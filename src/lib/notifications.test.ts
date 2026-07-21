import * as Notifications from "expo-notifications";
import {
  cancelLeaveByNotification,
  LEAVE_BY_LEAD_MINUTES,
  requestNotificationPermission,
  scheduleLeaveByNotification,
  summarizeRecommendation,
} from "./notifications";
import type { Recommendation } from "./recommend";
import type { Journey } from "../types";

// Explicit factory, not a bare jest.mock(path) auto-mock — same reasoning
// as planJourney.test.ts's comment: keeps expo-notifications' native
// module resolution out of the test entirely.
jest.mock("expo-notifications", () => ({
  requestPermissionsAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;

const HOME = { id: "home", label: "Home", address: "1 Home St", lat: -36.8485, lng: 174.7633 };
const WORK = { id: "work", label: "Work", address: "2 Work St", lat: -36.86, lng: 174.77 };

function journey(departTime: string): Journey {
  return { id: "journey-1", origin: HOME, destination: WORK, departTime, legs: [] };
}

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return { layers: [], accessories: [], notes: [], ...overrides };
}

describe("notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requestNotificationPermission returns true only when granted", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "granted" });
    expect(await requestNotificationPermission()).toBe(true);

    mockRequestPermissions.mockResolvedValue({ status: "denied" });
    expect(await requestNotificationPermission()).toBe(false);

    mockRequestPermissions.mockRejectedValue(new Error("unsupported on this platform"));
    expect(await requestNotificationPermission()).toBe(false);
  });

  it("summarizeRecommendation joins resolved item names, falling back when nothing resolved", () => {
    expect(summarizeRecommendation(recommendation())).toBe("Check today's gear recommendation");
    expect(
      summarizeRecommendation(
        recommendation({
          layers: [{ id: "jacket-1", name: "Rain shell", type: "jacket", warmth: 6, waterproof: true, windproof: true, packable: false }],
          shoes: { id: "shoe-1", name: "Waterproof boots", type: "waterproof-boot", waterproof: true, grip: "high" },
        })
      )
    ).toBe("Rain shell + Waterproof boots");
  });

  it("scheduleLeaveByNotification schedules with a stable per-journey identifier when permission is granted and the trigger is in the future", async () => {
    mockGetPermissions.mockResolvedValue({ status: "granted" });
    const futureDepart = new Date(Date.now() + 60 * 60_000).toISOString(); // 1 hour out
    await scheduleLeaveByNotification(journey(futureDepart), recommendation());

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const call = mockSchedule.mock.calls[0][0];
    expect(call.identifier).toBe("leave-by:journey-1");
    expect(call.content.title).toBe(`Leave in ${LEAVE_BY_LEAD_MINUTES} minutes`);
    expect(call.content.data).toEqual({ journeyId: "journey-1" });
  });

  it("scheduleLeaveByNotification no-ops without permission or when the leave-by trigger is already in the past", async () => {
    mockGetPermissions.mockResolvedValue({ status: "denied" });
    const futureDepart = new Date(Date.now() + 60 * 60_000).toISOString();
    await scheduleLeaveByNotification(journey(futureDepart), recommendation());
    expect(mockSchedule).not.toHaveBeenCalled();

    mockGetPermissions.mockResolvedValue({ status: "granted" });
    const pastDepart = new Date(Date.now() + 1000).toISOString(); // leave-by trigger (10 min before) is already past
    await scheduleLeaveByNotification(journey(pastDepart), recommendation());
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("scheduleLeaveByNotification uses forecast-changed copy when options.changed is set (§5.2 point 3)", async () => {
    mockGetPermissions.mockResolvedValue({ status: "granted" });
    const futureDepart = new Date(Date.now() + 60 * 60_000).toISOString();
    await scheduleLeaveByNotification(journey(futureDepart), recommendation(), { changed: true });

    const call = mockSchedule.mock.calls[0][0];
    expect(call.content.title).toBe("Forecast changed");
    expect(call.content.body).toContain("now looks like");
  });

  it("cancelLeaveByNotification swallows errors (nothing scheduled, or unsupported platform)", async () => {
    mockCancel.mockRejectedValue(new Error("not scheduled"));
    await expect(cancelLeaveByNotification("journey-1")).resolves.toBeUndefined();
    expect(mockCancel).toHaveBeenCalledWith("leave-by:journey-1");
  });
});
