import { SCREEN_TIME } from "@/constants/screenTime";
import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import {
  blockSelectionNow,
  clearSelection,
  getMonitoredActivities,
  isShieldEnabled,
  onMonitorEvent,
  setSelection,
  unblockSelection,
} from "@/services/deviceActivity";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore, type FocusSchedule } from "@/store/user";
import {
  getActiveScheduleSyncPlan,
  getBlockingReconciliationPlan,
  getFocusMonitorRegistrationPlan,
} from "@/utils/focusScheduleCoordinator";
import { applyFocusSchedulesToDevice } from "@/utils/focusScheduleRuntime";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useShallow } from "zustand/react/shallow";

interface PremiumSyncState {
  onboardingComplete: boolean;
  isPremium: boolean;
  isBlockingPaused: boolean;
  focusSchedules: FocusSchedule[];
  familyActivitySelection: string | null;
}

const getRelevantNativeActivities = () =>
  getMonitoredActivities().filter((activityName) =>
    activityName.startsWith(`${SCREEN_TIME.ACTIVITY_NAME}-`),
  );

const useFamilyActivitySelectionSync = ({
  onboardingComplete,
  isPremium,
  isBlockingPaused,
  familyActivitySelection,
}: Pick<
  PremiumSyncState,
  "onboardingComplete" | "isPremium" | "isBlockingPaused" | "familyActivitySelection"
>) => {
  const appliedSelectionRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!onboardingComplete || !isPremium) return;
    if (appliedSelectionRef.current === familyActivitySelection) return;

    if (familyActivitySelection) {
      setSelection(familyActivitySelection);
      if (!isBlockingPaused && isShieldEnabled()) {
        blockSelectionNow();
      }
    } else {
      if (isShieldEnabled()) {
        unblockSelection();
      }
      clearSelection();
    }

    appliedSelectionRef.current = familyActivitySelection;
  }, [
    familyActivitySelection,
    isBlockingPaused,
    isPremium,
    onboardingComplete,
  ]);
};

const useFocusMonitorRegistration = ({
  onboardingComplete,
  isPremium,
  isBlockingPaused,
  focusSchedules,
}: Pick<
  PremiumSyncState,
  "onboardingComplete" | "isPremium" | "isBlockingPaused" | "focusSchedules"
>) => {
  const {
    nativeScheduleFingerprint,
    setNativeScheduleFingerprint,
    setQuranMinutesToUnblock,
  } = useBlockingStore(
    useShallow((s) => ({
      nativeScheduleFingerprint: s.nativeScheduleFingerprint,
      setNativeScheduleFingerprint: s.setNativeScheduleFingerprint,
      setQuranMinutesToUnblock: s.setQuranMinutesToUnblock,
    })),
  );

  useEffect(() => {
    const existingActivityNames = getRelevantNativeActivities();
    const plan = getFocusMonitorRegistrationPlan({
      onboardingComplete,
      isPremium,
      isBlockingPaused,
      focusSchedules,
      nativeScheduleFingerprint,
      existingActivityNames,
    });

    setQuranMinutesToUnblock(plan.quranMinutesToUnblock);

    if (plan.kind === "skip") {
      return;
    }

    if (plan.kind === "clear") {
      if (plan.stopActivityNames.length > 0) {
        void applyFocusSchedulesToDevice({
          schedules: [],
          setQuranMinutesToUnblock,
          stopActivityNames: plan.stopActivityNames,
        });
      }
      if (nativeScheduleFingerprint !== plan.nextFingerprint) {
        setNativeScheduleFingerprint(plan.nextFingerprint);
      }
      return;
    }

    if (plan.kind === "adopt" || plan.kind === "noop") {
      if (nativeScheduleFingerprint !== plan.nextFingerprint) {
        setNativeScheduleFingerprint(plan.nextFingerprint);
      }
      return;
    }

    let cancelled = false;
    void applyFocusSchedulesToDevice({
      schedules: plan.schedules,
      setQuranMinutesToUnblock,
      stopActivityNames: plan.stopActivityNames,
    }).then(() => {
      if (cancelled) return;
      setNativeScheduleFingerprint(plan.nextFingerprint);
    });

    return () => {
      cancelled = true;
    };
  }, [
    focusSchedules,
    isBlockingPaused,
    isPremium,
    nativeScheduleFingerprint,
    onboardingComplete,
    setNativeScheduleFingerprint,
    setQuranMinutesToUnblock,
  ]);
};

