import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import { useBlockingStore } from "@/store/blocking";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

export const useVerseScheduleController = () => {
  const {
    completedScheduleDate,
    activeScheduleId,
    ensureCompletionDate,
    setActiveSchedule,
  } = useBlockingStore(
    useShallow((s) => ({
      completedScheduleDate: s.completedScheduleDate,
      activeScheduleId: s.activeScheduleId,
      ensureCompletionDate: s.ensureCompletionDate,
      setActiveSchedule: s.setActiveSchedule,
    })),
  );

  const scheduleVm = useFocusScheduleStatus();
  const { dateKey, activeSchedule } = scheduleVm;
  const ensureCompletionDateRef = useRef(ensureCompletionDate);
  ensureCompletionDateRef.current = ensureCompletionDate;
  const setActiveScheduleRef = useRef(setActiveSchedule);
  setActiveScheduleRef.current = setActiveSchedule;

  useEffect(() => {
    if (completedScheduleDate === dateKey) return;
    ensureCompletionDateRef.current(dateKey);
  }, [completedScheduleDate, dateKey]);

  useEffect(() => {
    if (completedScheduleDate !== dateKey) return;
    const nextActiveScheduleId = activeSchedule?.schedule.id ?? null;
    if (nextActiveScheduleId === activeScheduleId) return;
    setActiveScheduleRef.current(
      nextActiveScheduleId,
      activeSchedule?.schedule.durationMinutes ?? 0,
      dateKey,
    );
  }, [activeSchedule, activeScheduleId, completedScheduleDate, dateKey]);

  return scheduleVm;
};
