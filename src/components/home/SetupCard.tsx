import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface SetupCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBackground: string;
  title: string;
  description: string;
  ctaLabel: string;
  onPress: () => void;
}

export function SetupCard({
  icon,
  iconColor,
  iconBackground,
  title,
  description,
  ctaLabel,
  onPress,
}: SetupCardProps) {
  return (
    <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
      <View className="flex-row items-center gap-3">
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBackground }}
        >
          <Ionicons name={icon} size={22} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="font-sfPro-semibold text-foreground">{title}</Text>
          <Text className="mt-1 text-sm font-sfPro text-muted">{description}</Text>
        </View>
      </View>
      <Pressable onPress={onPress} className="mt-4 rounded-full bg-primary px-4 py-2">
        <View className="flex-row items-center justify-center gap-1">
          <Text className="text-center text-sm font-sfPro-semibold text-primaryForeground">
            {ctaLabel}
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#ffffff" />
        </View>
      </Pressable>
    </View>
  );
}
