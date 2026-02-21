import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import {
  getActiveSchedule,
  getDateKey,
  getPendingSchedules,
  getScheduleStatuses,
} from "@/utils/scheduleEngine";
import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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
