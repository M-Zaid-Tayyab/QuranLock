import {
  blockSelectionNow,
  setSelection,
  unblockSelection,
} from "@/services/deviceActivity";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore, type FocusSchedule } from "@/store/user";
import { areFocusSchedulesEqual } from "@/utils/focusScheduleEntitlement";
import { applyFocusSchedulesToDevice } from "@/utils/focusScheduleRuntime";
import { getDateKey, getScheduleStatuses } from "@/utils/scheduleEngine";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

interface PremiumSyncState {
  onboardingComplete: boolean;
  isPremium: boolean;
  isBlockingPaused: boolean;
  focusSchedules: FocusSchedule[];
  familyActivitySelection: string | null;
}

const usePremiumSelectionSync = ({
  onboardingComplete,
  isPremium,
  familyActivitySelection,
}: Pick<
  PremiumSyncState,
  "onboardingComplete" | "isPremium" | "familyActivitySelection"
>) => {
  const appliedSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onboardingComplete) return;

    if (!isPremium) {
      appliedSelectionRef.current = null;
      return;
    }

    if (
      familyActivitySelection &&
      appliedSelectionRef.current !== familyActivitySelection
    ) {
      setSelection(familyActivitySelection);
      appliedSelectionRef.current = familyActivitySelection;
    }
  }, [familyActivitySelection, isPremium, onboardingComplete]);
};

const usePremiumScheduleSync = ({
  onboardingComplete,
  isPremium,
  isBlockingPaused,
  focusSchedules,
}: Pick<
  PremiumSyncState,
  "onboardingComplete" | "isPremium" | "isBlockingPaused" | "focusSchedules"
>) => {
  const setQuranMinutesToUnblock = useBlockingStore(
    (s) => s.setQuranMinutesToUnblock,
  );
  const appliedSchedulesRef = useRef<FocusSchedule[]>([]);

  useEffect(() => {
    if (!onboardingComplete) return;

    const nextSchedules =
      isPremium && !isBlockingPaused ? focusSchedules : [];
    const previousSchedules = appliedSchedulesRef.current;
    if (areFocusSchedulesEqual(previousSchedules, nextSchedules)) {
      return;
    }

    appliedSchedulesRef.current = nextSchedules;
    void applyFocusSchedulesToDevice({
      previousSchedules,
      nextSchedules,
      setQuranMinutesToUnblock,
    }).catch(() => {});
  }, [
    focusSchedules,
    isBlockingPaused,
    isPremium,
    onboardingComplete,
    setQuranMinutesToUnblock,
  ]);
};

const usePremiumWindowEnforcement = ({
  onboardingComplete,
  isPremium,
  isBlockingPaused,
  focusSchedules,
  familyActivitySelection,
}: PremiumSyncState) => {
  const resetAfterUnblock = useBlockingStore((s) => s.resetAfterUnblock);

  useEffect(() => {
    if (!onboardingComplete) return;

    if (!isPremium) {
      unblockSelection();
      resetAfterUnblock();
      return;
    }

    if (isBlockingPaused) {
      unblockSelection();
      return;
    }

    const blockingState = useBlockingStore.getState();
    const now = new Date();
    const dateKey = getDateKey(now);

    if (blockingState.completedScheduleDate !== dateKey) {
      blockingState.ensureCompletionDate(dateKey);
    }

    const {
      activeScheduleDate,
      activeScheduleId,
      completedScheduleIds,
      setActiveSchedule,
    } = useBlockingStore.getState();
    const nextPending =
      getScheduleStatuses(focusSchedules, completedScheduleIds, now).find(
        (entry) => entry.status === "pending",
      ) ?? null;
    const nextPendingId = nextPending?.schedule.id ?? null;

    if (
      nextPendingId !== activeScheduleId ||
      (nextPendingId != null && activeScheduleDate !== dateKey)
    ) {
      setActiveSchedule(
        nextPendingId,
        nextPending?.schedule.durationMinutes ?? 0,
        dateKey,
      );
    }

    if (nextPending && familyActivitySelection) {
      blockSelectionNow();
      return;
    }

    unblockSelection();
  }, [
    familyActivitySelection,
    focusSchedules,
    isBlockingPaused,
    isPremium,
    onboardingComplete,
    resetAfterUnblock,
  ]);
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

  usePremiumSelectionSync(state);
  usePremiumScheduleSync(state);
  usePremiumWindowEnforcement(state);
};
