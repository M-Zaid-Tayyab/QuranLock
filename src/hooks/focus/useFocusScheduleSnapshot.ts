import type { FocusSchedule } from "@/store/user";
import { getEffectiveCompletedScheduleIds } from "@/utils/focusScheduleCoordinator";
import {
  getDateKey,
  getNextScheduleBoundaryDelayMs,
  getScheduleSnapshot,
} from "@/utils/scheduleEngine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

interface FocusScheduleSnapshotInput {
  completedScheduleIds: string[];
  completedScheduleDate: string | null;
  focusSchedules: FocusSchedule[];
}

interface UseFocusScheduleSnapshotOptions {
  autoRefreshOnAppActive?: boolean;
  autoTickMinutes?: boolean;
}

export const useFocusScheduleSnapshot = (
  {
    completedScheduleDate,
    completedScheduleIds,
    focusSchedules,
  }: FocusScheduleSnapshotInput,
  {
    autoRefreshOnAppActive = true,
    autoTickMinutes = true,
  }: UseFocusScheduleSnapshotOptions = {},
) => {
  const [now, setNow] = useState(() => new Date());
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  const refresh = useCallback(() => {
    setNow(new Date());
  }, []);

  const dateKey = useMemo(() => getDateKey(now), [now]);
  const effectiveCompletedScheduleIds = useMemo(
    () =>
      getEffectiveCompletedScheduleIds({
        completedScheduleDate,
        completedScheduleIds,
        dateKey,
      }),
    [completedScheduleDate, completedScheduleIds, dateKey],
  );

  useEffect(() => {
    if (!autoRefreshOnAppActive && !autoTickMinutes) return;
    const sub = AppState.addEventListener("change", (nextState) => {
      if (autoTickMinutes) {
        setAppState(nextState);
      }
      if (autoRefreshOnAppActive && nextState === "active") {
        setNow(new Date());
      }
    });
    return () => sub.remove();
  }, [autoRefreshOnAppActive, autoTickMinutes]);

  useEffect(() => {
    if (!autoTickMinutes) return;
    if (appState !== "active") return;
    const timeoutId = setTimeout(() => {
      setNow(new Date());
    }, getNextScheduleBoundaryDelayMs({
      now,
      focusSchedules,
      completedScheduleIds: effectiveCompletedScheduleIds,
    }));

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    appState,
    autoTickMinutes,
    effectiveCompletedScheduleIds,
    focusSchedules,
    now,
  ]);

  const snapshot = useMemo(
    () => getScheduleSnapshot(focusSchedules, effectiveCompletedScheduleIds, now),
    [effectiveCompletedScheduleIds, focusSchedules, now],
  );

  return {
    ...snapshot,
    now,
    refresh,
  };
};
