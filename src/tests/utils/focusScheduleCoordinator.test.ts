import type { FocusSchedule } from "@/store/user";
import {
  areActivitySetsEqual,
  getActiveScheduleSyncPlan,
  getBlockingReconciliationPlan,
  getEffectiveCompletedScheduleIds,
  getFocusMonitorRegistrationPlan,
  getFocusScheduleActivityNames,
} from "@/utils/focusScheduleCoordinator";
import type { ScheduleStatusEntry } from "@/utils/scheduleEngine";
import { afterEach, describe, expect, it, vi } from "vitest";

const schedules: FocusSchedule[] = [
  {
    id: "custom-1",
    label: "Dhuhr",
    kind: "custom",
    hour: 15,
    minute: 20,
    durationMinutes: 5,
  },
  {
    id: "custom-2",
    label: "Isha",
    kind: "custom",
    hour: 20,
    minute: 0,
    durationMinutes: 15,
  },
];

const activeSchedule: ScheduleStatusEntry = {
  schedule: schedules[0],
  minutes: schedules[0].hour * 60 + schedules[0].minute,
  status: "pending",
};

describe("focusScheduleCoordinator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops completed ids from previous days immediately", () => {
    expect(
      getEffectiveCompletedScheduleIds({
        completedScheduleDate: "2026-03-03",
        completedScheduleIds: ["custom-1"],
        dateKey: "2026-03-04",
      }),
    ).toEqual([]);
  });

  it("keeps completed ids for the current day", () => {
    expect(
      getEffectiveCompletedScheduleIds({
        completedScheduleDate: "2026-03-04",
        completedScheduleIds: ["custom-1"],
        dateKey: "2026-03-04",
      }),
    ).toEqual(["custom-1"]);
  });

  it("adopts matching native monitors on remount instead of re-registering them", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T14:00:00"));

    const plan = getFocusMonitorRegistrationPlan({
      onboardingComplete: true,
      isPremium: true,
      isBlockingPaused: false,
      blockAllApps: true,
      focusSchedules: schedules,
      nativeScheduleFingerprint: null,
      existingActivityNames: getFocusScheduleActivityNames(schedules),
    });

    expect(plan).toMatchObject({
      kind: "adopt",
      nextFingerprint: expect.any(String),
      quranMinutesToUnblock: 5,
    });
  });

  it("skips native registration work before onboarding is complete", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T14:00:00"));

    const plan = getFocusMonitorRegistrationPlan({
      onboardingComplete: false,
      isPremium: true,
      isBlockingPaused: false,
      blockAllApps: true,
      focusSchedules: schedules,
      nativeScheduleFingerprint: null,
      existingActivityNames: [],
    });

    expect(plan).toEqual({
      kind: "skip",
      quranMinutesToUnblock: 5,
    });
  });

  it("does nothing when the desired native registration already matches", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T14:00:00"));

    const adoptedPlan = getFocusMonitorRegistrationPlan({
      onboardingComplete: true,
      isPremium: true,
      isBlockingPaused: false,
      blockAllApps: true,
      focusSchedules: schedules,
      nativeScheduleFingerprint: null,
      existingActivityNames: getFocusScheduleActivityNames(schedules),
    });
    if (adoptedPlan.kind !== "adopt") throw new Error("Expected adopt plan");

    const noopPlan = getFocusMonitorRegistrationPlan({
      onboardingComplete: true,
      isPremium: true,
      isBlockingPaused: false,
      blockAllApps: true,
      focusSchedules: schedules,
      nativeScheduleFingerprint: adoptedPlan.nextFingerprint,
      existingActivityNames: getFocusScheduleActivityNames(schedules),
    });

    expect(noopPlan).toEqual({
      kind: "noop",
      nextFingerprint: adoptedPlan.nextFingerprint,
      quranMinutesToUnblock: 5,
    });
  });

  it("re-applies native monitors when the desired schedule set changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T14:00:00"));

    const existingActivityNames = getFocusScheduleActivityNames([schedules[0]]);
    const plan = getFocusMonitorRegistrationPlan({
      onboardingComplete: true,
      isPremium: true,
      isBlockingPaused: false,
      blockAllApps: true,
      focusSchedules: schedules,
      nativeScheduleFingerprint: "stale",
      existingActivityNames,
    });

    expect(plan.kind).toBe("apply");
    if (plan.kind !== "apply") throw new Error("Expected apply plan");
    expect(plan.schedules).toEqual(schedules);
    expect(plan.stopActivityNames).toEqual(
      expect.arrayContaining([
        "quranlock_focus-custom-1",
        "quranlock_focus-custom-2",
      ]),
    );
  });

  it("re-applies native monitors when the blocking scope changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T14:00:00"));

    const existingActivityNames = getFocusScheduleActivityNames(schedules);
    const blockAllPlan = getFocusMonitorRegistrationPlan({
      onboardingComplete: true,
      isPremium: true,
      isBlockingPaused: false,
      blockAllApps: true,
      focusSchedules: schedules,
      nativeScheduleFingerprint: null,
      existingActivityNames,
    });
    if (blockAllPlan.kind !== "adopt") throw new Error("Expected adopt plan");

    const customPlan = getFocusMonitorRegistrationPlan({
      onboardingComplete: true,
      isPremium: true,
      isBlockingPaused: false,
      blockAllApps: false,
      focusSchedules: schedules,
      nativeScheduleFingerprint: blockAllPlan.nextFingerprint,
      existingActivityNames,
    });

    expect(customPlan.kind).toBe("apply");
  });

  it("clears native monitors when the schedule system is paused", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T14:00:00"));

    const plan = getFocusMonitorRegistrationPlan({
      onboardingComplete: true,
      isPremium: true,
      isBlockingPaused: true,
      blockAllApps: true,
      focusSchedules: schedules,
      nativeScheduleFingerprint: "existing",
      existingActivityNames: getFocusScheduleActivityNames(schedules),
    });

    expect(plan).toEqual({
      kind: "clear",
      nextFingerprint: null,
      quranMinutesToUnblock: 30,
      stopActivityNames: [
        "quranlock_focus-custom-1",
        "quranlock_focus-custom-2",
      ],
    });
  });

  it("updates the active session when the same schedule id gets a new required duration", () => {
    const plan = getActiveScheduleSyncPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule,
      activeScheduleId: "custom-1",
      activeScheduleDate: "2026-03-04",
      requiredQuranMinutes: 10,
    });

    expect(plan).toEqual({
      isReady: true,
      needsUpdate: true,
      nextActiveScheduleId: "custom-1",
      nextRequiredMinutes: 5,
    });
  });

  it("does not sync active session state before the new day reset is ready", () => {
    const plan = getActiveScheduleSyncPlan({
      completedScheduleDate: "2026-03-03",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule,
      activeScheduleId: null,
      activeScheduleDate: null,
      requiredQuranMinutes: 0,
    });

    expect(plan).toEqual({
      isReady: false,
      needsUpdate: false,
      nextActiveScheduleId: null,
      nextRequiredMinutes: 0,
    });
  });

  it("leaves active session state alone when it is already aligned", () => {
    const plan = getActiveScheduleSyncPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule,
      activeScheduleId: "custom-1",
      activeScheduleDate: "2026-03-04",
      requiredQuranMinutes: 5,
    });

    expect(plan).toEqual({
      isReady: true,
      needsUpdate: false,
      nextActiveScheduleId: "custom-1",
      nextRequiredMinutes: 5,
    });
  });

  it("clears active session state when the schedule system is disabled", () => {
    const plan = getActiveScheduleSyncPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: false,
      activeSchedule,
      activeScheduleId: "custom-1",
      activeScheduleDate: "2026-03-04",
      requiredQuranMinutes: 5,
    });

    expect(plan).toEqual({
      isReady: true,
      needsUpdate: true,
      nextActiveScheduleId: null,
      nextRequiredMinutes: 0,
    });
  });

  it("stays idle when there is no active schedule and no local state to clear", () => {
    const plan = getActiveScheduleSyncPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule: null,
      activeScheduleId: null,
      activeScheduleDate: null,
      requiredQuranMinutes: 0,
    });

    expect(plan).toEqual({
      isReady: true,
      needsUpdate: false,
      nextActiveScheduleId: null,
      nextRequiredMinutes: 0,
    });
  });

  it("unblocks and resets stale local block state when no schedule is active", () => {
    const plan = getBlockingReconciliationPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule: null,
      shieldEnabled: true,
      activeScheduleId: "custom-1",
      lastBlockedAt: 123,
      requiredQuranMinutes: 5,
    });

    expect(plan).toEqual({
      action: "unblock",
      shouldResetAfterUnblock: true,
    });
  });

  it("waits for day rollover before reconciling native block state", () => {
    const plan = getBlockingReconciliationPlan({
      completedScheduleDate: "2026-03-03",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule,
      shieldEnabled: true,
      activeScheduleId: "custom-1",
      lastBlockedAt: 123,
      requiredQuranMinutes: 5,
    });

    expect(plan).toEqual({
      action: "noop",
      shouldResetAfterUnblock: false,
    });
  });

  it("resets stale local block state even when native apps are already unblocked", () => {
    const plan = getBlockingReconciliationPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule: null,
      shieldEnabled: false,
      activeScheduleId: "custom-1",
      lastBlockedAt: 123,
      requiredQuranMinutes: 5,
    });

    expect(plan).toEqual({
      action: "noop",
      shouldResetAfterUnblock: true,
    });
  });

  it("blocks when a schedule is active and the native shield is not yet enabled", () => {
    const plan = getBlockingReconciliationPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule,
      shieldEnabled: false,
      activeScheduleId: "custom-1",
      lastBlockedAt: null,
      requiredQuranMinutes: 5,
    });

    expect(plan).toEqual({
      action: "block",
      shouldResetAfterUnblock: false,
    });
  });

  it("keeps native state unchanged when a schedule is active and shield is already enabled", () => {
    const plan = getBlockingReconciliationPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule,
      shieldEnabled: true,
      activeScheduleId: "custom-1",
      lastBlockedAt: 123,
      requiredQuranMinutes: 5,
    });

    expect(plan).toEqual({
      action: "noop",
      shouldResetAfterUnblock: false,
    });
  });

  it("compares native activity sets without depending on order", () => {
    expect(
      areActivitySetsEqual(
        ["quranlock_focus-custom-2", "quranlock_focus-custom-1"],
        ["quranlock_focus-custom-1", "quranlock_focus-custom-2"],
      ),
    ).toBe(true);
  });

  it("treats mismatched native activity sets as different", () => {
    expect(
      areActivitySetsEqual(
        ["quranlock_focus-custom-1"],
        ["quranlock_focus-custom-1", "quranlock_focus-custom-2"],
      ),
    ).toBe(false);
  });

  it("does not reset anything when there is no active schedule and no stale block state", () => {
    const plan = getBlockingReconciliationPlan({
      completedScheduleDate: "2026-03-04",
      dateKey: "2026-03-04",
      shouldUseScheduleSystem: true,
      activeSchedule: null,
      shieldEnabled: false,
      activeScheduleId: null,
      lastBlockedAt: null,
      requiredQuranMinutes: 0,
    });

    expect(plan).toEqual({
      action: "noop",
      shouldResetAfterUnblock: false,
    });
  });
});
