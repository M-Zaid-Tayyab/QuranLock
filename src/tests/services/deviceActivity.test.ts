import { SCREEN_TIME } from "@/constants/screenTime";
import {
  clearSelection,
  configureBlockUnblock,
} from "@/services/deviceActivity";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  blockSelection: vi.fn(),
  configureActions: vi.fn(),
  disableBlockAllMode: vi.fn(),
  enableBlockAllMode: vi.fn(),
  getActivities: vi.fn(() => []),
  getAuthorizationStatus: vi.fn(() => 0),
  isShieldActive: vi.fn(() => false),
  onDeviceActivityMonitorEvent: vi.fn(() => ({ remove: vi.fn() })),
  pollAuthorizationStatus: vi.fn(),
  requestAuthorization: vi.fn(),
  startMonitoring: vi.fn(),
  stopMonitoring: vi.fn(),
  unblockSelection: vi.fn(),
  setFamilyActivitySelectionId: vi.fn(),
  updateShieldWithId: vi.fn(),
  userDefaultsGet: vi.fn(),
  userDefaultsRemove: vi.fn(),
  userDefaultsSet: vi.fn(),
}));

vi.mock("react-native-device-activity", () => mocks);

describe("deviceActivity.clearSelection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("removes only this app's selection id while preserving others", () => {
    mocks.userDefaultsGet.mockReturnValue({
      [SCREEN_TIME.SELECTION_ID]: "serialized-selection",
      "other-selection": "keep-me",
    });

    clearSelection();

    expect(mocks.userDefaultsSet).toHaveBeenCalledWith(
      "familyActivitySelectionIds",
      {
        "other-selection": "keep-me",
      },
    );
    expect(mocks.userDefaultsRemove).not.toHaveBeenCalled();
  });

  it("clears the shared selection map when this app stored the only entry", () => {
    mocks.userDefaultsGet.mockReturnValue({
      [SCREEN_TIME.SELECTION_ID]: "serialized-selection",
    });

    clearSelection();

    expect(mocks.userDefaultsRemove).toHaveBeenCalledWith(
      "familyActivitySelectionIds",
    );
    expect(mocks.userDefaultsSet).not.toHaveBeenCalled();
  });

  it("does nothing when this app has no stored selection id", () => {
    mocks.userDefaultsGet.mockReturnValue({
      "other-selection": "keep-me",
    });

    clearSelection();

    expect(mocks.userDefaultsSet).not.toHaveBeenCalled();
    expect(mocks.userDefaultsRemove).not.toHaveBeenCalled();
  });
});

describe("deviceActivity.configureBlockUnblock", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses all-app blocking actions for the recommended selection", () => {
    configureBlockUnblock("daily-focus", "selection", "shield", true);

    expect(mocks.configureActions).toHaveBeenNthCalledWith(1, {
      activityName: "daily-focus",
      callbackName: "intervalDidStart",
      actions: [{ type: "enableBlockAllMode" }],
    });
    expect(mocks.configureActions).toHaveBeenNthCalledWith(2, {
      activityName: "daily-focus",
      callbackName: "intervalDidEnd",
      actions: [{ type: "disableBlockAllMode" }],
    });
  });
});
