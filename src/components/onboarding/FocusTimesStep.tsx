import { BottomSheetModal, PrimaryButton } from "@/components/common";
import {
  DURATION_OPTIONS,
  PRAYER_PRESETS,
  TIME_OPTIONS,
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
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
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
  const timePickerRef: RefObject<GorhomBottomSheetModal | null> =
    useRef<GorhomBottomSheetModal | null>(null);
  const customIndexRef = useRef(
    focusSchedules.filter((schedule) => schedule.kind === "custom").length + 1,
  );

  useEffect(() => {
    if (focusSchedules.length === 0) {
      setExpandedScheduleId(null);
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

  const activeTimeValue = useMemo(() => {
    const active = focusSchedules.find(
      (schedule) => schedule.id === timePickerTarget,
    );
    if (!active) return null;
    return `${active.hour}-${active.minute}`;
  }, [focusSchedules, timePickerTarget]);

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

  const onOpenTimePicker = useCallback((id: string) => {
    setTimePickerTarget(id);
    timePickerRef.current?.present();
  }, []);

  const onOpenNewCustomTime = useCallback(() => {
    if (!ensureCanAddSchedule(PAYWALL_SOURCES.FOCUS_TIMES_ADD_CUSTOM)) return;
    setTimePickerTarget("new");
    timePickerRef.current?.present();
  }, [ensureCanAddSchedule]);

  const onPickTime = useCallback(
    (hour: number, minute: number) => {
      if (timePickerTarget === "new") {
        if (!ensureCanAddSchedule(PAYWALL_SOURCES.FOCUS_TIMES_ADD_CUSTOM)) {
          timePickerRef.current?.dismiss();
          setTimePickerTarget(null);
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
      } else if (timePickerTarget) {
        onUpdateSchedule(timePickerTarget, { hour, minute });
      }

      timePickerRef.current?.dismiss();
      setTimePickerTarget(null);
    },
    [
      ensureCanAddSchedule,
      focusSchedules,
      onUpdateSchedule,
      setSchedule,
      timePickerTarget,
    ],
  );

  const onCloseTimePicker = useCallback(() => {
    timePickerRef.current?.dismiss();
    setTimePickerTarget(null);
  }, []);

  const onToggleExpandedSchedule = useCallback((id: string) => {
    setExpandedScheduleId((current) => (current === id ? null : id));
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

      <BottomSheetModal
        sheetRef={timePickerRef}
        snapPoints={["70%"]}
        showHandle
        scrollView
      >
        <View className="px-6 pt-4 pb-8">
          <Text className="text-lg font-sfPro-semibold text-foreground">
            Choose a time
          </Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">
            Pick a time that fits your daily rhythm.
          </Text>
          <View className="mt-4 gap-2">
            {TIME_OPTIONS.map((option) => (
              <Pressable
                key={`${option.hour}-${option.minute}`}
                onPress={() => onPickTime(option.hour, option.minute)}
                className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                  activeTimeValue === `${option.hour}-${option.minute}`
                    ? "border-primary bg-primary/15"
                    : "border-outline bg-surface"
                }`}
              >
                <Text className="font-sfPro text-foreground">{option.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
          <View className="mt-4">
            <PrimaryButton title="Close" onPress={onCloseTimePicker} />
          </View>
        </View>
      </BottomSheetModal>
    </View>
  );
}
