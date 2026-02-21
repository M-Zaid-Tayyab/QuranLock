import {
  REVIEW_STEP,
  STEP_ICONS,
  STEP_SUBTITLES,
  STEP_TITLES,
  TOTAL_STEPS,
} from "@/configs/onboarding";
import { useFunnelText } from "@/hooks/app";
import { canProceedScreenTime } from "@/components/onboarding/ScreenTimeStep";
import { commitSelectApps } from "@/components/onboarding/SelectAppsStep";
import {
  getAuthStatus,
  getStableAuthStatus,
  requestAuthorization,
} from "@/services/deviceActivity";
import { ensureCanEditFocusTimes } from "@/services/entitlements";
import { useBlockingStore } from "@/store/blocking";
import { useUserStore, type FocusSchedule } from "@/store/user";
import { resolveFocusSchedulesByEntitlement } from "@/utils/focusScheduleEntitlement";
import { applyFocusSchedulesToDevice } from "@/utils/focusScheduleRuntime";
import * as Notifications from "expo-notifications";
import * as StoreReview from "expo-store-review";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
import { useShallow } from "zustand/react/shallow";

const AuthorizationStatus = { notDetermined: 0, denied: 1, approved: 2 } as const;
type NotificationPermissionStatus = "granted" | "denied" | "undetermined" | null;

export interface UseOnboardingResult {
  activeStep: number;
  ageInput: string;
  animateCTA: boolean;
  ctaDelayMs: number;
  ctaKey: string | number;
  animateTitleWords: boolean;
  familyActivitySelection: string | null;
  hideProgress: boolean;
  headerAlign: "left" | "center";
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
  titleHighlightWords: string[];
  totalSteps: number;
  onBack: () => void;
  onNext: () => Promise<void>;
  onScreenTimeAuthorizationChange: (approved: boolean) => void;
  onScreenTimeAuthorizationStatusChange: (status: number) => void;
  onNotificationPermissionChange: (approved: boolean) => void;
  onNotificationPermissionStatusChange: (status: NotificationPermissionStatus) => void;
  onSetAgeInput: (value: string) => void;
  onSetFamilyActivitySelection: (selection: string | null) => void;
}

