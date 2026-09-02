import { getTypingAnimationDuration } from "@/components/common";
import {
  ACQUISITION_SOURCE_STEP,
  CONTACT_STEP,
  FOCUS_TIMES_STEP,
  INTRO_STEPS,
  ONBOARDING_CONTACT_BUTTON_COUNT,
  ONBOARDING_CONTACT_BUTTON_ENTER_DURATION_MS,
  ONBOARDING_CONTACT_BUTTON_STAGGER_MS,
  ONBOARDING_CONTACT_CTA_GAP_MS,
  ONBOARDING_CONTACT_MESSAGE,
  ONBOARDING_CONTACT_TYPING_OPTIONS,
  REVIEW_STEP,
  SCREEN_TIME_STEP,
  SELECT_APPS_STEP,
  STEP_ICONS,
  STEP_SUBTITLES,
  STEP_TITLES,
  TOTAL_STEPS,
} from "@/configs/onboarding";
import { useFunnelText } from "@/hooks/app";
import { useFocusTimes, type UseFocusTimesResult } from "@/hooks/focus";
import { canProceedScreenTime } from "@/components/onboarding/ScreenTimeStep";
import { commitSelectApps } from "@/components/onboarding/SelectAppsStep";
import {
  getAuthStatus,
  getStableAuthStatus,
  requestAuthorization,
} from "@/services/deviceActivity";
import { ensureCanEditFocusTimes } from "@/services/entitlements";
import { useUserStore } from "@/store/user";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import { useShallow } from "zustand/react/shallow";

const AuthorizationStatus = {
  notDetermined: 0,
  denied: 1,
  approved: 2,
} as const;
type NotificationPermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | null;

export interface UseOnboardingResult {
  activeStep: number;
  ageInput: string;
  animateCTA: boolean;
  ctaDelayMs: number;
  ctaKey: string | number;
  animateTitleWords: boolean;
  nameInput: string;
  blockAllApps: boolean;
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
  focusTimes: UseFocusTimesResult;
  onBack: () => void;
  onNext: () => Promise<void>;
  onScreenTimeAuthorizationChange: (approved: boolean) => void;
  onScreenTimeAuthorizationStatusChange: (status: number) => void;
  onNotificationPermissionChange: (approved: boolean) => void;
  onNotificationPermissionStatusChange: (
    status: NotificationPermissionStatus,
  ) => void;
  onSetNameInput: (value: string) => void;
  onSetAgeInput: (value: string) => void;
  onBlockAllAppsChange: (blockAllApps: boolean) => void;
  onSetFamilyActivitySelection: (selection: string | null) => void;
}

