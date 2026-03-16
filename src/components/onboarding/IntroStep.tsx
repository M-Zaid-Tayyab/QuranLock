import { AnimatedTypingText } from "@/components/common";
import { colors, rgba } from "@/constants/colors";
import { INTRO_STEPS } from "@/configs/onboarding";
import { useFunnelText } from "@/hooks/app";
import { Text, View } from "react-native";

interface IntroStepProps {
  step: number;
}

export function IntroStep({ step }: IntroStepProps) {
  const funnelText = useFunnelText();
  const currentStep = INTRO_STEPS[step];
  if (!currentStep) return null;
  const overrideTitle = funnelText.onboarding.introTitles[step];
  const title = overrideTitle ?? currentStep.title;

  return (
    <View key={`intro-${step}`} className="flex-1 justify-center">
      <View className="mb-6">
        <View
          className="self-start rounded-full border px-3 py-1"
          style={{
            borderColor: rgba(currentStep.accent, 0.4),
            backgroundColor: rgba(currentStep.accent, 0.12),
          }}
        >
          <Text
            className="text-xs font-sfPro-semibold tracking-widest"
            style={{ color: currentStep.accent }}
          >
            {currentStep.kicker.toUpperCase()}
          </Text>
        </View>

        <View className="mt-5">
          <AnimatedTypingText
            text={title}
            highlightedWords={currentStep.highlight.split(" ")}
            defaultColor={colors.foreground}
            highlightColor={currentStep.accent}
            containerClassName="max-w-[320px]"
            textClassName="text-4xl font-sfPro-bold leading-tight"
            textStyle={{ letterSpacing: 0.6 }}
            charDelayMs={42}
            durationMs={120}
            enableWordHaptics
            keyPrefix={`intro-${step}`}
          />
        </View>
      </View>
    </View>
  );
}
