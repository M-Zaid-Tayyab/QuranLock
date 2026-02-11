import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface HomeHeaderProps {
  greeting: string;
  name: string;
  onOpenSettings: () => void;
}

export function HomeHeader({ greeting, name, onOpenSettings }: HomeHeaderProps) {
  return (
    <View className="mb-6 flex-row items-center justify-between">
      <View>
        <View className="flex-row items-center gap-2">
          <Ionicons name="moon-outline" size={15} color={colors.muted} />
          <Text className="text-base font-sfPro text-muted">{greeting}</Text>
        </View>
        <Text className="mt-1 text-4xl font-sfPro-bold text-foreground">{name}</Text>
      </View>
      <Pressable
        onPress={onOpenSettings}
        className="h-12 w-12 items-center justify-center rounded-full border border-outline bg-surface"
      >
        <Ionicons name="settings-outline" size={22} color={colors.muted} />
      </Pressable>
    </View>
  );
}
