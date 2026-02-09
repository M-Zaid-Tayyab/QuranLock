import { BottomSheetModal, PrimaryButton } from "@/components/common";
import {
  canProceedScreenTime,
  commitSelectApps,
  QuestionCard,
  ScreenTimeStep,
  SelectAppsStep,
  StepContainer,
  TextInputQuestion,
  type Option,
} from "@/components/onboarding";
import { colors, rgba } from "@/constants/colors";
import { SCREEN_TIME } from "@/constants/screenTime";
import {
  configureBlockOnly,
  DEFAULT_SHIELD_ACTIONS,
  DEFAULT_SHIELD_CONFIG,
  startDailyBlockScheduleFor,
  stopMonitoring,
  updateShield,
} from "@/services/deviceActivity";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore, type FocusSchedule } from "@/store/user";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal as GorhomBottomSheetModal } from "@gorhom/bottom-sheet";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";

const TOTAL_STEPS = 10;

const STEP_TITLES: Record<number, string> = {
  0: "",
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
  7: "Enable Screen Time",
  8: "Select apps to block",
  9: "Set your daily focus times",
};

const STEP_SUBTITLES: Record<number, string> = {
  0: "",
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
  7: "We use Screen Time to protect your focus window and pause distracting apps.",
  8: "Choose the apps that tend to pull your attention away.",
  9: "Pick prayer times or add a custom time, then set the focus duration for each.",
};

const STEP_ICONS: Record<number, string> = {};

const QURAN_FREQUENCY_OPTIONS: Option[] = [
  {
    value: "daily",
    label: "Daily",
    description: "I read every day",
    icon: "book-outline",
    color: colors.primary,
  },
  {
    value: "few_times",
    label: "A few times a week",
    description: "Aim for consistency",
    icon: "calendar-outline",
    color: colors.secondary,
  },
  {
    value: "rarely",
    label: "Rarely",
    description: "Trying to build a habit",
    icon: "time-outline",
    color: colors.muted,
  },
  {
    value: "want_to_start",
    label: "I want to start",
    description: "Beginning my journey",
    icon: "flag-outline",
    color: colors.accent,
  },
];

const REASONS_OPTIONS: Option[] = [
  {
    value: "social_media",
    label: "Social media",
    description: "Scrolling takes my time",
    icon: "phone-portrait-outline",
    color: colors.primary,
  },
  {
    value: "work",
    label: "Work",
    description: "Too busy with deadlines",
    icon: "briefcase-outline",
    color: colors.orange,
  },
  {
    value: "distractions",
    label: "Distractions",
    description: "Hard to stay focused",
    icon: "flash-outline",
    color: colors.warning,
  },
  {
    value: "lack_of_time",
    label: "Lack of time",
    description: "Struggle to find time",
    icon: "time-outline",
    color: colors.muted,
  },
  {
    value: "other",
    label: "Other",
    description: "Something else",
    icon: "ellipsis-horizontal",
    color: colors.secondary,
  },
];

const PRAYER_PRESETS = [
  { id: "fajr", label: "Fajr", hour: 5, minute: 0 },
  { id: "dhuhr", label: "Dhuhr", hour: 12, minute: 30 },
  { id: "asr", label: "Asr", hour: 15, minute: 30 },
  { id: "maghrib", label: "Maghrib", hour: 18, minute: 30 },
  { id: "isha", label: "Isha", hour: 20, minute: 0 },
] as const;

const DURATION_OPTIONS = [15, 30, 45, 60] as const;

const INTRO_STEPS = [
  {
    kicker: "Purpose",
    title: "It’s simple. Read Quran once a day to unlock your apps.",
    highlight: "Read Quran",
    accent: colors.accent,
  },
  {
    kicker: "How It Works",
    title: "Your focus time is protected until you reconnect with Allah.",
    highlight: "protected",
    accent: colors.primary,
  },
  {
    kicker: "Why It Matters",
    title: "Less scrolling. More remembrance and peace.",
    highlight: "remembrance",
    accent: colors.secondary,
  },
] as const;

const renderAnimatedHeadline = (
  title: string,
  highlight: string,
  accent: string,
  stepKey: string,
) => {
  const words = title.split(" ");
  const highlightWords = new Set(
    highlight
      .split(" ")
      .map((word) => word.replace(/[^a-z]/gi, "").toLowerCase())
      .filter(Boolean),
  );

  return (
    <View className="flex-row flex-wrap max-w-[320px]">
      {words.map((word, index) => {
        const clean = word.replace(/[^a-z]/gi, "").toLowerCase();
        const isHighlight = highlightWords.has(clean);
        return (
          <Animated.Text
            key={`${stepKey}-${word}-${index}`}
            entering={FadeInDown.delay(index * 140)
              .duration(240)
              .easing(Easing.out(Easing.cubic))}
            className="text-4xl font-sfPro-bold leading-tight"
            style={{
              letterSpacing: 0.6,
              color: isHighlight ? accent : colors.foreground,
            }}
          >
            {word}
            {index < words.length - 1 ? " " : ""}
          </Animated.Text>
        );
      })}
    </View>
  );
};

