import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import { unblockSelection } from "@/services/deviceActivity";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import { getScheduleStatuses } from "@/utils/scheduleEngine";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useShallow } from "zustand/react/shallow";

const TICK_INTERVAL_MS = 1000;

export const useVerseFocusSessionTicker = () => {
  const {
    getRequiredMinutes,
    getAccumulatedMinutesSnapshot,
    startLiveProgress,
    pauseLiveProgress,
    resetAfterUnblock,
    completedScheduleIds,
    markScheduleCompleted,
    setActiveSchedule,
  } = useBlockingStore(
    useShallow((s) => ({
      getRequiredMinutes: s.getRequiredMinutes,
      getAccumulatedMinutesSnapshot: s.getAccumulatedMinutesSnapshot,
      startLiveProgress: s.startLiveProgress,
      pauseLiveProgress: s.pauseLiveProgress,
      resetAfterUnblock: s.resetAfterUnblock,
      completedScheduleIds: s.completedScheduleIds,
      markScheduleCompleted: s.markScheduleCompleted,
      setActiveSchedule: s.setActiveSchedule,
    })),
  );

  const { incrementCompletedUnlockSessions, focusSchedules, markStreakDayCompleted } = useUserStore(
    useShallow((s) => ({
      incrementCompletedUnlockSessions: s.incrementCompletedUnlockSessions,
      focusSchedules: s.focusSchedules,
      markStreakDayCompleted: s.markStreakDayCompleted,
    })),
  );

  const { dateKey, activeSchedule, pendingSchedules } = useFocusScheduleStatus();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockSessionCountedRef = useRef(false);

  useEffect(() => {
    unlockSessionCountedRef.current = false;
  }, [activeSchedule?.schedule.id, dateKey]);

  const tick = useCallback(() => {
    const requiredMinutes = getRequiredMinutes();
    if (requiredMinutes <= 0) return;
    const accumulatedMinutes = getAccumulatedMinutesSnapshot(Date.now());
    const shouldUnblock = accumulatedMinutes >= requiredMinutes;
    if (!shouldUnblock) return;
    pauseLiveProgress(Date.now());
    if (!unlockSessionCountedRef.current) {
      incrementCompletedUnlockSessions();
      unlockSessionCountedRef.current = true;
    }
    if (activeSchedule) {
      const completedIds = completedScheduleIds.includes(
        activeSchedule.schedule.id,
      )
        ? completedScheduleIds
        : [...completedScheduleIds, activeSchedule.schedule.id];
      const hasCompletedAllGoalsToday =
        focusSchedules.length > 0 &&
        focusSchedules.every((schedule) => completedIds.includes(schedule.id));
      if (hasCompletedAllGoalsToday) {
        markStreakDayCompleted(dateKey);
      }
      markScheduleCompleted(activeSchedule.schedule.id, dateKey);
      const statuses = getScheduleStatuses(
        focusSchedules,
        completedIds,
        new Date(),
      );
      const nextPending = statuses.find((entry) => entry.status === "pending");
      if (nextPending) {
        setActiveSchedule(
          nextPending.schedule.id,
          nextPending.schedule.durationMinutes,
          dateKey,
        );
      } else {
        setActiveSchedule(null, 0, dateKey);
        unblockSelection();
        resetAfterUnblock();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      return;
    }
    unblockSelection();
    resetAfterUnblock();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [
    activeSchedule,
    completedScheduleIds,
    dateKey,
    focusSchedules,
    getAccumulatedMinutesSnapshot,
    getRequiredMinutes,
    incrementCompletedUnlockSessions,
    markStreakDayCompleted,
    markScheduleCompleted,
    pauseLiveProgress,
    resetAfterUnblock,
    setActiveSchedule,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", setAppState);
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!activeSchedule || appState !== "active") {
      pauseLiveProgress(Date.now());
      useBlockingStore.getState().flushLifetimeProgress();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    startLiveProgress(Date.now());
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      pauseLiveProgress(Date.now());
      useBlockingStore.getState().flushLifetimeProgress();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeSchedule, appState, pauseLiveProgress, startLiveProgress, tick]);

  return {
    pendingSchedulesCount: pendingSchedules.length,
  };
};
