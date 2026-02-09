import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export interface Option {
  label: string;
  value: string;
  icon: string;
  color: string;
  description?: string;
}

interface OptionItemProps {
  option: Option;
  isSelected: boolean;
  onPress: (value: string) => void;
}

export function OptionItem({ option, isSelected, onPress }: OptionItemProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      className={`px-4 py-2 rounded-xl border-2 ${
        isSelected
          ? "bg-primaryContainer border-primary"
          : "bg-surface border-outline"
      }`}
      onPress={() => onPress(option.value)}
    >
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-4 bg-backgroundElevated"
          style={isSelected ? { backgroundColor: colors.primary + "33" } : undefined}
        >
          <Ionicons
            name={option.icon as any}
            size={20}
            color={isSelected ? colors.white : option.color}
          />
        </View>
        <View className="flex-1">
          <Text
            className={`text-lg font-sfPro-semibold ${
              isSelected ? "text-white" : "text-foreground"
            }`}
          >
            {option.label}
          </Text>
          {option.description && (
            <Text
              className={`text-sm font-sfPro mt-1 ${
                isSelected ? "text-white/80" : "text-muted"
              }`}
            >
              {option.description}
            </Text>
          )}
        </View>
        {isSelected && (
          <View
            className="w-6 h-6 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Ionicons name="checkmark" size={16} color={colors.white} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