const formatTime = (hour: number, minute: number) => {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${suffix}`;
};

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? 0 : 30;
  return {
    hour,
    minute,
    label: formatTime(hour, minute),
  };
});

const getNextDuration = (schedules: FocusSchedule[]) => {
  if (!schedules.length) return 30;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const sorted = [...schedules].sort(
    (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
  );
  for (const schedule of sorted) {
    const scheduleMinutes = schedule.hour * 60 + schedule.minute;
    if (scheduleMinutes >= currentMinutes) return schedule.durationMinutes;
  }
  return sorted[0]?.durationMinutes ?? 30;
};

export default function Onboarding() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [familyActivitySelection, setFamilyActivitySelection] = useState<
    string | null
  >(null);
  const [ageInput, setAgeInput] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(
    null,
  );
  const [timePickerTarget, setTimePickerTarget] = useState<string | null>(null);
  const customIndexRef = useRef(1);
  const timePickerRef = useRef<GorhomBottomSheetModal | null>(null);
  const previousSchedulesRef = useRef<FocusSchedule[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<
    "granted" | "denied" | "undetermined" | null
  >(null);
  const notificationRequestedRef = useRef(false);

  const name = useUserStore((s) => s.name);
  const setName = useUserStore((s) => s.setName);
  const age = useUserStore((s) => s.age);
  const setAge = useUserStore((s) => s.setAge);
  const quranFrequency = useUserStore((s) => s.quranFrequency);
  const setQuranFrequency = useUserStore((s) => s.setQuranFrequency);
  const reasonsDisconnect = useUserStore((s) => s.reasonsDisconnect);
  const setReasonsDisconnect = useUserStore((s) => s.setReasonsDisconnect);
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const setFocusSchedules = useUserStore((s) => s.setFocusSchedules);
  const setOnboardingComplete = useUserStore((s) => s.setOnboardingComplete);
  const setQuranMinutesToUnblock = useBlockingStore(
    (s) => s.setQuranMinutesToUnblock,
  );

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isEditTimes = modeParam === "edit-times";
  const activeStep = isEditTimes ? 9 : stepIndex;

  useEffect(() => {
    if (isEditTimes) return;
    if (stepIndex === 4) setAgeInput(age != null ? String(age) : "");
  }, [stepIndex, age, isEditTimes]);

  useEffect(() => {
    if (isEditTimes) return;
    if (activeStep !== 9 || Platform.OS !== "ios") return;
    if (notificationRequestedRef.current) return;
    notificationRequestedRef.current = true;
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
  }, [activeStep, isEditTimes]);

  useEffect(() => {
    if (!focusSchedules.length) return;
    setQuranMinutesToUnblock(getNextDuration(focusSchedules));
  }, [focusSchedules, setQuranMinutesToUnblock]);

  useEffect(() => {
    if (focusSchedules.length) setScheduleError(null);
  }, [focusSchedules.length]);

  useEffect(() => {
    if (
      previousSchedulesRef.current.length === 0 &&
      focusSchedules.length > 0
    ) {
      previousSchedulesRef.current = focusSchedules;
    }
  }, [focusSchedules]);

  const handleBack = useCallback(() => {
    setStepError(null);
    setScheduleError(null);
    if (isEditTimes) {
      router.back();
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }, [isEditTimes, router]);

  const applySchedules = useCallback(async () => {
    const schedules = useUserStore.getState().focusSchedules;
    if (!schedules.length) return;
    setQuranMinutesToUnblock(getNextDuration(schedules));
    const previousNames = previousSchedulesRef.current.map(
      (schedule) => `${SCREEN_TIME.ACTIVITY_NAME}-${schedule.id}`,
    );
    const activityNames = schedules.map(
      (schedule) => `${SCREEN_TIME.ACTIVITY_NAME}-${schedule.id}`,
    );
    if (Platform.OS === "ios") {
      stopMonitoring(Array.from(new Set([...previousNames, ...activityNames])));
      for (const schedule of schedules) {
        const activityName = `${SCREEN_TIME.ACTIVITY_NAME}-${schedule.id}`;
        configureBlockOnly(
          activityName,
          SCREEN_TIME.SELECTION_ID,
          SCREEN_TIME.SHIELD_ID,
        );
        await startDailyBlockScheduleFor(
          activityName,
          schedule.hour,
          schedule.minute,
        );
      }
      previousSchedulesRef.current = schedules;
    }
  }, [setQuranMinutesToUnblock]);

  const handleNext = useCallback(async () => {
    setStepError(null);
    setScheduleError(null);

    if (!isEditTimes && activeStep === 3) {
      if (!name.trim()) {
        setStepError("Please enter your name");
        return;
      }
    }

    if (!isEditTimes && activeStep === 4) {
      const a = parseInt(ageInput.trim(), 10);
      if (ageInput.trim() === "" || Number.isNaN(a)) {
        setStepError("Please enter your age");
        return;
      }
      if (a < 1 || a > 120) {
        setStepError("Please enter an age between 1 and 120");
        return;
      }
      setAge(a);
    }

    if (!isEditTimes && activeStep === 7) {
      if (!canProceedScreenTime()) return;
    }

    if (!isEditTimes && activeStep === 8) {
      if (!commitSelectApps(familyActivitySelection)) return;
    }

    if (activeStep === 9) {
      if (!focusSchedules.length) {
        setScheduleError("Please select at least one focus time.");
        return;
      }
      if (Platform.OS === "ios") {
        try {
          updateShield(
            DEFAULT_SHIELD_CONFIG,
            DEFAULT_SHIELD_ACTIONS,
            SCREEN_TIME.SHIELD_ID,
          );
          await applySchedules();
        } catch {}
      }
      if (!isEditTimes) {
        setOnboardingComplete(true);
        router.replace("/paywall");
      } else {
        router.back();
      }
      return;
    }

    setStepIndex((i) => Math.min(TOTAL_STEPS - 1, i + 1));
  }, [
    activeStep,
    familyActivitySelection,
    name,
    ageInput,
    focusSchedules.length,
    setAge,
    setOnboardingComplete,
    applySchedules,
    isEditTimes,
    router,
  ]);

  const showBack = isEditTimes;
  const nextLabel = isEditTimes
    ? "Save"
    : stepIndex === TOTAL_STEPS - 1
      ? "Finish"
      : stepIndex === 0
        ? "Get Started"
        : stepIndex < 3
          ? "Next"
          : "Continue";
  const title = STEP_TITLES[activeStep] ?? "";
  const subtitle = STEP_SUBTITLES[activeStep] ?? "";
  const icon = STEP_ICONS[activeStep] ?? undefined;

  const toggleReason = useCallback(
    (value: string) => {
      const set = new Set(reasonsDisconnect);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      setReasonsDisconnect(Array.from(set));
    },
    [reasonsDisconnect, setReasonsDisconnect],
  );
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
      if (!next.length) setExpandedScheduleId(null);
    },
    [setFocusSchedules],
  );

  const togglePrayer = useCallback(
    (preset: (typeof PRAYER_PRESETS)[number]) => {
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
    [expandedScheduleId, focusSchedules, selectedPrayerIds, setSchedule],
  );

  const updateSchedule = useCallback(
    (id: string, updates: Partial<FocusSchedule>) => {
      setSchedule(
        focusSchedules.map((schedule) =>
          schedule.id === id ? { ...schedule, ...updates } : schedule,
        ),
      );
    },
    [focusSchedules, setSchedule],
  );

  const removeSchedule = useCallback(
    (id: string) => {
      setSchedule(focusSchedules.filter((schedule) => schedule.id !== id));
      if (expandedScheduleId === id) setExpandedScheduleId(null);
    },
    [expandedScheduleId, focusSchedules, setSchedule],
  );

  const openTimePicker = useCallback((id: string) => {
    setTimePickerTarget(id);
    timePickerRef.current?.present();
  }, []);

  const openNewCustomTime = useCallback(() => {
    setTimePickerTarget("new");
    timePickerRef.current?.present();
  }, []);

  const handleTimePick = useCallback(
    (hour: number, minute: number) => {
      if (timePickerTarget === "new") {
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
        updateSchedule(timePickerTarget, { hour, minute });
      }
      timePickerRef.current?.dismiss();
      setTimePickerTarget(null);
    },
    [focusSchedules, setSchedule, timePickerTarget, updateSchedule],
  );

  return (
    <StepContainer
      step={isEditTimes ? 0 : stepIndex}
      totalSteps={isEditTimes ? 1 : TOTAL_STEPS}
      title={title}
      subtitle={subtitle}
      icon={icon}
      onBack={showBack ? handleBack : undefined}
      onNext={handleNext}
      nextLabel={nextLabel}
      showBack={showBack}
      hideProgress={isEditTimes}
      progressVariant={isEditTimes ? "full" : "bar"}
      nextDisabled={activeStep === 9 && focusSchedules.length === 0}
      animateCTA={!isEditTimes && stepIndex <= 2}
      ctaDelayMs={360}
      ctaKey={isEditTimes ? "edit-times" : stepIndex}
    >
      {activeStep <= 2 && (
        <View key={`intro-${activeStep}`} className="flex-1 justify-center">
          <View className="mb-6">
            <View
              className="self-start rounded-full border px-3 py-1"
              style={{
                borderColor: rgba(INTRO_STEPS[activeStep].accent, 0.4),
                backgroundColor: rgba(INTRO_STEPS[activeStep].accent, 0.12),
              }}
            >
              <Text
                className="text-xs font-sfPro-semibold tracking-widest"
                style={{ color: INTRO_STEPS[activeStep].accent }}
              >
                {INTRO_STEPS[activeStep].kicker.toUpperCase()}
              </Text>
            </View>

            <View className="mt-5">
              {renderAnimatedHeadline(
                INTRO_STEPS[activeStep].title,
                INTRO_STEPS[activeStep].highlight,
                INTRO_STEPS[activeStep].accent,
                `intro-${activeStep}`,
              )}
            </View>
          </View>
        </View>
      )}

      {activeStep === 3 && (
        <TextInputQuestion
          question="What's your name?"
          subtitle="We'd love to know how to address you"
          icon="person-outline"
          iconColor={colors.primary}
          placeholder="Your name"
          value={name}
          onChangeText={setName}
          error={stepError ?? undefined}
        />
      )}

      {activeStep === 4 && (
        <TextInputQuestion
          question="How old are you?"
          subtitle="This helps us create age-appropriate content"
          icon="person-outline"
          iconColor={colors.primary}
          placeholder="Your age"
          value={ageInput}
          onChangeText={setAgeInput}
          keyboardType="numeric"
          maxLength={3}
          unitLabel="Years"
          error={stepError ?? undefined}
        />
      )}

      {activeStep === 5 && (
        <QuestionCard
          question="How often do you read the Quran?"
          subtitle="This helps us tailor your experience"
          icon="book-outline"
          iconColor={colors.primary}
          options={QURAN_FREQUENCY_OPTIONS}
          selectedValue={quranFrequency || null}
          onSelect={setQuranFrequency}
        />
      )}

      {activeStep === 6 && (
        <QuestionCard
          question="What keeps you from staying connected with Allah?"
          subtitle="Select all that apply"
          icon="heart-dislike-outline"
          iconColor={colors.primary}
          options={REASONS_OPTIONS}
          selectedValues={reasonsDisconnect}
          onToggle={toggleReason}
          multiSelect
        />
      )}

      {activeStep === 7 && <ScreenTimeStep />}
      {activeStep === 8 && (
        <SelectAppsStep
          familyActivitySelection={familyActivitySelection}
          onSelectionChange={setFamilyActivitySelection}
        />
      )}

      {activeStep === 9 && (
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
                      onPress={() => togglePrayer(preset)}
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
                  onPress={openNewCustomTime}
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
                        onPress={() =>
                          setExpandedScheduleId(expanded ? null : schedule.id)
                        }
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
                            onPress={() => openTimePicker(schedule.id)}
                            className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
                          >
                            <View className="flex-row items-center gap-2">
                              <Ionicons
                                name="time-outline"
                                size={18}
                                color={colors.primary}
                              />
                              <Text className="font-sfPro text-foreground">
                                Time
                              </Text>
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
                                const isSelected =
                                  schedule.durationMinutes === mins;
                                return (
                                  <Pressable
                                    key={mins}
                                    onPress={() =>
                                      updateSchedule(schedule.id, {
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
                                        isSelected
                                          ? "text-foreground"
                                          : "text-muted"
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
                              onPress={() => removeSchedule(schedule.id)}
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
                      We’ll remind you to open QuranLock when the shield
                      appears.
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
                    onPress={() => handleTimePick(option.hour, option.minute)}
                    className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                      activeTimeValue === `${option.hour}-${option.minute}`
                        ? "border-primary bg-primary/15"
                        : "border-outline bg-surface"
                    }`}
                  >
                    <Text className="font-sfPro text-foreground">
                      {option.label}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                ))}
              </View>
              <View className="mt-4">
                <PrimaryButton
                  title="Close"
                  onPress={() => timePickerRef.current?.dismiss()}
                />
              </View>
            </View>
          </BottomSheetModal>
        </View>
      )}
    </StepContainer>
  );
}
