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
      focusDurationMode: s.focusDurationMode,
      focusCompletionDays: s.focusCompletionDays,
      focusMinutesPerPage: s.focusMinutesPerPage,
      onboardingComplete: s.onboardingComplete,
      hasSelectedApps: s.hasSelectedApps,
      familyActivitySelection: s.familyActivitySelection,
      lastReadPage: s.lastReadPage,
      translationEnabled: s.translationEnabled,
      quranFontScale: s.quranFontScale,
      isPremium: s.isPremium,
      subscriptionTier: s.subscriptionTier,
      completedUnlockSessions: s.completedUnlockSessions,
      streakCompletedDates: s.streakCompletedDates,
    })),
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");
  const previousOnboardingCompleteRef = useRef<boolean>(
    payload.onboardingComplete,
  );

  useEffect(() => {
    if (!payload.appUserId || !payload.onboardingComplete) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      previousOnboardingCompleteRef.current = payload.onboardingComplete;
      return;
    }

    const serialized = JSON.stringify(payload);
    if (serialized === lastPayloadRef.current) return;
    lastPayloadRef.current = serialized;

    const becameOnboardingComplete =
      !previousOnboardingCompleteRef.current && payload.onboardingComplete;
    previousOnboardingCompleteRef.current = payload.onboardingComplete;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (becameOnboardingComplete) {
      syncUserProfile(payload);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      syncUserProfile(payload);
    }, 1500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [payload]);
};
