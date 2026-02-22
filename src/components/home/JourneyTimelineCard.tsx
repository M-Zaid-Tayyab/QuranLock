import { colors } from "@/constants/colors";
import { useFunnelText } from "@/hooks/app";
import type { HomeTimelineItem } from "@/hooks/home";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface JourneyTimelineCardProps {
  items: HomeTimelineItem[];
  nextFocusLabel: string;
  onManageTimes: () => void;
}

const statusAccent = (status: HomeTimelineItem["status"]) => {
  if (status === "completed") return colors.success;
  if (status === "pending") return colors.warning;
  if (status === "premium_locked") return colors.accent;
  return colors.muted;
};

const statusLabel = (status: HomeTimelineItem["status"]) => {
  if (status === "completed") return "Done";
  if (status === "pending") return "Now";
  if (status === "premium_locked") return "Pro";
  return "Upcoming";
};

const statusIcon = (
  status: Exclude<HomeTimelineItem["status"], "premium_locked">,
) => {
  if (status === "completed") return "checkmark-circle-outline";
  if (status === "pending") return "time-outline";
  return "ellipse-outline";
};

export function JourneyTimelineCard({
  items,
  nextFocusLabel,
  onManageTimes,
}: JourneyTimelineCardProps) {
  const funnelText = useFunnelText();
  return (
    <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={18} color={colors.accent} />
          <Text className="text-lg font-sfPro-semibold text-foreground">
            {funnelText.home.timelineTitle}
          </Text>
        </View>
        <Pressable
          onPress={onManageTimes}
          className="rounded-full border border-outline bg-backgroundElevated px-3 py-1.5"
        >
          <View className="flex-row items-center gap-1">
            <Text className="text-xs font-sfPro-semibold text-foreground">Manage</Text>
            <Ionicons name="chevron-forward" size={12} color={colors.muted} />
          </View>
        </Pressable>
      </View>
      <View className="mt-1 flex-row items-center gap-1.5">
        <Ionicons name="navigate-outline" size={13} color={colors.muted} />
        <Text className="text-sm font-sfPro text-muted">{nextFocusLabel}</Text>
      </View>

      <View className="mt-4 gap-3">
        {items.map((item) => (
          <View
            key={item.id}
            className="rounded-xl border border-outline bg-backgroundElevated px-4 py-3"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="font-sfPro-semibold text-foreground">{item.label}</Text>
                <View className="mt-1 flex-row items-center gap-2">
                  <Ionicons name="alarm-outline" size={12} color={colors.muted} />
                  <Text className="text-xs font-sfPro text-muted">{item.timeLabel}</Text>
                  <Ionicons name="timer-outline" size={12} color={colors.muted} />
                  <Text className="text-xs font-sfPro text-muted">
                    {item.durationMinutes} min
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2">
                {item.status === "premium_locked" ? (
                  <MaterialCommunityIcons
                    name="crown"
                    size={16}
                    color={statusAccent(item.status)}
                  />
                ) : (
                  <Ionicons
                    name={statusIcon(item.status)}
                    size={16}
                    color={statusAccent(item.status)}
                  />
                )}
                <Text
                  className="text-xs font-sfPro-semibold"
                  style={{ color: statusAccent(item.status) }}
                >
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
