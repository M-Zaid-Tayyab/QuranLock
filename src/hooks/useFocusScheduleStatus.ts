import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import {
  getActiveSchedule,
  getDateKey,
  getPendingSchedules,
  getScheduleStatuses,
} from "@/utils/scheduleEngine";
import { useEffect, useMemo, useState } from "react";

export const useFocusScheduleStatus = () => {
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const completedScheduleDate = useBlockingStore(
    (s) => s.completedScheduleDate,
  );
  const completedScheduleIds = useBlockingStore(
    (s) => s.completedScheduleIds,
  );
  const activeScheduleId = useBlockingStore((s) => s.activeScheduleId);
  const ensureCompletionDate = useBlockingStore((s) => s.ensureCompletionDate);
  const setActiveSchedule = useBlockingStore((s) => s.setActiveSchedule);

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
  }, [completedScheduleDate, dateKey, ensureCompletionDate]);

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
  }, [activeSchedule, activeScheduleId, dateKey, setActiveSchedule]);

  return {
    dateKey,
    statuses,
    pendingSchedules,
    activeSchedule,
  };
};
