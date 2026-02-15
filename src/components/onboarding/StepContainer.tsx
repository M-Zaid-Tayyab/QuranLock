import { PrimaryButton } from "@/components/common";
import { colors } from "@/constants/colors";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEffect } from "react";
import {
  Keyboard,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

interface StepContainerProps {
  step: number;
  totalSteps: number;
  title?: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  hideProgress?: boolean;
  progressVariant?: "full" | "bar";
  animateCTA?: boolean;
  ctaDelayMs?: number;
  ctaKey?: string | number;
  children: React.ReactNode;
}

export function StepContainer({
  step,
  totalSteps,
  title,
  subtitle,
  icon,
  iconColor,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  showBack = true,
  hideProgress = false,
  progressVariant = "full",
  animateCTA = false,
  ctaDelayMs = 260,
  ctaKey,
  children,
}: StepContainerProps) {
  const progress = totalSteps > 0 ? (step + 1) / totalSteps : 0;
  const progressPercent = Math.round(progress * 100);
  const accentColor = iconColor ?? colors.primary;

  const ctaOpacity = useSharedValue(animateCTA ? 0 : 1);
  const ctaScale = useSharedValue(animateCTA ? 0.92 : 1);

  useEffect(() => {
    if (!animateCTA) {
      ctaOpacity.value = 1;
      ctaScale.value = 1;
      return;
    }

    ctaOpacity.value = 0;
    ctaScale.value = 0.92;
    ctaOpacity.value = withDelay(
      ctaDelayMs,
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }),
    );
    ctaScale.value = withDelay(
      ctaDelayMs,
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [animateCTA, ctaDelayMs, ctaKey, ctaOpacity, ctaScale]);

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ scale: ctaScale.value }],
  }));

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View className="flex-1 bg-background pt-safe pb-safe">
        <View className="px-6 pt-2">
          {!hideProgress && (
            <View
              className={`mb-4 ${progressVariant === "bar" ? "" : "flex-row items-center gap-3"}`}
            >
              {progressVariant === "full" && (
                <Text className="text-muted font-sfPro text-sm">
                  Step {step + 1} of {totalSteps}
                </Text>
              )}
              <View
                className={`h-2 mt-1 rounded-full overflow-hidden ${
                  progressVariant === "bar" ? "w-full" : "flex-1"
                }`}
                style={{
                  backgroundColor: colors.outline,
                }}
              >
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </View>
              {progressVariant === "full" && (
                <Text
                  className="text-sm font-sfPro-semibold min-w-[2.5rem]"
                  style={{ color: accentColor }}
                >
                  {progressPercent}%
                </Text>
              )}
            </View>
          )}

          {/* Back link (optional) */}
          {showBack && onBack && (
            <TouchableOpacity
              onPress={onBack}
              hitSlop={12}
              activeOpacity={0.7}
              className="flex-row items-center mb-4"
            >
              <MaterialIcons
                name="chevron-left"
                size={24}
                color={colors.primary}
              />
              <Text className="text-primary font-sfPro-semibold text-base ml-1">
                Back
              </Text>
            </TouchableOpacity>
          )}

          {/* Centered icon circle (reference style) */}
          {icon && (
            <View className="items-center mb-4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center"
                style={{ backgroundColor: accentColor + "22" }}
              >
                <Ionicons name={icon as any} size={32} color={accentColor} />
              </View>
            </View>
          )}

          {/* Title + subtitle */}
          {title ? (
            <View className="mb-6">
              <Text className="text-2xl font-sfPro-bold text-foreground leading-tight">
                {title}
              </Text>
              {subtitle ? (
                <Text className="mt-2 text-muted font-sfPro text-base leading-6">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View className="flex-1 px-6">{children}</View>

        <View className="px-6 pb-6 pt-4">
          <Animated.View style={ctaAnimatedStyle}>
            <PrimaryButton
              title={nextLabel}
              onPress={onNext}
              disabled={nextDisabled}
            />
          </Animated.View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
