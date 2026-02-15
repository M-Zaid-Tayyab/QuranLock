import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

interface PermissionsCardProps {
  needsScreenTime: boolean;
  needsNotifications: boolean;
  requestingScreenTime: boolean;
  onRequestScreenTime: () => void;
  onRequestNotifications: () => void;
}

export function PermissionsCard({
  needsScreenTime,
  needsNotifications,
  requestingScreenTime,
  onRequestScreenTime,
  onRequestNotifications,
}: PermissionsCardProps) {
  if (!needsScreenTime && !needsNotifications) return null;

  return (
    <View className="mb-6 rounded-2xl border border-outline bg-surface px-5 py-5">
      <View className="flex-row items-center gap-2">
        <Ionicons name="key-outline" size={17} color={colors.accent} />
        <Text className="font-sfPro-semibold text-foreground">Permissions</Text>
      </View>
      <View className="mt-4 gap-3">
        {needsScreenTime && (
          <View className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3">
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={colors.primary}
              />
              <Text className="font-sfPro text-sm text-foreground">Screen Time access</Text>
            </View>
            <Pressable
              onPress={onRequestScreenTime}
              className="rounded-full bg-primary/20 px-3 py-1.5"
            >
              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-sfPro-semibold text-foreground">
                  {requestingScreenTime ? "..." : "Allow"}
                </Text>
                {!requestingScreenTime ? (
                  <Ionicons name="chevron-forward" size={12} color={colors.muted} />
                ) : null}
              </View>
            </Pressable>
          </View>
        )}
        {needsNotifications && (
          <View className="flex-row items-center justify-between rounded-xl border border-outline bg-backgroundElevated px-4 py-3">
            <View className="flex-row items-center gap-3">
              <Ionicons
                name="notifications-outline"
                size={18}
                color={colors.primary}
              />
              <Text className="font-sfPro text-sm text-foreground">Notifications</Text>
            </View>
            <Pressable
              onPress={onRequestNotifications}
              className="rounded-full bg-primary/20 px-3 py-1.5"
            >
              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-sfPro-semibold text-foreground">Enable</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.muted} />
              </View>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
