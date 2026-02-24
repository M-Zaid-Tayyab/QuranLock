import { useFocusScheduleStatus } from "@/hooks/useFocusScheduleStatus";
import { useBlockingStore } from "@/store/blocking";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

interface UseHomeScheduleStatusOptions {
  autoRefreshOnAppActive?: boolean;
  autoTickMinutes?: boolean;
}

export const useHomeScheduleStatus = (
  options: UseHomeScheduleStatusOptions = {},
) => {
  const { completedScheduleDate, ensureCompletionDate } = useBlockingStore(
    useShallow((s) => ({
      completedScheduleDate: s.completedScheduleDate,
      ensureCompletionDate: s.ensureCompletionDate,
    })),
  );
  const scheduleVm = useFocusScheduleStatus(options);
  const { dateKey } = scheduleVm;
  const ensureCompletionDateRef = useRef(ensureCompletionDate);
  ensureCompletionDateRef.current = ensureCompletionDate;

  useEffect(() => {
    if (completedScheduleDate === dateKey) return;
    ensureCompletionDateRef.current(dateKey);
  }, [completedScheduleDate, dateKey]);

  return scheduleVm;
};
