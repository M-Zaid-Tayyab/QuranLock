import { PrimaryButton } from "@/components/common";
import { IMAGES } from "@/constants";
import { colors, rgba } from "@/constants/colors";
import { useFunnelText } from "@/hooks/app";
import { Stack, useRouter, type Href } from "expo-router";
import React, { useEffect } from "react";
import { Image, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export default function Welcome() {
  const router = useRouter();
  const funnelText = useFunnelText();
  const onboardingHref: Href = "/onboarding";

  const heroText = funnelText.welcome.heroText;
  const heroWords = heroText.split(" ");
  const highlightedWords = funnelText.welcome.highlightedWords;

  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.92);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    const buttonStart = 360;

    buttonOpacity.value = withDelay(
      buttonStart,
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }),
    );
    buttonScale.value = withDelay(
      buttonStart,
      withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [buttonOpacity, buttonScale]);

  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      <Stack.Screen options={{ animation: "fade" }} />

      <View className="flex-1 px-8 pt-8 pb-8">
        <View pointerEvents="none" className="absolute inset-0">
          <View
            className="absolute -top-16 -left-12 h-48 w-48 rounded-full"
            style={{ backgroundColor: colors.primary, opacity: 0.09 }}
          />
          <View
            className="absolute -bottom-28 -right-16 h-56 w-56 rounded-full"
            style={{ backgroundColor: colors.accent, opacity: 0.06 }}
          />
        </View>

        <View className="flex-1 justify-center">
          <Animated.View
            entering={FadeInDown.delay(40)
              .duration(240)
              .easing(Easing.out(Easing.cubic))}
            className="items-center"
          >
            <View
              className="h-32 w-32 items-center justify-center rounded-[2rem]"
              style={{
                backgroundColor: rgba(colors.primary, 0.14),
                borderColor: rgba(colors.primary, 0.42),
                borderWidth: 1,
                shadowColor: colors.black,
                shadowOpacity: 0.24,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 12 },
              }}
            >
              <Image
                source={IMAGES.ICON}
                resizeMode="contain"
                className="h-28 w-28 rounded-[1.5rem]"
              />
            </View>
            <Text
              className="mt-3 text-[11px] font-sfPro-semibold tracking-widest"
              style={{ color: colors.primaryVariant }}
            >
              QURAN LOCK
            </Text>
          </Animated.View>

          <View className="mt-8 self-center">
            <View className="flex-row flex-wrap max-w-[344px] items-center justify-center">
              {heroWords.map((word, index) => (
                <Animated.Text
                  key={`${word}-${index}`}
                  entering={FadeInDown.delay(120 + index * 140)
                    .duration(260)
                    .easing(Easing.out(Easing.cubic))}
                  className="text-center font-sfPro-bold"
                  style={{
                    fontSize: 32,
                    lineHeight: 49,
                    letterSpacing: 0.35,
                    color: highlightedWords.includes(
                      word.replace(/[^a-z]/gi, "").toLowerCase(),
                    )
                      ? colors.accent
                      : colors.white,
                  }}
                >
                  {word}
                  {index < heroWords.length - 1 ? " " : ""}
                </Animated.Text>
              ))}
            </View>
          </View>
        </View>

        <Animated.View style={buttonAnimatedStyle}>
          <View className="pt-4">
            <PrimaryButton
              title="Bismillah, Let's Start"
              onPress={() => router.replace(onboardingHref)}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
