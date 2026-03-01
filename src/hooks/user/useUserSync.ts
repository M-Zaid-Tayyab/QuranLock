import { syncUserProfile } from "@/services/userSync";
import { useUserStore } from "@/store/user";
import { useEffect, useMemo, useRef } from "react";
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
      completedUnlockSessions: s.completedUnlockSessions,
      streakCompletedDates: s.streakCompletedDates,
    })),
  );
  const syncPayload = useMemo(
    () => {
      const {
        focusCompletionDays,
        focusMinutesPerPage,
        ...basePayload
      } = payload;
      if (payload.focusDurationMode !== "goal") {
        return basePayload;
      }
      return {
        ...basePayload,
        focusCompletionDays,
        focusMinutesPerPage,
      };
    },
    [payload],
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");
  const previousOnboardingCompleteRef = useRef<boolean>(
    syncPayload.onboardingComplete,
  );

  useEffect(() => {
    if (!syncPayload.appUserId || !syncPayload.onboardingComplete) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      previousOnboardingCompleteRef.current = syncPayload.onboardingComplete;
      return;
    }

    const serialized = JSON.stringify(syncPayload);
    if (serialized === lastPayloadRef.current) return;
    lastPayloadRef.current = serialized;

    const becameOnboardingComplete =
      !previousOnboardingCompleteRef.current && syncPayload.onboardingComplete;
    previousOnboardingCompleteRef.current = syncPayload.onboardingComplete;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (becameOnboardingComplete) {
      syncUserProfile(syncPayload);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      syncUserProfile(syncPayload);
    }, 1500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [syncPayload]);
};
