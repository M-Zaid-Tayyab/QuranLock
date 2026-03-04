import { getNextDuration } from "@/configs/onboarding";
import type { FocusSchedule } from "@/store/user";
import type { ScheduleStatusEntry } from "@/utils/scheduleEngine";

export const getFocusScheduleActivityName = (scheduleId: string) =>
  `quranlock_focus-${scheduleId}`;

export const getFocusScheduleActivityNames = (
  schedules: Pick<FocusSchedule, "id">[],
) => schedules.map((schedule) => getFocusScheduleActivityName(schedule.id));

export const getFocusScheduleFingerprint = (schedules: FocusSchedule[]) =>
  JSON.stringify(
    [...schedules]
      .map((schedule) => ({
        durationMinutes: schedule.durationMinutes,
        hour: schedule.hour,
        id: schedule.id,
        minute: schedule.minute,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );

export const areActivitySetsEqual = (left: string[], right: string[]) => {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((activityName, index) => activityName === rightSorted[index]);
};

export const getEffectiveCompletedScheduleIds = (params: {
  completedScheduleDate: string | null;
  completedScheduleIds: string[];
  dateKey: string;
}) => {
  const { completedScheduleDate, completedScheduleIds, dateKey } = params;
  return completedScheduleDate === dateKey ? completedScheduleIds : [];
};

interface FocusMonitorRegistrationPlanArgs {
  onboardingComplete: boolean;
  isPremium: boolean;
  isBlockingPaused: boolean;
  focusSchedules: FocusSchedule[];
  nativeScheduleFingerprint: string | null;
  existingActivityNames: string[];
}

type FocusMonitorRegistrationPlan =
  | {
      kind: "skip";
      quranMinutesToUnblock: number;
    }
  | {
      kind: "clear";
      nextFingerprint: null;
      quranMinutesToUnblock: number;
      stopActivityNames: string[];
    }
  | {
      kind: "adopt";
      nextFingerprint: string;
      quranMinutesToUnblock: number;
    }
  | {
      kind: "noop";
      nextFingerprint: string;
      quranMinutesToUnblock: number;
    }
  | {
      kind: "apply";
      nextFingerprint: string;
      quranMinutesToUnblock: number;
      schedules: FocusSchedule[];
      stopActivityNames: string[];
    };

export const getFocusMonitorRegistrationPlan = ({
  onboardingComplete,
  isPremium,
  isBlockingPaused,
  focusSchedules,
  nativeScheduleFingerprint,
  existingActivityNames,
}: FocusMonitorRegistrationPlanArgs): FocusMonitorRegistrationPlan => {
  const schedules = isPremium && !isBlockingPaused ? focusSchedules : [];
  const quranMinutesToUnblock = getNextDuration(schedules);

  if (!onboardingComplete) {
    return {
      kind: "skip",
      quranMinutesToUnblock,
    };
  }

  const desiredFingerprint =
    schedules.length > 0 ? getFocusScheduleFingerprint(schedules) : null;
  const desiredActivityNames = getFocusScheduleActivityNames(schedules);
  const nativeActivitiesMatch = areActivitySetsEqual(
    existingActivityNames,
    desiredActivityNames,
  );

  if (desiredFingerprint == null) {
    return {
      kind: "clear",
      nextFingerprint: null,
      quranMinutesToUnblock,
      stopActivityNames: existingActivityNames,
    };
  }

  if (nativeScheduleFingerprint == null && nativeActivitiesMatch) {
    return {
      kind: "adopt",
      nextFingerprint: desiredFingerprint,
      quranMinutesToUnblock,
    };
  }

  if (
    nativeScheduleFingerprint === desiredFingerprint &&
    nativeActivitiesMatch
  ) {
    return {
      kind: "noop",
      nextFingerprint: desiredFingerprint,
      quranMinutesToUnblock,
    };
  }

  return {
    kind: "apply",
    nextFingerprint: desiredFingerprint,
    quranMinutesToUnblock,
    schedules,
    stopActivityNames: Array.from(
      new Set([...existingActivityNames, ...desiredActivityNames]),
    ),
  };
};

interface ActiveScheduleSyncPlanArgs {
  completedScheduleDate: string | null;
  dateKey: string;
  shouldUseScheduleSystem: boolean;
  activeSchedule: ScheduleStatusEntry | null;
  activeScheduleId: string | null;
  activeScheduleDate: string | null;
  requiredQuranMinutes: number;
}

export const getActiveScheduleSyncPlan = ({
  completedScheduleDate,
  dateKey,
  shouldUseScheduleSystem,
  activeSchedule,
  activeScheduleId,
  activeScheduleDate,
  requiredQuranMinutes,
}: ActiveScheduleSyncPlanArgs) => {
  if (completedScheduleDate !== dateKey) {
    return {
      isReady: false,
      needsUpdate: false,
      nextActiveScheduleId: null,
      nextRequiredMinutes: 0,
    };
  }

  const nextActiveScheduleId = shouldUseScheduleSystem
    ? activeSchedule?.schedule.id ?? null
    : null;
  const nextRequiredMinutes = shouldUseScheduleSystem
    ? activeSchedule?.schedule.durationMinutes ?? 0
    : 0;

  const needsUpdate =
    nextActiveScheduleId !== activeScheduleId ||
    (nextActiveScheduleId != null &&
      nextRequiredMinutes !== requiredQuranMinutes) ||
    (nextActiveScheduleId != null && activeScheduleDate !== dateKey) ||
    (nextActiveScheduleId == null &&
      (activeScheduleId != null || activeScheduleDate != null));

  return {
    isReady: true,
    needsUpdate,
    nextActiveScheduleId,
    nextRequiredMinutes,
  };
};

interface BlockingReconciliationPlanArgs {
  completedScheduleDate: string | null;
  dateKey: string;
  shouldUseScheduleSystem: boolean;
  activeSchedule: ScheduleStatusEntry | null;
  shieldEnabled: boolean;
  activeScheduleId: string | null;
  lastBlockedAt: number | null;
  requiredQuranMinutes: number;
}

export const getBlockingReconciliationPlan = ({
  completedScheduleDate,
  dateKey,
  shouldUseScheduleSystem,
  activeSchedule,
  shieldEnabled,
  activeScheduleId,
  lastBlockedAt,
  requiredQuranMinutes,
}: BlockingReconciliationPlanArgs) => {
  if (completedScheduleDate !== dateKey) {
    return {
      action: "noop" as const,
      shouldResetAfterUnblock: false,
    };
  }

  const shouldBeBlocked = shouldUseScheduleSystem && activeSchedule != null;
  if (shouldBeBlocked) {
    return {
      action: shieldEnabled ? ("noop" as const) : ("block" as const),
      shouldResetAfterUnblock: false,
    };
  }

  return {
    action: shieldEnabled ? ("unblock" as const) : ("noop" as const),
    shouldResetAfterUnblock:
      activeScheduleId != null ||
      lastBlockedAt != null ||
      requiredQuranMinutes > 0,
  };
};
