import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import {
  areFocusSchedulesEqual,
  resolveFocusSchedulesByEntitlement,
} from "@/utils/focusScheduleEntitlement";
import { applyFocusSchedulesToDevice } from "@/utils/focusScheduleRuntime";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

export const useFocusScheduleEntitlementReconciliation = () => {
  const {
    onboardingComplete,
    isPremium,
    focusSchedules,
    deferredFocusSchedules,
    setFocusSchedules,
    setDeferredFocusSchedules,
  } = useUserStore(
    useShallow((s) => ({
      onboardingComplete: s.onboardingComplete,
      isPremium: s.isPremium,
      focusSchedules: s.focusSchedules,
      deferredFocusSchedules: s.deferredFocusSchedules,
      setFocusSchedules: s.setFocusSchedules,
      setDeferredFocusSchedules: s.setDeferredFocusSchedules,
    })),
  );
  const { setQuranMinutesToUnblock } = useBlockingStore(
    useShallow((s) => ({
      setQuranMinutesToUnblock: s.setQuranMinutesToUnblock,
    })),
  );

  useEffect(() => {
    if (!onboardingComplete) return;

    const next = resolveFocusSchedulesByEntitlement({
      isPremium,
      activeSchedules: focusSchedules,
      deferredSchedules: deferredFocusSchedules,
    });

    const activeChanged = !areFocusSchedulesEqual(
      next.activeSchedules,
      focusSchedules,
    );
    const deferredChanged = !areFocusSchedulesEqual(
      next.deferredSchedules,
      deferredFocusSchedules,
    );

    if (!activeChanged && !deferredChanged) return;
    if (activeChanged) {
      setFocusSchedules(next.activeSchedules);
      void applyFocusSchedulesToDevice({
        previousSchedules: focusSchedules,
        nextSchedules: next.activeSchedules,
        setQuranMinutesToUnblock,
      }).catch(() => {});
    }
    if (deferredChanged) {
      setDeferredFocusSchedules(next.deferredSchedules);
    }
  }, [
    deferredFocusSchedules,
    focusSchedules,
    isPremium,
    onboardingComplete,
  ]);
};
