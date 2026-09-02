import { getAppSelectionSummary } from "@/services/deviceActivity";
import { syncUserProfile } from "@/services/userSync";
import { useUserStore } from "@/store/user";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

export const useUserSync = () => {
  const onboardingComplete = useUserStore((state) => state.onboardingComplete);
  const payload = useUserStore(
    useShallow((s) => ({
      appUserId: s.appUserId,
      name: s.name,
      age: s.age,
      quranFrequency: s.quranFrequency,
      reasonsDisconnect: s.reasonsDisconnect,
      acquisitionSource: s.acquisitionSource,
      focusSchedules: s.focusSchedules,
      focusDurationMode: s.focusDurationMode,
      focusCompletionDays: s.focusCompletionDays,
      focusMinutesPerPage: s.focusMinutesPerPage,
      blockAllApps: s.blockAllApps,
      familyActivitySelection: s.familyActivitySelection,
      isBlockingPaused: s.isBlockingPaused,
      lastReadPage: s.lastReadPage,
      translationEnabled: s.translationEnabled,
      quranFontScale: s.quranFontScale,
      isPremium: s.isPremium,
      completedUnlockSessions: s.completedUnlockSessions,
      streakCompletedDates: s.streakCompletedDates,
    })),
  );

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPayloadRef = useRef<string>("");
  const previousOnboardingCompleteRef = useRef<boolean>(
    onboardingComplete,
  );

  useEffect(() => {
    const {
      blockAllApps,
      familyActivitySelection,
      focusCompletionDays,
      focusMinutesPerPage,
      ...basePayload
    } = payload;
    const appSelection = getAppSelectionSummary(
      blockAllApps,
      familyActivitySelection,
    );
    const syncPayload =
      payload.focusDurationMode === "goal"
        ? {
            ...basePayload,
            focusCompletionDays,
            focusMinutesPerPage,
            appSelection,
          }
        : {
            ...basePayload,
            appSelection,
          };

    if (!syncPayload.appUserId || !onboardingComplete) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      previousOnboardingCompleteRef.current = onboardingComplete;
      return;
    }

    const serialized = JSON.stringify(syncPayload);
    if (serialized === lastPayloadRef.current) return;
    lastPayloadRef.current = serialized;

    const becameOnboardingComplete =
      !previousOnboardingCompleteRef.current && onboardingComplete;
    previousOnboardingCompleteRef.current = onboardingComplete;

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
  }, [onboardingComplete, payload]);
};
