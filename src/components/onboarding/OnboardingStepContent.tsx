import { colors } from "@/constants/colors";
import {
  QURAN_FREQUENCY_OPTIONS,
  REASONS_OPTIONS,
} from "@/configs/onboarding";
import type { UseOnboardingResult } from "@/hooks/onboarding/useOnboarding";
import { useUserStore } from "@/store/user";
import { useCallback } from "react";
import { FocusTimesStep } from "./FocusTimesStep";
import { IntroStep } from "./IntroStep";
import { QuestionCard } from "./QuestionCard";
import { ScreenTimeStep } from "./ScreenTimeStep";
import { SelectAppsStep } from "./SelectAppsStep";
import { TextInputQuestion } from "./TextInputQuestion";

interface OnboardingStepContentProps {
  onboarding: UseOnboardingResult;
}

export function OnboardingStepContent({
  onboarding,
}: OnboardingStepContentProps) {
  const name = useUserStore((s) => s.name);
  const setName = useUserStore((s) => s.setName);
  const quranFrequency = useUserStore((s) => s.quranFrequency);
  const setQuranFrequency = useUserStore((s) => s.setQuranFrequency);
  const reasonsDisconnect = useUserStore((s) => s.reasonsDisconnect);
  const setReasonsDisconnect = useUserStore((s) => s.setReasonsDisconnect);

  const onToggleReason = useCallback(
    (value: string) => {
      const set = new Set(reasonsDisconnect);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      setReasonsDisconnect(Array.from(set));
    },
    [reasonsDisconnect, setReasonsDisconnect],
  );

  if (onboarding.activeStep <= 2) {
    return <IntroStep step={onboarding.activeStep} />;
  }

  if (onboarding.activeStep === 3) {
    return (
      <TextInputQuestion
        question="What's your name?"
        subtitle="We'd love to know how to address you"
        icon="person-outline"
        iconColor={colors.primary}
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        error={onboarding.stepError ?? undefined}
      />
    );
  }

  if (onboarding.activeStep === 4) {
    return (
      <TextInputQuestion
        question="How old are you?"
        subtitle="This helps us create age-appropriate content"
        icon="person-outline"
        iconColor={colors.primary}
        placeholder="Your age"
        value={onboarding.ageInput}
        onChangeText={onboarding.onSetAgeInput}
        keyboardType="numeric"
        maxLength={3}
        unitLabel="Years"
        error={onboarding.stepError ?? undefined}
      />
    );
  }

  if (onboarding.activeStep === 5) {
    return (
      <QuestionCard
        question="How often do you read the Quran?"
        subtitle="This helps us tailor your experience"
        icon="book-outline"
        iconColor={colors.primary}
        options={QURAN_FREQUENCY_OPTIONS}
        selectedValue={quranFrequency || null}
        onSelect={setQuranFrequency}
      />
    );
  }

  if (onboarding.activeStep === 6) {
    return (
      <QuestionCard
        question="What keeps you from staying connected with Allah?"
        subtitle="Select all that apply"
        icon="heart-dislike-outline"
        iconColor={colors.primary}
        options={REASONS_OPTIONS}
        selectedValues={reasonsDisconnect}
        onToggle={onToggleReason}
        multiSelect
      />
    );
  }

  if (onboarding.activeStep === 7) {
    return (
      <ScreenTimeStep
        onAuthorizationChange={onboarding.onScreenTimeAuthorizationChange}
        onAuthorizationStatusChange={
          onboarding.onScreenTimeAuthorizationStatusChange
        }
      />
    );
  }

  if (onboarding.activeStep === 8) {
    return (
      <SelectAppsStep
        familyActivitySelection={onboarding.familyActivitySelection}
        onSelectionChange={onboarding.onSetFamilyActivitySelection}
      />
    );
  }

  if (onboarding.activeStep === 9) {
    return (
      <FocusTimesStep
        isEditTimes={onboarding.isEditTimes}
        scheduleError={onboarding.scheduleError}
        onNotificationPermissionChange={
          onboarding.onNotificationPermissionChange
        }
        onNotificationPermissionStatusChange={
          onboarding.onNotificationPermissionStatusChange
        }
      />
    );
  }

  return null;
}
