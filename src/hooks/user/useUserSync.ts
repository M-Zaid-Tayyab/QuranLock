import { syncUserProfile } from "@/services/userSync";
import { useUserStore } from "@/store/user";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

export const useUserSync = () => {
  const payload = useUserStore(
    useShallow((s) => ({
      appUserId: s.appUserId,
      name: s.name,
      age: s.age,
      quranFrequency: s.quranFrequency,
      reasonsDisconnect: s.reasonsDisconnect,
      focusSchedules: s.focusSchedules,
      deferredFocusSchedules: s.deferredFocusSchedules,
      onboardingComplete: s.onboardingComplete,
      hasSelectedApps: s.hasSelectedApps,
      lastReadPage: s.lastReadPage,
      translationEnabled: s.translationEnabled,
      isPremium: s.isPremium,
      subscriptionTier: s.subscriptionTier,
      completedUnlockSessions: s.completedUnlockSessions,
      streakCompletedDates: s.streakCompletedDates,
    })),
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");

  useEffect(() => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastPayloadRef.current) return;
    lastPayloadRef.current = serialized;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      syncUserProfile(payload);
    }, 1500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [payload]);
};
