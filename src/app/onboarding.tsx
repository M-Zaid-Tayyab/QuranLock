import { OnboardingStepContent, StepContainer } from "@/components/onboarding";
import { useOnboarding } from "@/hooks/onboarding/useOnboarding";

export default function Onboarding() {
  const onboarding = useOnboarding();

  return (
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
      progressVariant={onboarding.progressVariant}
      nextDisabled={onboarding.nextDisabled}
      animateCTA={onboarding.animateCTA}
      ctaDelayMs={onboarding.ctaDelayMs}
      ctaKey={onboarding.ctaKey}
    >
      <OnboardingStepContent onboarding={onboarding} />
    </StepContainer>
  );
}
