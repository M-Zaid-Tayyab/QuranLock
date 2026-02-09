import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { Option, OptionItem } from "./OptionItem";
import Animated, {
  Easing,
  FadeInDown,
} from "react-native-reanimated";

export interface QuestionCardData {
  question: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  options: Option[];
}

interface QuestionCardSingleProps {
  question: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  options: Option[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
}

interface QuestionCardMultiProps {
  question: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  options: Option[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

export type QuestionCardProps = QuestionCardSingleProps | (QuestionCardMultiProps & { multiSelect: true });

function isMultiSelect(props: QuestionCardProps): props is QuestionCardMultiProps & { multiSelect: true } {
  return "multiSelect" in props && props.multiSelect === true;
}

export function QuestionCard(props: QuestionCardProps) {
  const { question, subtitle, icon, iconColor, options } = props;
  const questionWords = question.split(" ");

  return (
    <View className="w-full">
      <View className="items-center mb-6">
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
          className="text-muted text-center font-sfPro text-base leading-6 max-w-xs"
        >
          {subtitle}
        </Animated.Text>
      </View>

      <View className="gap-4">
        {options.map((option, index) => {
          const isSelected = isMultiSelect(props)
            ? props.selectedValues.includes(option.value)
            : props.selectedValue === option.value;
          const onPress = isMultiSelect(props)
            ? () => props.onToggle(option.value)
            : () => props.onSelect(option.value);
          return (
            <Animated.View
              key={option.value}
              entering={FadeInDown.delay(120 + index * 80)
                .duration(240)
                .easing(Easing.out(Easing.cubic))}
            >
              <OptionItem
                option={option}
                isSelected={isSelected}
                onPress={onPress}
              />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