export function useOnboarding(): UseOnboardingResult {
  const funnelText = useFunnelText();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();

  const {
    name,
    age,
    setAge,
    quranFrequency,
    reasonsDisconnect,
    focusSchedules,
    setFocusSchedules,
    setDeferredFocusSchedules,
    familyActivitySelection,
    setFamilyActivitySelection,
    isPremium,
    setOnboardingComplete,
  } = useUserStore(
    useShallow((s) => ({
      name: s.name,
      age: s.age,
      setAge: s.setAge,
      quranFrequency: s.quranFrequency,
      reasonsDisconnect: s.reasonsDisconnect,
      focusSchedules: s.focusSchedules,
      setFocusSchedules: s.setFocusSchedules,
      setDeferredFocusSchedules: s.setDeferredFocusSchedules,
      familyActivitySelection: s.familyActivitySelection,
      setFamilyActivitySelection: s.setFamilyActivitySelection,
      isPremium: s.isPremium,
      setOnboardingComplete: s.setOnboardingComplete,
    })),
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [ageInput, setAgeInput] = useState(() =>
    age != null ? String(age) : "",
  );
  const [screenTimeApproved, setScreenTimeApproved] = useState(() =>
    canProceedScreenTime(),
  );
  const [, setScreenTimeStatus] = useState<number>(() =>
    Platform.OS === "ios" ? getAuthStatus() : AuthorizationStatus.approved,
  );
  const [screenTimeResolving, setScreenTimeResolving] = useState(false);
  const [notificationApproved, setNotificationApproved] = useState(() =>
    Platform.OS !== "ios",
  );
  const [notificationStatus, setNotificationStatus] =
    useState<NotificationPermissionStatus>(null);
  const [notificationResolving, setNotificationResolving] = useState(false);
  const [hasAttemptedScheduleSubmit, setHasAttemptedScheduleSubmit] =
    useState(false);
  const [hasRequestedReview, setHasRequestedReview] = useState(false);

  const { setQuranMinutesToUnblock } = useBlockingStore(
    useShallow((s) => ({
      setQuranMinutesToUnblock: s.setQuranMinutesToUnblock,
    })),
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

  const onScreenTimeAuthorizationStatusChange = useCallback((status: number) => {
    setScreenTimeStatus(status);
    setScreenTimeApproved(status === AuthorizationStatus.approved);
  }, []);

  const onNotificationPermissionChange = useCallback((approved: boolean) => {
    setNotificationApproved(approved);
  }, []);

  const onNotificationPermissionStatusChange = useCallback(
    (status: NotificationPermissionStatus) => {
      setNotificationStatus(status);
      if (status != null) {
        setNotificationApproved(status === "granted");
      }
    },
    [],
  );

  const mapNotificationStatus = useCallback(
    (
      status: Notifications.PermissionStatus,
    ): Exclude<NotificationPermissionStatus, null> =>
      status === "granted"
        ? "granted"
        : status === "denied"
          ? "denied"
          : "undetermined",
    [],
  );

  useEffect(() => {
    if (!isEditTimes) return;
    ensureCanEditFocusTimes(
      router,
      { isPremium },
      { replace: true },
    );
  }, [isEditTimes, isPremium, router]);

  const applySchedules = useCallback(async (schedules: FocusSchedule[]) => {
    if (!schedules.length) return;
    await applyFocusSchedulesToDevice({
      previousSchedules: previousSchedulesRef.current,
      nextSchedules: schedules,
      setQuranMinutesToUnblock,
    });
    previousSchedulesRef.current = schedules;
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

    if (!isEditTimes && activeStep === 7 && Platform.OS === "ios") {
      if (!screenTimeApproved) {
        setScreenTimeResolving(true);
        try {
          await requestAuthorization();
          const nextStatus = await getStableAuthStatus();
          setScreenTimeStatus(nextStatus);
          const approved = nextStatus === AuthorizationStatus.approved;
          setScreenTimeApproved(approved);
          if (!approved) return;
        } catch {
          setScreenTimeStatus(getAuthStatus());
          setScreenTimeApproved(false);
          return;
        } finally {
          setScreenTimeResolving(false);
        }
      }
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
      if (
        !isEditTimes &&
        Platform.OS === "ios" &&
        !notificationApproved
      ) {
        setNotificationResolving(true);
        try {
          const { status: current } = await Notifications.getPermissionsAsync();
          const currentMapped = mapNotificationStatus(current);
          setNotificationStatus(currentMapped);
          if (currentMapped === "denied") {
            Linking.openSettings().catch(() => {});
            return;
          }

          const { status: requested } =
            await Notifications.requestPermissionsAsync();
          const requestedMapped = mapNotificationStatus(requested);
          const approved = requestedMapped === "granted";
          setNotificationStatus(requestedMapped);
          setNotificationApproved(approved);
          if (!approved) return;
        } catch {
          return;
        } finally {
          setNotificationResolving(false);
        }
      }

      if (!focusSchedules.length) {
        setHasAttemptedScheduleSubmit(true);
        return;
      }

      setHasAttemptedScheduleSubmit(false);
      const selectedSchedules = useUserStore.getState().focusSchedules;
      let schedulesToActivate = selectedSchedules;

      if (!isEditTimes) {
        const resolved = resolveFocusSchedulesByEntitlement({
          isPremium,
          activeSchedules: selectedSchedules,
          deferredSchedules: [],
        });
        schedulesToActivate = resolved.activeSchedules;
        setFocusSchedules(resolved.activeSchedules);
        setDeferredFocusSchedules(resolved.deferredSchedules);
      }

      try {
        await applySchedules(schedulesToActivate);
      } catch {}

      if (!isEditTimes) {
        setStepIndex(REVIEW_STEP);
      } else {
        router.back();
      }
      return;
    }

    if (!isEditTimes && activeStep === REVIEW_STEP) {
      if (!hasRequestedReview) {
        setHasRequestedReview(true);
        try {
          const isReviewAvailable = await StoreReview.isAvailableAsync();
          if (isReviewAvailable) {
            await StoreReview.requestReview();
          }
        } catch {}
        return;
      }

      setOnboardingComplete(true);
      router.replace({
        pathname: "/paywall",
        params: { entry: "onboarding" },
      });
      return;
    }

    setStepIndex((i) => Math.min(TOTAL_STEPS - 1, i + 1));
  }, [
    activeStep,
    ageInput,
    applySchedules,
    familyActivitySelection,
    focusSchedules.length,
    hasRequestedReview,
    isEditTimes,
    isPremium,
    mapNotificationStatus,
    name,
    notificationApproved,
    router,
    screenTimeApproved,
    setAge,
    setDeferredFocusSchedules,
    setFocusSchedules,
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
    if (activeStep === 7) return screenTimeResolving;
    if (activeStep === 8) return !hasSelectedApps;
    if (activeStep === 9) {
      return focusSchedules.length === 0 || notificationResolving;
    }
    return false;
  })();

  const nextLabel = (() => {
    if (isEditTimes) return "Save";
    if (activeStep === 7 && Platform.OS === "ios" && !screenTimeApproved) {
      return screenTimeResolving ? "Checking..." : "Give Access";
    }
    if (activeStep === 9 && Platform.OS === "ios" && !notificationApproved) {
      if (notificationResolving) return "Checking...";
      return notificationStatus === "denied" ? "Open Settings" : "Give Access";
    }
    if (stepIndex === 0) return "Get Started";
    if (stepIndex < 3) return "Next";
    return "Continue";
  })();

  const title = STEP_TITLES[activeStep] ?? "";
  const subtitle =
    funnelText.onboarding.stepSubtitles[activeStep] ??
    STEP_SUBTITLES[activeStep] ??
    "";
  const icon = STEP_ICONS[activeStep] ?? undefined;
  const scheduleError =
    hasAttemptedScheduleSubmit && focusSchedules.length === 0
      ? "Please select at least one focus time."
      : null;
  const isReviewStep = !isEditTimes && activeStep === REVIEW_STEP;

  return {
    activeStep,
    ageInput,
    animateCTA: !isEditTimes && stepIndex <= 2,
    animateTitleWords: isReviewStep,
    ctaDelayMs: 360,
    ctaKey: isEditTimes ? "edit-times" : stepIndex,
    familyActivitySelection,
    hideProgress: isEditTimes,
    headerAlign: isReviewStep ? "center" : "left",
    icon,
    isEditTimes,
    nextDisabled,
    nextLabel,
    onBack,
    onNext,
    onNotificationPermissionChange,
    onNotificationPermissionStatusChange,
    onScreenTimeAuthorizationChange,
    onScreenTimeAuthorizationStatusChange,
    onSetAgeInput: setAgeInput,
    onSetFamilyActivitySelection: setFamilyActivitySelection,
    progressVariant: isEditTimes ? "full" : "bar",
    scheduleError,
    showBack: isEditTimes,
    step: isEditTimes ? 0 : Math.min(stepIndex, TOTAL_STEPS - 1),
    stepError,
    titleHighlightWords: isReviewStep ? ["ummah", "quran"] : [],
    subtitle,
    title,
    totalSteps: isEditTimes ? 1 : TOTAL_STEPS,
  };
}
