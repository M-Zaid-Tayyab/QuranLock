import { PrimaryButton } from "@/components/common";
import { colors } from "@/constants/colors";
import { useRouter, type Href } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
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

  const heroText =
    "Reconnect with Allah, step away from endless scrolling, and sit with his talk to you again.";
  const heroWords = heroText.split(" ");
  const highlightedWords = ["allah", "talk"];

  const [heroFinished, setHeroFinished] = useState(false);

  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.9);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    const heroWordDelay = 160;
    const heroWordDuration = 260;

    const totalHeroDuration =
      heroWords.length * heroWordDelay + heroWordDuration;

    const buttonStart = totalHeroDuration + 80;

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

    const heroFinishedTimeout = setTimeout(() => {
      setHeroFinished(true);
    }, buttonStart + 260);

    return () => {
      clearTimeout(heroFinishedTimeout);
    };
  }, [buttonOpacity, buttonScale, heroWords.length]);

  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      <View className="flex-1 px-8 pt-8 pb-8">
        <View pointerEvents="none" className="absolute inset-0">
          <View
            className="absolute -top-24 -left-16 h-64 w-64 rounded-full"
            style={{ backgroundColor: colors.primary, opacity: 0.18 }}
          />
          <View
            className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full"
            style={{ backgroundColor: colors.accent, opacity: 0.12 }}
          />
        </View>

        {/* Hero copy */}
        <View className="flex-1 justify-center">
          <Animated.View
            entering={FadeInDown.delay(40)
              .duration(240)
              .easing(Easing.out(Easing.cubic))}
            className="self-start rounded-full border px-3 py-1"
            style={{
              borderColor: colors.primary,
              backgroundColor: "rgba(13, 148, 136, 0.15)",
            }}
          >
            <Text className="text-xs font-sfPro-semibold tracking-widest text-primary">
              QURANLOCK
            </Text>
          </Animated.View>

          <View className="mt-5">
            <View className="flex-row flex-wrap max-w-[320px]">
              {heroWords.map((word, index) => (
                <Animated.Text
                  key={`${word}-${index}`}
                  entering={FadeInDown.delay(index * 160)
                    .duration(260)
                    .easing(Easing.out(Easing.cubic))}
                  className="text-4xl font-sfPro-bold leading-tight"
                  style={{
                    letterSpacing: 0.8,
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

        {/* CTA */}
        <Animated.View style={buttonAnimatedStyle}>
          <View className="pt-4">
            <PrimaryButton
              title="Begin"
              onPress={() => router.replace("/onboarding" as Href)}
              disabled={!heroFinished}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
