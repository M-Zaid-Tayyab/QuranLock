import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import {
  areFocusSchedulesEqual,
  resolveFocusSchedulesByEntitlement,
} from "@/utils/focusScheduleEntitlement";
import { applyFocusSchedulesToDevice } from "@/utils/focusScheduleRuntime";
import { useEffect } from "react";

export const useFocusScheduleEntitlementReconciliation = () => {
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  const isPremium = useUserStore((s) => s.isPremium);
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const deferredFocusSchedules = useUserStore((s) => s.deferredFocusSchedules);
  const setFocusSchedules = useUserStore((s) => s.setFocusSchedules);
  const setDeferredFocusSchedules = useUserStore(
    (s) => s.setDeferredFocusSchedules,
  );
  const setQuranMinutesToUnblock = useBlockingStore(
    (s) => s.setQuranMinutesToUnblock,
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
    setDeferredFocusSchedules,
    setFocusSchedules,
    setQuranMinutesToUnblock,
  ]);
};
