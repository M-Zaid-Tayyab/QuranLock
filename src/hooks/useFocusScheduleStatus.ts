import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import {
  getActiveSchedule,
  getDateKey,
  getPendingSchedules,
  getScheduleStatuses,
} from "@/utils/scheduleEngine";
import { useEffect, useMemo, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useShallow } from "zustand/react/shallow";

export const useFocusScheduleStatus = () => {
  const { focusSchedules } = useUserStore(
    useShallow((s) => ({
      focusSchedules: s.focusSchedules,
    })),
  );
  const {
    completedScheduleDate,
    completedScheduleIds,
    activeScheduleId,
    ensureCompletionDate,
    setActiveSchedule,
  } = useBlockingStore(
    useShallow((s) => ({
      completedScheduleDate: s.completedScheduleDate,
      completedScheduleIds: s.completedScheduleIds,
      activeScheduleId: s.activeScheduleId,
      ensureCompletionDate: s.ensureCompletionDate,
      setActiveSchedule: s.setActiveSchedule,
    })),
  );

  const [now, setNow] = useState(() => new Date());
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
      if (nextState === "active") {
        setNow(new Date());
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (appState !== "active") return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextTick = () => {
      const msUntilNextMinute = 60_000 - (Date.now() % 60_000) + 24;
      timeoutId = setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, msUntilNextMinute);
    };

    scheduleNextTick();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [appState]);

  const dateKey = useMemo(() => getDateKey(now), [now]);

  useEffect(() => {
    if (completedScheduleDate !== dateKey) {
      ensureCompletionDate(dateKey);
    }
  }, [completedScheduleDate, dateKey]);

  const statuses = useMemo(
    () => getScheduleStatuses(focusSchedules, completedScheduleIds, now),
    [focusSchedules, completedScheduleIds, now],
  );

  const activeSchedule = useMemo(() => getActiveSchedule(statuses), [statuses]);
  const pendingSchedules = useMemo(
    () => getPendingSchedules(statuses),
    [statuses],
  );

  useEffect(() => {
    if (activeSchedule?.schedule.id !== activeScheduleId) {
      setActiveSchedule(
        activeSchedule?.schedule.id ?? null,
        activeSchedule?.schedule.durationMinutes ?? 0,
        dateKey,
      );
    }
  }, [activeSchedule, activeScheduleId, dateKey]);

  return {
    dateKey,
    statuses,
    pendingSchedules,
    activeSchedule,
  };
};
