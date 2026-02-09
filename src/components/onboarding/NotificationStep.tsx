import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

export function NotificationStep() {
  const [status, setStatus] = useState<"undetermined" | "granted" | "denied" | null>(null);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status: s }) => {
      setStatus(s === "granted" ? "granted" : s === "denied" ? "denied" : "undetermined");
    });
  }, []);

  const request = useCallback(async () => {
    const { status: s } = await Notifications.requestPermissionsAsync();
    setStatus(s === "granted" ? "granted" : "denied");
  }, []);

  if (status === "granted") {
    return (
      <View className="flex-1 justify-center">
        <Text className="text-center font-sfPro text-textPrimary">
          Notifications allowed. Tap Continue to finish.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center">
      <Text className="mb-4 text-center font-sfPro text-textSecondary">
        Allow notifications so we can send you a reminder to open a Quran verse when you tap the shield.
      </Text>
      <Pressable
        onPress={request}
        className="rounded-lg bg-primary py-3 active:opacity-90"
      >
        <Text className="text-center font-sfPro-semibold text-onPrimary">
          Enable notifications
        </Text>
      </Pressable>
    </View>
  );
}
