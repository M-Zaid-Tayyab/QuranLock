import type { FocusSchedule } from "@/store/user";
import {
  getNextScheduleBoundaryDelayMs,
  getScheduleSnapshot,
  getScheduleStatuses,
} from "@/utils/scheduleEngine";
import { describe, expect, it, vi, afterEach } from "vitest";

const schedules: FocusSchedule[] = [
  {
    id: "fajr",
    label: "Fajr",
    kind: "prayer",
    hour: 8,
    minute: 0,
    durationMinutes: 15,
  },
  {
    id: "asr",
    label: "Asr",
    kind: "prayer",
    hour: 15,
    minute: 20,
    durationMinutes: 5,
  },
  {
    id: "isha",
    label: "Isha",
    kind: "prayer",
    hour: 21,
    minute: 45,
    durationMinutes: 20,
  },
];

describe("scheduleEngine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks past schedules pending for the rest of the day until completed", () => {
    const now = new Date("2026-03-04T16:00:00");
    const statuses = getScheduleStatuses(schedules, [], now);

    expect(
      statuses.map((entry) => [entry.schedule.id, entry.status]),
    ).toEqual([
      ["fajr", "pending"],
      ["asr", "pending"],
      ["isha", "upcoming"],
    ]);
  });

  it("suppresses completed schedules while keeping later overdue schedules pending", () => {
    const now = new Date("2026-03-04T16:00:00");
    const snapshot = getScheduleSnapshot(schedules, ["fajr"], now);

    expect(
      snapshot.statuses.map((entry) => [entry.schedule.id, entry.status]),
    ).toEqual([
      ["fajr", "completed"],
      ["asr", "pending"],
      ["isha", "upcoming"],
    ]);
    expect(snapshot.activeSchedule?.schedule.id).toBe("asr");
    expect(snapshot.pendingSchedules.map((entry) => entry.schedule.id)).toEqual([
      "asr",
    ]);
  });

  it("advances to no pending schedules after all overdue ones are completed", () => {
    const now = new Date("2026-03-04T23:00:00");
    const snapshot = getScheduleSnapshot(schedules, ["fajr", "asr", "isha"], now);

    expect(snapshot.activeSchedule).toBeNull();
    expect(snapshot.pendingSchedules).toEqual([]);
  });

  it("ticks to the next schedule boundary when one is still ahead today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T14:00:00"));

    const delay = getNextScheduleBoundaryDelayMs({
      now: new Date(),
      focusSchedules: schedules,
      completedScheduleIds: [],
    });

    expect(delay).toBe(80 * 60 * 1000 + 24);
  });

  it("ticks to midnight once the remaining schedules are already completed today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T22:00:00"));

    const delay = getNextScheduleBoundaryDelayMs({
      now: new Date(),
      focusSchedules: schedules,
      completedScheduleIds: ["fajr", "asr", "isha"],
    });

    expect(delay).toBe(2 * 60 * 60 * 1000 + 24);
  });
});
