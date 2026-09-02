import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import {
  isShieldEnabled,
  syncFocusLockStatus,
  type FocusLockSession,
} from "@/services";
import { type FocusSchedule, useUserStore } from "@/store/user";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

const INITIAL_USER_SYNC_RETRY_DELAY_MS = 2_000;
const MAX_INITIAL_USER_SYNC_RETRIES = 3;

const toFocusLockSession = (schedule: FocusSchedule): FocusLockSession => ({
  id: schedule.id,
  label: schedule.label,
  kind: schedule.kind,
  hour: schedule.hour,
  minute: schedule.minute,
  durationMinutes: schedule.durationMinutes,
});

export const useFocusLockStatusSync = () => {
  const {
    appUserId,
    onboardingComplete,
    isPremium,
    isBlockingPaused,
    blockAllApps,
    familyActivitySelection,
  } = useUserStore(
    useShallow((s) => ({
      appUserId: s.appUserId,
      onboardingComplete: s.onboardingComplete,
      isPremium: s.isPremium,
      isBlockingPaused: s.isBlockingPaused,
      blockAllApps: s.blockAllApps,
      familyActivitySelection: s.familyActivitySelection,
    })),
  );
  const { dateKey, activeSchedule, pendingSchedules } =
    useFocusScheduleStatus();
  const lastSyncedRef = useRef("");
  const [retryCount, setRetryCount] = useState(0);
  const lockConfigurationKey = JSON.stringify({
    isPremium,
    isBlockingPaused,
    blockAllApps,
    hasManualSelection: familyActivitySelection !== null,
  });

  useEffect(() => {
    if (!appUserId || !onboardingComplete) return;

    const focusLockStatus = {
      dateKey,
      isAppsLocked: isShieldEnabled(),
      activeSession: activeSchedule
        ? toFocusLockSession(activeSchedule.schedule)
        : undefined,
      pendingSessions: pendingSchedules.map(({ schedule }) =>
        toFocusLockSession(schedule),
      ),
      updatedAt: Date.now(),
    };
    const serialized = JSON.stringify({
      ...focusLockStatus,
      updatedAt: undefined,
    });

    if (serialized === lastSyncedRef.current) return;

    let cancelled = false;

    const sync = async () => {
      const result = await syncFocusLockStatus({
        appUserId,
        focusLockStatus,
      });
      if (cancelled || !result) return;
      if (result.updated) {
        lastSyncedRef.current = serialized;
        return;
      }
      if (retryCount >= MAX_INITIAL_USER_SYNC_RETRIES) return;
      setTimeout(() => {
        if (!cancelled) {
          setRetryCount((count) => count + 1);
        }
      }, INITIAL_USER_SYNC_RETRY_DELAY_MS);
    };

    sync();

    return () => {
      cancelled = true;
    };
  }, [
    activeSchedule,
    appUserId,
    dateKey,
    lockConfigurationKey,
    onboardingComplete,
    pendingSchedules,
    retryCount,
  ]);
};