const useFocusScheduleCoordinator = ({
  onboardingComplete,
  isPremium,
  isBlockingPaused,
  familyActivitySelection,
}: Pick<
  PremiumSyncState,
  "onboardingComplete" | "isPremium" | "isBlockingPaused" | "familyActivitySelection"
>) => {
  const {
    activeScheduleDate,
    activeScheduleId,
    completedScheduleDate,
    ensureCompletionDate,
    lastBlockedAt,
    requiredQuranMinutes,
    resetAfterUnblock,
    setActiveSchedule,
  } = useBlockingStore(
    useShallow((s) => ({
      activeScheduleDate: s.activeScheduleDate,
      activeScheduleId: s.activeScheduleId,
      completedScheduleDate: s.completedScheduleDate,
      ensureCompletionDate: s.ensureCompletionDate,
      lastBlockedAt: s.lastBlockedAt,
      requiredQuranMinutes: s.requiredQuranMinutes,
      resetAfterUnblock: s.resetAfterUnblock,
      setActiveSchedule: s.setActiveSchedule,
    })),
  );

  const { dateKey, activeSchedule, refresh } = useFocusScheduleStatus();
  const shouldUseScheduleSystem =
    onboardingComplete &&
    isPremium &&
    !isBlockingPaused &&
    familyActivitySelection != null;

  useEffect(() => {
    if (!onboardingComplete) return;
    if (completedScheduleDate === dateKey) return;
    ensureCompletionDate(dateKey);
  }, [completedScheduleDate, dateKey, ensureCompletionDate, onboardingComplete]);

  useEffect(() => {
    if (!onboardingComplete) return;
    const plan = getActiveScheduleSyncPlan({
      completedScheduleDate,
      dateKey,
      shouldUseScheduleSystem,
      activeSchedule,
      activeScheduleId,
      activeScheduleDate,
      requiredQuranMinutes,
    });
    if (!plan.isReady || !plan.needsUpdate) return;
    setActiveSchedule(
      plan.nextActiveScheduleId,
      plan.nextRequiredMinutes,
      dateKey,
    );
  }, [
    activeSchedule,
    activeScheduleDate,
    activeScheduleId,
    completedScheduleDate,
    dateKey,
    onboardingComplete,
    requiredQuranMinutes,
    setActiveSchedule,
    shouldUseScheduleSystem,
  ]);

  const reconcileBlocking = useCallback(() => {
    const plan = getBlockingReconciliationPlan({
      completedScheduleDate,
      dateKey,
      shouldUseScheduleSystem,
      activeSchedule,
      shieldEnabled: isShieldEnabled(),
      activeScheduleId,
      lastBlockedAt,
      requiredQuranMinutes,
    });

    if (plan.action === "block") {
      blockSelectionNow();
      return;
    }

    if (plan.action === "unblock") {
      unblockSelection();
    }

    if (plan.shouldResetAfterUnblock) {
      resetAfterUnblock();
    }
  }, [
    activeSchedule,
    activeScheduleId,
    completedScheduleDate,
    dateKey,
    lastBlockedAt,
    requiredQuranMinutes,
    resetAfterUnblock,
    shouldUseScheduleSystem,
  ]);

  useEffect(() => {
    reconcileBlocking();
  }, [reconcileBlocking]);

  useEffect(() => {
    const monitorSubscription = onMonitorEvent(() => {
      refresh();
    });
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState !== "active") return;
        refresh();
      },
    );

    return () => {
      monitorSubscription.remove();
      appStateSubscription.remove();
    };
  }, [refresh]);
};

export const usePremiumAccessSync = () => {
  const state = useUserStore(
    useShallow((s) => ({
      onboardingComplete: s.onboardingComplete,
      isPremium: s.isPremium,
      isBlockingPaused: s.isBlockingPaused,
      focusSchedules: s.focusSchedules,
      familyActivitySelection: s.familyActivitySelection,
    })),
  );

  useFamilyActivitySelectionSync(state);
  useFocusMonitorRegistration(state);
  useFocusScheduleCoordinator(state);
};
