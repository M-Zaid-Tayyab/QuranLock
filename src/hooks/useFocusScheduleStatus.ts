import { useFocusScheduleSnapshot } from "@/hooks/focus/useFocusScheduleSnapshot";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore } from "@/store/user";
import { useShallow } from "zustand/react/shallow";

interface UseFocusScheduleStatusOptions {
  autoRefreshOnAppActive?: boolean;
  autoTickMinutes?: boolean;
}

export const useFocusScheduleStatus = ({
  autoRefreshOnAppActive = true,
  autoTickMinutes = true,
}: UseFocusScheduleStatusOptions = {}) => {
  const { focusSchedules } = useUserStore(
    useShallow((s) => ({
      focusSchedules: s.focusSchedules,
    })),
  );
  const { completedScheduleDate, completedScheduleIds } = useBlockingStore(
    useShallow((s) => ({
      completedScheduleDate: s.completedScheduleDate,
      completedScheduleIds: s.completedScheduleIds,
    })),
  );

  const { dateKey, statuses, activeSchedule, pendingSchedules, refresh } =
    useFocusScheduleSnapshot(
      {
        completedScheduleDate,
        focusSchedules,
        completedScheduleIds,
      },
      {
        autoRefreshOnAppActive,
        autoTickMinutes,
      },
    );

  return {
    dateKey,
    statuses,
    pendingSchedules,
    activeSchedule,
    refresh,
  };
};
