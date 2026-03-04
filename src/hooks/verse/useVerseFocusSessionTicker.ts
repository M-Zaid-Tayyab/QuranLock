import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import { unblockSelection } from "@/services/deviceActivity";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import { useIsFocused } from "@react-navigation/native";
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
    setSessionNowMs,
    completedScheduleIds,
    markScheduleCompleted,
  } = useBlockingStore(
    useShallow((s) => ({
      getRequiredMinutes: s.getRequiredMinutes,
      getAccumulatedMinutesSnapshot: s.getAccumulatedMinutesSnapshot,
      startLiveProgress: s.startLiveProgress,
      pauseLiveProgress: s.pauseLiveProgress,
      resetAfterUnblock: s.resetAfterUnblock,
      setSessionNowMs: s.setSessionNowMs,
      completedScheduleIds: s.completedScheduleIds,
      markScheduleCompleted: s.markScheduleCompleted,
    })),
  );

  const {
    incrementCompletedUnlockSessions,
    focusSchedules,
    isBlockingPaused,
    markStreakDayCompleted,
  } = useUserStore(
    useShallow((s) => ({
      incrementCompletedUnlockSessions: s.incrementCompletedUnlockSessions,
      focusSchedules: s.focusSchedules,
      isBlockingPaused: s.isBlockingPaused,
      markStreakDayCompleted: s.markStreakDayCompleted,
    })),
  );

  const { dateKey, activeSchedule, pendingSchedules, refresh } =
    useFocusScheduleStatus();
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockSessionCountedRef = useRef(false);

  useEffect(() => {
    unlockSessionCountedRef.current = false;
  }, [activeSchedule?.schedule.id, dateKey]);

  const tick = useCallback(() => {
    if (isBlockingPaused) return;
    const nowMs = Date.now();
    setSessionNowMs(nowMs);
    const requiredMinutes = getRequiredMinutes();
    if (requiredMinutes <= 0) return;
    const accumulatedMinutes = getAccumulatedMinutesSnapshot(nowMs);
    const shouldUnblock = accumulatedMinutes >= requiredMinutes;
    if (!shouldUnblock) return;
    pauseLiveProgress(nowMs);
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
      unblockSelection();
      resetAfterUnblock();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
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
    isBlockingPaused,
    markStreakDayCompleted,
    markScheduleCompleted,
    pauseLiveProgress,
    resetAfterUnblock,
    setSessionNowMs,
  ]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", setAppState);
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (isBlockingPaused || !isFocused || !activeSchedule || appState !== "active") {
      pauseLiveProgress(Date.now());
      useBlockingStore.getState().flushLifetimeProgress();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const nowMs = Date.now();
    setSessionNowMs(nowMs);
    startLiveProgress(nowMs);
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
  }, [
    activeSchedule,
    appState,
    isFocused,
    isBlockingPaused,
    pauseLiveProgress,
    setSessionNowMs,
    startLiveProgress,
    tick,
  ]);

  return {
    pendingSchedulesCount: pendingSchedules.length,
    refreshSchedule: refresh,
  };
};
