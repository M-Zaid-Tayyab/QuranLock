import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
} from "react-native-reanimated";

interface TextInputQuestionProps {
  question: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "numeric" | "default";
  maxLength?: number;
  unitLabel?: string;
  error?: string;
}

const largeInputStyle = StyleSheet.create({
  input: {
    fontSize: 48,
    fontFamily: Platform.OS === "ios" ? "SFProText-Bold" : "SF-Pro-Text-Bold",
    width: "100%",
    textAlign: "center",
    color: colors.textPrimary,
    paddingVertical: 8,
  },
});

export function TextInputQuestion({
  question,
  subtitle,
  icon,
  iconColor,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  maxLength,
  unitLabel,
  error,
}: TextInputQuestionProps) {
  const questionWords = question.split(" ");

  return (
    <View className="items-center w-full flex-1">
      <Animated.View
        entering={FadeInDown.delay(40)
          .duration(220)
          .easing(Easing.out(Easing.cubic))}
        className="w-16 h-16 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: colors.primary + "22" }}
      >
        <Ionicons name={icon as any} size={32} color={iconColor} />
      </Animated.View>

      <View className="items-center px-2 mb-2">
        <View className="flex-row flex-wrap justify-center max-w-[320px]">
          {questionWords.map((word, index) => (
            <Animated.Text
              key={`${word}-${index}`}
              entering={FadeInDown.delay(index * 120)
                .duration(220)
                .easing(Easing.out(Easing.cubic))}
              className="text-2xl font-sfPro-bold text-foreground leading-tight"
              style={{ letterSpacing: 0.4 }}
            >
              {word}
              {index < questionWords.length - 1 ? " " : ""}
            </Animated.Text>
          ))}
        </View>
      </View>

      <Animated.Text
        entering={FadeInDown.delay(140)
          .duration(220)
          .easing(Easing.out(Easing.cubic))}
        className="text-muted text-center font-sfPro text-base leading-6 max-w-xs mb-8"
      >
        {subtitle}
      </Animated.Text>

      <Animated.View
        entering={FadeInDown.delay(200)
          .duration(240)
          .easing(Easing.out(Easing.cubic))}
        className="items-center w-full"
      >
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          maxLength={maxLength}
          cursorColor={colors.primary}
          autoFocus
          style={largeInputStyle.input}
        />
        {unitLabel ? (
          <Text className="text-foreground text-center font-sfPro-semibold text-lg mt-1">
            {unitLabel}
          </Text>
        ) : null}
        {error ? (
          <Text className="text-error font-sfPro text-sm mt-2">{error}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}
