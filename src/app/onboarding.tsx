import { OnboardingStepContent, StepContainer } from "@/components/onboarding";
import { REVIEW_STEP } from "@/configs/onboarding";
import { useOnboarding } from "@/hooks/onboarding/useOnboarding";
import { Stack } from "expo-router";

export default function Onboarding() {
  const onboarding = useOnboarding();

  return (
    <>
      <Stack.Screen options={{ animation: "fade" }} />
      <StepContainer
        step={onboarding.step}
        totalSteps={onboarding.totalSteps}
        title={onboarding.title}
        subtitle={onboarding.subtitle}
        icon={onboarding.icon}
        onBack={onboarding.showBack ? onboarding.onBack : undefined}
        onNext={onboarding.onNext}
        nextLabel={onboarding.nextLabel}
        showBack={onboarding.showBack}
        hideProgress={onboarding.hideProgress}
        headerAlign={onboarding.headerAlign}
        progressVariant={onboarding.progressVariant}
        nextDisabled={onboarding.nextDisabled}
        animateCTA={onboarding.animateCTA}
        ctaDelayMs={onboarding.ctaDelayMs}
        ctaKey={onboarding.ctaKey}
        animateTitleWords={onboarding.animateTitleWords}
        titleHighlightWords={onboarding.titleHighlightWords}
        hideNextButton={
          !onboarding.isEditTimes && onboarding.activeStep === REVIEW_STEP
        }
      >
        <OnboardingStepContent onboarding={onboarding} />
      </StepContainer>
    </>
  );
}
