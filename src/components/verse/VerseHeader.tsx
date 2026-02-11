import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface VerseHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  onOpenSettings: () => void;
}

export function VerseHeader({
  title,
  subtitle,
  onBack,
  onOpenSettings,
}: VerseHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-6 pb-3 pt-4">
      <Pressable
        onPress={onBack}
        className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
      >
        <Ionicons name="chevron-back" size={22} color={colors.muted} />
      </Pressable>
      <View className="flex-1 items-center">
        <Text className="text-base font-sfPro-semibold text-foreground">{title}</Text>
        <Text className="text-xs font-sfPro text-muted">{subtitle}</Text>
      </View>
      <Pressable
        onPress={onOpenSettings}
        className="h-10 w-10 items-center justify-center rounded-full border border-outline bg-surface"
      >
        <Ionicons name="options-outline" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}
