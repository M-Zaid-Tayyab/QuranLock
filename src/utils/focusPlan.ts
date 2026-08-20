import type { FocusSchedule } from "@/store/user";

export const QURAN_TOTAL_PAGES = 604;
export const DEFAULT_MINUTES_PER_PAGE = 3.0;
export const DEFAULT_GOAL_DAYS = 90;
export const GOAL_DAYS_MIN = 7;
export const GOAL_DAYS_MAX = 365;
export const GOAL_DAYS_STEP = 5;
export const GOAL_SESSION_CAP_MINUTES = 90;
export const ROUND_STEP_MINUTES = 5;
export const MANUAL_MIN_DURATION = 5;
export const MANUAL_MAX_DURATION = 120;

interface ComputeGoalRecommendationArgs {
  completionDays: number;
  scheduleCount: number;
  minutesPerPage: number;
}

export interface GoalRecommendation {
  completionDays: number;
  scheduleCount: number;
  minutesPerPage: number;
  pagesPerDay: number;
  pagesPerSession: number;
  rawMinutes: number;
  roundedMinutes: number;
  recommendedMinutes: number;
  capped: boolean;
  computable: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roundToStep = (value: number, step: number) => {
  if (!Number.isFinite(value)) return step;
  return Math.round(value / step) * step;
};

export const sanitizeGoalDays = (value: number) => {
  if (!Number.isFinite(value)) return DEFAULT_GOAL_DAYS;
  return clamp(Math.round(value), GOAL_DAYS_MIN, GOAL_DAYS_MAX);
};

export const sanitizeManualDuration = (value: number) => {
  if (!Number.isFinite(value)) return MANUAL_MIN_DURATION;
  return clamp(
    Math.round(value),
    MANUAL_MIN_DURATION,
    MANUAL_MAX_DURATION,
  );
};

export const computeGoalRecommendation = ({
  completionDays,
  scheduleCount,
  minutesPerPage,
}: ComputeGoalRecommendationArgs): GoalRecommendation => {
  const days = sanitizeGoalDays(completionDays);
  const safeScheduleCount = Math.max(0, Math.floor(scheduleCount));
  const safeMinutesPerPage = Number.isFinite(minutesPerPage) && minutesPerPage > 0
    ? minutesPerPage
    : DEFAULT_MINUTES_PER_PAGE;

  if (safeScheduleCount <= 0) {
    return {
      completionDays: days,
      scheduleCount: safeScheduleCount,
      minutesPerPage: safeMinutesPerPage,
      pagesPerDay: QURAN_TOTAL_PAGES / days,
      pagesPerSession: 0,
      rawMinutes: 0,
      roundedMinutes: 0,
      recommendedMinutes: 0,
      capped: false,
      computable: false,
    };
  }

  const pagesPerDay = QURAN_TOTAL_PAGES / days;
  const pagesPerSession = pagesPerDay / safeScheduleCount;
  const rawMinutes = pagesPerSession * safeMinutesPerPage;
  const roundedMinutes = roundToStep(rawMinutes, ROUND_STEP_MINUTES);
  const clampedMin = Math.max(MANUAL_MIN_DURATION, roundedMinutes);
  const recommendedMinutes = Math.min(GOAL_SESSION_CAP_MINUTES, clampedMin);

  return {
    completionDays: days,
    scheduleCount: safeScheduleCount,
    minutesPerPage: safeMinutesPerPage,
    pagesPerDay,
    pagesPerSession,
    rawMinutes,
    roundedMinutes,
    recommendedMinutes,
    capped: rawMinutes > GOAL_SESSION_CAP_MINUTES,
    computable: true,
  };
};

export const applyGoalDurationToSchedules = (
  schedules: FocusSchedule[],
  minutes: number,
) => {
  const nextDuration = sanitizeManualDuration(minutes);
  return schedules.map((schedule) => ({
    ...schedule,
    durationMinutes: nextDuration,
  }));
};

interface RebaseMinutesPerPageArgs {
  editedMinutes: number;
  completionDays: number;
  scheduleCount: number;
}

export const rebaseMinutesPerPageFromManualEdit = ({
  editedMinutes,
  completionDays,
  scheduleCount,
}: RebaseMinutesPerPageArgs) => {
  const safeEditedMinutes = sanitizeManualDuration(editedMinutes);
  const days = sanitizeGoalDays(completionDays);
  const safeScheduleCount = Math.max(0, Math.floor(scheduleCount));
  if (safeScheduleCount <= 0) return DEFAULT_MINUTES_PER_PAGE;
  const pagesPerDay = QURAN_TOTAL_PAGES / days;
  const pagesPerSession = pagesPerDay / safeScheduleCount;
  if (!Number.isFinite(pagesPerSession) || pagesPerSession <= 0) {
    return DEFAULT_MINUTES_PER_PAGE;
  }
  return safeEditedMinutes / pagesPerSession;
};
