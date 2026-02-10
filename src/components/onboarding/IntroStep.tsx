import { colors, rgba } from "@/constants/colors";
import { INTRO_STEPS } from "@/configs/onboarding";
import { Text, View } from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";

interface IntroStepProps {
  step: number;
}

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

export function IntroStep({ step }: IntroStepProps) {
  const currentStep = INTRO_STEPS[step];
  if (!currentStep) return null;

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
          {renderAnimatedHeadline(
            currentStep.title,
            currentStep.highlight,
            currentStep.accent,
            `intro-${step}`,
          )}
        </View>
      </View>
    </View>
  );
}
