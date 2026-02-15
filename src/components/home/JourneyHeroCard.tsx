import { PrimaryButton } from "@/components/common";
import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

interface JourneyHeroCardProps {
  title: string;
  subtitle: string;
  progressPercent: number;
  pagesRead: number;
  pagesTotal: number;
  requiredMinutes: number;
  onPressRead: () => void;
}

export function JourneyHeroCard({
  title,
  subtitle,
  progressPercent,
  pagesRead,
  pagesTotal,
  requiredMinutes,
  onPressRead,
}: JourneyHeroCardProps) {
  return (
    <View className="mb-6 rounded-3xl border border-outline bg-surface px-6 py-6">
      <View className="items-center">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accent + "22" }}
        >
          <Ionicons name="bar-chart-outline" size={24} color={colors.accent} />
        </View>
        <Text className="mt-4 text-2xl font-sfPro-bold text-foreground">{title}</Text>
        <Text className="mt-1 text-sm font-sfPro text-muted">{subtitle}</Text>
      </View>

      <View className="mt-5">
        <View className="h-2 rounded-full bg-backgroundElevated">
          <View
            className="h-2 rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="book-outline" size={13} color={colors.muted} />
            <Text className="text-xs font-sfPro text-muted">
              {pagesRead}/{pagesTotal} pages
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="trending-up-outline" size={13} color={colors.primary} />
            <Text className="text-xs font-sfPro-semibold text-foreground">
              {Math.min(100, Math.max(0, progressPercent))}%
            </Text>
          </View>
        </View>
      </View>

      <PrimaryButton
        title={requiredMinutes > 0 ? "Continue Reading" : "Bismillah, Let's Read"}
        onPress={onPressRead}
        className="mt-5"
      />
    </View>
  );
}