export function useOnboarding(): UseOnboardingResult {
  const funnelText = useFunnelText();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; from?: string }>();

  const {
    name,
    setName,
    age,
    setAge,
    quranFrequency,
    reasonsDisconnect,
    acquisitionSource,
    blockAllApps,
    familyActivitySelection,
    isPremium,
    setOnboardingComplete,
  } = useUserStore(
    useShallow((s) => ({
      name: s.name,
      setName: s.setName,
      age: s.age,
      setAge: s.setAge,
      quranFrequency: s.quranFrequency,
      reasonsDisconnect: s.reasonsDisconnect,
      acquisitionSource: s.acquisitionSource,
      blockAllApps: s.blockAllApps,
      familyActivitySelection: s.familyActivitySelection,
      isPremium: s.isPremium,
      setOnboardingComplete: s.setOnboardingComplete,
    })),
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(() => name);
  const [ageInput, setAgeInput] = useState(() =>
    age != null ? String(age) : "",
  );
  const [familyActivitySelectionDraft, setFamilyActivitySelectionDraft] =
    useState<string | null>(() => familyActivitySelection);
  const [blockAllAppsDraft, setBlockAllAppsDraft] = useState(
    () => familyActivitySelection == null || blockAllApps,
  );
  const [screenTimeApproved, setScreenTimeApproved] = useState(() =>
    canProceedScreenTime(),
  );
  const [screenTimeStatus, setScreenTimeStatus] = useState<number>(() =>
    Platform.OS === "ios" ? getAuthStatus() : AuthorizationStatus.approved,
  );
  const [screenTimeResolving, setScreenTimeResolving] = useState(false);
  const [notificationApproved, setNotificationApproved] = useState(
    () => Platform.OS !== "ios",
  );
  const [notificationStatus, setNotificationStatus] =
    useState<NotificationPermissionStatus>(null);
  const [notificationResolving, setNotificationResolving] = useState(false);
  const [hasAttemptedScheduleSubmit, setHasAttemptedScheduleSubmit] =
    useState(false);

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const isEditTimes = modeParam === "edit-times";
  const activeStep = isEditTimes ? FOCUS_TIMES_STEP : stepIndex;

  useEffect(() => {
    setNameInput(name);
  }, [name]);

  useEffect(() => {
    setFamilyActivitySelectionDraft(familyActivitySelection);
  }, [familyActivitySelection]);

  useEffect(() => {
    if (familyActivitySelection != null || blockAllApps) {
      setBlockAllAppsDraft(blockAllApps);
    }
  }, [blockAllApps, familyActivitySelection]);

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

  const onScreenTimeAuthorizationStatusChange = useCallback(
    (status: number) => {
      setScreenTimeStatus(status);
      setScreenTimeApproved(status === AuthorizationStatus.approved);
    },
    [],
  );

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

  const focusTimes = useFocusTimes({
    isEditTimes,
    isActive: activeStep === FOCUS_TIMES_STEP,
    onNotificationPermissionChange,
    onNotificationPermissionStatusChange,
  });

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
    ensureCanEditFocusTimes(router, { isPremium }, { replace: true });
  }, [isEditTimes, isPremium, router]);

  useEffect(() => {
    if (
      isEditTimes ||
      activeStep !== SCREEN_TIME_STEP ||
      !screenTimeApproved
    ) {
      return;
    }
    setStepError(null);
    setStepIndex((current) =>
      current === SCREEN_TIME_STEP ? SELECT_APPS_STEP : current,
    );
  }, [activeStep, isEditTimes, screenTimeApproved]);

  const onNext = useCallback(async () => {
    setStepError(null);
    if (activeStep !== FOCUS_TIMES_STEP) {
      setHasAttemptedScheduleSubmit(false);
    }

    if (!isEditTimes && activeStep === 3) {
      const trimmedInput = nameInput.trim();
      if (!trimmedInput) {
        setStepError("Please enter your name");
        return;
      }
      if (trimmedInput !== name) {
        setName(trimmedInput);
      }
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

    if (
      !isEditTimes &&
      activeStep === SCREEN_TIME_STEP &&
      Platform.OS === "ios"
    ) {
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
      activeStep === SELECT_APPS_STEP &&
      Platform.OS === "ios" &&
      !commitSelectApps(familyActivitySelectionDraft, blockAllAppsDraft)
    ) {
      return;
    }

    if (activeStep === FOCUS_TIMES_STEP) {
      if (!isEditTimes && Platform.OS === "ios" && !notificationApproved) {
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

      if (!focusTimes.focusSchedules.length) {
        setHasAttemptedScheduleSubmit(true);
        return;
      }

      setHasAttemptedScheduleSubmit(false);
      focusTimes.commitDraftToStore();
      if (!isEditTimes) {
        setStepIndex(CONTACT_STEP);
      } else {
        router.back();
      }
      return;
    }

    if (!isEditTimes && activeStep === CONTACT_STEP) {
      setStepIndex(REVIEW_STEP);
      return;
    }

    if (!isEditTimes && activeStep === REVIEW_STEP) {
      setOnboardingComplete(true);
      router.replace({
        pathname: "/paywall",
        params: { entry: "onboarding" },
      });
      return;
    }

    setStepIndex((i) =>
      i === activeStep ? Math.min(TOTAL_STEPS - 1, i + 1) : i,
    );
  }, [
    activeStep,
    ageInput,
    blockAllAppsDraft,
    familyActivitySelectionDraft,
    focusTimes,
    isEditTimes,
    mapNotificationStatus,
    name,
    nameInput,
    notificationApproved,
    router,
    screenTimeApproved,
    setName,
    setAge,
    setOnboardingComplete,
  ]);

  const trimmedName = nameInput.trim();
  const parsedAge = parseInt(ageInput.trim(), 10);
  const isAgeValid =
    ageInput.trim() !== "" &&
    !Number.isNaN(parsedAge) &&
    parsedAge >= 1 &&
    parsedAge <= 120;
  const hasSelectedApps =
    Platform.OS !== "ios" ||
    familyActivitySelectionDraft != null ||
    blockAllAppsDraft;

  const nextDisabled = (() => {
    if (activeStep === 3) return trimmedName.length === 0;
    if (activeStep === 4) return !isAgeValid;
    if (activeStep === 5) return !quranFrequency;
    if (activeStep === 6) return reasonsDisconnect.length === 0;
    if (activeStep === ACQUISITION_SOURCE_STEP) return !acquisitionSource;
    if (activeStep === SCREEN_TIME_STEP) return screenTimeResolving;
    if (activeStep === SELECT_APPS_STEP) return !hasSelectedApps;
    if (activeStep === FOCUS_TIMES_STEP) {
      return notificationResolving;
    }
    return false;
  })();

  const nextLabel = (() => {
    if (isEditTimes) return "Save";
    if (
      activeStep === SCREEN_TIME_STEP &&
      Platform.OS === "ios" &&
      screenTimeStatus === AuthorizationStatus.notDetermined
    ) {
      return "Checking...";
    }
    if (
      activeStep === SCREEN_TIME_STEP &&
      Platform.OS === "ios" &&
      !screenTimeApproved
    ) {
      return screenTimeResolving ? "Checking..." : "Give Access";
    }
    if (
      activeStep === FOCUS_TIMES_STEP &&
      Platform.OS === "ios" &&
      !notificationApproved
    ) {
      if (notificationResolving) return "Checking...";
      return notificationStatus === "denied" ? "Open Settings" : "Give Access";
    }
    if (stepIndex === 0) return "Continue";
    if (stepIndex < 3) return "Continue";
    return "Continue";
  })();

  const title = STEP_TITLES[activeStep] ?? "";
  const subtitle =
    funnelText.onboarding.stepSubtitles[activeStep] ??
    STEP_SUBTITLES[activeStep] ??
    "";
  const introTitle =
    stepIndex > 2
      ? ""
      : (funnelText.onboarding.introTitles[stepIndex] ??
        INTRO_STEPS[stepIndex]?.title ??
        "");
  const introCtaDelayMs = introTitle
    ? getTypingAnimationDuration(introTitle, {
        charDelayMs: 42,
        durationMs: 120,
        endDelayMs: 140,
      })
    : 360;
  const contactCtaDelayMs =
    getTypingAnimationDuration(
      ONBOARDING_CONTACT_MESSAGE,
      ONBOARDING_CONTACT_TYPING_OPTIONS,
    ) +
    (ONBOARDING_CONTACT_BUTTON_COUNT - 1) *
      ONBOARDING_CONTACT_BUTTON_STAGGER_MS +
    ONBOARDING_CONTACT_BUTTON_ENTER_DURATION_MS +
    ONBOARDING_CONTACT_CTA_GAP_MS;
  const icon = STEP_ICONS[activeStep] ?? undefined;
  const scheduleError =
    hasAttemptedScheduleSubmit && focusTimes.focusSchedules.length === 0
      ? "Please select at least one focus time."
      : null;
  const isReviewStep = !isEditTimes && activeStep === REVIEW_STEP;
  const isContactStep = !isEditTimes && activeStep === CONTACT_STEP;

  return {
    activeStep,
    ageInput,
    animateCTA: !isEditTimes && (stepIndex <= 2 || isContactStep),
    animateTitleWords: isReviewStep,
    blockAllApps: blockAllAppsDraft,
    ctaDelayMs: isContactStep ? contactCtaDelayMs : introCtaDelayMs,
    ctaKey: isEditTimes ? "edit-times" : stepIndex,
    familyActivitySelection: familyActivitySelectionDraft,
    hideProgress: isEditTimes,
    headerAlign: isReviewStep || isContactStep ? "center" : "left",
    icon,
    isEditTimes,
    nameInput,
    nextDisabled,
    nextLabel,
    onBack,
    onBlockAllAppsChange: setBlockAllAppsDraft,
    onNext,
    onNotificationPermissionChange,
    onNotificationPermissionStatusChange,
    onScreenTimeAuthorizationChange,
    onScreenTimeAuthorizationStatusChange,
    onSetNameInput: setNameInput,
    onSetAgeInput: setAgeInput,
    onSetFamilyActivitySelection: setFamilyActivitySelectionDraft,
    progressVariant: isEditTimes ? "full" : "bar",
    scheduleError,
    showBack: isEditTimes,
    step: isEditTimes ? 0 : Math.min(stepIndex, TOTAL_STEPS - 1),
    stepError,
    titleHighlightWords: isReviewStep ? ["ummah", "quran"] : [],
    subtitle,
    title,
    totalSteps: isEditTimes ? 1 : TOTAL_STEPS,
    focusTimes,
  };
}
