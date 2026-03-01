import {
  PRAYER_PRESETS,
  getNextDuration,
  type PrayerPreset,
} from "@/configs/onboarding";
import { useBlockingStore } from "@/store/blocking";
import {
  useUserStore,
  type FocusDurationMode,
  type FocusSchedule,
} from "@/store/user";
import {
  applyGoalDurationToSchedules,
  computeGoalRecommendation,
  DEFAULT_MINUTES_PER_PAGE,
  sanitizeGoalDays,
  sanitizeManualDuration,
} from "@/utils/focusPlan";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { useShallow } from "zustand/react/shallow";

export type FocusNotificationStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | null;

export interface UseFocusTimesArgs {
  isEditTimes: boolean;
  onNotificationPermissionChange?: (approved: boolean) => void;
  onNotificationPermissionStatusChange?: (status: FocusNotificationStatus) => void;
}

export interface UseFocusTimesResult {
  focusSchedules: FocusSchedule[];
  focusDurationMode: FocusDurationMode;
  focusCompletionDays: number;
  goalDaysInput: string;
  scheduleLabelDrafts: Record<string, string>;
  expandedScheduleId: string | null;
  timePickerTarget: string | null;
  pickerDate: Date;
  isTimePickerOpen: boolean;
  notificationStatus: FocusNotificationStatus;
  selectedPrayerIds: Set<string>;
  orderedSchedules: FocusSchedule[];
  summaryMinutesText: string;
  goalRecommendation: ReturnType<typeof computeGoalRecommendation>;
  setGoalDaysInput: (value: string) => void;
  onTogglePrayer: (preset: PrayerPreset) => void;
  onRemoveSchedule: (id: string) => void;
  onOpenTimePicker: (id: string) => void;
  onOpenNewCustomTime: () => void;
  onConfirmTimePicker: (date: Date) => void;
  onCancelTimePicker: () => void;
  onToggleExpandedSchedule: (id: string) => void;
  onChangeMode: (nextMode: FocusDurationMode) => void;
  onStepGoalDays: (delta: number) => void;
  onCommitGoalDays: () => void;
  onAdjustDuration: (schedule: FocusSchedule, delta: number) => void;
  onCommitDurationInput: (scheduleId: string, rawValue: string) => void;
  onChangeScheduleLabel: (scheduleId: string, rawValue: string) => void;
  onCommitScheduleLabel: (schedule: FocusSchedule, rawValue: string) => void;
}

export const FOCUS_DURATION_STEP = 5;
export const FOCUS_LABEL_MAX_LENGTH = 24;

