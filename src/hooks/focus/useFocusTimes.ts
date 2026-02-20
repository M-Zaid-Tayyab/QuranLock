import {
  PRAYER_PRESETS,
  getNextDuration,
  type PrayerPreset,
} from "@/configs/onboarding";
import { PAYWALL_SOURCES, type PaywallSource } from "@/constants/entitlements";
import {
  canAddFocusSchedule,
  openPaywallForBlockedDecision,
} from "@/services/entitlements";
import { useBlockingStore } from "@/store/blocking";
import {
  useUserStore,
  type FocusDurationMode,
  type FocusSchedule,
} from "@/store/user";
import {
  applyGoalDurationToSchedules,
  computeGoalRecommendation,
  sanitizeGoalDays,
  sanitizeManualDuration,
} from "@/utils/focusPlan";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

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
  const router = useRouter();
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const focusDurationMode = useUserStore((s) => s.focusDurationMode);
  const focusCompletionDays = useUserStore((s) => s.focusCompletionDays);
  const focusMinutesPerPage = useUserStore((s) => s.focusMinutesPerPage);
  const setFocusSchedules = useUserStore((s) => s.setFocusSchedules);
  const setFocusDurationMode = useUserStore((s) => s.setFocusDurationMode);
  const setFocusCompletionDays = useUserStore((s) => s.setFocusCompletionDays);
  const isPremium = useUserStore((s) => s.isPremium);
  const setQuranMinutesToUnblock = useBlockingStore(
    (s) => s.setQuranMinutesToUnblock,
  );

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
    String(sanitizeGoalDays(focusCompletionDays)),
  );

  const hasRequestedNotificationsRef = useRef(false);
  const customIndexRef = useRef(
    focusSchedules.filter((schedule) => schedule.kind === "custom").length + 1,
  );

  useEffect(() => {
    setGoalDaysInput(String(sanitizeGoalDays(focusCompletionDays)));
  }, [focusCompletionDays]);

  useEffect(() => {
    if (focusSchedules.length === 0) {
      setExpandedScheduleId(null);
      setTimePickerTarget(null);
    }
  }, [focusSchedules.length]);

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
  }, [syncNotificationStatus]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncNotificationStatus();
      }
    });
    return () => subscription.remove();
  }, [syncNotificationStatus]);

  useEffect(() => {
    if (isEditTimes || Platform.OS !== "ios") return;
    if (notificationStatus !== "undetermined") return;
    if (hasRequestedNotificationsRef.current) return;

    hasRequestedNotificationsRef.current = true;
    void requestNotifications();
  }, [isEditTimes, notificationStatus, requestNotifications]);

  useEffect(() => {
    if (!onNotificationPermissionChange) return;
    if (Platform.OS !== "ios") {
      onNotificationPermissionChange(true);
      return;
    }
    if (notificationStatus == null) return;
    onNotificationPermissionChange(notificationStatus === "granted");
  }, [notificationStatus, onNotificationPermissionChange]);

  useEffect(() => {
    if (!onNotificationPermissionStatusChange) return;
    onNotificationPermissionStatusChange(notificationStatus);
  }, [notificationStatus, onNotificationPermissionStatusChange]);

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
        completionDays: focusCompletionDays,
        scheduleCount: focusSchedules.length,
        minutesPerPage: focusMinutesPerPage,
      }),
    [focusCompletionDays, focusMinutesPerPage, focusSchedules.length],
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
    if (focusDurationMode !== "goal") return;
    if (!goalRecommendation.computable) return;
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
    setSchedule,
  ]);

  const ensureCanAddSchedule = useCallback(
    (source: PaywallSource) => {
      if (!isEditTimes) return true;
      const gate = canAddFocusSchedule({
        isPremium,
        focusScheduleCount: focusSchedules.length,
      });
      if (gate.allowed) return true;
      openPaywallForBlockedDecision(router, gate, source);
      return false;
    },
    [focusSchedules.length, isEditTimes, isPremium, router],
  );

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

      if (!ensureCanAddSchedule(PAYWALL_SOURCES.FOCUS_TIMES_ADD_PRAYER)) return;

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
      ensureCanAddSchedule,
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
        if (!ensureCanAddSchedule(PAYWALL_SOURCES.FOCUS_TIMES_ADD_CUSTOM)) {
          return;
        }
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
    [ensureCanAddSchedule, focusSchedules, onUpdateSchedule, setSchedule],
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
    if (!ensureCanAddSchedule(PAYWALL_SOURCES.FOCUS_TIMES_ADD_CUSTOM)) return;
    const initialDate = toPickerDate(12, 0);
    setPickerDate(initialDate);
    setTimePickerTarget("new");
  }, [
    ensureCanAddSchedule,
    toPickerDate,
  ]);

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
      if (nextMode !== "goal") return;
      const safeDays = sanitizeGoalDays(focusCompletionDays);
      setFocusCompletionDays(safeDays);
      const recommendation = computeGoalRecommendation({
        completionDays: safeDays,
        scheduleCount: focusSchedules.length,
        minutesPerPage: focusMinutesPerPage,
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
      focusCompletionDays,
      focusMinutesPerPage,
      focusSchedules,
      setFocusCompletionDays,
      setFocusDurationMode,
      setSchedule,
    ],
  );

  const onStepGoalDays = useCallback(
    (delta: number) => {
      const nextDays = sanitizeGoalDays(focusCompletionDays + delta);
      setFocusCompletionDays(nextDays);
      setGoalDaysInput(String(nextDays));
    },
    [focusCompletionDays, setFocusCompletionDays],
  );

  const onCommitGoalDays = useCallback(() => {
    const digits = goalDaysInput.replace(/\D/g, "");
    const parsed = digits ? parseInt(digits, 10) : focusCompletionDays;
    const nextDays = sanitizeGoalDays(parsed);
    setFocusCompletionDays(nextDays);
    setGoalDaysInput(String(nextDays));
  }, [focusCompletionDays, goalDaysInput, setFocusCompletionDays]);

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
      onUpdateSchedule(scheduleId, { label: nextLabel });
    },
    [onUpdateSchedule],
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
    focusCompletionDays,
    goalDaysInput,
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
