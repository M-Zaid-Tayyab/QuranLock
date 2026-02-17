import {
  STEP_ICONS,
  STEP_SUBTITLES,
  STEP_TITLES,
  TOTAL_STEPS,
  getNextDuration,
} from "@/configs/onboarding";
import { canProceedScreenTime } from "@/components/onboarding/ScreenTimeStep";
import { commitSelectApps } from "@/components/onboarding/SelectAppsStep";
import { SCREEN_TIME } from "@/constants/screenTime";
import {
  DEFAULT_SHIELD_ACTIONS,
  DEFAULT_SHIELD_CONFIG,
  configureBlockOnly,
  startDailyBlockScheduleFor,
  stopMonitoring,
  updateShield,
} from "@/services/deviceActivity";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore, type FocusSchedule } from "@/store/user";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

export interface UseOnboardingResult {
  activeStep: number;
  ageInput: string;
  animateCTA: boolean;
  ctaDelayMs: number;
  ctaKey: string | number;
  familyActivitySelection: string | null;
  hideProgress: boolean;
  icon?: string;
  isEditTimes: boolean;
  nextDisabled: boolean;
  nextLabel: string;
  progressVariant: "full" | "bar";
  scheduleError: string | null;
  showBack: boolean;
  step: number;
  stepError: string | null;
  subtitle: string;
  title: string;
  totalSteps: number;
  onBack: () => void;
  onNext: () => Promise<void>;
  onScreenTimeAuthorizationChange: (approved: boolean) => void;
  onSetAgeInput: (value: string) => void;
  onSetFamilyActivitySelection: (selection: string | null) => void;
}

export function useOnboarding(): UseOnboardingResult {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();

  const name = useUserStore((s) => s.name);
  const age = useUserStore((s) => s.age);
  const setAge = useUserStore((s) => s.setAge);
  const quranFrequency = useUserStore((s) => s.quranFrequency);
  const reasonsDisconnect = useUserStore((s) => s.reasonsDisconnect);
  const focusSchedules = useUserStore((s) => s.focusSchedules);
  const setOnboardingComplete = useUserStore((s) => s.setOnboardingComplete);

  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [familyActivitySelection, setFamilyActivitySelection] = useState<
    string | null
  >(null);
  const [ageInput, setAgeInput] = useState(() =>
    age != null ? String(age) : "",
  );
  const [screenTimeApproved, setScreenTimeApproved] = useState(() =>
    canProceedScreenTime(),
  );
  const [hasAttemptedScheduleSubmit, setHasAttemptedScheduleSubmit] =
    useState(false);

  const setQuranMinutesToUnblock = useBlockingStore(
    (s) => s.setQuranMinutesToUnblock,
  );
  const previousSchedulesRef = useRef<FocusSchedule[]>(
    useUserStore.getState().focusSchedules,
  );

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isEditTimes = modeParam === "edit-times";
  const activeStep = isEditTimes ? 9 : stepIndex;

  const onBack = useCallback(() => {
    setStepError(null);
    setHasAttemptedScheduleSubmit(false);

    if (isEditTimes) {
      router.back();
      return;
    }

    setStepIndex((i) => Math.max(0, i - 1));
  }, [isEditTimes, router]);

  const onScreenTimeAuthorizationChange = useCallback((approved: boolean) => {
    setScreenTimeApproved(approved);
  }, []);

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

  const onNext = useCallback(async () => {
    setStepError(null);
    if (activeStep !== 9) setHasAttemptedScheduleSubmit(false);

    if (!isEditTimes && activeStep === 3 && !name.trim()) {
      setStepError("Please enter your name");
      return;
    }

    if (!isEditTimes && activeStep === 4) {
      const parsedAge = parseInt(ageInput.trim(), 10);
      if (ageInput.trim() === "" || Number.isNaN(parsedAge)) {
        setStepError("Please enter your age");
        return;
      }
      if (parsedAge < 1 || parsedAge > 120) {
        setStepError("Please enter an age between 1 and 120");
        return;
      }
      setAge(parsedAge);
    }

    if (!isEditTimes && activeStep === 7 && !canProceedScreenTime()) {
      return;
    }

    if (
      !isEditTimes &&
      activeStep === 8 &&
      Platform.OS === "ios" &&
      !commitSelectApps(familyActivitySelection)
    ) {
      return;
    }

    if (activeStep === 9) {
      if (!focusSchedules.length) {
        setHasAttemptedScheduleSubmit(true);
        return;
      }

      setHasAttemptedScheduleSubmit(false);

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
        router.replace({
          pathname: "/paywall",
          params: { entry: "onboarding" },
        });
      } else {
        router.back();
      }
      return;
    }

    setStepIndex((i) => Math.min(TOTAL_STEPS - 1, i + 1));
  }, [
    activeStep,
    ageInput,
    applySchedules,
    familyActivitySelection,
    focusSchedules.length,
    isEditTimes,
    name,
    router,
    setAge,
    setOnboardingComplete,
  ]);

  const trimmedName = name.trim();
  const parsedAge = parseInt(ageInput.trim(), 10);
  const isAgeValid =
    ageInput.trim() !== "" &&
    !Number.isNaN(parsedAge) &&
    parsedAge >= 1 &&
    parsedAge <= 120;
  const hasSelectedApps =
    Platform.OS !== "ios" || familyActivitySelection != null;

  const nextDisabled = (() => {
    if (activeStep === 3) return trimmedName.length === 0;
    if (activeStep === 4) return !isAgeValid;
    if (activeStep === 5) return !quranFrequency;
    if (activeStep === 6) return reasonsDisconnect.length === 0;
    if (activeStep === 7) return !screenTimeApproved;
    if (activeStep === 8) return !hasSelectedApps;
    if (activeStep === 9) return focusSchedules.length === 0;
    return false;
  })();

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
  const scheduleError =
    hasAttemptedScheduleSubmit && focusSchedules.length === 0
      ? "Please select at least one focus time."
      : null;

  return {
    activeStep,
    ageInput,
    animateCTA: !isEditTimes && stepIndex <= 2,
    ctaDelayMs: 360,
    ctaKey: isEditTimes ? "edit-times" : stepIndex,
    familyActivitySelection,
    hideProgress: isEditTimes,
    icon,
    isEditTimes,
    nextDisabled,
    nextLabel,
    onBack,
    onNext,
    onScreenTimeAuthorizationChange,
    onSetAgeInput: setAgeInput,
    onSetFamilyActivitySelection: setFamilyActivitySelection,
    progressVariant: isEditTimes ? "full" : "bar",
    scheduleError,
    showBack: isEditTimes,
    step: isEditTimes ? 0 : stepIndex,
    stepError,
    subtitle,
    title,
    totalSteps: isEditTimes ? 1 : TOTAL_STEPS,
  };
}
