import { colors } from "@/constants/colors";
import {
  QURAN_FREQUENCY_OPTIONS,
  REASONS_OPTIONS,
} from "@/configs/onboarding";
import { useFunnelText } from "@/hooks/app";
import type { UseOnboardingResult } from "@/hooks/onboarding/useOnboarding";
import { useUserStore } from "@/store/user";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { FocusTimesStep } from "./FocusTimesStep";
import { IntroStep } from "./IntroStep";
import { QuestionCard } from "./QuestionCard";
import { ReviewsStep } from "./ReviewsStep";
import { ScreenTimeStep } from "./ScreenTimeStep";
import { SelectAppsStep } from "./SelectAppsStep";
import { TextInputQuestion } from "./TextInputQuestion";

interface OnboardingStepContentProps {
  onboarding: UseOnboardingResult;
}

function QuranFrequencyQuestion() {
  const funnelText = useFunnelText();
  const { quranFrequency, setQuranFrequency } = useUserStore(
    useShallow((s) => ({
      quranFrequency: s.quranFrequency,
      setQuranFrequency: s.setQuranFrequency,
    })),
  );

  return (
    <QuestionCard
      question={funnelText.onboarding.quranFrequencyQuestion}
      subtitle={funnelText.onboarding.quranFrequencySubtitle}
      icon="book-outline"
      iconColor={colors.primary}
      options={QURAN_FREQUENCY_OPTIONS}
      selectedValue={quranFrequency || null}
      onSelect={setQuranFrequency}
    />
  );
}

function ReasonsQuestion() {
  const funnelText = useFunnelText();
  const { reasonsDisconnect, setReasonsDisconnect } = useUserStore(
    useShallow((s) => ({
      reasonsDisconnect: s.reasonsDisconnect,
      setReasonsDisconnect: s.setReasonsDisconnect,
    })),
  );

  const onToggleReason = useCallback(
    (value: string) => {
      const next = new Set(reasonsDisconnect);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      setReasonsDisconnect(Array.from(next));
    },
    [reasonsDisconnect, setReasonsDisconnect],
  );

  return (
    <QuestionCard
      question={funnelText.onboarding.reasonsQuestion}
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

export function OnboardingStepContent({
  onboarding,
}: OnboardingStepContentProps) {
  if (onboarding.activeStep <= 2) {
    return <IntroStep step={onboarding.activeStep} />;
  }

  if (onboarding.activeStep === 3) {
    return (
      <TextInputQuestion
        key="name-input"
        question="What's your name?"
        subtitle="We'd love to know how to address you"
        icon="person-outline"
        iconColor={colors.primary}
        placeholder="Your name"
        value={onboarding.nameInput}
        onChangeText={onboarding.onSetNameInput}
        error={onboarding.stepError ?? undefined}
        autoFocus
      />
    );
  }

  if (onboarding.activeStep === 4) {
    return (
      <TextInputQuestion
        key="age-input"
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
        autoFocus
      />
    );
  }

  if (onboarding.activeStep === 5) {
    return <QuranFrequencyQuestion />;
  }

  if (onboarding.activeStep === 6) {
    return <ReasonsQuestion />;
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
        onSelectionDone={() => {
          void onboarding.onNext();
        }}
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

  if (onboarding.activeStep === 10) {
    return <ReviewsStep onContinue={onboarding.onNext} />;
  }

  return null;
}
