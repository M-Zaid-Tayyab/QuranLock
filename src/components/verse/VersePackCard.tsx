import { colors } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { PackState } from "./types";

interface VersePackCardProps {
  packState: PackState;
  packError: string | null;
  downloadProgress: number;
  onDownload: () => void;
}

export function VersePackCard({
  packState,
  packError,
  downloadProgress,
  onDownload,
}: VersePackCardProps) {
  return (
    <View className="mt-6 rounded-3xl border border-outline bg-surface px-6 py-8">
      <View className="items-center">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accent + "22" }}
        >
          <Ionicons name="cloud-download" size={24} color={colors.accent} />
        </View>
        <Text className="mt-4 text-xl font-sfPro-bold text-foreground">
          Quran download
        </Text>
        <Text className="mt-2 text-center text-sm font-sfPro text-muted">
          Download the Quran pack once so it works fully offline.
        </Text>
      </View>

      {packState === "downloading" && (
        <View className="mt-6 items-center">
          <ActivityIndicator color={colors.accent} />
          <Text className="mt-3 text-sm font-sfPro text-muted">
            {Math.round(downloadProgress * 100)}% complete
          </Text>
        </View>
      )}

      {packState === "error" && (
        <Text className="mt-4 text-center text-sm font-sfPro text-error">
          {packError ?? "Unable to download. Please try again."}
        </Text>
      )}

      {packState !== "downloading" && (
        <Pressable
          onPress={onDownload}
          className="mt-6 rounded-full bg-accent px-6 py-3"
        >
          <Text className="text-center text-base font-sfPro-bold text-black">
            {packState === "checking" ? "Checking…" : "Download now"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
