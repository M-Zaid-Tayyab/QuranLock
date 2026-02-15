import {
  DURATION_OPTIONS,
  PRAYER_PRESETS,
  formatTime,
  getNextDuration,
  type PrayerPreset,
} from "@/configs/onboarding";
import { colors } from "@/constants/colors";
import { PAYWALL_SOURCES, type PaywallSource } from "@/constants/entitlements";
import {
  canAddFocusSchedule,
  openPaywallForBlockedDecision,
} from "@/services/entitlements";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore, type FocusSchedule } from "@/store/user";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

interface FocusTimesStepProps {
  isEditTimes: boolean;
  scheduleError: string | null;
}

export function FocusTimesStep({
  isEditTimes,
  scheduleError,
}: FocusTimesStepProps) {
  const router = useRouter();
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const setFocusSchedules = useUserStore((s) => s.setFocusSchedules);
  const isPremium = useUserStore((s) => s.isPremium);
  const setQuranMinutesToUnblock = useBlockingStore(
    (s) => s.setQuranMinutesToUnblock,
  );

  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(
    null,
  );
  const [timePickerTarget, setTimePickerTarget] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<
    "granted" | "denied" | "undetermined" | null
  >(null);

  const hasRequestedNotificationsRef = useRef(false);
  const customIndexRef = useRef(
    focusSchedules.filter((schedule) => schedule.kind === "custom").length + 1,
  );

  useEffect(() => {
    if (focusSchedules.length === 0) {
      setExpandedScheduleId(null);
      setTimePickerTarget(null);
    }
  }, [focusSchedules.length]);

  useEffect(() => {
    if (isEditTimes || Platform.OS !== "ios") return;
    if (hasRequestedNotificationsRef.current) return;

    hasRequestedNotificationsRef.current = true;
    Notifications.getPermissionsAsync()
      .then(({ status }) => {
        const current =
          status === "granted"
            ? "granted"
            : status === "denied"
              ? "denied"
              : "undetermined";
        setNotificationStatus(current);

        if (status === "granted") return;
        return Notifications.requestPermissionsAsync().then(({ status: s }) => {
          setNotificationStatus(
            s === "granted"
              ? "granted"
              : s === "denied"
                ? "denied"
                : "undetermined",
          );
        });
      })
      .catch(() => {});
  }, [isEditTimes]);

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

  const ensureCanAddSchedule = useCallback(
    (source: PaywallSource) => {
      const gate = canAddFocusSchedule({
        isPremium,
        focusScheduleCount: focusSchedules.length,
      });
      if (gate.allowed) return true;
      openPaywallForBlockedDecision(router, gate, source);
      return false;
    },
    [focusSchedules.length, isPremium, router],
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

  const toPickerDate = useCallback((hour: number, minute: number) => {
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

      if (Platform.OS === "android") {
        DateTimePickerAndroid.open({
          value: initialDate,
          mode: "time",
          is24Hour: false,
          onChange: (event, selectedDate) => {
            if (event.type !== "set" || !selectedDate) return;
            applyPickedTime(id, selectedDate);
          },
        });
        return;
      }

      setTimePickerTarget((current) => (current === id ? null : id));
    },
    [applyPickedTime, focusSchedules, toPickerDate],
  );

  const onOpenNewCustomTime = useCallback(() => {
    if (!ensureCanAddSchedule(PAYWALL_SOURCES.FOCUS_TIMES_ADD_CUSTOM)) return;

    const initialDate = toPickerDate(12, 0);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: "time",
        is24Hour: false,
        onChange: (event, selectedDate) => {
          if (event.type !== "set" || !selectedDate) return;
          applyPickedTime("new", selectedDate);
        },
      });
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
        hour: initialDate.getHours(),
        minute: initialDate.getMinutes(),
        durationMinutes: 30,
      },
    ]);
    setExpandedScheduleId(id);
    setTimePickerTarget(id);
  }, [
    applyPickedTime,
    ensureCanAddSchedule,
    focusSchedules,
    setSchedule,
    toPickerDate,
  ]);

  const onToggleExpandedSchedule = useCallback((id: string) => {
    setExpandedScheduleId((current) => {
      const next = current === id ? null : id;
      if (next !== id) {
        setTimePickerTarget(null);
      }
      return next;
    });
  }, []);

  return (
    <View className="flex-1">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="mb-6">
          <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
            PRAYER TIMES
          </Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {PRAYER_PRESETS.map((preset) => {
              const isSelected = selectedPrayerIds.has(preset.id);
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => onTogglePrayer(preset)}
                  className={`rounded-full border px-4 py-2 ${
                    isSelected
                      ? "border-primary bg-primary/20"
                      : "border-outline bg-surface"
                  }`}
                >
                  <Text
                    className={`font-sfPro-semibold ${
                      isSelected ? "text-foreground" : "text-muted"
                    }`}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={onOpenNewCustomTime}
              className="rounded-full border border-dashed border-outline px-4 py-2"
            >
              <Text className="font-sfPro-semibold text-primary">
                + Custom time
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="gap-4">
          {orderedSchedules.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-outline bg-surface px-4 py-6">
              <Text className="text-center font-sfPro text-muted">
                Select a prayer time or add a custom time to continue.
              </Text>
            </View>
          ) : (
            orderedSchedules.map((schedule) => {
              const expanded = expandedScheduleId === schedule.id;
              return (
                <View
                  key={schedule.id}
                  className="rounded-2xl border border-outline bg-surface"
                >
                  <Pressable
                    onPress={() => onToggleExpandedSchedule(schedule.id)}
                    className="flex-row items-center justify-between px-4 py-4"
                  >
                    <View>
                      <Text className="font-sfPro-semibold text-foreground">
                        {schedule.label}
                      </Text>
                      <Text className="mt-1 text-sm font-sfPro text-muted">
                        {formatTime(schedule.hour, schedule.minute)}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.muted}
                    />
                  </Pressable>

                  {expanded && (
                    <View className="px-4 pb-4">
                      <Pressable
                        onPress={() => onOpenTimePicker(schedule.id)}
                        className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
                      >
                        <View className="flex-row items-center gap-2">
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color={colors.primary}
                          />
                          <Text className="font-sfPro text-foreground">Time</Text>
                        </View>
                        <Text className="font-sfPro-semibold text-foreground">
                          {formatTime(schedule.hour, schedule.minute)}
                        </Text>
                      </Pressable>
                      {Platform.OS === "ios" &&
                      timePickerTarget === schedule.id ? (
                        <View className="mt-3 rounded-xl border border-outline bg-backgroundElevated px-2 py-2">
                          <DateTimePicker
                            value={toPickerDate(schedule.hour, schedule.minute)}
                            mode="time"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (event.type === "dismissed" || !selectedDate)
                                return;
                              onUpdateSchedule(schedule.id, {
                                hour: selectedDate.getHours(),
                                minute: selectedDate.getMinutes(),
                              });
                            }}
                          />
                        </View>
                      ) : null}

                      <View className="mt-4">
                        <Text className="text-xs font-sfPro-semibold tracking-widest text-muted">
                          FOCUS DURATION
                        </Text>
                        <View className="mt-3 flex-row flex-wrap gap-2">
                          {DURATION_OPTIONS.map((mins) => {
                            const isSelected = schedule.durationMinutes === mins;
                            return (
                              <Pressable
                                key={mins}
                                onPress={() =>
                                  onUpdateSchedule(schedule.id, {
                                    durationMinutes: mins,
                                  })
                                }
                                className={`rounded-full border px-4 py-2 ${
                                  isSelected
                                    ? "border-primary bg-primary/20"
                                    : "border-outline bg-backgroundElevated"
                                }`}
                              >
                                <Text
                                  className={`font-sfPro-semibold ${
                                    isSelected ? "text-foreground" : "text-muted"
                                  }`}
                                >
                                  {mins} min
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {schedule.kind === "custom" && (
                        <Pressable
                          onPress={() => onRemoveSchedule(schedule.id)}
                          className="mt-4 self-start"
                        >
                          <Text className="font-sfPro-semibold text-error">
                            Remove custom time
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {scheduleError ? (
          <Text className="mt-4 text-center font-sfPro text-sm text-error">
            {scheduleError}
          </Text>
        ) : null}

        {!isEditTimes && (
          <View className="mt-6 rounded-2xl border border-outline bg-backgroundElevated px-4 py-4">
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.primary + "22" }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View className="flex-1">
                <Text className="font-sfPro-semibold text-foreground">
                  Notifications
                </Text>
                <Text className="mt-1 text-sm font-sfPro text-muted">
                  We will remind you to open QuranLock when the shield appears.
                </Text>
              </View>
            </View>
            {notificationStatus ? (
              <Text className="mt-3 text-sm font-sfPro text-muted">
                Status:{" "}
                <Text className="font-sfPro-semibold text-foreground">
                  {notificationStatus === "granted"
                    ? "Allowed"
                    : notificationStatus === "denied"
                      ? "Denied"
                      : "Not determined"}
                </Text>
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
