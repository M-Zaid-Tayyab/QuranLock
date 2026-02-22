import type { FocusSchedule } from "@/store/user";

interface ResolveFocusSchedulesByEntitlementArgs {
  isPremium: boolean;
  activeSchedules: FocusSchedule[];
  deferredSchedules: FocusSchedule[];
  freeActiveLimit?: number;
}

export interface ResolvedFocusSchedules {
  activeSchedules: FocusSchedule[];
  deferredSchedules: FocusSchedule[];
}

const dedupeSchedules = (schedules: FocusSchedule[]) => {
  const seen = new Set<string>();
  const next: FocusSchedule[] = [];
  for (const schedule of schedules) {
    if (seen.has(schedule.id)) continue;
    seen.add(schedule.id);
    next.push(schedule);
  }
  return next;
};

const withoutDuplicateIds = (
  schedules: FocusSchedule[],
  blockedIds: Set<string>,
) => schedules.filter((schedule) => !blockedIds.has(schedule.id));

export const areFocusSchedulesEqual = (a: FocusSchedule[], b: FocusSchedule[]) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.label !== right.label ||
      left.kind !== right.kind ||
      left.hour !== right.hour ||
      left.minute !== right.minute ||
      left.durationMinutes !== right.durationMinutes
    ) {
      return false;
    }
  }
  return true;
};

export const resolveFocusSchedulesByEntitlement = ({
  isPremium,
  activeSchedules,
  deferredSchedules,
  freeActiveLimit = 1,
}: ResolveFocusSchedulesByEntitlementArgs): ResolvedFocusSchedules => {
  const normalizedActive = dedupeSchedules(activeSchedules);
  const normalizedDeferred = dedupeSchedules(deferredSchedules);
  const activeIds = new Set(normalizedActive.map((schedule) => schedule.id));
  const deferredOnly = withoutDuplicateIds(normalizedDeferred, activeIds);

  if (isPremium) {
    return {
      activeSchedules: dedupeSchedules([...normalizedActive, ...deferredOnly]),
      deferredSchedules: [],
    };
  }

  if (normalizedActive.length <= freeActiveLimit) {
    return {
      activeSchedules: normalizedActive,
      deferredSchedules: deferredOnly,
    };
  }

  return {
    activeSchedules: normalizedActive.slice(0, freeActiveLimit),
    deferredSchedules: dedupeSchedules([
      ...normalizedActive.slice(freeActiveLimit),
      ...deferredOnly,
    ]),
  };
};
