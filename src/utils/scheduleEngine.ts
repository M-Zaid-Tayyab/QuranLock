import type { FocusSchedule } from "@/store/user";

export type ScheduleStatus = "upcoming" | "pending" | "completed";

export interface ScheduleStatusEntry {
  schedule: FocusSchedule;
  status: ScheduleStatus;
  minutes: number;
}

export const getDateKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getScheduleStatuses = (
  schedules: FocusSchedule[],
  completedIds: string[],
  now: Date = new Date(),
): ScheduleStatusEntry[] => {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const completedSet = new Set(completedIds);
  return schedules
    .map((schedule) => {
      const minutes = schedule.hour * 60 + schedule.minute;
      const completed = completedSet.has(schedule.id);
      const pending = !completed && minutes <= nowMinutes;
      return {
        schedule,
        minutes,
        status: completed ? "completed" : pending ? "pending" : "upcoming",
      } as ScheduleStatusEntry;
    })
    .sort((a, b) => a.minutes - b.minutes);
};

export const getActiveSchedule = (
  statuses: ScheduleStatusEntry[],
): ScheduleStatusEntry | null =>
  statuses.find((entry) => entry.status === "pending") ?? null;

export const getPendingSchedules = (statuses: ScheduleStatusEntry[]) =>
  statuses.filter((entry) => entry.status === "pending");
