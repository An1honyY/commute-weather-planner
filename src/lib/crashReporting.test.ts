import { captureException, initCrashReportingIfEnabled, isCrashReportingInitialized, scrubCrashContext } from "./crashReporting";
import { getCrashReportingEnabled } from "../db/repositories/settings";

jest.mock("../db/repositories/settings", () => ({
  getCrashReportingEnabled: jest.fn(),
}));

const mockGetEnabled = getCrashReportingEnabled as jest.Mock;

describe("scrubCrashContext", () => {
  it("strips location coordinates and saved-location labels", () => {
    const scrubbed = scrubCrashContext({ lat: -36.8, lng: 174.7, label: "Home", address: "1 Home St", note: "ok" });
    expect(scrubbed).toEqual({ note: "ok" });
  });

  it("recurses into nested objects (e.g. a Journey's origin/destination)", () => {
    const scrubbed = scrubCrashContext({
      journeyId: "j1",
      origin: { label: "Home", lat: -36.8, lng: 174.7 },
    });
    expect(scrubbed).toEqual({ journeyId: "j1" });
  });

  it("leaves non-sensitive keys and array values untouched", () => {
    const scrubbed = scrubCrashContext({ mode: "walk", legIds: ["a", "b"] });
    expect(scrubbed).toEqual({ mode: "walk", legIds: ["a", "b"] });
  });
});

describe("initCrashReportingIfEnabled", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    // reset module-level `initialized` state between tests
    mockGetEnabled.mockResolvedValue(false);
    await initCrashReportingIfEnabled();
  });

  it("stays uninitialized when the stored preference is off", async () => {
    mockGetEnabled.mockResolvedValue(false);
    await initCrashReportingIfEnabled();
    expect(isCrashReportingInitialized()).toBe(false);
  });

  it("initializes once the stored preference is on", async () => {
    mockGetEnabled.mockResolvedValue(true);
    await initCrashReportingIfEnabled();
    expect(isCrashReportingInitialized()).toBe(true);
  });

  it("tears down again when the preference is turned back off", async () => {
    mockGetEnabled.mockResolvedValue(true);
    await initCrashReportingIfEnabled();
    expect(isCrashReportingInitialized()).toBe(true);

    mockGetEnabled.mockResolvedValue(false);
    await initCrashReportingIfEnabled();
    expect(isCrashReportingInitialized()).toBe(false);
  });
});

describe("captureException", () => {
  it("is a no-op while uninitialized (no telemetry connection made while opted out)", async () => {
    mockGetEnabled.mockResolvedValue(false);
    await initCrashReportingIfEnabled();
    expect(() => captureException(new Error("boom"), { lat: -36.8 })).not.toThrow();
  });
});
