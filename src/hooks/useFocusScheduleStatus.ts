import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import {
  getActiveSchedule,
  getDateKey,
  getPendingSchedules,
  getScheduleStatuses,
} from "@/utils/scheduleEngine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useShallow } from "zustand/react/shallow";

interface UseFocusScheduleStatusOptions {
  autoRefreshOnAppActive?: boolean;
  autoTickMinutes?: boolean;
}

const TIMER_GRACE_MS = 24;
const MIN_TIMER_DELAY_MS = 250;

const getNextBoundaryDelayMs = (params: {
  now: Date;
  focusSchedules: { hour: number; minute: number; id: string }[];
  completedScheduleIds: string[];
}) => {
  const { now, focusSchedules, completedScheduleIds } = params;
  const nowMs = now.getTime();
  const completedSet = new Set(completedScheduleIds);

  let nextScheduleStartMs = Number.POSITIVE_INFINITY;
  for (const schedule of focusSchedules) {
    if (completedSet.has(schedule.id)) continue;
    const scheduleTime = new Date(now);
    scheduleTime.setHours(schedule.hour, schedule.minute, 0, 0);
    const scheduleMs = scheduleTime.getTime();
    if (scheduleMs > nowMs && scheduleMs < nextScheduleStartMs) {
      nextScheduleStartMs = scheduleMs;
    }
  }

  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const nextMidnightMs = nextMidnight.getTime();
  const nextBoundaryMs = Math.min(nextScheduleStartMs, nextMidnightMs);
  const rawDelay = nextBoundaryMs - nowMs + TIMER_GRACE_MS;
  return Math.max(MIN_TIMER_DELAY_MS, rawDelay);
};

export const useFocusScheduleStatus = ({
  autoRefreshOnAppActive = true,
  autoTickMinutes = true,
}: UseFocusScheduleStatusOptions = {}) => {
  const { focusSchedules } = useUserStore(
    useShallow((s) => ({
      focusSchedules: s.focusSchedules,
    })),
  );
  const { completedScheduleIds } = useBlockingStore(
    useShallow((s) => ({
      completedScheduleIds: s.completedScheduleIds,
    })),
  );

  const [now, setNow] = useState(() => new Date());
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const refresh = useCallback(() => {
    setNow(new Date());
  }, []);

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
    }, getNextBoundaryDelayMs({
      now,
      focusSchedules,
      completedScheduleIds,
    }));

    return () => {
      clearTimeout(timeoutId);
    };
  }, [appState, autoTickMinutes, completedScheduleIds, focusSchedules, now]);

  const dateKey = useMemo(() => getDateKey(now), [now]);

  const statuses = useMemo(
    () => getScheduleStatuses(focusSchedules, completedScheduleIds, now),
    [focusSchedules, completedScheduleIds, now],
  );

  const activeSchedule = useMemo(() => getActiveSchedule(statuses), [statuses]);
  const pendingSchedules = useMemo(
    () => getPendingSchedules(statuses),
    [statuses],
  );

  return {
    dateKey,
    statuses,
    pendingSchedules,
    activeSchedule,
    refresh,
  };
};
