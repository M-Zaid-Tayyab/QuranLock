import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { stopFocusSession } from "@/services/deviceActivity";

export default function ActiveSessionScreen() {
  const router = useRouter();
  const { duration } = useLocalSearchParams<{ duration?: string }>();
  const minutes = duration ? parseInt(duration, 10) : 30;

  const handleEndEarly = useCallback(() => {
    stopFocusSession();
    router.replace("/home" as Href);
  }, [router]);

  const handleOpenVerse = useCallback(() => {
    Linking.openURL("quranlock://verse");
  }, []);

  return (
    <View className="flex-1 bg-background px-6 pt-6">
      <Text className="mb-2 text-center text-2xl font-bold text-foreground">Session active</Text>
      <Text className="mb-8 text-center text-muted">
        Focus for {minutes} minutes. If you open a blocked app, tap the notification to open a
        Quran verse.
      </Text>
      <View className="mb-4">
        <Pressable onPress={handleOpenVerse} className="rounded-lg bg-primary py-3 active:opacity-90">
          <Text className="text-center font-semibold text-primaryForeground">Open Quran verse</Text>
        </Pressable>
      </View>
      <Pressable onPress={handleEndEarly} className="rounded-lg border border-border py-3 active:opacity-90">
        <Text className="text-center text-muted">End session early</Text>
      </Pressable>
    </View>
  );
}