export function useFocusTimes({
  isEditTimes,
  onNotificationPermissionChange,
  onNotificationPermissionStatusChange,
}: UseFocusTimesArgs): UseFocusTimesResult {
  const {
    focusSchedules,
    focusDurationMode,
    focusCompletionDays,
    focusMinutesPerPage,
    setFocusSchedules,
    setFocusDurationMode,
    setFocusCompletionDays,
    setFocusMinutesPerPage,
  } = useUserStore(
    useShallow((s) => ({
      focusSchedules: s.focusSchedules,
      focusDurationMode: s.focusDurationMode,
      focusCompletionDays: s.focusCompletionDays,
      focusMinutesPerPage: s.focusMinutesPerPage,
      setFocusSchedules: s.setFocusSchedules,
      setFocusDurationMode: s.setFocusDurationMode,
      setFocusCompletionDays: s.setFocusCompletionDays,
      setFocusMinutesPerPage: s.setFocusMinutesPerPage,
    })),
  );
  const { setQuranMinutesToUnblock } = useBlockingStore(
    useShallow((s) => ({
      setQuranMinutesToUnblock: s.setQuranMinutesToUnblock,
    })),
  );

  const goalCompletionDays = sanitizeGoalDays(focusCompletionDays ?? 30);
  const goalMinutesPerPage =
    focusMinutesPerPage && focusMinutesPerPage > 0
      ? focusMinutesPerPage
      : DEFAULT_MINUTES_PER_PAGE;

  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(
    null,
  );
  const [timePickerTarget, setTimePickerTarget] = useState<string | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [notificationStatus, setNotificationStatus] =
    useState<FocusNotificationStatus>(null);
  const [goalDaysInput, setGoalDaysInput] = useState(() =>
    String(goalCompletionDays),
  );
  const [scheduleLabelDrafts, setScheduleLabelDrafts] = useState<
    Record<string, string>
  >(() =>
    focusSchedules.reduce<Record<string, string>>((acc, schedule) => {
      acc[schedule.id] = schedule.label;
      return acc;
    }, {}),
  );

  const hasRequestedNotificationsRef = useRef(false);
  const customIndexRef = useRef(
    focusSchedules.filter((schedule) => schedule.kind === "custom").length + 1,
  );

  useEffect(() => {
    setGoalDaysInput(String(goalCompletionDays));
  }, [goalCompletionDays]);

  useEffect(() => {
    if (focusSchedules.length === 0) {
      setExpandedScheduleId(null);
      setTimePickerTarget(null);
    }
  }, [focusSchedules.length]);

  useEffect(() => {
    setScheduleLabelDrafts((previous) => {
      let changed = false;
      const next: Record<string, string> = {};

      for (const schedule of focusSchedules) {
        if (Object.prototype.hasOwnProperty.call(previous, schedule.id)) {
          next[schedule.id] = previous[schedule.id];
          continue;
        }
        next[schedule.id] = schedule.label;
        changed = true;
      }

      if (Object.keys(previous).length !== focusSchedules.length) {
        changed = true;
      }

      if (!changed) {
        return previous;
      }

      return next;
    });
  }, [focusSchedules]);

  const mapNotificationStatus = useCallback(
    (status: Notifications.PermissionStatus): Exclude<
      FocusNotificationStatus,
      null
    > =>
      status === "granted"
        ? "granted"
        : status === "denied"
          ? "denied"
          : "undetermined",
    [],
  );

  const syncNotificationStatus = useCallback(async () => {
    if (Platform.OS !== "ios") {
      setNotificationStatus("granted");
      return "granted" as const;
    }
    try {
      const { status } = await Notifications.getPermissionsAsync();
      const mapped = mapNotificationStatus(status);
      setNotificationStatus(mapped);
      return mapped;
    } catch {
      return null;
    }
  }, [mapNotificationStatus]);

  const requestNotifications = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setNotificationStatus(mapNotificationStatus(status));
    } catch {}
  }, [mapNotificationStatus]);

  useEffect(() => {
    void syncNotificationStatus();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncNotificationStatus();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      isEditTimes ||
      Platform.OS !== "ios" ||
      notificationStatus !== "undetermined" ||
      hasRequestedNotificationsRef.current
    ) {
      return;
    }

    hasRequestedNotificationsRef.current = true;
    void requestNotifications();
  }, [isEditTimes, notificationStatus]);

  useEffect(() => {
    if (!onNotificationPermissionChange) return;
    if (Platform.OS !== "ios") {
      onNotificationPermissionChange(true);
      return;
    }
    if (notificationStatus == null) return;
    onNotificationPermissionChange(notificationStatus === "granted");
  }, [notificationStatus]);

  useEffect(() => {
    if (!onNotificationPermissionStatusChange) return;
    onNotificationPermissionStatusChange(notificationStatus);
  }, [notificationStatus]);

  const selectedPrayerIds = useMemo(
    () =>
      new Set(
        focusSchedules
          .filter((schedule) => schedule.kind === "prayer")
          .map((schedule) => schedule.id),
      ),
    [focusSchedules],
  );

  const orderedSchedules = useMemo(
    () =>
      [...focusSchedules].sort(
        (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
      ),
    [focusSchedules],
  );

  const goalRecommendation = useMemo(
    () =>
      computeGoalRecommendation({
        completionDays: goalCompletionDays,
        scheduleCount: focusSchedules.length,
        minutesPerPage: goalMinutesPerPage,
      }),
    [focusSchedules.length, goalCompletionDays, goalMinutesPerPage],
  );

  const setSchedule = useCallback(
    (next: FocusSchedule[]) => {
      setFocusSchedules(next);
      if (!next.length) {
        setExpandedScheduleId(null);
        return;
      }
      setQuranMinutesToUnblock(getNextDuration(next));
    },
    [setFocusSchedules, setQuranMinutesToUnblock],
  );

  useEffect(() => {
    if (focusDurationMode !== "goal" || !goalRecommendation.computable) return;
    const nextDuration = goalRecommendation.recommendedMinutes;
    const alreadyApplied = focusSchedules.every(
      (schedule) => schedule.durationMinutes === nextDuration,
    );
    if (alreadyApplied) return;
    setSchedule(applyGoalDurationToSchedules(focusSchedules, nextDuration));
  }, [
    focusDurationMode,
    focusSchedules,
    goalRecommendation.computable,
    goalRecommendation.recommendedMinutes,
  ]);

  const applyManualDuration = useCallback(
    (scheduleId: string, minutes: number) => {
      if (focusDurationMode === "goal") return;
      const sanitized = sanitizeManualDuration(minutes);
      setSchedule(
        focusSchedules.map((schedule) =>
          schedule.id === scheduleId
            ? { ...schedule, durationMinutes: sanitized }
            : schedule,
        ),
      );
    },
    [
      focusDurationMode,
      focusSchedules,
      setSchedule,
    ],
  );

  const onTogglePrayer = useCallback(
    (preset: PrayerPreset) => {
      const exists = selectedPrayerIds.has(preset.id);

      if (exists) {
        setSchedule(
          focusSchedules.filter((schedule) => schedule.id !== preset.id),
        );
        if (expandedScheduleId === preset.id) setExpandedScheduleId(null);
        return;
      }

      setSchedule([
        ...focusSchedules,
        {
          id: preset.id,
          label: preset.label,
          kind: "prayer",
          hour: preset.hour,
          minute: preset.minute,
          durationMinutes: 30,
        },
      ]);
      setExpandedScheduleId(preset.id);
    },
    [
      expandedScheduleId,
      focusSchedules,
      selectedPrayerIds,
      setSchedule,
    ],
  );

  const onUpdateSchedule = useCallback(
    (id: string, updates: Partial<FocusSchedule>) => {
      setSchedule(
        focusSchedules.map((schedule) =>
          schedule.id === id ? { ...schedule, ...updates } : schedule,
        ),
      );
    },
    [focusSchedules, setSchedule],
  );

  const onRemoveSchedule = useCallback(
    (id: string) => {
      setSchedule(focusSchedules.filter((schedule) => schedule.id !== id));
      if (expandedScheduleId === id) setExpandedScheduleId(null);
    },
    [expandedScheduleId, focusSchedules, setSchedule],
  );

  const toPickerDate = useCallback((hour: number, minute: number): Date => {
    const nextDate = new Date();
    nextDate.setHours(hour, minute, 0, 0);
    return nextDate;
  }, []);

  const applyPickedTime = useCallback(
    (targetId: string, date: Date) => {
      const hour = date.getHours();
      const minute = date.getMinutes();
      if (targetId === "new") {
        const customIndex = customIndexRef.current++;
        const id = `custom-${Date.now()}`;
        setSchedule([
          ...focusSchedules,
          {
            id,
            label: `Custom ${customIndex}`,
            kind: "custom",
            hour,
            minute,
            durationMinutes: 30,
          },
        ]);
        setExpandedScheduleId(id);
      } else {
        onUpdateSchedule(targetId, { hour, minute });
      }
    },
    [focusSchedules, onUpdateSchedule, setSchedule],
  );

  const onOpenTimePicker = useCallback(
    (id: string) => {
      const active = focusSchedules.find((schedule) => schedule.id === id);
      const initialDate = active
        ? toPickerDate(active.hour, active.minute)
        : toPickerDate(12, 0);
      setPickerDate(initialDate);
      setTimePickerTarget((current) => (current === id ? null : id));
    },
    [focusSchedules, toPickerDate],
  );

  const onOpenNewCustomTime = useCallback(() => {
    const initialDate = toPickerDate(12, 0);
    setPickerDate(initialDate);
    setTimePickerTarget("new");
  }, [toPickerDate]);

  const onConfirmTimePicker = useCallback(
    (date: Date) => {
      if (!timePickerTarget) return;
      applyPickedTime(timePickerTarget, date);
      setTimePickerTarget(null);
    },
    [applyPickedTime, timePickerTarget],
  );

  const onCancelTimePicker = useCallback(() => {
    setTimePickerTarget(null);
  }, []);

  const onToggleExpandedSchedule = useCallback((id: string) => {
    setExpandedScheduleId((current) => {
      const next = current === id ? null : id;
      if (next !== id) {
        setTimePickerTarget(null);
      }
      return next;
    });
  }, []);

  const onChangeMode = useCallback(
    (nextMode: FocusDurationMode) => {
      setFocusDurationMode(nextMode);
      if (nextMode !== "goal") {
        setFocusCompletionDays(undefined);
        setFocusMinutesPerPage(undefined);
        return;
      }
      const safeDays = goalCompletionDays;
      setFocusCompletionDays(safeDays);
      setFocusMinutesPerPage(goalMinutesPerPage);
      const recommendation = computeGoalRecommendation({
        completionDays: safeDays,
        scheduleCount: focusSchedules.length,
        minutesPerPage: goalMinutesPerPage,
      });
      if (!recommendation.computable) return;
      setSchedule(
        applyGoalDurationToSchedules(
          focusSchedules,
          recommendation.recommendedMinutes,
        ),
      );
    },
    [
      focusSchedules,
      goalCompletionDays,
      setFocusCompletionDays,
      setFocusDurationMode,
      setFocusMinutesPerPage,
      setSchedule,
      goalMinutesPerPage,
    ],
  );

  const onStepGoalDays = useCallback(
    (delta: number) => {
      const nextDays = sanitizeGoalDays(goalCompletionDays + delta);
      setFocusCompletionDays(nextDays);
      setGoalDaysInput(String(nextDays));
    },
    [goalCompletionDays, setFocusCompletionDays],
  );

  const onCommitGoalDays = useCallback(() => {
    const digits = goalDaysInput.replace(/\D/g, "");
    const parsed = digits ? parseInt(digits, 10) : goalCompletionDays;
    const nextDays = sanitizeGoalDays(parsed);
    setFocusCompletionDays(nextDays);
    setGoalDaysInput(String(nextDays));
  }, [goalCompletionDays, goalDaysInput, setFocusCompletionDays]);

  const onAdjustDuration = useCallback(
    (schedule: FocusSchedule, delta: number) => {
      const next = sanitizeManualDuration(schedule.durationMinutes + delta);
      applyManualDuration(schedule.id, next);
    },
    [applyManualDuration],
  );

  const onCommitDurationInput = useCallback(
    (scheduleId: string, rawValue: string) => {
      const digits = rawValue.replace(/\D/g, "");
      if (!digits) return;
      const parsed = parseInt(digits, 10);
      if (Number.isNaN(parsed)) return;
      applyManualDuration(scheduleId, parsed);
    },
    [applyManualDuration],
  );

  const onChangeScheduleLabel = useCallback(
    (scheduleId: string, rawValue: string) => {
      const nextLabel = rawValue.slice(0, FOCUS_LABEL_MAX_LENGTH);
      setScheduleLabelDrafts((current) => {
        if (current[scheduleId] === nextLabel) return current;
        return { ...current, [scheduleId]: nextLabel };
      });
    },
    [],
  );

  const onCommitScheduleLabel = useCallback(
    (schedule: FocusSchedule, rawValue: string) => {
      const collapsed = rawValue.replace(/\s+/g, " ").trim();
      const defaultPrayerLabel =
        PRAYER_PRESETS.find((preset) => preset.id === schedule.id)?.label ??
        schedule.label;
      const fallback =
        schedule.kind === "prayer" ? defaultPrayerLabel : "Custom time";
      const nextLabel = (collapsed || fallback).slice(0, FOCUS_LABEL_MAX_LENGTH);
      setScheduleLabelDrafts((current) => {
        if (current[schedule.id] === nextLabel) return current;
        return { ...current, [schedule.id]: nextLabel };
      });
      if (nextLabel === schedule.label) return;
      onUpdateSchedule(schedule.id, { label: nextLabel });
    },
    [onUpdateSchedule],
  );

  const summaryMinutesText = goalRecommendation.computable
    ? `${goalRecommendation.recommendedMinutes} min/session`
    : "Select at least one time";

  return {
    focusSchedules,
    focusDurationMode,
    focusCompletionDays: goalCompletionDays,
    goalDaysInput,
    scheduleLabelDrafts,
    expandedScheduleId,
    timePickerTarget,
    pickerDate,
    isTimePickerOpen: timePickerTarget != null,
    notificationStatus,
    selectedPrayerIds,
    orderedSchedules,
    summaryMinutesText,
    goalRecommendation,
    setGoalDaysInput,
    onTogglePrayer,
    onRemoveSchedule,
    onOpenTimePicker,
    onOpenNewCustomTime,
    onConfirmTimePicker,
    onCancelTimePicker,
    onToggleExpandedSchedule,
    onChangeMode,
    onStepGoalDays,
    onCommitGoalDays,
    onAdjustDuration,
    onCommitDurationInput,
    onChangeScheduleLabel,
    onCommitScheduleLabel,
  };
}
