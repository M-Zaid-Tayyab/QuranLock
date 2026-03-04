import type { FocusSchedule } from "@/store/user";

type ScheduleBoundary = Pick<FocusSchedule, "hour" | "minute" | "id">;

export type ScheduleStatus = "upcoming" | "pending" | "completed";

export interface ScheduleStatusEntry {
  schedule: FocusSchedule;
  status: ScheduleStatus;
  minutes: number;
}

export interface ScheduleSnapshot {
  dateKey: string;
  statuses: ScheduleStatusEntry[];
  activeSchedule: ScheduleStatusEntry | null;
  pendingSchedules: ScheduleStatusEntry[];
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

export const getScheduleSnapshot = (
  schedules: FocusSchedule[],
  completedIds: string[],
  now: Date = new Date(),
): ScheduleSnapshot => {
  const statuses = getScheduleStatuses(schedules, completedIds, now);
  return {
    dateKey: getDateKey(now),
    statuses,
    activeSchedule: getActiveSchedule(statuses),
    pendingSchedules: getPendingSchedules(statuses),
  };
};

export const getNextScheduleBoundaryDelayMs = (params: {
  now: Date;
  focusSchedules: ScheduleBoundary[];
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
  const rawDelay = nextBoundaryMs - nowMs + 24;
  return Math.max(250, rawDelay);
};
