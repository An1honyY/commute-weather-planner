import { decayCalibration, recordGearFeedback, runCalibrationDecayIfDue } from "./calibration";
import { getWarmthCalibration, saveWarmthCalibration } from "../db/repositories/calibration";
import type { WarmthCalibration } from "../types";

jest.mock("../db/repositories/calibration", () => ({
  getWarmthCalibration: jest.fn(),
  saveWarmthCalibration: jest.fn(),
}));

const mockGet = getWarmthCalibration as jest.Mock;
const mockSave = saveWarmthCalibration as jest.Mock;

const DEPART_WINTER = "2026-07-20T08:00:00.000Z"; // July -> winter (Southern Hemisphere)

function baseCalibration(overrides: Partial<WarmthCalibration> = {}): WarmthCalibration {
  return { offsetLevels: 0, sampleCount: 0, ...overrides };
}

describe("recordGearFeedback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("just_right resets the decay clock without moving any offset or sample count", async () => {
    mockGet.mockResolvedValue(baseCalibration({ offsetLevels: 1, sampleCount: 4 }));
    const result = await recordGearFeedback("just_right", DEPART_WINTER);

    expect(result.calibration.offsetLevels).toBe(1);
    expect(result.calibration.sampleCount).toBe(4);
    expect(typeof result.calibration.lastFeedbackAt).toBe("string");
    expect(result.toast).toBeNull();
  });

  it("too_warm moves both global and the current season's offset negative by one step", async () => {
    mockGet.mockResolvedValue(baseCalibration());
    const result = await recordGearFeedback("too_warm", DEPART_WINTER);

    expect(result.calibration.offsetLevels).toBe(-0.5);
    expect(result.calibration.seasonalOffsets).toEqual({ summer: 0, winter: -0.5, shoulder: 0 });
    expect(result.calibration.seasonalSampleCounts).toEqual({ summer: 0, winter: 1, shoulder: 0 });
    expect(result.calibration.sampleCount).toBe(1);
    expect(mockSave).toHaveBeenCalledWith(result.calibration);
  });

  it("much_too_cold moves twice as far as too_cold", async () => {
    mockGet.mockResolvedValue(baseCalibration());
    const result = await recordGearFeedback("much_too_cold", DEPART_WINTER);
    expect(result.calibration.offsetLevels).toBe(1);
  });

  it("clamps to ±2 and does not fire the toast once already at the clamp", async () => {
    mockGet.mockResolvedValue(
      baseCalibration({
        offsetLevels: 2,
        seasonalOffsets: { summer: 0, winter: 2, shoulder: 0 },
        seasonalSampleCounts: { summer: 0, winter: 5, shoulder: 0 },
      })
    );
    const result = await recordGearFeedback("much_too_cold", DEPART_WINTER);
    expect(result.calibration.offsetLevels).toBe(2);
    expect(result.calibration.seasonalOffsets!.winter).toBe(2);
    expect(result.toast).toBeNull(); // offset didn't actually change — already clamped
  });

  it("shows the toast on the first change and reports the direction", async () => {
    mockGet.mockResolvedValue(baseCalibration());
    const result = await recordGearFeedback("too_warm", DEPART_WINTER);
    expect(result.toast).toEqual({ direction: "warmer" });
    expect(result.calibration.calibrationToastsShown).toBe(1);
  });

  it("stops showing the toast after CALIBRATION_TOAST_MAX_SHOWN occurrences", async () => {
    mockGet.mockResolvedValue(baseCalibration({ calibrationToastsShown: 3 }));
    const result = await recordGearFeedback("too_warm", DEPART_WINTER);
    expect(result.toast).toBeNull();
    expect(result.calibration.calibrationToastsShown).toBe(3);
  });
});

describe("decayCalibration", () => {
  it("leaves calibration untouched when there's no lastFeedbackAt yet", () => {
    const calibration = baseCalibration({ offsetLevels: 1 });
    expect(decayCalibration(calibration)).toBe(calibration);
  });

  it("leaves calibration untouched when feedback is recent", () => {
    const calibration = baseCalibration({ offsetLevels: 1, lastFeedbackAt: "2026-07-01T00:00:00.000Z" });
    expect(decayCalibration(calibration, new Date("2026-07-20T00:00:00.000Z"))).toBe(calibration);
  });

  it("nudges a stale global offset toward 0 without overshooting", () => {
    const calibration = baseCalibration({ offsetLevels: 0.1, lastFeedbackAt: "2026-01-01T00:00:00.000Z" });
    const next = decayCalibration(calibration, new Date("2026-07-01T00:00:00.000Z"));
    expect(next.offsetLevels).toBe(0);
  });

  it("nudges stale seasonal and wind-sensitivity offsets by CALIBRATION_DECAY_STEP each, per sign", () => {
    const calibration = baseCalibration({
      offsetLevels: 1,
      seasonalOffsets: { summer: -1, winter: 0, shoulder: 0.6 },
      windSensitivityOffset: -1,
      lastFeedbackAt: "2026-01-01T00:00:00.000Z",
    });
    const next = decayCalibration(calibration, new Date("2026-07-01T00:00:00.000Z"));
    expect(next.offsetLevels).toBe(0.75);
    expect(next.seasonalOffsets).toEqual({ summer: -0.75, winter: 0, shoulder: 0.35 });
    expect(next.windSensitivityOffset).toBe(-0.75);
  });
});

describe("runCalibrationDecayIfDue", () => {
  beforeEach(() => jest.clearAllMocks());

  it("saves only when decay actually changed something", async () => {
    mockGet.mockResolvedValue(baseCalibration({ offsetLevels: 0 }));
    await runCalibrationDecayIfDue();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("persists the decayed calibration when stale", async () => {
    mockGet.mockResolvedValue(baseCalibration({ offsetLevels: 1, lastFeedbackAt: "2020-01-01T00:00:00.000Z" }));
    const result = await runCalibrationDecayIfDue();
    expect(result.offsetLevels).toBe(0.75);
    expect(mockSave).toHaveBeenCalledWith(result);
  });
});
